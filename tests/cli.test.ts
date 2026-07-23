import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  CliError,
  handoffAcknowledge,
  handoffCreate,
  handoffShow,
  handoffValidate,
  init,
  list,
  show,
  status,
  taskCreate,
  taskShow,
  taskUpdate,
} from "../src/cli/commands.js";
import { SqliteStore } from "../src/store/sqlite-store.js";
import { createMemoryWriter } from "../src/domain/memory-writer.js";

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
    expect(result.output).not.toContain("rec_decision_");
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

  it("status ignores archived/superseded handoffs when choosing latest", async () => {
    const store = new SqliteStore();
    await store.initProjectStore(tempProject);

    const latest = store.createRecord({
      type: "handoff",
      title: "Current handoff",
      summary: "This is the current handoff",
      status: "latest",
      author: "user:test",
      from: "agent:a",
      to: "agent:b",
      context: "Current context",
      state: "Current state",
      next: "Next steps",
    });

    // Simulate an archived handoff touched later; it should not replace latest.
    store.createRecord({
      type: "handoff",
      title: "Old archived handoff",
      summary: "This handoff is archived",
      status: "archived",
      author: "user:test",
      from: "agent:a",
      to: "agent:b",
      context: "Old context",
      state: "Old state",
      next: "Old next",
    });

    const result = await status(tempProject);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Latest handoff:");
    expect(result.output).toContain(latest.id);
    expect(result.output).toContain("Current handoff");
    expect(result.output).not.toContain("Old archived handoff");
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



});

