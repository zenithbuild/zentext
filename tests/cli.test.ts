import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { CliError, init, list, show, status } from "../src/cli/commands.js";
import { SqliteStore } from "../src/store/sqlite-store.js";

describe("Zentext CLI — Phase 2 read/inspect", () => {
  let tempHome: string;
  let tempProject: string;
  let originalHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "zentext-cli-test-"));
    tempProject = mkdtempSync(join(tmpdir(), "zentext-cli-proj-"));
    originalHome = process.env.HOME ?? "";
    process.env.HOME = tempHome;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    rmSync(tempHome, { recursive: true, force: true });
    rmSync(tempProject, { recursive: true, force: true });
  });

  it("init creates the store and reports it as created", async () => {
    const result = await init(tempProject);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("State:   created");
    expect(result.output).toContain("Next: run `zentext status`");
    expect(result.output).toContain(tempProject.split("/").pop() ?? "");
  });

  it("init is idempotent and reports already existed", async () => {
    const first = await init(tempProject);
    expect(first.output).toContain("State:   created");

    const second = await init(tempProject);
    expect(second.exitCode).toBe(0);
    expect(second.output).toContain("State:   already existed");
    expect(second.output).toContain(first.output.split("\n")[1].replace("ID:      ", ""));
  });

  it("status before init tells the user to run init", async () => {
    await expect(status(tempProject)).rejects.toThrow(
      /Run `zentext init` first/,
    );
  });

  it("status before init throws a CliError with exit code 2", async () => {
    try {
      await status(tempProject);
      expect.fail("expected status to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(CliError);
      expect((err as CliError).exitCode).toBe(2);
    }
  });

  it("status after init prints project and store summary", async () => {
    const initResult = await init(tempProject);
    const result = await status(tempProject);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Project:");
    expect(result.output).toContain(initResult.output.split("\n")[1].replace("ID:      ", ""));
    expect(result.output).toContain("Store:");
    expect(result.output).toContain("Record counts:");
  });

  it("status reports active tasks and open blockers", async () => {
    const store = new SqliteStore();
    await store.initProjectStore(tempProject);

    store.createRecord({
      type: "task",
      title: "Active task",
      goal: "Do something",
      status: "active",
      author: "user:test",
    });
    store.createRecord({
      type: "blocker",
      title: "Open blocker",
      blocker: "Something is wrong",
      status: "open",
      severity: "high",
      author: "user:test",
    });
    store.createRecord({
      type: "blocker",
      title: "Resolved blocker",
      blocker: "Fixed",
      status: "resolved",
      author: "user:test",
    });

    const result = await status(tempProject);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Open blockers: 1");
    expect(result.output).toContain("Active tasks:  1");
    store.close();
  });

  it("list after init with empty store works", async () => {
    await init(tempProject);
    const result = await list(tempProject, {});
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("(none)");
  });

  it("show prints a record by id", async () => {
    const store = new SqliteStore();
    await store.initProjectStore(tempProject);
    const created = store.createRecord({
      type: "decision",
      title: "Use SQLite",
      decision: "SQLite for local store",
      author: "user:test",
    });

    const result = await show(tempProject, created.id);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("DECISION: Use SQLite");
    expect(result.output).toContain(created.id);
    expect(result.output).toContain("SQLite for local store");
    store.close();
  });

  it("show missing id returns a clear not-found error", async () => {
    await init(tempProject);
    try {
      await show(tempProject, "rec_task_nonexistent");
      expect.fail("expected show to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(CliError);
      expect((err as CliError).exitCode).toBe(3);
      expect((err as Error).message).toContain("Record not found");
    }
  });

  it("list supports --type filter", async () => {
    const store = new SqliteStore();
    await store.initProjectStore(tempProject);
    store.createRecord({ type: "task", title: "T1", goal: "G1", author: "user:test" });
    store.createRecord({ type: "task", title: "T2", goal: "G2", author: "user:test" });
    store.createRecord({ type: "decision", title: "D1", decision: "D", author: "user:test" });

    const result = await list(tempProject, { type: "task" });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("T1");
    expect(result.output).toContain("T2");
    expect(result.output).not.toContain("D1");
    store.close();
  });

  it("list supports --status filter", async () => {
    const store = new SqliteStore();
    await store.initProjectStore(tempProject);
    store.createRecord({
      type: "task",
      title: "Done task",
      goal: "G",
      status: "done",
      author: "user:test",
    });
    store.createRecord({
      type: "task",
      title: "Active task",
      goal: "G",
      status: "active",
      author: "user:test",
    });

    const result = await list(tempProject, { status: "done" });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Done task");
    expect(result.output).not.toContain("Active task");
    store.close();
  });

  it("list supports --limit filter", async () => {
    const store = new SqliteStore();
    await store.initProjectStore(tempProject);
    for (let i = 0; i < 5; i++) {
      store.createRecord({
        type: "task",
        title: `Task ${i}`,
        goal: `Goal ${i}`,
        author: "user:test",
      });
    }

    const result = await list(tempProject, { limit: 2 });
    expect(result.exitCode).toBe(0);
    const lines = result.output.split("\n").filter((line) => line.startsWith("rec_"));
    expect(lines.length).toBe(2);
    store.close();
  });

  it("does not pollute real ~/.zentext", async () => {
    const result = await init(tempProject);
    const expectedPrefix = join(tempHome, ".zentext", "projects");
    const storeLine = result.output
      .split("\n")
      .find((line) => line.startsWith("Store:"));
    expect(storeLine).toBeDefined();
    expect(storeLine!.includes(expectedPrefix)).toBe(true);
  });

  it("CLI module does not expose write CLI commands", async () => {
    // This test documents the Phase 2 boundary: the commands module only
    // exports read/inspect functions. No add, handoff, edit, repack, audit.
    const commands = await import("../src/cli/commands.js");
    expect(commands.init).toBeTypeOf("function");
    expect(commands.status).toBeTypeOf("function");
    expect(commands.show).toBeTypeOf("function");
    expect(commands.list).toBeTypeOf("function");
    expect("add" in commands).toBe(false);
    expect("handoff" in commands).toBe(false);
    expect("edit" in commands).toBe(false);
    expect("repack" in commands).toBe(false);
    expect("audit" in commands).toBe(false);
  });
});
