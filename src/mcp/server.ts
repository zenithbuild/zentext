import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { SqliteStore, StoreNotFoundError } from "../store/sqlite-store.js";
import type { StoreMeta } from "../types/store.js";
import { repack } from "../repack/engine.js";
import { RECORD_TYPES, ALLOWED_STATUSES } from "../types/records.js";
import type { AnyRecord, ListFilter, RecordType } from "../types/records.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { redactForOutput } from "../safety.js";
import { SqliteMemoryStore } from "../memory-interface.js";
import { ZentextError } from "../errors.js";

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const projectIdSchema = z.string().regex(/^[0-9a-f]{16}$/, "project_id must be a valid 16-character hex project ID");
const recordIdSchema = z.string().min(1, "record_id is required");

const ReadInput = z.object({
  project_id: projectIdSchema,
  record_id: recordIdSchema,
  include_history: z.boolean().optional(),
});

const RecordTypeSchema = z.enum(RECORD_TYPES as [string, ...string[]]);

const ALL_STATUSES = Array.from(new Set(Object.values(ALLOWED_STATUSES).flat())) as string[];

function refineStatus(
  data: { type?: string | undefined; status?: string | undefined },
  ctx: z.RefinementCtx,
): void {
  if (!data.status) return;
  if (data.type) {
    const allowed = ALLOWED_STATUSES[data.type as keyof typeof ALLOWED_STATUSES];
    if (allowed && !allowed.includes(data.status)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid status '${data.status}' for type '${data.type}'. Allowed: ${allowed.join(", ")}`,
        path: ["status"],
      });
    }
  } else if (!ALL_STATUSES.includes(data.status)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Invalid status '${data.status}'`,
      path: ["status"],
    });
  }
}

const ListInput = z.object({
  project_id: projectIdSchema,
  type: RecordTypeSchema.optional(),
  status: z.string().optional(),
  limit: z.number().int().positive().optional(),
}).superRefine(refineStatus);

const QueryInput = z.object({
  project_id: projectIdSchema,
  query: z.string().optional(),
  type: RecordTypeSchema.optional(),
  status: z.string().optional(),
  limit: z.number().int().positive().optional(),
}).superRefine(refineStatus);

const RepackInput = z.object({
  project_id: projectIdSchema,
  focus: z.string().optional(),
  max_size: z.number().int().positive().optional(),
});

const ContinuationInput = z.object({
  project_id: projectIdSchema,
});

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

class McpToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpToolError";
  }
}

function toolError(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

function toolSuccess(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(redactForOutput(data), null, 2) }],
  };
}

function mapToolError(err: unknown): CallToolResult {
  if (err instanceof ZentextError) {
    return toolError(`${err.code}: ${redactForOutput(err.message)}`);
  }
  if (err instanceof McpToolError) {
    return toolError(err.message);
  }
  if (err instanceof StoreNotFoundError) {
    return toolError("Project not found.");
  }
  console.error("MCP tool error:", err instanceof Error ? err.message : String(err));
  return toolError("Store read failed.");
}

async function openMcpStore(
  projectId: string,
): Promise<{ store: SqliteStore; meta: StoreMeta }> {
  const store = new SqliteStore();
  try {
    const meta = await store.openProjectStoreById(projectId);
    return { store, meta };
  } catch (err) {
    store.close();
    if (err instanceof StoreNotFoundError) {
      throw new McpToolError("Project not found.");
    }
    throw new McpToolError("Store read failed.");
  }
}

function listSort(a: AnyRecord, b: AnyRecord): number {
  if (a.updated_at > b.updated_at) return -1;
  if (a.updated_at < b.updated_at) return 1;
  return a.id.localeCompare(b.id);
}