describe("Zentext CLI — handoff commands", () => {
  let tempHome: string;
  let tempProject: string;
  let originalHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "zentext-cli-handoff-test-"));
    tempProject = mkdtempSync(join(tmpdir(), "zentext-cli-handoff-proj-"));
    originalHome = process.env.HOME ?? "";
    process.env.HOME = tempHome;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    rmSync(tempHome, { recursive: true, force: true });
    rmSync(tempProject, { recursive: true, force: true });
  });

  it("handoff show reports no handoff when none exists", async () => {
    await init(tempProject);
    try {
      await handoffShow(tempProject);
      expect.fail("expected handoffShow to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(CliError);
      expect((err as CliError).exitCode).toBe(3);
      expect((err as Error).message).toContain("No latest handoff found");
    }
  });

  it("handoff create stores a structured handoff", async () => {
    const store = new SqliteStore();
    await store.initProjectStore(tempProject);
    store.createRecord({
      type: "task",
      title: "Verify CSS determinism",
      goal: "Trace contract",
      status: "active",
      author: "agent:A",
    });

    const result = await handoffCreate(tempProject, {
      from: "agent:A",
      stoppingPoint: "Read contract and implementation.",
      nextAction: "Run fresh build and compare.",
      completed: ["Read contract"],
      blockers: ["Need build artifact"],
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Previous agent: agent:A");
    expect(result.output).toContain("Stopping point: Read contract and implementation.");
    expect(result.output).toContain("Next action: Run fresh build and compare.");
    expect(result.output).toContain("Completed work:");
    expect(result.output).toContain("Blockers: Need build artifact");
    store.close();
  });

  it("handoff show displays the latest handoff and detects current revision", async () => {
    const store = new SqliteStore();
    await store.initProjectStore(tempProject);
    store.createRecord({
      type: "task",
      title: "Verify CSS determinism",
      goal: "Trace contract",
      status: "active",
      author: "agent:A",
    });

    await handoffCreate(tempProject, {
      from: "agent:A",
      stoppingPoint: "Read contract.",
      nextAction: "Compare build outputs.",
    });

    const result = await handoffShow(tempProject);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Verify CSS determinism");
    expect(result.output).toContain("Task revision:");
    store.close();
  });

  it("handoff show exits nonzero when handoff is stale", async () => {
    const store = new SqliteStore();
    await store.initProjectStore(tempProject);
    const task = store.createRecord({
      type: "task",
      title: "Verify CSS determinism",
      goal: "Trace contract",
      status: "active",
      author: "agent:A",
    });

    await handoffCreate(tempProject, {
      from: "agent:A",
      stoppingPoint: "Read contract.",
      nextAction: "Compare build outputs.",
    });

    // Advance the task revision outside the handoff workflow.
    const writer = createMemoryWriter(store);
    writer.updateRecord(task.id, { next: "new step" }, { author: "agent:B" });

    const result = await handoffShow(tempProject);
    expect(result.exitCode).toBe(4);
    expect(result.output).toContain("STALE");
    store.close();
  });

  it("handoff acknowledge renders startup acknowledgement", async () => {
    const store = new SqliteStore();
    await store.initProjectStore(tempProject);
    store.createRecord({
      type: "task",
      title: "Verify CSS determinism",
      goal: "Trace contract",
      status: "active",
      author: "agent:A",
    });

    await handoffCreate(tempProject, {
      from: "agent:A",
      stoppingPoint: "Read contract.",
      nextAction: "Compare build outputs.",
      completed: ["Read contract"],
    });

    const result = await handoffAcknowledge(tempProject);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Zentext context loaded.");
    expect(result.output).toContain("Active task: Verify CSS determinism");
    expect(result.output).toContain("I will continue from this stopping point");
    store.close();
  });


  it("handoff acknowledge rejects stale handoff and does not claim continuation", async () => {
    const store = new SqliteStore();
    await store.initProjectStore(tempProject);
    const task = store.createRecord({
      type: "task",
      title: "Verify CSS determinism",
      goal: "Trace contract",
      status: "active",
      author: "agent:A",
    });

    await handoffCreate(tempProject, {
      from: "agent:A",
      stoppingPoint: "Read contract.",
      nextAction: "Compare build outputs.",
      completed: ["Read contract"],
    });

    const writer = createMemoryWriter(store);
    writer.updateRecord(task.id, { next: "new step" }, { author: "agent:B" });

    const result = await handoffAcknowledge(tempProject);
    expect(result.exitCode).toBe(4);
    expect(result.output).toContain("Handoff rejected");
    expect(result.output).not.toContain("Zentext context loaded.");
    expect(result.output).not.toContain("I will continue from this stopping point");
    expect(result.output).toContain("Live revision:");
    store.close();
  });

  it("handoff acknowledge --json reports acknowledged false for stale handoff", async () => {
    const store = new SqliteStore();
    await store.initProjectStore(tempProject);
    const task = store.createRecord({
      type: "task",
      title: "Verify CSS determinism",
      goal: "Trace contract",
      status: "active",
      author: "agent:A",
    });

    await handoffCreate(tempProject, {
      from: "agent:A",
      stoppingPoint: "Read contract.",
      nextAction: "Compare build outputs.",
      completed: ["Read contract"],
    });

    const writer = createMemoryWriter(store);
    writer.updateRecord(task.id, { next: "new step" }, { author: "agent:B" });

    const result = await handoffAcknowledge(tempProject, { json: true });
    expect(result.exitCode).toBe(4);
    const parsed = JSON.parse(result.output);
    expect(parsed.acknowledged).toBe(false);
    expect(parsed.current).toBe(false);
    expect(parsed.reason).toContain("active_task revision changed");
    expect(parsed.handoff_revision).toBe(1);
    expect(parsed.live_revision).toBe(2);
    expect(parsed.task_id).toBe(task.id);
    store.close();
  });
  it("handoff validate returns current for matching revision", async () => {
    const store = new SqliteStore();
    await store.initProjectStore(tempProject);
    store.createRecord({
      type: "task",
      title: "Verify CSS determinism",
      goal: "Trace contract",
      status: "active",
      author: "agent:A",
    });

    await handoffCreate(tempProject, {
      from: "agent:A",
      stoppingPoint: "Read contract.",
      nextAction: "Compare build outputs.",
    });

    const result = await handoffValidate(tempProject);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("current");
    store.close();
  });

  it("handoff show --json returns structured JSON", async () => {
    const store = new SqliteStore();
    await store.initProjectStore(tempProject);
    store.createRecord({
      type: "task",
      title: "Verify CSS determinism",
      goal: "Trace contract",
      status: "active",
      author: "agent:A",
    });

    await handoffCreate(tempProject, {
      from: "agent:A",
      stoppingPoint: "Read contract.",
      nextAction: "Compare build outputs.",
    });

    const result = await handoffShow(tempProject, { json: true });
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.output);
    expect(parsed.active_task.title).toBe("Verify CSS determinism");
    expect(parsed.current).toBe(true);
    store.close();
  });
  it("task create creates an active task", async () => {
    await init(tempProject);
    const result = await taskCreate(tempProject, {
      title: "Investigate CSS determinism",
      goal: "Confirm ordering and hashing",
    });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Created task");
    expect(result.output).toContain("Investigate CSS determinism");
    expect(result.output).toContain("Status: active");
  });

  it("task create rejects an invalid status", async () => {
    await init(tempProject);
    try {
      await taskCreate(tempProject, {
        title: "Investigate CSS determinism",
        goal: "Confirm ordering and hashing",
        status: "invalid",
      });
      expect.fail("expected taskCreate to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(CliError);
      expect((err as CliError).exitCode).toBe(1);
      expect((err as Error).message).toContain("Invalid task status");
    }
  });

  it("task show displays the active task", async () => {
    await init(tempProject);
    await taskCreate(tempProject, { title: "T1", goal: "G1" });
    const result = await taskShow(tempProject);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("TASK: T1");
    expect(result.output).toContain("status:     active");
  });

  it("task show guides the user when no tasks exist", async () => {
    await init(tempProject);
    const result = await taskShow(tempProject);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("No tasks exist");
    expect(result.output).toContain("zentext task create --title");
  });

  it("task update advances task revision", async () => {
    await init(tempProject);
    const created = await taskCreate(tempProject, { title: "T1", goal: "G1" });
    const taskId = created.output.split("Created task ")[1].split("\n")[0];

    const result = await taskUpdate(tempProject, {
      summary: "Updated objective",
      note: "Making progress",
      nextAction: "Run tests",
    });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Updated task");
    expect(result.output).toContain("revision:   2");
    expect(result.output).toContain("Updated objective");
    expect(result.output).toContain("notes: Making progress");
    expect(result.output).toContain("next_action: Run tests");
  });

  it("retains repeated task notes and handoff values through persisted reload and output", async () => {
    await init(tempProject);
    await taskCreate(tempProject, { title: "Portable continuation", goal: "Retain every value" });

    const updated = await taskUpdate(tempProject, {
      notes: ["First note, with comma", "Second note with spaces", "検証済み ✅"],
    });
    expect(updated.output).toContain("First note, with comma");
    expect(updated.output).toContain("Second note with spaces");
    expect(updated.output).toContain("検証済み ✅");

    await handoffCreate(tempProject, {
      from: "tool-a",
      stoppingPoint: "Parser and persistence are complete.",
      nextAction: "Validate every output surface.",
      completed: ["Implemented parser, preserving commas", "Added regression coverage"],
      blockers: ["Provider A unavailable", "Need clean consumer run"],
      filesChanged: ["src/cli/args.ts", "tests/cli-args.test.ts"],
      verification: ["npm run typecheck:test", "npm test -- cli-args"],
    });

    const human = await handoffShow(tempProject);
    expect(human.output.indexOf("Implemented parser, preserving commas")).toBeLessThan(
      human.output.indexOf("Added regression coverage"),
    );
    expect(human.output).toContain("src/cli/args.ts");
    expect(human.output).toContain("tests/cli-args.test.ts");

    const json = await handoffShow(tempProject, { json: true });
    const parsed = JSON.parse(json.output);
    expect(parsed.completed).toEqual([
      "Implemented parser, preserving commas",
      "Added regression coverage",
    ]);
    expect(parsed.blockers).toEqual(["Provider A unavailable", "Need clean consumer run"]);
    expect(parsed.files_changed).toEqual(["src/cli/args.ts", "tests/cli-args.test.ts"]);
    expect(parsed.verification).toEqual(["npm run typecheck:test", "npm test -- cli-args"]);

    const store = new SqliteStore();
    await store.openProjectStore(tempProject);
    const task = store.listRecords({ type: "task", status: "active" })[0] as unknown as {
      notes: string[];
    };
    expect(task.notes).toEqual(["First note, with comma", "Second note with spaces", "検証済み ✅"]);
    store.close();
  });

  it("handoff create fails with guidance when no active task exists", async () => {
    await init(tempProject);
    try {
      await handoffCreate(tempProject, {
        from: "agent:A",
        stoppingPoint: "Read contract.",
        nextAction: "Run tests.",
      });
      expect.fail("expected handoffCreate to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(CliError);
      expect((err as CliError).exitCode).toBe(1);
      expect((err as Error).message).toContain("no active or blocked task");
      expect((err as Error).message).toContain("zentext task create --title");
    }
  });

  it("status guides the user when no active task exists", async () => {
    await init(tempProject);
    const result = await status(tempProject);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("No active task recorded yet");
    expect(result.output).toContain("zentext task create --title");
  });

  it("CLI module does not expose unapproved write CLI commands", async () => {
    const commands = await import("../src/cli/commands.js");
    expect(commands.init).toBeTypeOf("function");
    expect(commands.status).toBeTypeOf("function");
    expect(commands.show).toBeTypeOf("function");
    expect(commands.list).toBeTypeOf("function");
    expect(commands.repack).toBeTypeOf("function");
    expect(commands.handoffShow).toBeTypeOf("function");
    expect(commands.handoffCreate).toBeTypeOf("function");
    expect(commands.taskCreate).toBeTypeOf("function");
    expect(commands.taskShow).toBeTypeOf("function");
    expect(commands.taskUpdate).toBeTypeOf("function");
    expect("add" in commands).toBe(false);
    expect("edit" in commands).toBe(false);
    expect("audit" in commands).toBe(false);
  });
});
