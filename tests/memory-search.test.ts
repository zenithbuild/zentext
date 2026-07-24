import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import { search as searchCli } from "../src/cli/commands.js";
import {
  MEMORY_SEARCH_SCHEMA_VERSION,
  MEMORY_SEARCH_STRATEGY,
  MemorySearchInputSchema,
  searchMemoryRecords,
  type ParsedMemorySearchInput,
} from "../src/memory-search.js";
import { memorySearch as searchMcp } from "../src/mcp/server.js";
import { handleRpcLine } from "../src/rpc/server.js";
import { RPC_PROTOCOL_VERSION } from "../src/rpc/protocol.js";
import { openProject } from "../src/sdk.js";
import { SqliteStore } from "../src/store/sqlite-store.js";
import type {
  AnyRecord,
  RecordProvenance,
} from "../src/types/records.js";

function fixtureRecord(
  id: string,
  title: string,
  updatedAt: string,
  extra: Partial<AnyRecord> = {},
): AnyRecord {
  return {
    id,
    project: "0123456789abcdef",
    type: "task",
    title,
    status: "active",
    created_at: updatedAt,
    updated_at: updatedAt,
    revision: 1,
    author: "fixture",
    tags: [],
    refs: {},
    schema_version: 1,
    goal: title,
    ...extra,
  } as AnyRecord;
}

function parsed(
  input: Parameters<typeof MemorySearchInputSchema.parse>[0],
): ParsedMemorySearchInput {
  return MemorySearchInputSchema.parse(input);
}

describe("deterministic memory search engine", () => {
  it("matches exact, phrase, and cross-field tokens without ranking by relevance", () => {
    const records = [
      fixtureRecord("rec_task_c", "CSS stable", "2026-01-01T00:00:00.000Z"),
      fixtureRecord(
        "rec_task_b",
        "Renderer plan",
        "2026-01-03T00:00:00.000Z",
        { summary: "Prove CSS output is stable." },
      ),
      fixtureRecord(
        "rec_task_a",
        "CSS work",
        "2026-01-02T00:00:00.000Z",
        { notes: ["The fixture remains stable."] },
      ),
    ];

    const page = searchMemoryRecords(
      records,
      parsed({ query: "CSS stable" }),
      "0123456789abcdef",
    );

    expect(page.strategy).toBe(MEMORY_SEARCH_STRATEGY);
    expect(page.results.map((result) => result.id)).toEqual([
      "rec_task_b",
      "rec_task_a",
      "rec_task_c",
    ]);
    expect(page.results.map((result) => result.match.kind)).toEqual([
      "tokens",
      "tokens",
      "exact",
    ]);
  });

  it("uses updated_at descending and canonical id ascending as a stable tie-breaker", () => {
    const timestamp = "2026-01-01T00:00:00.000Z";
    const page = searchMemoryRecords(
      [
        fixtureRecord("rec_task_b", "shared term", timestamp),
        fixtureRecord("rec_task_a", "shared term", timestamp),
      ],
      parsed({ query: "shared" }),
      "0123456789abcdef",
    );
    expect(page.results.map((result) => result.id)).toEqual([
      "rec_task_a",
      "rec_task_b",
    ]);
  });

  it("normalizes Unicode deterministically without fuzzy matching", () => {
    const page = searchMemoryRecords(
      [
        fixtureRecord(
          "rec_task_unicode",
          "Café Δelta",
          "2026-01-01T00:00:00.000Z",
        ),
      ],
      parsed({ query: "ＣＡＦÉ" }),
      "0123456789abcdef",
    );
    expect(page.results.map((result) => result.id)).toEqual(["rec_task_unicode"]);
    expect(page.query.normalized).toBe("café");
  });

  it("paginates after deterministic filtering and exposes bounded page metadata", () => {
    const records = Array.from({ length: 12 }, (_, index) =>
      fixtureRecord(
        `rec_task_${String(index).padStart(2, "0")}`,
        `bounded result ${index}`,
        `2026-01-01T00:00:${String(index).padStart(2, "0")}.000Z`,
      ),
    );
    const page = searchMemoryRecords(
      records,
      parsed({ query: "bounded", limit: 3, offset: 4 }),
      "0123456789abcdef",
    );
    expect(page.page).toEqual({
      offset: 4,
      limit: 3,
      returned: 3,
      total: 12,
      has_more: true,
    });
  });

  it("keeps an obvious full-scan baseline bounded and deterministic", () => {
    const records = Array.from({ length: 2_000 }, (_, index) =>
      fixtureRecord(
        `rec_task_${String(index).padStart(4, "0")}`,
        index % 25 === 0 ? `needle ${index}` : `record ${index}`,
        "2026-01-01T00:00:00.000Z",
      ),
    );
    const start = performance.now();
    const first = searchMemoryRecords(
      records,
      parsed({ query: "needle", limit: 100 }),
      "0123456789abcdef",
    );
    const second = searchMemoryRecords(
      records,
      parsed({ query: "needle", limit: 100 }),
      "0123456789abcdef",
    );
    expect(first).toEqual(second);
    expect(first.page.total).toBe(80);
    expect(performance.now() - start).toBeLessThan(2_000);
  });
});

