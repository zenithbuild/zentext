import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { SqliteStore } from "../src/store/sqlite-store.js";
import {
  memoryRead,
  memoryList,
  memoryQuery,
  memoryRepack,
  createMcpServer,
} from "../src/mcp/server.js";
import { repack } from "../src/repack/engine.js";
import type { CallToolResult, JSONRPCMessage, MessageExtraInfo } from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

let tempHome: string;
let tempProject: string;
let originalHome: string;
let projectId: string;

beforeEach(async () => {
  tempHome = mkdtempSync(join(tmpdir(), "zentext-mcp-test-"));
  tempProject = mkdtempSync(join(tmpdir(), "zentext-mcp-proj-"));
  originalHome = process.env.HOME ?? "";
  process.env.HOME = tempHome;

  const store = new SqliteStore();
  const meta = await store.initProjectStore(tempProject);
  projectId = meta.projectId;
  store.close();
});

afterEach(() => {
  process.env.HOME = originalHome;
  rmSync(tempHome, { recursive: true, force: true });
  rmSync(tempProject, { recursive: true, force: true });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function openStore(): Promise<SqliteStore> {
  const store = new SqliteStore();
  await store.initProjectStore(tempProject);
  return store;
}

function recordCount(store: SqliteStore): number {
  return store.listRecords().length;
}

function historyCount(store: SqliteStore): number {
  const records = store.listRecords();
  let count = 0;
  for (const record of records) {
    count += store.getRecordHistory(record.id).length;
  }
  return count;
}

function snapshot(store: SqliteStore): string {
  return JSON.stringify(
    store
      .listRecords()
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((r) => ({ id: r.id, status: r.status, revision: r.revision, title: r.title })),
  );
}

function getText(result: CallToolResult): string {
  expect(result.content).toHaveLength(1);
  const item = result.content[0];
  expect(item.type).toBe("text");
  return (item as { type: "text"; text: string }).text;
}

// ---------------------------------------------------------------------------
// memory.read
// ---------------------------------------------------------------------------

describe("memory.read", () => {
  it("reads an existing record by id", async () => {
    const store = await openStore();
    const created = store.createRecord({
      type: "task",
      title: "Read task",
      goal: "Be readable",
      author: "user:test",
    });
    const before = snapshot(store);
    store.close();

    const result = await memoryRead({ project_id: projectId, record_id: created.id });
    const parsed = JSON.parse(getText(result));
    expect(parsed.record.id).toBe(created.id);
    expect(parsed.record.title).toBe("Read task");

    const after = await openStore();
    expect(snapshot(after)).toBe(before);
    after.close();
  });

  it("returns a structured error for missing record", async () => {
    const result = await memoryRead({
      project_id: projectId,
      record_id: "rec_task_nonexistent",
    });
    expect(result.isError).toBe(true);
    expect(getText(result)).toContain("Record not found");
  });

  it("returns a structured error for unknown project", async () => {
    const result = await memoryRead({
      project_id: "0000000000000000",
      record_id: "rec_task_x",
    });
    expect(result.isError).toBe(true);
    expect(getText(result)).toBe("Project not found.");
  });

  it("includes revision history when requested", async () => {
    const store = await openStore();
    const created = store.createRecord({
      type: "task",
      title: "History task",
      goal: "Track history",
      author: "user:test",
    });
    store.updateRecord({ id: created.id, title: "History task updated" });
    store.close();

    const result = await memoryRead({
      project_id: projectId,
      record_id: created.id,
      include_history: true,
    });
    const parsed = JSON.parse(getText(result));
    expect(parsed.history).toHaveLength(2);
    expect(parsed.history[0].event).toBe("create");
    expect(parsed.history[1].event).toBe("update");
  });

  it("does not mutate records or revisions", async () => {
    const store = await openStore();
    const created = store.createRecord({
      type: "decision",
      title: "Immutable decision",
      decision: "Stay the same",
      author: "user:test",
    });
    const before = snapshot(store);
    const beforeHistory = historyCount(store);
    store.close();

    await memoryRead({ project_id: projectId, record_id: created.id, include_history: true });

    const after = await openStore();
    expect(snapshot(after)).toBe(before);
    expect(historyCount(after)).toBe(beforeHistory);
    after.close();
  });
});

// ---------------------------------------------------------------------------
// memory.list
// ---------------------------------------------------------------------------

describe("project ID safety", () => {
  const adversarialIds = [
    "../other",
    "../../tmp/file",
    "/absolute/path",
    "~/.zentext",
    "project/child",
    "project\\child",
    ".",
    "..",
    "",
    "%2e%2e%2fother",
    "a".repeat(1000),
    "0123456789abcdef../other",
    "0123456789abcdef/sub",
  ];

  it("rejects adversarial project IDs for memory.read", async () => {
    for (const id of adversarialIds) {
      const result = await memoryRead({ project_id: id, record_id: "rec_task_x" } as any);
      expect(result.isError).toBe(true);
      const msg = getText(result);
      expect(msg).toMatch(/Project not found|project_id must be a valid/);
      expect(msg).not.toContain(".zentext");
    }
  });

  it("rejects adversarial project IDs for memory.list", async () => {
    for (const id of adversarialIds) {
      const result = await memoryList({ project_id: id } as any);
      expect(result.isError).toBe(true);
    }
  });

  it("rejects adversarial project IDs for memory.query", async () => {
    for (const id of adversarialIds) {
      const result = await memoryQuery({ project_id: id, query: "x" } as any);
      expect(result.isError).toBe(true);
    }
  });

  it("rejects adversarial project IDs for memory.repack", async () => {
    for (const id of adversarialIds) {
      const result = await memoryRepack({ project_id: id } as any);
      expect(result.isError).toBe(true);
    }
  });

  it("does not create files outside the projects directory for unknown IDs", async () => {
    const before = readdirSync(join(tempHome, ".zentext"));
    const result = await memoryRead({ project_id: "zzzzzzzzzzzzzzzz", record_id: "rec_task_x" } as any);
    expect(result.isError).toBe(true);
    const after = readdirSync(join(tempHome, ".zentext"));
    expect(after).toEqual(before);
  });
});

describe("memory.list", () => {
  it("lists all records deterministically", async () => {
    const store = await openStore();
    store.createRecord({ type: "task", title: "A", goal: "G", author: "user:test" });
    await sleep(30);
    store.createRecord({ type: "task", title: "B", goal: "G", author: "user:test" });
    await sleep(30);
    store.createRecord({ type: "decision", title: "D", decision: "X", author: "user:test" });
    const before = snapshot(store);
    store.close();

    const result = await memoryList({ project_id: projectId });
    const records = JSON.parse(getText(result)) as Array<{ title: string; type: string }>;
    expect(records).toHaveLength(3);
    expect(records.map((r) => r.title)).toEqual(["D", "B", "A"]);

    const after = await openStore();
    expect(snapshot(after)).toBe(before);
    after.close();
  });

  it("filters by type", async () => {
    const store = await openStore();
    store.createRecord({ type: "task", title: "T1", goal: "G", author: "user:test" });
    store.createRecord({ type: "decision", title: "D1", decision: "X", author: "user:test" });
    store.close();

    const result = await memoryList({ project_id: projectId, type: "task" });
    const records = JSON.parse(getText(result)) as Array<{ title: string }>;
    expect(records.map((r) => r.title)).toEqual(["T1"]);
  });

  it("filters by status", async () => {
    const store = await openStore();
    store.createRecord({
      type: "task",
      title: "Done",
      goal: "G",
      status: "done",
      author: "user:test",
    });
    store.createRecord({
      type: "task",
      title: "Active",
      goal: "G",
      status: "active",
      author: "user:test",
    });
    store.close();

    const result = await memoryList({ project_id: projectId, status: "done" });
    const records = JSON.parse(getText(result)) as Array<{ title: string }>;
    expect(records.map((r) => r.title)).toEqual(["Done"]);
  });

  it("honors limit", async () => {
    const store = await openStore();
    for (let i = 0; i < 5; i++) {
      store.createRecord({ type: "task", title: `Task ${i}`, goal: "G", author: "user:test" });
    }
    store.close();

    const result = await memoryList({ project_id: projectId, limit: 2 });
    const records = JSON.parse(getText(result)) as Array<unknown>;
    expect(records).toHaveLength(2);
  });

  it("returns empty result for empty store", async () => {
    const result = await memoryList({ project_id: projectId });
    const records = JSON.parse(getText(result)) as Array<unknown>;
    expect(records).toHaveLength(0);
  });

  it("does not mutate canonical state", async () => {
    const store = await openStore();
    store.createRecord({ type: "task", title: "M", goal: "G", author: "user:test" });
    const before = snapshot(store);
    const beforeHistory = historyCount(store);
    store.close();

    await memoryList({ project_id: projectId, type: "task", status: "active", limit: 1 });

    const after = await openStore();
    expect(snapshot(after)).toBe(before);
    expect(historyCount(after)).toBe(beforeHistory);
    after.close();
  });
});

// ---------------------------------------------------------------------------
// memory.query
// ---------------------------------------------------------------------------

describe("memory.query", () => {
  it("matches title case-insensitively", async () => {
    const store = await openStore();
    store.createRecord({ type: "task", title: "Authentication flow", goal: "G", author: "user:test" });
    store.createRecord({ type: "task", title: "Billing page", goal: "G", author: "user:test" });
    store.close();

    const result = await memoryQuery({ project_id: projectId, query: "AUTH" });
    const records = JSON.parse(getText(result)) as Array<{ title: string }>;
    expect(records.map((r) => r.title)).toEqual(["Authentication flow"]);
  });

  it("matches summary", async () => {
    const store = await openStore();
    store.createRecord({
      type: "task",
      title: "T1",
      summary: "Handle retries gracefully",
      goal: "G",
      author: "user:test",
    });
    store.createRecord({ type: "task", title: "T2", summary: "No retries", goal: "G", author: "user:test" });
    store.close();

    const result = await memoryQuery({ project_id: projectId, query: "gracefully" });
    const records = JSON.parse(getText(result)) as Array<{ title: string }>;
    expect(records.map((r) => r.title)).toEqual(["T1"]);
  });

  it("matches tags", async () => {
    const store = await openStore();
    store.createRecord({
      type: "task",
      title: "T1",
      goal: "G",
      tags: ["backend"],
      author: "user:test",
    });
    store.createRecord({ type: "task", title: "T2", goal: "G", tags: ["ui"], author: "user:test" });
    store.close();

    const result = await memoryQuery({ project_id: projectId, query: "BACKEND" });
    const records = JSON.parse(getText(result)) as Array<{ title: string }>;
    expect(records.map((r) => r.title)).toEqual(["T1"]);
  });

  it("composes type and status filters with text", async () => {
    const store = await openStore();
    store.createRecord({
      type: "task",
      title: "Auth",
      goal: "G",
      status: "active",
      author: "user:test",
    });
    store.createRecord({
      type: "task",
      title: "Auth done",
      goal: "G",
      status: "done",
      author: "user:test",
    });
    store.createRecord({
      type: "decision",
      title: "Auth decision",
      decision: "X",
      author: "user:test",
    });
    store.close();

    const result = await memoryQuery({
      project_id: projectId,
      query: "auth",
      type: "task",
      status: "active",
    });
    const records = JSON.parse(getText(result)) as Array<{ title: string }>;
    expect(records.map((r) => r.title)).toEqual(["Auth"]);
  });

  it("empty query returns filtered list", async () => {
    const store = await openStore();
    store.createRecord({ type: "task", title: "A", goal: "G", author: "user:test" });
    store.createRecord({ type: "decision", title: "D", decision: "X", author: "user:test" });
    store.close();

    const result = await memoryQuery({ project_id: projectId, type: "task" });
    const records = JSON.parse(getText(result)) as Array<{ type: string }>;
    expect(records).toHaveLength(1);
    expect(records[0].type).toBe("task");
  });

  it("does not mutate canonical state", async () => {
    const store = await openStore();
    store.createRecord({ type: "task", title: "Q", goal: "G", author: "user:test" });
    const before = snapshot(store);
    const beforeHistory = historyCount(store);
    store.close();

    await memoryQuery({ project_id: projectId, query: "Q" });

    const after = await openStore();
    expect(snapshot(after)).toBe(before);
    expect(historyCount(after)).toBe(beforeHistory);
    after.close();
  });
});

// ---------------------------------------------------------------------------
// memory.repack
// ---------------------------------------------------------------------------

describe("memory.repack", () => {
  it("returns the same body as the direct shared engine", async () => {
    const store = await openStore();
    store.createRecord({
      type: "task",
      title: "Primary",
      goal: "G",
      status: "active",
      author: "user:test",
    });
    const meta = { projectName: "test", projectId };
    const direct = repack(store, meta);
    store.close();

    const result = await memoryRepack({ project_id: projectId });
    const directBody = direct.markdown.split("\n\n").slice(2).join("\n\n");
    const mcpBody = getText(result).split("\n\n").slice(2).join("\n\n");
    expect(mcpBody).toBe(directBody);
  });

  it("respects focus and max_size", async () => {
    const store = await openStore();
    store.createRecord({
      type: "task",
      title: "Auth task",
      goal: "G",
      status: "active",
      author: "user:test",
    });
    store.createRecord({
      type: "task",
      title: "Other task",
      goal: "G",
      status: "active",
      author: "user:test",
    });
    store.close();

    const result = await memoryRepack({ project_id: projectId, focus: "auth", max_size: 500 });
    expect(result.isError).toBeFalsy();
    expect(getText(result)).toContain("Auth task");
  });

  it("does not mutate canonical state", async () => {
    const store = await openStore();
    store.createRecord({ type: "task", title: "R", goal: "G", author: "user:test" });
    const before = snapshot(store);
    const beforeHistory = historyCount(store);
    store.close();

    await memoryRepack({ project_id: projectId });

    const after = await openStore();
    expect(snapshot(after)).toBe(before);
    expect(historyCount(after)).toBe(beforeHistory);
    after.close();
  });
});

// ---------------------------------------------------------------------------
// Protocol / integration
// ---------------------------------------------------------------------------

class InMemoryTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: <T extends JSONRPCMessage>(message: T, extra?: MessageExtraInfo) => void;
  sessionId = "test-session";
  sent: JSONRPCMessage[] = [];

  async start(): Promise<void> {
    // no-op
  }

  async send(message: JSONRPCMessage): Promise<void> {
    this.sent.push(message);
  }

  async close(): Promise<void> {
    this.onclose?.();
  }

  receive(message: JSONRPCMessage): void {
    this.onmessage?.(message);
  }
}


async function waitForResponse(
  transport: InMemoryTransport,
  id: number,
  timeoutMs = 500,
): Promise<JSONRPCMessage | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = transport.sent.find(
      (m) => "id" in m && (m as { id: number }).id === id,
    );
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return undefined;
}