function recordMatches(record: AnyRecord, needle: string): boolean {
  const lowered = needle.toLowerCase();
  if (record.title.toLowerCase().includes(lowered)) return true;
  if (record.summary?.toLowerCase().includes(lowered)) return true;
  if (record.tags.some((tag) => tag.toLowerCase().includes(lowered))) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Tool handlers (exported for direct testing)
// ---------------------------------------------------------------------------

export async function memoryRead(args: z.infer<typeof ReadInput>): Promise<CallToolResult> {
  let store: SqliteStore | undefined;
  try {
    ({ store } = await openMcpStore(args.project_id));
    const record = store.getRecord(args.record_id);
    if (!record) {
      return toolError("Record not found.");
    }

    const result: Record<string, unknown> = { record };
    if (args.include_history) {
      const rawHistory = store.getRecordHistory(args.record_id);
      result.history = rawHistory.map((entry) => ({
        revision: entry.revision,
        event: entry.event,
        occurred_at: entry.occurred_at,
        author: entry.author,
        record: JSON.parse(entry.record_json),
      }));
    }
    return toolSuccess(result);
  } catch (err) {
    return mapToolError(err);
  } finally {
    store?.close();
  }
}

export async function memoryList(args: z.infer<typeof ListInput>): Promise<CallToolResult> {
  let store: SqliteStore | undefined;
  try {
    ({ store } = await openMcpStore(args.project_id));
    const filter: ListFilter = {};
    if (args.type) filter.type = args.type as RecordType;
    if (args.status) filter.status = args.status;
    const records = store.listRecords(filter).sort(listSort);
    const limited = args.limit ? records.slice(0, args.limit) : records;
    return toolSuccess(limited);
  } catch (err) {
    return mapToolError(err);
  } finally {
    store?.close();
  }
}

export async function memoryQuery(args: z.infer<typeof QueryInput>): Promise<CallToolResult> {
  let store: SqliteStore | undefined;
  try {
    ({ store } = await openMcpStore(args.project_id));
    const filter: ListFilter = {};
    if (args.type) filter.type = args.type as RecordType;
    if (args.status) filter.status = args.status;

    let records = store.listRecords(filter);
    const query = (args.query ?? "").trim();
    if (query) {
      records = records.filter((record) => recordMatches(record, query));
    }
    records.sort(listSort);
    const limited = args.limit ? records.slice(0, args.limit) : records;
    return toolSuccess(limited);
  } catch (err) {
    return mapToolError(err);
  } finally {
    store?.close();
  }
}

export async function memoryRepack(args: z.infer<typeof RepackInput>): Promise<CallToolResult> {
  let store: SqliteStore | undefined;
  try {
    const { store: openedStore, meta } = await openMcpStore(args.project_id);
    store = openedStore;
    const result = repack(store, meta, {
      focus: args.focus,
      maxSize: args.max_size,
    });
    return { content: [{ type: "text", text: redactForOutput(result.markdown) }] };
  } catch (err) {
    return mapToolError(err);
  } finally {
    store?.close();
  }
}

export async function memoryContinuation(
  args: z.infer<typeof ContinuationInput>,
): Promise<CallToolResult> {
  let memory: SqliteMemoryStore | undefined;
  try {
    memory = await SqliteMemoryStore.openById(args.project_id);
    return toolSuccess(await memory.getContinuation());
  } catch (err) {
    return mapToolError(err);
  } finally {
    memory?.close();
  }
}

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

export function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: "zentext", version: "0.1.0" },
    { capabilities: {} },
  );

  const readOnly = { readOnlyHint: true };

  server.registerTool(
    "memory.continuation",
    {
      title: "Read validated Zentext continuation",
      description:
        "Return the same validated canonical continuation used by the CLI, SDK, and RPC. " +
        "Rejects stale state and never mutates the project.",
      inputSchema: ContinuationInput,
      annotations: readOnly,
    },
    memoryContinuation,
  );

  server.registerTool(
    "memory.read",
    {
      title: "Read a canonical Zentext record",
      description:
        "Read one memory record by ID, optionally including revision history. " +
        "Returns the full record envelope and never mutates canonical state.",
      inputSchema: ReadInput,
      annotations: readOnly,
    },
    memoryRead,
  );

  server.registerTool(
    "memory.list",
    {
      title: "List Zentext records",
      description:
        "List records for a project, optionally filtered by type, status, and limit. " +
        "Results are sorted deterministically by updated_at descending then id ascending.",
      inputSchema: ListInput,
      annotations: readOnly,
    },
    memoryList,
  );

  server.registerTool(
    "memory.query",
    {
      title: "Search Zentext records",
      description:
        "Deterministic case-insensitive substring search across record title, summary, and tags. " +
        "Optionally filtered by type and status. An empty query returns the filtered list.",
      inputSchema: QueryInput,
      annotations: readOnly,
    },
    memoryQuery,
  );

  server.registerTool(
    "memory.repack",
    {
      title: "Generate current-context payload",
      description:
        "Return the deterministic repack payload for the project using the shared repack engine. " +
        "Supports optional focus and max_size. Does not reimplement engine logic.",
      inputSchema: RepackInput,
      annotations: readOnly,
    },
    memoryRepack,
  );

  return server;
}