describe("project memory search surfaces", () => {
  let tempHome: string;
  let tempProject: string;
  let otherProject: string;
  let originalHome: string;
  let projectId: string;
  let taskId: string;
  let oldDecisionId: string;
  const syntheticSecret = "api_key=synthetic-memory-search-secret";

  function provenance(task: string, verification: string[]): RecordProvenance {
    return {
      source_environment: "memory-search-test",
      captured_at: "2026-01-01T00:00:00.000Z",
      project_id: projectId,
      task_id: task,
      task_revision: 1,
      files_inspected: ["src/theme.css"],
      commands_executed: ["npm test -- memory-search"],
      verification,
    };
  }

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "zentext-search-home-"));
    tempProject = mkdtempSync(join(tmpdir(), "zentext-search-project-"));
    otherProject = mkdtempSync(join(tmpdir(), "zentext-search-other-"));
    originalHome = process.env.HOME ?? "";
    process.env.HOME = tempHome;

    const store = new SqliteStore();
    const meta = await store.initProjectStore(tempProject);
    projectId = meta.projectId;
    const task = store.createRecord({
      type: "task",
      title: "Prove CSS determinism",
      goal: "Make CSS output stable across runtimes.",
      notes: ["Preserve selector ordering."],
      refs: { files: ["src/theme.css", "tests/theme.test.ts"] },
      author: "tool-a",
    });
    taskId = task.id;

    store.createRecord({
      type: "decision",
      title: "Stable renderer decision",
      decision: "Sort CSS selectors by canonical name.",
      rationale: "Deterministic output is reviewable.",
      refs: { files: ["src/theme.css"] },
      provenance: provenance(taskId, ["Architecture review accepted"]),
      author: "tool-a",
    });
    store.createRecord({
      type: "validation",
      title: "CSS snapshot verification",
      check: "Snapshot suite",
      result: "passed",
      summary: "CSS determinism verified on Node 22 and 24.",
      provenance: provenance(taskId, ["Snapshot suite passed"]),
      author: "tool-a",
    });
    store.createRecord({
      type: "blocker",
      title: "Browser fixture unavailable",
      blocker: "The browser fixture is not installed.",
      status: "open",
      provenance: provenance(taskId, []),
      author: "tool-a",
    });
    store.createRecord({
      type: "handoff",
      title: "CSS continuation",
      from: "tool-a",
      to: "next-agent",
      context: "CSS determinism work is partially complete.",
      state: "Selector ordering is implemented.",
      next: "Run the browser snapshot.",
      completed_this_session: ["Sorted selectors", "Added unit verification"],
      structured_handoff: {
        active_task: { id: taskId, revision: 1 },
        completed: ["Sorted selectors", "Added unit verification"],
      },
      provenance: provenance(taskId, ["Unit verification passed"]),
      author: "tool-a",
    });
    const oldDecision = store.createRecord({
      type: "decision",
      title: "Discarded renderer approach",
      decision: "Use discarded-zeta insertion order.",
      provenance: provenance(taskId, []),
      author: "tool-a",
    });
    oldDecisionId = oldDecision.id;
    store.createRecord({
      type: "decision",
      title: "Replacement renderer approach",
      decision: "Use canonical selector ordering.",
      supersedes: [oldDecisionId],
      provenance: provenance(taskId, []),
      author: "tool-a",
    });
    store.createRecord(
      {
        type: "log",
        title: "Private deployment note",
        summary: syntheticSecret,
        author: "tool-a",
      },
      { allowSecretOverride: true },
    );
    store.updateRecord({
      id: taskId,
      summary: "CSS determinism implementation is ready.",
      author: "tool-a",
    });
    store.close();

    const isolated = new SqliteStore();
    await isolated.initProjectStore(otherProject);
    isolated.createRecord({
      type: "task",
      title: "CSS determinism must stay isolated",
      goal: "Never appear in another project.",
      author: "other-tool",
    });
    isolated.close();
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    rmSync(tempHome, { recursive: true, force: true });
    rmSync(tempProject, { recursive: true, force: true });
    rmSync(otherProject, { recursive: true, force: true });
  });

  it("searches canonical task, decision, handoff, verification, note, and file fields", async () => {
    const project = await openProject({ cwd: tempProject });
    const cases = [
      ["selector ordering", "task"],
      ["canonical name", "decision"],
      ["partially complete", "handoff"],
      ["Node 22 and 24", "validation"],
      ["src/theme.css", "task"],
      ["Architecture review accepted", "decision"],
    ] as const;
    for (const [query, expectedType] of cases) {
      const page = await project.searchMemory({ query, limit: 100 });
      expect(page.results.some((result) => result.type === expectedType)).toBe(true);
    }
    project.close();
  });

  it("composes type, status, task, revision, supersession, limit, and offset filters", async () => {
    const project = await openProject({ cwd: tempProject });
    const scoped = await project.searchMemory({
      query: "CSS",
      record_types: ["task", "validation"],
      statuses: ["active", "passed"],
      task_id: taskId,
      min_revision: 1,
      max_revision: 2,
      limit: 1,
      offset: 1,
    });
    expect(scoped.page.total).toBeGreaterThan(1);
    expect(scoped.results).toHaveLength(1);
    expect(scoped.results.every((result) => result.project === projectId)).toBe(true);

    const hidden = await project.searchMemory({ query: "discarded-zeta" });
    expect(hidden.results).toHaveLength(0);
    const historical = await project.searchMemory({
      query: "discarded-zeta",
      include_superseded: true,
    });
    expect(historical.results.map((result) => result.id)).toEqual([oldDecisionId]);
    project.close();
  });

  it("rejects empty, oversized, unsafe, malformed, and secret-bearing queries", async () => {
    const project = await openProject({ cwd: tempProject });
    for (const query of [
      "",
      "   ",
      "x".repeat(513),
      "\u001b[31munsafe",
      "\ud800",
    ]) {
      await expect(project.searchMemory({ query })).rejects.toMatchObject({
        code: expect.stringMatching(/INVALID_INPUT|UNSAFE_INPUT/),
      });
    }
    await expect(
      project.searchMemory({ query: "api_key=synthetic-memory-search-secret" }),
    ).rejects.toMatchObject({ code: "SECRET_DETECTED" });
    await expect(
      project.searchMemory({ query: "CSS", min_revision: 3, max_revision: 2 }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      project.searchMemory({
        query: "CSS",
        record_types: ["validation"],
        statuses: ["accepted"],
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    project.close();
  });

  it("returns only bounded redacted output and never crosses project identity", async () => {
    const project = await openProject({ cwd: tempProject });
    const privateResult = await project.searchMemory({ query: "Private deployment" });
    expect(privateResult.results).toHaveLength(1);
    expect(JSON.stringify(privateResult)).not.toContain(syntheticSecret);
    expect(privateResult.results[0].match.excerpt.text.length).toBeLessThanOrEqual(240);
    expect(privateResult.results.every((result) => result.project === projectId)).toBe(true);
    project.close();
  });

  it("keeps SDK, CLI JSON, RPC, and MCP pages semantically identical", async () => {
    const input = {
      query: "CSS determinism",
      task_id: taskId,
      include_superseded: true,
      limit: 50,
    };
    const project = await openProject({ cwd: tempProject });
    const sdk = await project.searchMemory(input);
    project.close();

    const cli = await searchCli(tempProject, { ...input, json: true });
    const rpc = await handleRpcLine(
      JSON.stringify({
        protocol_version: RPC_PROTOCOL_VERSION,
        id: "search",
        method: "memory.search",
        params: { cwd: tempProject, project_id: projectId, input },
      }),
    );
    const mcp = await searchMcp({ project_id: projectId, ...input });
    if (!rpc.ok) throw new Error(`RPC search failed: ${rpc.error.code}`);
    const mcpContent = mcp.content[0];
    if (!mcpContent || mcpContent.type !== "text") {
      throw new Error("Expected MCP text search result.");
    }

    expect(JSON.parse(cli.output)).toEqual(sdk);
    expect(rpc.result).toEqual(sdk);
    expect(JSON.parse(mcpContent.text)).toEqual(sdk);
    expect(sdk.schema_version).toBe(MEMORY_SEARCH_SCHEMA_VERSION);
    expect(sdk.strategy).toBe(MEMORY_SEARCH_STRATEGY);
  });

  it("returns a stable no-result page without mutating canonical records", async () => {
    const beforeStore = new SqliteStore();
    await beforeStore.openProjectStore(tempProject);
    const before = JSON.stringify(beforeStore.listRecords());
    beforeStore.close();

    const project = await openProject({ cwd: tempProject });
    const page = await project.searchMemory({ query: "no-such-memory-term" });
    expect(page.results).toEqual([]);
    expect(page.page).toEqual({
      offset: 0,
      limit: 20,
      returned: 0,
      total: 0,
      has_more: false,
    });
    project.close();

    const afterStore = new SqliteStore();
    await afterStore.openProjectStore(tempProject);
    expect(JSON.stringify(afterStore.listRecords())).toBe(before);
    afterStore.close();
  });
});
