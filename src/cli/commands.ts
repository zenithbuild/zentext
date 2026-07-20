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
import { formatInit, formatStatus, formatRecord, formatList } from "./format.js";
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
  repack  Generate a focused context payload from project memory

Options:
  --type     Filter by record type (task, decision, blocker, ...)
  --status   Filter by record status
  --limit    Limit the number of records shown
  --focus    Prioritize records matching this topic
  --max-size Character budget for the output (default 12000)
  --out      Write the payload to a file instead of stdout
`;
}
