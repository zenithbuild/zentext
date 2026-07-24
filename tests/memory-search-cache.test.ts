import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createMemoryWriter } from "../src/domain/memory-writer.js";
import {
  MemorySearchInputSchema,
  deriveMemorySearchState,
  type MemorySearchPage,
} from "../src/memory-search.js";
import {
  MEMORY_SEARCH_CACHE_MAX_BYTES,
  MEMORY_SEARCH_CACHE_MAX_ENTRIES,
  createMemorySearchCacheKey,
  getMemorySearchCacheStats,
  resetMemorySearchCache,
  setCachedMemorySearch,
} from "../src/memory-search-cache.js";
import { openProject } from "../src/sdk.js";
import { SqliteStore } from "../src/store/sqlite-store.js";

describe("revision-aware derived search cache", () => {
  let tempHome: string;
  let tempProject: string;
  let otherProject: string;
  let originalHome: string;
  let projectId: string;
  let taskId: string;

  beforeEach(async () => {
    resetMemorySearchCache();
    tempHome = mkdtempSync(join(tmpdir(), "zentext-cache-home-"));
    tempProject = mkdtempSync(join(tmpdir(), "zentext-cache-project-"));
    otherProject = mkdtempSync(join(tmpdir(), "zentext-cache-other-"));
    originalHome = process.env.HOME ?? "";
    process.env.HOME = tempHome;

    const store = new SqliteStore();
    const meta = await store.initProjectStore(tempProject);
    projectId = meta.projectId;
    taskId = store.createRecord({
      type: "task",
      title: "Cache correctness task",
      goal: "Prove revision-safe derived results.",
      refs: { files: ["src/cache.ts"] },
      author: "cache-test",
    }).id;
    store.close();
  });

  afterEach(() => {
    resetMemorySearchCache();
    process.env.HOME = originalHome;
    rmSync(tempHome, { recursive: true, force: true });
    rmSync(tempProject, { recursive: true, force: true });
    rmSync(otherProject, { recursive: true, force: true });
  });

  it("hits for the same canonical state and returns defensive copies", async () => {
    const project = await openProject({ cwd: tempProject });
    const first = await project.searchMemory({ query: "Cache correctness" });
    expect(project.getSearchCacheStats()).toMatchObject({
      hits: 0,
      misses: 1,
      stores: 1,
      entries: 1,
    });

    first.results[0]!.title = "caller mutation";
    const second = await project.searchMemory({ query: "Cache correctness" });
    expect(second.results[0]!.title).toBe("Cache correctness task");
    expect(project.getSearchCacheStats()).toMatchObject({
      hits: 1,
      misses: 1,
      stores: 1,
      entries: 1,
    });
    project.close();
  });

  it("keys every semantic query dimension and canonicalizes set-like filters", async () => {
    const store = new SqliteStore();
    await store.openProjectStore(tempProject);
    const records = store.listRecords();
    store.close();
    const state = deriveMemorySearchState(records, projectId);
    const parsed = (input: Parameters<typeof MemorySearchInputSchema.parse>[0]) =>
      MemorySearchInputSchema.parse(input);
    const base = parsed({ query: "cache", limit: 20 });
    const baseKey = createMemorySearchCacheKey(projectId, state, base);
    const variants = [
      parsed({ query: "different" }),
      parsed({ query: "cache", record_types: ["task"] }),
      parsed({ query: "cache", statuses: ["active"] }),
      parsed({ query: "cache", task_id: taskId }),
      parsed({ query: "cache", min_revision: 1 }),
      parsed({ query: "cache", max_revision: 1 }),
      parsed({ query: "cache", include_superseded: true }),
      parsed({ query: "cache", freshness_mode: "current-only" }),
      parsed({ query: "cache", limit: 1 }),
      parsed({ query: "cache", offset: 1 }),
    ];
    expect(new Set(variants.map((input) =>
      createMemorySearchCacheKey(projectId, state, input),
    )).size).toBe(variants.length);
    expect(
      variants.every(
        (input) =>
          createMemorySearchCacheKey(projectId, state, input) !== baseKey,
      ),
    ).toBe(true);

    const orderedA = parsed({
      query: " cache ",
      record_types: ["task", "decision"],
      statuses: ["active", "accepted"],
    });
    const orderedB = parsed({
      query: "CACHE",
      record_types: ["decision", "task"],
      statuses: ["accepted", "active"],
    });
    expect(createMemorySearchCacheKey(projectId, state, orderedA)).toBe(
      createMemorySearchCacheKey(projectId, state, orderedB),
    );
  });

  it("misses and evicts prior-state entries after a successful cross-store write", async () => {
    const reader = await openProject({ cwd: tempProject });
    const before = await reader.searchMemory({ query: "cache" });
    expect(before.state.active_task_revision).toBe(1);

    const writer = await openProject({ cwd: tempProject });
    await writer.updateTask({
      task_id: taskId,
      expected_revision: 1,
      summary: "Cache revision advanced.",
      source_environment: "cache-writer",
    });
    writer.close();

    const after = await reader.searchMemory({ query: "cache" });
    expect(after.state.active_task_revision).toBe(2);
    expect(after.state.fingerprint).not.toBe(before.state.fingerprint);
    expect(reader.getSearchCacheStats()).toMatchObject({
      hits: 0,
      misses: 2,
      stores: 2,
      evictions: 1,
      entries: 1,
    });
    reader.close();
  });

  it("keeps a warm entry after rejected and no-op writes", async () => {
    const reader = await openProject({ cwd: tempProject });
    await reader.searchMemory({ query: "cache" });

    const writer = await openProject({ cwd: tempProject });
    await expect(
      writer.updateTask({
        task_id: taskId,
        expected_revision: 2,
        summary: "This stale write must fail.",
        source_environment: "cache-writer",
      }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    writer.close();

    const rawStore = new SqliteStore();
    await rawStore.openProjectStore(tempProject);
    const task = rawStore.getRecord(taskId)!;
    const noOp = createMemoryWriter(rawStore).updateRecord(
      taskId,
      { title: task.title },
      { expectedRevision: 1, author: "cache-test" },
    );
    expect(noOp.revision).toBe(1);
    rawStore.close();

    await reader.searchMemory({ query: "cache" });
    expect(reader.getSearchCacheStats()).toMatchObject({
      hits: 1,
      misses: 1,
      stores: 1,
      evictions: 0,
    });
    reader.close();
  });

  it("isolates projects even when their query text is identical", async () => {
    const otherStore = new SqliteStore();
    const otherMeta = await otherStore.initProjectStore(otherProject);
    otherStore.createRecord({
      type: "task",
      title: "Cache correctness task",
      goal: "Remain isolated.",
      author: "cache-test",
    });
    otherStore.close();

    const first = await openProject({ cwd: tempProject });
    const second = await openProject({ cwd: otherProject });
    const firstPage = await first.searchMemory({ query: "Cache correctness" });
    const secondPage = await second.searchMemory({ query: "Cache correctness" });
    expect(firstPage.project_id).toBe(projectId);
    expect(secondPage.project_id).toBe(otherMeta.projectId);
    expect(firstPage.state.fingerprint).not.toBe(secondPage.state.fingerprint);
    expect(first.getSearchCacheStats().entries).toBe(1);
    expect(second.getSearchCacheStats().entries).toBe(1);
    first.close();
    second.close();
  });

  it("enforces entry and byte bounds with observable eviction", async () => {
    const project = await openProject({ cwd: tempProject });
    for (let index = 0; index <= MEMORY_SEARCH_CACHE_MAX_ENTRIES; index += 1) {
      await project.searchMemory({ query: `cache-query-${index}` });
    }
    expect(project.getSearchCacheStats()).toMatchObject({
      entries: MEMORY_SEARCH_CACHE_MAX_ENTRIES,
      evictions: 1,
    });

    const page = await project.searchMemory({ query: "cache" });
    const oversized = structuredClone(page) as MemorySearchPage;
    oversized.results[0]!.title = "x".repeat(
      MEMORY_SEARCH_CACHE_MAX_BYTES + 1,
    );
    setCachedMemorySearch(
      projectId,
      "oversized-test-key",
      oversized.state.fingerprint,
      oversized,
    );
    expect(project.getSearchCacheStats().skipped_oversized).toBe(1);
    project.close();
  });

  it("never reuses a prior revision after interleaved reads and writes", async () => {
    const reader = await openProject({ cwd: tempProject });
    const writer = await openProject({ cwd: tempProject });
    let revision = 1;
    for (let index = 0; index < 4; index += 1) {
      await reader.searchMemory({ query: "cache" });
      const update = await writer.updateTask({
        task_id: taskId,
        expected_revision: revision,
        summary: `Cache revision ${revision + 1}.`,
        source_environment: "cache-concurrency-test",
      });
      revision = update.revision;
      const current = await reader.searchMemory({ query: "cache" });
      expect(current.state.active_task_revision).toBe(revision);
    }
    expect(reader.getSearchCacheStats()).toMatchObject({
      misses: 5,
      stores: 5,
      entries: 1,
    });
    reader.close();
    writer.close();
  });

  it("starts empty when process-local state is reset", async () => {
    const project = await openProject({ cwd: tempProject });
    await project.searchMemory({ query: "cache" });
    expect(project.getSearchCacheStats().entries).toBe(1);
    resetMemorySearchCache();
    expect(getMemorySearchCacheStats(projectId)).toMatchObject({
      hits: 0,
      misses: 0,
      entries: 0,
      bytes: 0,
    });
    project.close();
  });
});
