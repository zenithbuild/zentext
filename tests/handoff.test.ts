import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { SqliteStore } from "../src/store/sqlite-store.js";
import {
  buildHandoff,
  handoffToCreateInput,
  isHandoffCurrent,
  recordToHandoff,
  renderAcknowledgement,
  validateHandoff,
  HandoffValidationError,

} from "../src/handoff.js";
import { createMemoryWriter } from "../src/domain/memory-writer.js";

describe("handoff contract", () => {
  let tempHome: string;
  let tempProject: string;
  let originalHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "zentext-handoff-test-"));
    tempProject = mkdtempSync(join(tmpdir(), "zentext-handoff-proj-"));
    originalHome = process.env.HOME ?? "";
    process.env.HOME = tempHome;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    rmSync(tempHome, { recursive: true, force: true });
    rmSync(tempProject, { recursive: true, force: true });
  });

  function seedStore(store: SqliteStore) {
    store.createRecord({
      type: "task",
      title: "Verify CSS determinism contract",
      goal: "Trace Zenith CSS determinism contract to implementation",
      status: "active",
      author: "agent:A",
    });
    store.createRecord({
      type: "decision",
      title: "Use topological sort for CSS",
      decision: "CSS blocks are ordered by dependency depth via compiler sort",
      status: "accepted",
      author: "agent:A",
    });
    store.createRecord({
      type: "blocker",
      title: "Hash order independence",
      blocker: "Bundle hash may not change when CSS order changes",
      status: "open",
      severity: "medium",
      author: "agent:A",
    });
  }

  it("builds a structured handoff from live store state", async () => {
    const store = new SqliteStore();
    await store.initProjectStore(tempProject);
    seedStore(store);

    const meta = await store.openProjectStore(tempProject);
    const handoff = buildHandoff(store, meta, {
      previous_agent: "agent:A",
      stopping_point: "Completed contract trace; need to verify hash-order behavior in fresh build.",
      next_action: "Run a fresh build and compare CSS bundle filename when style block order changes.",
      completed: ["Read contracts/DETERMINISM.md", "Read packages/bundler/src/utils.rs"],
    });

    expect(handoff.schema_version).toBe(1);
    expect(handoff.project_id).toBe(meta.projectId);
    expect(handoff.project_name).toBe(meta.projectName);
    expect(handoff.previous_agent).toBe("agent:A");
    expect(handoff.active_task.title).toBe("Verify CSS determinism contract");
    expect(handoff.active_task.revision).toBe(1);
    expect(handoff.stopping_point).toContain("Completed contract trace");
    expect(handoff.next_action).toContain("fresh build");
    expect(handoff.accepted_decisions).toHaveLength(1);
    expect(handoff.blockers).toHaveLength(1);
    expect(handoff.completed).toHaveLength(2);
    store.close();
  });

  it("rejects handoff without stopping_point", async () => {
    const store = new SqliteStore();
    await store.initProjectStore(tempProject);
    seedStore(store);
    const meta = await store.openProjectStore(tempProject);

    expect(() =>
      buildHandoff(store, meta, {
        previous_agent: "agent:A",
        stopping_point: "",
        next_action: "continue",
      }),
    ).toThrow(HandoffValidationError);
    store.close();
  });

  it("rejects handoff without next_action when task is incomplete", async () => {
    const store = new SqliteStore();
    await store.initProjectStore(tempProject);
    seedStore(store);
    const meta = await store.openProjectStore(tempProject);

    expect(() =>
      buildHandoff(store, meta, {
        previous_agent: "agent:A",
        stopping_point: "stopped",
        next_action: "",
      }),
    ).toThrow(HandoffValidationError);
    store.close();
  });

  it("validates a correct structured handoff", () => {
    const handoff = {
      schema_version: 1,
      project_id: "abc123",
      project_name: "Test",
      previous_agent: "agent:A",
      active_task: { id: "rec_task_1", title: "T", revision: 1, status: "active" },
      accepted_decisions: [],
      completed: [],
      stopping_point: "stopped",
      next_action: "continue",
      blockers: [],
      references: { files: [], commits: [], branches: [] },
      files_changed: [],
      verification: [],
      created_at: new Date().toISOString(),
    };
    expect(() => validateHandoff(handoff)).not.toThrow();
  });

  it("rejects handoff with missing active_task fields", () => {
    const handoff = {
      schema_version: 1,
      project_id: "abc123",
      project_name: "Test",
      previous_agent: "agent:A",
      active_task: { id: "rec_task_1", title: "T", revision: 1 },
      accepted_decisions: [],
      completed: [],
      stopping_point: "stopped",
      next_action: "continue",
      blockers: [],
      files_changed: [],
      verification: [],
      created_at: new Date().toISOString(),
    };
    expect(() => validateHandoff(handoff)).toThrow(HandoffValidationError);
  });

  it("renders human acknowledgement", () => {
    const handoff = {
      schema_version: 1,
      project_id: "abc123",
      project_name: "Test",
      previous_agent: "agent:A",
      active_task: { id: "rec_task_1", title: "Verify contract", revision: 3, status: "active" },
      accepted_decisions: ["Use topological sort"],
      completed: ["Read contract"],
      stopping_point: "Done reading.",
      next_action: "Compare outputs.",
      blockers: [],
      references: { files: [], commits: [], branches: [] },
      files_changed: [],
      verification: [],
      created_at: new Date().toISOString(),
    };
    const text = renderAcknowledgement(handoff) as string;
    expect(text).toContain("Zentext context loaded.");
    expect(text).toContain("Active task: Verify contract");
    expect(text).toContain("Task ID: rec_task_1");
    expect(text).toContain("Task revision: 3");
    expect(text).toContain("Stopping point: Done reading.");
    expect(text).toContain("Next action: Compare outputs.");
    expect(text).toContain("I will continue from this stopping point");
  });

  it("renders JSON acknowledgement", () => {
    const handoff = {
      schema_version: 1,
      project_id: "abc123",
      project_name: "Test",
      previous_agent: "agent:A",
      active_task: { id: "rec_task_1", title: "Verify contract", revision: 3, status: "active" },
      accepted_decisions: ["Use topological sort"],
      completed: ["Read contract"],
      stopping_point: "Done reading.",
      next_action: "Compare outputs.",
      blockers: ["Need fresh build"],
      references: { files: [], commits: [], branches: [] },
      files_changed: [],
      verification: [],
      created_at: new Date().toISOString(),
    };
    const json = renderAcknowledgement(handoff, "json") as Record<string, unknown>;
    expect(json.acknowledged).toBe(true);
    expect(json.task_id).toBe("rec_task_1");
    expect(json.task_revision).toBe(3);
    expect(json.blockers).toEqual(["Need fresh build"]);
  });

  it("converts handoff to create input and round-trips through store", async () => {
    const store = new SqliteStore();
    await store.initProjectStore(tempProject);
    seedStore(store);
    const meta = await store.openProjectStore(tempProject);

    const handoff = buildHandoff(store, meta, {
      previous_agent: "agent:A",
      stopping_point: "Stopped after reading.",
      next_action: "Compare build outputs.",
      completed: ["Read contract"],
      previous_response: "Agent A investigated the contract.",
    });

    const input = handoffToCreateInput(handoff);
    const writer = createMemoryWriter(store);
    const record = writer.createHandoff(input);
    const loaded = recordToHandoff(record);

    expect(loaded.active_task.id).toBe(handoff.active_task.id);
    expect(loaded.stopping_point).toBe(handoff.stopping_point);
    expect(loaded.next_action).toBe(handoff.next_action);
    expect(loaded.previous_response).toBe(handoff.previous_response);
    store.close();
  });

  it("detects stale handoff when task revision advanced", async () => {
    const store = new SqliteStore();
    await store.initProjectStore(tempProject);
    const task = store.createRecord({
      type: "task",
      title: "Verify CSS determinism contract",
      goal: "Trace Zenith CSS determinism contract to implementation",
      status: "active",
      author: "agent:A",
    });
    const meta = await store.openProjectStore(tempProject);
    const handoff = buildHandoff(store, meta, {
      previous_agent: "agent:A",
      stopping_point: "Stopped.",
      next_action: "Continue.",
    });

    // Advance the task revision.
    const writer = createMemoryWriter(store);
    writer.updateRecord(task.id, { next: "Updated next step" }, { author: "agent:B" });

    const current = isHandoffCurrent(handoff, store);
    expect(current.current).toBe(false);
    if (!current.current) {
      expect(current.handoffRevision).toBe(1);
      expect(current.liveRevision).toBe(2);
    }
    store.close();
  });

  it("detects current handoff when revision matches", async () => {
    const store = new SqliteStore();
    await store.initProjectStore(tempProject);
    store.createRecord({
      type: "task",
      title: "Verify CSS determinism contract",
      goal: "Trace Zenith CSS determinism contract to implementation",
      status: "active",
      author: "agent:A",
    });
    const meta = await store.openProjectStore(tempProject);
    const handoff = buildHandoff(store, meta, {
      previous_agent: "agent:A",
      stopping_point: "Stopped.",
      next_action: "Continue.",
    });

    const current = isHandoffCurrent(handoff, store);
    expect(current.current).toBe(true);
    store.close();
  });

  it("handoff with completed task does not require next_action", async () => {
    const store = new SqliteStore();
    await store.initProjectStore(tempProject);
    store.createRecord({
      type: "task",
      title: "Verify CSS determinism contract",
      goal: "Trace Zenith CSS determinism contract to implementation",
      status: "done",
      author: "agent:A",
    });
    const meta = await store.openProjectStore(tempProject);

    const handoff = buildHandoff(store, meta, {
      previous_agent: "agent:A",
      stopping_point: "Task complete.",
      next_action: "",
      completed: ["Investigated contract", "Documented findings"],
    });

    expect(handoff.active_task.status).toBe("done");
    expect(handoff.next_action).toBe("");
    store.close();
  });
});
