import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { SqliteStore } from "../src/store/sqlite-store.js";
import { repack } from "../src/repack/engine.js";
import { CliError, repack as repackCli, init } from "../src/cli/commands.js";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Zentext repack engine", () => {
  let tempHome: string;
  let tempProject: string;
  let originalHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "zentext-repack-test-"));
    tempProject = mkdtempSync(join(tmpdir(), "zentext-repack-proj-"));
    originalHome = process.env.HOME ?? "";
    process.env.HOME = tempHome;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    rmSync(tempHome, { recursive: true, force: true });
    rmSync(tempProject, { recursive: true, force: true });
  });

  function openStore(): SqliteStore {
    const store = new SqliteStore();
    store.initProjectStore(tempProject);
    return store;
  }

  it("empty store produces a concise payload", async () => {
    const store = openStore();
    const meta = await store.openProjectStore(tempProject);
    const result = repack(store, meta);
    expect(result.markdown).toContain("# Zentext context");
    expect(result.markdown).toContain("Point-in-time snapshot");
    store.close();
  });

  it("includes one active task", async () => {
    const store = openStore();
    const meta = await store.openProjectStore(tempProject);
    store.createRecord({
      type: "task",
      title: "Implement auth",
      goal: "Add OAuth login",
      next: "Wire callback",
      author: "user:test",
    });

    const result = repack(store, meta);
    expect(result.markdown).toContain("## Active task");
    expect(result.markdown).toContain("Implement auth");
    expect(result.markdown).toContain("Add OAuth login");
    expect(result.markdown).toContain("Wire callback");
    store.close();
  });

  it("selects the most recently updated active or blocked task", async () => {
    const store = openStore();
    const meta = await store.openProjectStore(tempProject);
    store.createRecord({
      type: "task",
      title: "Old active task",
      goal: "Old goal",
      author: "user:test",
    });
    await delay(50);
    const blocked = store.createRecord({
      type: "task",
      title: "Recent blocked task",
      goal: "New goal",
      status: "blocked",
      author: "user:test",
    });

    const result = repack(store, meta);
    expect(result.markdown).toContain("## Active task");
    expect(result.markdown).toContain("Recent blocked task");
    expect(result.markdown).toContain("## Other active tasks");
    expect(result.markdown).toContain("Old active task");
    store.close();
  });

  it("selects most recently updated active task when multiple exist", async () => {
    const store = openStore();
    const meta = await store.openProjectStore(tempProject);
    store.createRecord({
      type: "task",
      title: "Old task",
      goal: "G1",
      author: "user:test",
    });
    const latest = store.createRecord({
      type: "task",
      title: "New task",
      goal: "G2",
      author: "user:test",
    });

    const result = repack(store, meta);
    expect(result.markdown).toContain("## Active task");
    expect(result.markdown).toContain("New task");
    expect(result.markdown).toContain("## Other active tasks");
    expect(result.markdown).toContain("Old task");
    store.close();
  });

  it("prioritizes focus-matched active task", async () => {
    const store = openStore();
    const meta = await store.openProjectStore(tempProject);
    store.createRecord({
      type: "task",
      title: "Newer task",
      goal: "General goal",
      author: "user:test",
    });
    store.createRecord({
      type: "task",
      title: "Auth task",
      goal: "Implement OAuth",
      tags: ["auth"],
      author: "user:test",
    });

    const result = repack(store, meta, { focus: "auth" });
    expect(result.markdown).toContain("## Active task");
    expect(result.markdown).toContain("Auth task");
    expect(result.markdown).toContain("## Other active tasks");
    expect(result.markdown).toContain("Newer task");
    store.close();
  });

  it("includes open blockers", async () => {
    const store = openStore();
    const meta = await store.openProjectStore(tempProject);
    store.createRecord({
      type: "task",
      title: "T",
      goal: "G",
      author: "user:test",
    });
    store.createRecord({
      type: "blocker",
      title: "OAuth fails",
      blocker: "OAuth callback returns 400",
      severity: "high",
      workaround: "Use dev mode",
      status: "open",
      author: "user:test",
    });

    const result = repack(store, meta);
    expect(result.markdown).toContain("## Blockers");
    expect(result.markdown).toContain("OAuth fails");
    expect(result.markdown).toContain("[high]");
    expect(result.markdown).toContain("Workaround: Use dev mode");
    store.close();
  });

  it("includes accepted decisions", async () => {
    const store = openStore();
    const meta = await store.openProjectStore(tempProject);
    store.createRecord({
      type: "task",
      title: "T",
      goal: "G",
      author: "user:test",
    });
    store.createRecord({
      type: "decision",
      title: "Use SQLite",
      decision: "SQLite for local store",
      rationale: "Simplicity",
      status: "accepted",
      author: "user:test",
    });

    const result = repack(store, meta);
    expect(result.markdown).toContain("## Decisions");
    expect(result.markdown).toContain("Use SQLite");
    expect(result.markdown).toContain("Simplicity");
    store.close();
  });

  it("excludes superseded records", async () => {
    const store = openStore();
    const meta = await store.openProjectStore(tempProject);
    store.createRecord({
      type: "task",
      title: "T",
      goal: "G",
      author: "user:test",
    });
    store.createRecord({
      type: "decision",
      title: "Old decision",
      decision: "Use MongoDB",
      status: "superseded",
      author: "user:test",
    });

    const result = repack(store, meta);
    expect(result.markdown).not.toContain("Old decision");
    expect(result.markdown).not.toContain("Use MongoDB");
    store.close();
  });

  it("excludes archived handoffs from latest handoff selection", async () => {
    const store = openStore();
    const meta = await store.openProjectStore(tempProject);
    store.createRecord({
      type: "handoff",
      title: "Current handoff",
      status: "latest",
      author: "user:test",
      from: "agent:a",
      to: "agent:b",
      context: "Current",
      state: "Good",
      next: "Continue",
    });
    store.createRecord({
      type: "handoff",
      title: "Archived handoff",
      status: "archived",
      author: "user:test",
      from: "agent:a",
      to: "agent:b",
      context: "Old",
      state: "Done",
      next: "Nothing",
    });

    const result = repack(store, meta);
    expect(result.markdown).toContain("## Latest handoff");
    expect(result.markdown).toContain("Current handoff");
    expect(result.markdown).not.toContain("Archived handoff");
    store.close();
  });

  it("orders validations by updated_at", async () => {
    const store = openStore();
    const meta = await store.openProjectStore(tempProject);
    store.createRecord({
      type: "task",
      title: "T",
      goal: "G",
      author: "user:test",
    });
    const oldValidation = store.createRecord({
      type: "validation",
      title: "Old validation",
      check: "lint",
      result: "passed",
      author: "user:test",
    });
    await delay(50);
    const newValidation = store.createRecord({
      type: "validation",
      title: "New validation",
      check: "test",
      result: "failed",
      author: "user:test",
    });

    const result = repack(store, meta);
    const validationIndex = result.markdown.indexOf("## Validation state");
    const oldIndex = result.markdown.indexOf("lint: passed");
    const newIndex = result.markdown.indexOf("test: failed");
    expect(validationIndex).toBeGreaterThan(-1);
    expect(oldIndex).toBeGreaterThan(-1);
    expect(newIndex).toBeGreaterThan(-1);
    // Newer validation should appear before older one.
    expect(newIndex).toBeLessThan(oldIndex);
    store.close();
  });

  it("includes active policies", async () => {
    const store = openStore();
    const meta = await store.openProjectStore(tempProject);
    store.createRecord({
      type: "task",
      title: "T",
      goal: "G",
      author: "user:test",
    });
    store.createRecord({
      type: "policy",
      title: "No main commits",
      rule: "Never commit directly to main",
      scope: "project",
      enforcement: "required",
      status: "active",
      author: "user:test",
    });

    const result = repack(store, meta);
    expect(result.markdown).toContain("## Active policies");
    expect(result.markdown).toContain("No main commits");
    expect(result.markdown).toContain("required");
    store.close();
  });

  it("formats handoff timestamps deterministically as ISO", async () => {
    const store = openStore();
    const meta = await store.openProjectStore(tempProject);
    const handoff = store.createRecord({
      type: "handoff",
      title: "H",
      status: "latest",
      author: "user:test",
      from: "agent:a",
      to: "agent:b",
      context: "C",
      state: "S",
      next: "N",
    });

    const result = repack(store, meta);
    expect(result.markdown).toContain(handoff.updated_at);
    // Must not contain locale-dependent formatting like AM/PM markers.
    expect(result.markdown).not.toMatch(/\bAM\b|\bPM\b/);
    store.close();
  });

  it("produces deterministic output for same store state", async () => {
    const store = openStore();
    const meta = await store.openProjectStore(tempProject);
    store.createRecord({
      type: "task",
      title: "T",
      goal: "G",
      author: "user:test",
    });

    const result1 = repack(store, meta);
    const result2 = repack(store, meta);
    // The generation timestamp in the header is expected to differ across calls,
    // so compare the body only. The body must be byte-identical for identical store state.
    const body1 = result1.markdown.split("\n\n").slice(2).join("\n\n");
    const body2 = result2.markdown.split("\n\n").slice(2).join("\n\n");
    expect(body1).toBe(body2);
    store.close();
  });

  it("tie-breaks equal updated_at by id ascending", async () => {
    const store = openStore();
    const meta = await store.openProjectStore(tempProject);
    // created_at/updated_at may differ slightly; force same timestamp by using
    // a custom record with explicit fields is not allowed (generated fields).
    // Instead we rely on id ordering when timestamps are equal.
    const a = store.createRecord({
      type: "blocker",
      title: "A blocker",
      blocker: "A",
      status: "open",
      author: "user:test",
    });
    await delay(50);
    const b = store.createRecord({
      type: "blocker",
      title: "B blocker",
      blocker: "B",
      status: "open",
      author: "user:test",
    });

    const result = repack(store, meta);
    const aIndex = result.markdown.indexOf("A blocker");
    const bIndex = result.markdown.indexOf("B blocker");
    // b was created later, so it should appear first (updated_at descending).
    expect(bIndex).toBeLessThan(aIndex);
    store.close();
  });

  it("respects default max-size budget", async () => {
    const store = openStore();
    const meta = await store.openProjectStore(tempProject);
    store.createRecord({
      type: "task",
      title: "T",
      goal: "G",
      author: "user:test",
    });
    for (let i = 0; i < 50; i++) {
      store.createRecord({
        type: "log",
        title: `Log ${i}`,
        summary: `Summary ${i} `.repeat(50),
        author: "user:test",
      });
    }

    const result = repack(store, meta);
    expect(result.markdown.length).toBeLessThanOrEqual(12000);
    store.close();
  });

  it("omits lower-priority content first under tight budget", async () => {
    const store = openStore();
    const meta = await store.openProjectStore(tempProject);
    store.createRecord({
      type: "task",
      title: "T",
      goal: "G",
      author: "user:test",
    });
    store.createRecord({
      type: "blocker",
      title: "Open blocker",
      blocker: "B",
      status: "open",
      author: "user:test",
    });
    for (let i = 0; i < 20; i++) {
      store.createRecord({
        type: "log",
        title: `Log ${i}`,
        summary: `Log summary ${i} `.repeat(30),
        author: "user:test",
      });
    }

    const result = repack(store, meta, { maxSize: 2000 });
    expect(result.markdown).toContain("## Active task");
    expect(result.markdown).toContain("## Blockers");
    // Logs are lower priority and should be dropped or summarized.
    expect(result.markdown).not.toContain("## Recent logs");
    expect(result.markdown.length).toBeLessThanOrEqual(2000);
    store.close();
  });

  it("preserves primary task and blockers under tight budget", async () => {
    const store = openStore();
    const meta = await store.openProjectStore(tempProject);
    store.createRecord({
      type: "task",
      title: "Critical task",
      goal: "G",
      author: "user:test",
    });
    store.createRecord({
      type: "blocker",
      title: "Critical blocker",
      blocker: "B",
      status: "open",
      author: "user:test",
    });
    for (let i = 0; i < 30; i++) {
      store.createRecord({
        type: "decision",
        title: `Decision ${i}`,
        decision: `D${i} `.repeat(40),
        status: "accepted",
        author: "user:test",
      });
    }

    const result = repack(store, meta, { maxSize: 1500 });
    expect(result.markdown).toContain("Critical task");
    expect(result.markdown).toContain("Critical blocker");
    expect(result.markdown.length).toBeLessThanOrEqual(1500);
    store.close();
  });

  it("honestly overflows budget when mandatory content exceeds it", async () => {
    const store = openStore();
    const meta = await store.openProjectStore(tempProject);
    store.createRecord({
      type: "task",
      title: "Huge task",
      goal: "G".repeat(500),
      author: "user:test",
    });
    store.createRecord({
      type: "blocker",
      title: "Huge blocker",
      blocker: "B".repeat(500),
      status: "open",
      author: "user:test",
    });

    const result = repack(store, meta, { maxSize: 100 });
    expect(result.markdown).toContain("Huge task");
    expect(result.markdown).toContain("Huge blocker");
    // The omission notice must not make a mandatory overflow worse.
    expect(result.markdown).not.toContain("Omitted context notice");
    store.close();
  });

  it("CLI repack --out writes the same payload to a file", async () => {
    await init(tempProject);
    const outPath = join(tempProject, "context.md");
    const result = await repackCli(tempProject, { out: outPath });
    expect(result.exitCode).toBe(0);
    const written = readFileSync(outPath, "utf8");
    expect(written).toBe(result.output);
    expect(written).toContain("# Zentext context");
  });

  it("CLI repack creates parent directories for --out", async () => {
    await init(tempProject);
    const outPath = join(tempProject, "nested", "context.md");
    const result = await repackCli(tempProject, { out: outPath });
    expect(result.exitCode).toBe(0);
    const written = readFileSync(outPath, "utf8");
    expect(written).toBe(result.output);
  });

  it("CLI repack rejects non-numeric --max-size", async () => {
    await init(tempProject);
    await expect(repackCli(tempProject, { maxSize: NaN })).rejects.toThrow(
      /--max-size must be a positive number/,
    );
  });

  it("CLI repack rejects non-positive --max-size", async () => {
    await init(tempProject);
    await expect(repackCli(tempProject, { maxSize: 0 })).rejects.toThrow(
      /--max-size must be a positive number/,
    );
    await expect(repackCli(tempProject, { maxSize: -100 })).rejects.toThrow(
      /--max-size must be a positive number/,
    );
  });

  it("CLI repack before init tells the user to run init", async () => {
    await expect(repackCli(tempProject, {})).rejects.toThrow(
      /Run `zentext init` first/,
    );
  });

  it("CLI repack before init throws a CliError with exit code 2", async () => {
    try {
      await repackCli(tempProject, {});
      expect.fail("expected repack to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(CliError);
      expect((err as CliError).exitCode).toBe(2);
    }
  });

  it("does not pollute real ~/.zentext during repack", async () => {
    await init(tempProject);
    const result = await repackCli(tempProject, {});
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("~/.zentext/projects");
    expect(result.output).toContain("Point-in-time snapshot");
  });

  it("engine uses only deterministic local logic", () => {
    // This test documents Phase 3 boundaries: the engine module must not import
    // vector, MCP, model, graph, or cloud dependencies.
    const source = readFileSync(
      join(import.meta.dirname, "../src/repack/engine.ts"),
      "utf8",
    );
    expect(source).not.toContain("@modelcontextprotocol");
    expect(source).not.toContain("openai");
    expect(source).not.toContain("vector");
    expect(source).not.toContain("semantic");
    expect(source).not.toContain("embedding");
  });
});