function request(id: number, method: string, params: Record<string, unknown>): JSONRPCMessage {
  return { jsonrpc: "2.0", id, method, params } as JSONRPCMessage;
}

function notification(method: string, params?: Record<string, unknown>): JSONRPCMessage {
  return { jsonrpc: "2.0", method, params } as JSONRPCMessage;
}

describe("MCP protocol", () => {
  it("registers exactly six read-only tools", async () => {
    const transport = new InMemoryTransport();
    const server = createMcpServer();
    await server.connect(transport);

    transport.receive(
      request(1, "initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "0.1.0" },
      }),
    );

    const initResponse = await waitForResponse(transport, 1);
    expect(initResponse).toBeDefined();

    transport.receive(notification("notifications/initialized"));

    transport.receive(request(2, "tools/list", {}));
    const listResponse = (await waitForResponse(transport, 2)) as unknown as { result?: { tools: Array<{ name: string; annotations?: { readOnlyHint?: boolean } }> } } | undefined;
    expect(listResponse).toBeDefined();
    const names = listResponse!.result!.tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "memory.continuation",
      "memory.list",
      "memory.query",
      "memory.read",
      "memory.repack",
      "memory.search",
    ]);
    for (const tool of listResponse!.result!.tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
    }

    await server.close();
  });

  it("calls memory.read over the protocol", async () => {
    const store = await openStore();
    const created = store.createRecord({
      type: "task",
      title: "Protocol task",
      goal: "G",
      author: "user:test",
    });
    store.close();

    const transport = new InMemoryTransport();
    const server = createMcpServer();
    await server.connect(transport);

    transport.receive(
      request(1, "initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "0.1.0" },
      }),
    );
    transport.receive(notification("notifications/initialized"));

    transport.receive(
      request(2, "tools/call", {
        name: "memory.read",
        arguments: { project_id: projectId, record_id: created.id },
      }),
    );
    const callResponse = (await waitForResponse(transport, 2)) as unknown as { result?: { content: Array<{ type: string; text: string }> } } | undefined;
    expect(callResponse).toBeDefined();
    expect(callResponse!.result!.content[0].text).toContain(created.id);

    await server.close();
  });

  it("rejects malformed tool input over the protocol", async () => {
    const transport = new InMemoryTransport();
    const server = createMcpServer();
    await server.connect(transport);

    transport.receive(
      request(1, "initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "0.1.0" },
      }),
    );
    transport.receive(notification("notifications/initialized"));

    transport.receive(
      request(2, "tools/call", {
        name: "memory.list",
        arguments: { project_id: projectId, type: "not-a-type" },
      }),
    );
    const callResponse = (await waitForResponse(transport, 2)) as unknown as {
      result?: { isError?: boolean; content: Array<{ type: string; text: string }> };
    } | undefined;
    expect(callResponse).toBeDefined();
    expect(callResponse!.result!.isError).toBe(true);
    expect(callResponse!.result!.content[0].text).toContain("Invalid arguments");

    await server.close();
  });
});
