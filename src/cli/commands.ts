/**
 * CLI command handlers for Zentext Phase 2 read/inspect + Phase 3 repack commands.
 *
 * Each handler returns a string to print. Errors are thrown with a message
 * and an exitCode property so the entry point can exit cleanly.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { AnyRecord, RecordType } from "../types/records.js";
import { RECORD_TYPES } from "../types/records.js";
import { SqliteStore, StoreNotFoundError } from "../store/sqlite-store.js";
import { deriveProjectId } from "../store/project-id.js";
import { formatInit, formatStatus, formatRecord, formatList, formatHandoff } from "./format.js";
import {
  buildHandoff,
  handoffToCreateInput,
  isHandoffCurrent,
  recordToHandoff,
  renderAcknowledgement,
  HandoffValidationError,

  type StructuredHandoff,
} from "../handoff.js";
import { createMemoryWriter, MemoryWriterConflictError } from "../domain/memory-writer.js";
import { repack as repackEngine } from "../repack/engine.js";
import {
  buildContinuationView,
  ContinuationInvalidError,
  ContinuationNotFoundError,
  ContinuationStaleError,
} from "../continuation.js";
import {
  renderContinuation,
  renderStaleContinuation,
  type ContinuationFormat,
} from "../continuation-format.js";
import {
  renderEnvironmentContinuation,
  resolveEnvironmentFormatterId,
  UnsupportedEnvironmentFormatterError,
  type EnvironmentFormatterId,
} from "../environment-formatters.js";
import type { FlagValue } from "./args.js";
import { validateHandoffQuality } from "../handoff-quality.js";
import { redactForOutput } from "../safety.js";
import { openMemoryStore } from "../memory-interface.js";
import {
  renderMemorySearch,
  type MemorySearchInput,
} from "../memory-search.js";
import { ZentextError } from "../errors.js";

export class CliError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number,
  ) {
    super(message);
    this.name = "CliError";
  }
}

export function parseContinuationFormat(
  flags: Record<string, FlagValue>,
): ContinuationFormat {
  const supported = new Set(["json", "markdown", "prompt"]);
  const unsupported = Object.keys(flags).filter((key) => !supported.has(key));
  if (unsupported.length > 0) {
    throw new CliError(`Unsupported option for zentext continue: --${unsupported[0]}`, 1);
  }

  const modes = (["json", "markdown", "prompt"] as const).filter((key) => {
    const value = flags[key];
    if (value !== undefined && value !== true) {
      throw new CliError(`--${key} does not accept a value`, 1);
    }
    return value === true;
  });
  if (modes.length > 1) {
    throw new CliError(
      "Choose only one continuation output mode: --json, --markdown, or --prompt",
      1,
    );
  }
  return modes[0] ?? "human";
}

export interface ParsedContinuationOptions {
  format: ContinuationFormat;
  environment?: EnvironmentFormatterId;
  compact: boolean;
  includeInstructions: boolean;
}

export function parseContinuationOptions(
  flags: Record<string, FlagValue>,
): ParsedContinuationOptions {
  const presentationKeys = new Set(["for", "compact", "include-instructions"]);
  const formatFlags = Object.fromEntries(
    Object.entries(flags).filter(([key]) => !presentationKeys.has(key)),
  );
  const format = parseContinuationFormat(formatFlags);
  const requested = flags.for;
  const compact = flags.compact;
  const includeInstructions = flags["include-instructions"];

  for (const [name, value] of [
    ["compact", compact],
    ["include-instructions", includeInstructions],
  ] as const) {
    if (value !== undefined && value !== true) {
      throw new CliError(`--${name} does not accept a value`, 1);
    }
  }

  if (requested === undefined) {
    if (compact === true || includeInstructions === true) {
      throw new CliError(
        "--compact and --include-instructions require --for <environment>",
        1,
      );
    }
    return { format, compact: false, includeInstructions: false };
  }
  if (typeof requested !== "string" || requested.trim() === "") {
    throw new CliError(
      "Usage: zentext continue --for <generic|codex|claude-code|ollama-host>",
      1,
    );
  }
  if (format !== "human") {
    throw new CliError(
      "--for cannot be combined with --json, --markdown, or --prompt",
      1,
    );
  }

  try {
    return {
      format,
      environment: resolveEnvironmentFormatterId(requested),
      compact: compact === true,
      includeInstructions: includeInstructions === true,
    };
  } catch (error) {
    if (error instanceof UnsupportedEnvironmentFormatterError) {
      throw new CliError(error.message, 1);
    }
    throw error;
  }
}

export type HandoffExportFormat = "json" | "markdown" | "prompt";

export function parseHandoffExportFormat(
  flags: Record<string, FlagValue>,
): HandoffExportFormat {
  const unsupported = Object.keys(flags).filter((key) => key !== "format");
  if (unsupported.length > 0) {
    throw new CliError(
      `Unsupported option for zentext handoff export: --${unsupported[0]}`,
      1,
    );
  }
  const format = flags.format;
  if (typeof format !== "string") {
    throw new CliError(
      "Usage: zentext handoff export --format <json|markdown|prompt>",
      1,
    );
  }
  if (!(["json", "markdown", "prompt"] as const).includes(format as HandoffExportFormat)) {
    throw new CliError(
      `Unsupported handoff export format '${format}'. Choose json, markdown, or prompt.`,
      1,
    );
  }
  return format as HandoffExportFormat;
}

function getStoreDbPath(cwd: string): string {
  const projectId = deriveProjectId(cwd);
  return join(homedir(), ".zentext", "projects", projectId, "store.sqlite");
}

function storeExists(cwd: string): boolean {
  return existsSync(getStoreDbPath(cwd));
}



async function getLatestHandoffStructured(cwd: string): Promise<StructuredHandoff> {
  const store = await openStore(cwd);
  try {
    const handoffs = store
      .listRecords({ type: "handoff", status: "latest" })
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime() || a.id.localeCompare(b.id));
    const latest = handoffs[0];
    if (!latest) {
      throw new CliError("No latest handoff found. Create one with `zentext handoff create`.", 3);
    }
    return recordToHandoff(latest);
  } finally {
    store.close();
  }
}

async function openStore(cwd: string): Promise<SqliteStore> {
  const store = new SqliteStore();
  try {
    await store.openProjectStore(cwd);
    return store;
  } catch (err) {
    store.close();
    if (err instanceof StoreNotFoundError) {
      throw new CliError(
        "No Zentext store found for this project. Run `zentext init` first.",
        2,
      );
    }
    throw new CliError(
      `Could not open store: ${err instanceof Error ? err.message : String(err)}`,
      5,
    );
  }
}

export async function init(cwd: string): Promise<{ output: string; exitCode: number }> {
  const existed = storeExists(cwd);
  const store = new SqliteStore();
  try {
    const meta = await store.initProjectStore(cwd);
    return {
      output: formatInit({
        projectName: meta.projectName,
        projectId: meta.projectId,
        storePath: meta.storePath,
        schemaVersion: meta.schemaVersion,
        created: !existed,
      }),
      exitCode: 0,
    };
  } catch (err) {
    throw new CliError(
      `Could not initialize store: ${err instanceof Error ? err.message : String(err)}`,
      5,
    );
  } finally {
    store.close();
  }
}

export async function status(cwd: string): Promise<{ output: string; exitCode: number }> {
  const store = await openStore(cwd);
  try {
    const meta = await store.openProjectStore(cwd);
    const all = store.listRecords();

    const recordCounts = Object.fromEntries(
      RECORD_TYPES.map((type) => [type, 0]),
    ) as Record<RecordType, number>;

    let openBlockers = 0;
    let activeTasks = 0;
    let latestHandoff: AnyRecord | null = null;
    let latestValidation: AnyRecord | null = null;
    let lastUpdatedAt: string | null = null;

    for (const record of all) {
      recordCounts[record.type] += 1;

      if (record.type === "blocker" && record.status === "open") {
        openBlockers += 1;
      }
      if (record.type === "task" && record.status === "active") {
        activeTasks += 1;
      }
      if (record.type === "handoff" && record.status === "latest") {
        if (!latestHandoff || record.updated_at > latestHandoff.updated_at) {
          latestHandoff = record;
        }
      }
      if (record.type === "validation") {
        if (!latestValidation || record.updated_at > latestValidation.updated_at) {
          latestValidation = record;
        }
      }

      if (!lastUpdatedAt || record.updated_at > lastUpdatedAt) {
        lastUpdatedAt = record.updated_at;
      }
    }

    return {
      output: formatStatus({
        projectName: meta.projectName,
        projectId: meta.projectId,
        storePath: meta.storePath,
        schemaVersion: meta.schemaVersion,
        recordCounts,
        openBlockers,
        activeTasks,
        latestHandoff,
        latestValidation,
        lastUpdatedAt,
      }),
      exitCode: 0,
    };
  } finally {
    store.close();
  }
}

export async function show(cwd: string, id: string): Promise<{ output: string; exitCode: number }> {
  const store = await openStore(cwd);
  try {
    const record = store.getRecord(id);
    if (!record) {
      throw new CliError(`Record not found: ${id}`, 3);
    }
    return { output: formatRecord(record), exitCode: 0 };
  } finally {
    store.close();
  }
}

export async function list(
  cwd: string,
  options: { type?: string; status?: string; limit?: number },
): Promise<{ output: string; exitCode: number }> {
  const store = await openStore(cwd);
  try {
    const filter = {
      ...(options.type ? { type: options.type as RecordType } : {}),
      ...(options.status ? { status: options.status } : {}),
      ...(options.limit !== undefined ? { limit: options.limit } : {}),
    };

    const records = store.listRecords(filter);
    const rows = records.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      title: r.title,
      updated_at: r.updated_at,
    }));

    return { output: formatList(rows), exitCode: 0 };
  } finally {
    store.close();
  }
}

export async function search(
  cwd: string,
  options: MemorySearchInput & { json?: boolean },
): Promise<{ output: string; exitCode: number }> {
  let memory: Awaited<ReturnType<typeof openMemoryStore>> | undefined;
  try {
    memory = await openMemoryStore({ cwd });
    const { json = false, ...input } = options;
    const page = await memory.searchMemory(input);
    return {
      output: json ? JSON.stringify(page, null, 2) : renderMemorySearch(page),
      exitCode: 0,
    };
  } catch (error) {
    if (error instanceof ZentextError) {
      const exitCode =
        error.code === "PROJECT_NOT_FOUND"
          ? 2
          : ["INVALID_INPUT", "UNSAFE_INPUT", "SECRET_DETECTED"].includes(error.code)
            ? 1
            : 5;
      throw new CliError(error.message, exitCode);
    }
    throw error;
  } finally {
    memory?.close();
  }
}


export async function repack(
  cwd: string,
  options: { focus?: string; maxSize?: number; out?: string },
): Promise<{ output: string; exitCode: number }> {
  if (options.maxSize !== undefined && (!Number.isFinite(options.maxSize) || options.maxSize <= 0)) {
    throw new CliError("--max-size must be a positive number", 1);
  }

  const store = await openStore(cwd);
  try {
    const meta = await store.openProjectStore(cwd);
    const result = repackEngine(store, meta, {
      focus: options.focus,
      maxSize: options.maxSize,
    });
    const safeMarkdown = redactForOutput(result.markdown);

    if (options.out) {
      mkdirSync(dirname(options.out), { recursive: true });
      writeFileSync(options.out, safeMarkdown, "utf8");
    }

    return { output: safeMarkdown, exitCode: 0 };
  } finally {
    store.close();
  }
}


export async function handoffShow(
  cwd: string,
  options: { json?: boolean } = {},
): Promise<{ output: string; exitCode: number }> {
  const handoff = await getLatestHandoffStructured(cwd);
  const store = await openStore(cwd);
  try {
    const current = isHandoffCurrent(handoff, store);
    if (!current.current) {
      if (options.json) {
        return {
          output: formatHandoff(handoff as unknown as Record<string, unknown>, {
            json: true,
            current: false,
            staleReason: current.reason,
          }),
          exitCode: 4,
        };
      }
      return {
        output: formatHandoff(handoff as unknown as Record<string, unknown>, {
          current: false,
          staleReason: current.reason,
        }),
        exitCode: 4,
      };
    }
    return {
      output: formatHandoff(handoff as unknown as Record<string, unknown>, { json: options.json }),
      exitCode: 0,
    };
  } finally {
    store.close();
  }
}

export async function handoffAcknowledge(
  cwd: string,
  options: { json?: boolean } = {},
): Promise<{ output: string; exitCode: number }> {
  const store = await openStore(cwd);
  try {
    const handoffs = store
      .listRecords({ type: "handoff", status: "latest" })
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime() ||
          a.id.localeCompare(b.id),
      );
    const latest = handoffs[0];
    if (!latest) {
      throw new CliError(
        "No latest handoff found. Create one with `zentext handoff create`.",
        3,
      );
    }
    const handoff = recordToHandoff(latest);
    const current = isHandoffCurrent(handoff, store);
    if (!current.current) {
      const payload = {
        acknowledged: false,
        current: false,
        reason: current.reason,
        task_id: handoff.active_task.id,
        handoff_revision: current.handoffRevision,
        live_revision: current.liveRevision,
      };
      const output = options.json
        ? JSON.stringify(payload, null, 2)
        : [
            "Handoff rejected: the recorded handoff is stale and must be regenerated.",
            "",
            `Reason: ${current.reason}`,
            `Task ID: ${handoff.active_task.id}`,
            `Handoff revision: ${current.handoffRevision}`,
            `Live revision: ${current.liveRevision}`,
            "",
            "Run `zentext handoff create` to produce a current handoff before continuing.",
          ].join("\n");
      return { output, exitCode: 4 };
    }

    const ack = renderAcknowledgement(handoff, options.json ? "json" : "human");
    const output = options.json ? JSON.stringify(ack, null, 2) : String(ack);
    return { output, exitCode: 0 };
  } finally {
    store.close();
  }
}

export async function handoffValidate(
  cwd: string,
  options: { json?: boolean } = {},
): Promise<{ output: string; exitCode: number }> {
  const handoff = await getLatestHandoffStructured(cwd);
  const store = await openStore(cwd);
  try {
    const current = isHandoffCurrent(handoff, store);
    if (current.current) {
      const message = options.json
        ? JSON.stringify({ current: true, task_id: handoff.active_task.id, task_revision: handoff.active_task.revision }, null, 2)
        : `Handoff is current (task ${handoff.active_task.id} at revision ${handoff.active_task.revision}).`;
      return { output: message, exitCode: 0 };
    }
    const message = options.json
      ? JSON.stringify(
          {
            current: false,
            reason: current.reason,
            task_id: handoff.active_task.id,
            handoff_revision: current.handoffRevision,
            live_revision: current.liveRevision,
          },
          null,
          2,
        )
      : `Handoff is stale: ${current.reason} (handoff revision ${current.handoffRevision}, live revision ${current.liveRevision}).`;
    return { output: message, exitCode: 4 };
  } finally {
    store.close();
  }
}

export async function continueProject(
  cwd: string,
  options: {
    format?: ContinuationFormat;
    environment?: EnvironmentFormatterId;
    compact?: boolean;
    includeInstructions?: boolean;
  } = {},
): Promise<{ output: string; exitCode: number }> {
  const format = options.format ?? "human";
  const store = await openStore(cwd);
  try {
    const meta = await store.openProjectStore(cwd);
    try {
      const view = buildContinuationView(store, meta);
      return {
        output: options.environment
          ? renderEnvironmentContinuation(view, options.environment, {
              compact: options.compact,
              includeInstructions: options.includeInstructions,
            })
          : renderContinuation(view, format),
        exitCode: 0,
      };
    } catch (error) {
      if (error instanceof ContinuationStaleError) {
        return {
          output: renderStaleContinuation(error, format),
          exitCode: 4,
        };
      }
      if (error instanceof ContinuationNotFoundError) {
        throw new CliError(error.message, 3);
      }
      if (error instanceof ContinuationInvalidError) {
        throw new CliError(error.message, 5);
      }
      throw error;
    }
  } finally {
    store.close();
  }
}

export async function handoffExport(
  cwd: string,
  options: { format: HandoffExportFormat },
): Promise<{ output: string; exitCode: number }> {
  return continueProject(cwd, { format: options.format });
}

export async function taskCreate(
  cwd: string,
  options: {
    title: string;
    goal?: string;
    summary?: string;
    status?: string;
    author?: string;
  },
): Promise<{ output: string; exitCode: number }> {
  const store = await openStore(cwd);
  let writer: ReturnType<typeof createMemoryWriter> | undefined;
  try {
    await store.openProjectStore(cwd);
    writer = createMemoryWriter(store);
    const status = options.status ?? "active";
    if (!["active", "blocked", "done", "canceled"].includes(status)) {
      throw new CliError(
        `Invalid task status '${status}'. Allowed: active, blocked, done, canceled.`,
        1,
      );
    }
    const record = writer.createRecord({
      type: "task",
      title: options.title,
      summary: options.summary,
      goal: options.goal ?? options.title,
      status,
      author: options.author ?? "unknown",
    });
    return {
      output: `Created task ${record.id}
Title: ${record.title}
Status: ${record.status}`,
      exitCode: 0,
    };
  } catch (err) {
    if (err instanceof MemoryWriterConflictError) {
      throw new CliError(`Conflict: ${err.message}`, 6);
    }
    throw err;
  } finally {
    store.close();
  }
}

export async function taskShow(cwd: string): Promise<{ output: string; exitCode: number }> {
  const store = await openStore(cwd);
  try {
    await store.openProjectStore(cwd);
    const tasks = store.listRecords({ type: "task" });
    if (tasks.length === 0) {
      return {
        output: [
          "No tasks exist for this project.",
          "Create one with:",
          '  zentext task create --title "Describe the current task"',
        ].join("\n"),
        exitCode: 0,
      };
    }
    const active = tasks
      .filter((t) => t.status === "active")
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime() || a.id.localeCompare(b.id))[0];
    const target = active ?? tasks[0];
    return { output: formatRecord(target), exitCode: 0 };
  } finally {
    store.close();
  }
}

export async function taskUpdate(
  cwd: string,
  options: {
    title?: string;
    summary?: string;
    status?: string;
    note?: string;
    notes?: string[];
    nextAction?: string;
  },
): Promise<{ output: string; exitCode: number }> {
  const store = await openStore(cwd);
  let writer: ReturnType<typeof createMemoryWriter> | undefined;
  try {
    await store.openProjectStore(cwd);
    const tasks = store.listRecords({ type: "task" });
    const active = tasks
      .filter((t) => t.status === "active")
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime() || a.id.localeCompare(b.id))[0];
    const target = active ?? tasks[0];
    if (!target) {
      return {
        output: [
          "No task exists to update.",
          "Create one with:",
          '  zentext task create --title "Describe the current task"',
        ].join("\n"),
        exitCode: 1,
      };
    }

    if (options.status !== undefined) {
      if (!["active", "blocked", "done", "canceled"].includes(options.status)) {
        throw new CliError(
          `Invalid task status '${options.status}'. Allowed: active, blocked, done, canceled.`,
          1,
        );
      }
    }

    writer = createMemoryWriter(store);
    const patch: Record<string, unknown> = {};
    if (options.title !== undefined) patch.title = options.title;
    if (options.summary !== undefined) patch.summary = options.summary;
    if (options.status !== undefined) patch.status = options.status;
    const notes = options.notes ?? (options.note !== undefined ? [options.note] : undefined);
    if (notes !== undefined && notes.length > 0) patch.notes = notes;
    if (options.nextAction !== undefined) patch.next = options.nextAction;

    const record = writer.updateRecord(target.id, patch);
    return {
      output: `Updated task ${record.id} to revision ${record.revision}
${formatRecord(record)}`,
      exitCode: 0,
    };
  } catch (err) {
    if (err instanceof MemoryWriterConflictError) {
      throw new CliError(`Conflict: ${err.message}`, 6);
    }
    throw err;
  } finally {
    store.close();
  }
}

export async function handoffCreate(
  cwd: string,
  options: {
    from: string;
    stoppingPoint: string;
    nextAction: string;
    completed?: string[];
    blockers?: string[];
    filesChanged?: string[];
    verification?: string[];
    previousResponse?: string;
  },
): Promise<{ output: string; exitCode: number }> {
  const store = await openStore(cwd);
  let writer: ReturnType<typeof createMemoryWriter> | undefined;
  try {
    const meta = await store.openProjectStore(cwd);
    const handoff = buildHandoff(store, meta, {
      previous_agent: options.from,
      stopping_point: options.stoppingPoint,
      next_action: options.nextAction,
      completed: options.completed,
      blockers: options.blockers,
      files_changed: options.filesChanged,
      verification: options.verification,
      previous_response: options.previousResponse,
    });

    writer = createMemoryWriter(store);
    const input = handoffToCreateInput(handoff, options.from);
    const record = writer.createHandoff(input);
    const output = formatHandoff(handoff as unknown as Record<string, unknown>);
    const qualityWarnings = validateHandoffQuality(handoff);
    const warningOutput =
      qualityWarnings.length === 0
        ? ""
        : `\n\nHandoff quality warnings:\n${qualityWarnings
            .map(
              (warning) =>
                `- ${warning.message} ${warning.remediation}`,
            )
            .join("\n")}`;
    return { output: `${output}${warningOutput}

Stored handoff record: ${record.id}`, exitCode: 0 };
  } catch (err) {
    if (err instanceof HandoffValidationError) {
      let message = err.message;
      if (message.includes("no active or blocked task")) {
        message = `${message}

Create a task first:
  zentext task create --title "Describe the current task"`;
      }
      throw new CliError(message, 1);
    }
    if (err instanceof MemoryWriterConflictError) {
      throw new CliError(`Conflict: ${err.message}`, 6);
    }
    throw err;
  } finally {
    store.close();
  }
}

export function printUsage(): string {
  return `Zentext CLI — local project memory commands

Usage:
  zentext init
  zentext status
  zentext continue [--json | --markdown | --prompt]
  zentext continue --for <environment> [--compact] [--include-instructions]
  zentext rpc
  zentext task {create|show|update}
  zentext show <id>
  zentext list [--type <type>] [--status <status>] [--limit <n>]
  zentext search <query> [--type <type>] [--status <status>] [--limit <n>] [--offset <n>] [--json]
  zentext repack [--focus <text>] [--max-size <chars>] [--out <path>]

Commands:
  init    Initialize the local project store
  status  Show a concise overview of the project memory
  continue  Load the validated current task and handoff without changing state
  rpc     Exchange typed newline-delimited JSON over stdin/stdout
  task    Create, show, or update the current task
  show    Display a single record by id
  list    List records, optionally filtered
  search  Search redacted canonical project memory deterministically
  repack   Generate a focused context payload from project memory
  handoff  Structured handoff commands

Task subcommands:
  zentext task create --title <text> [--goal <text>] [--summary <text>]
    [--status active|blocked|done|canceled]
  zentext task show
  zentext task update [--title <text>] [--summary <text>] [--status <status>]
    [--note <text> ...] [--next-action <text>]

Handoff subcommands:
  zentext handoff show [--json]
  zentext handoff acknowledge [--json]
  zentext handoff validate [--json]
  zentext handoff export --format <json|markdown|prompt>
  zentext handoff create --from <agent> --stopping-point <text> --next-action <text>
    [--completed <text> ...] [--blockers <text> ...] [--files-changed <text> ...]
    [--verification <text> ...] [--previous-response <text>]

Continuation output:
  zentext continue            Human-readable validated continuation
  zentext continue --json     Stable machine-readable continuation
  zentext continue --markdown Portable Markdown continuation
  zentext continue --prompt   Tool-neutral continuation prompt
  zentext continue --for generic      Generic semantic baseline
  zentext continue --for codex        Codex project guidance
  zentext continue --for claude-code  Claude Code project guidance
  zentext continue --for ollama-host  Ollama host guidance

Options:
  --type     Filter by record type (task, decision, blocker, ...)
  --status   Filter by record status
  --limit    Limit the number of records shown
  --offset   Skip deterministic search results before returning a page
  --task-id  Restrict search to records related to one canonical task
  --include-superseded Include superseded records in search
  --freshness Prefer current, current-only, or historical-only search results
  --focus    Prioritize records matching this topic
  --max-size Character budget for the output (default 12000)
  --out      Write the payload to a file instead of stdout
  --json     Output supported commands as JSON
  --markdown Output continuation as portable Markdown
  --prompt   Output a tool-neutral continuation prompt
  --for      Format the validated continuation for a documented environment
  --compact  Reduce environment wrapper text; requires --for
  --include-instructions Add the complete tool-neutral contract; requires --for

Repeatable options:
  --note, --completed, --blockers, --files-changed, and --verification may be
  supplied more than once. Values are retained in invocation order.
`;
}
