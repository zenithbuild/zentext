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

export class CliError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number,
  ) {
    super(message);
    this.name = "CliError";
  }
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

    if (options.out) {
      mkdirSync(dirname(options.out), { recursive: true });
      writeFileSync(options.out, result.markdown, "utf8");
    }

    return { output: result.markdown, exitCode: 0 };
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
    return { output: `${output}

Stored handoff record: ${record.id}`, exitCode: 0 };
  } catch (err) {
    if (err instanceof HandoffValidationError) {
      throw new CliError(err.message, 1);
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
  return `Zentext CLI — Phase 2 read/inspect commands

Usage:
  zentext init
  zentext status
  zentext show <id>
  zentext list [--type <type>] [--status <status>] [--limit <n>]
  zentext repack [--focus <text>] [--max-size <chars>] [--out <path>]

Commands:
  init    Initialize the local project store
  status  Show a concise overview of the project memory
  show    Display a single record by id
  list    List records, optionally filtered
  repack   Generate a focused context payload from project memory
  handoff  Structured handoff commands

Handoff subcommands:
  zentext handoff show [--json]
  zentext handoff acknowledge [--json]
  zentext handoff validate [--json]
  zentext handoff create --from <agent> --stopping-point <text> --next-action <text>
    [--completed <text>] [--blockers <text>] [--files-changed <text>]
    [--verification <text>] [--previous-response <text>]

Options:
  --type     Filter by record type (task, decision, blocker, ...)
  --status   Filter by record status
  --limit    Limit the number of records shown
  --focus    Prioritize records matching this topic
  --max-size Character budget for the output (default 12000)
  --out      Write the payload to a file instead of stdout
  --json     Output handoff commands as JSON
`;
}
