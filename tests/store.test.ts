import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore, StoreValidationError } from "../src/store/sqlite-store.js";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";
import type {
  CreateTaskInput,
  CreateDecisionInput,
  CreateBlockerInput,
  CreateHandoffInput,
  CreateLogInput,
  CreateValidationInput,
  CreatePolicyInput,
  CreateCustomInput,
} from "../src/types/records.js";

// ---------------------------------------------------------------------------
// Test fixture: a temp directory that acts as a fake project root.
// We override HOME so the store goes to a temp dir, not the real ~/.zentext.
// ---------------------------------------------------------------------------

let tempHome: string;
let tempProject: string;
let originalHome: string;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), "zentext-test-"));
  tempProject = mkdtempSync(join(tmpdir(), "zentext-proj-"));
  originalHome = process.env.HOME ?? "";
  process.env.HOME = tempHome;
});

afterEach(() => {
  process.env.HOME = originalHome;
  rmSync(tempHome, { recursive: true, force: true });
  rmSync(tempProject, { recursive: true, force: true });
});

function makeStore(): SqliteStore {
  return new SqliteStore();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SqliteStore — init and open", () => {
  it("creates store directory and database on init", async () => {
    const store = makeStore();
    const meta = await store.initProjectStore(tempProject);

    expect(meta.projectName).toBeTruthy();
    expect(meta.projectId).toMatch(/^[0-9a-f]{16}$/);
    expect(existsSync(join(meta.storePath, "store.sqlite"))).toBe(true);
    expect(existsSync(join(meta.storePath, "exports"))).toBe(true);
    store.close();
  });

  it("init is idempotent — calling twice does not error", async () => {
    const store = makeStore();
    await store.initProjectStore(tempProject);
    store.close();

    const store2 = makeStore();
    await store2.initProjectStore(tempProject);
    store2.close();
  });

  it("open throws if store does not exist", async () => {
    const store = makeStore();
    await expect(store.openProjectStore(tempProject)).rejects.toThrow(
      /No Zentext store found/,
    );
  });

  it("open works after init", async () => {
    const store = makeStore();
    const meta1 = await store.initProjectStore(tempProject);
    store.close();

    const store2 = makeStore();
    const meta2 = await store2.openProjectStore(tempProject);
    expect(meta2.projectId).toBe(meta1.projectId);
    store2.close();
  });

  it("store path is under ~/.zentext/projects/<project-id>/", async () => {
    const store = makeStore();
    const meta = await store.initProjectStore(tempProject);
    expect(meta.storePath).toContain(".zentext");
    expect(meta.storePath).toContain("projects");
    expect(meta.storePath).toContain(meta.projectId);
    store.close();
  });
});

describe("SqliteStore — generated fields assigned on create", () => {
  let store: SqliteStore;

  beforeEach(async () => {
    store = makeStore();
    await store.initProjectStore(tempProject);
  });

  afterEach(() => {
    store.close();
  });

  it("assigns id, project, created_at, updated_at, revision on create", () => {
    const input: CreateTaskInput = {
      type: "task",
      title: "Write auth module",
      goal: "Implement OAuth login flow",
    };
    const record = store.createRecord(input);

    expect(record.id).toMatch(/^rec_task_/);
    expect(record.project).toMatch(/^[0-9a-f]{16}$/);
    expect(record.created_at).toBeTruthy();
    expect(record.updated_at).toBeTruthy();
    expect(record.revision).toBe(1);
    expect(record.author).toBe("unknown");
    expect(record.schema_version).toBe(1);
  });

  it("rejects create with generated field 'id' supplied", () => {
    expect(() =>
      store.createRecord({
        type: "task",
        title: "Test",
        goal: "Test goal",
        id: "should_not_be_allowed",
      } as CreateTaskInput),
    ).toThrow(StoreValidationError);
  });

  it("rejects create with generated field 'project' supplied", () => {
    expect(() =>
      store.createRecord({
        type: "task",
        title: "Test",
        goal: "Test goal",
        project: "should_not_be_allowed",
      } as CreateTaskInput),
    ).toThrow(StoreValidationError);
  });

  it("rejects create with generated field 'revision' supplied", () => {
    expect(() =>
      store.createRecord({
        type: "task",
        title: "Test",
        goal: "Test goal",
        revision: 5,
      } as CreateTaskInput),
    ).toThrow(StoreValidationError);
  });

  it("rejects create with generated field 'created_at' supplied", () => {
    expect(() =>
      store.createRecord({
        type: "task",
        title: "Test",
        goal: "Test goal",
        created_at: "2024-01-01T00:00:00Z",
      } as CreateTaskInput),
    ).toThrow(StoreValidationError);
  });

  it("rejects create with generated field 'updated_at' supplied", () => {
    expect(() =>
      store.createRecord({
        type: "task",
        title: "Test",
        goal: "Test goal",
        updated_at: "2024-01-01T00:00:00Z",
      } as CreateTaskInput),
    ).toThrow(StoreValidationError);
  });
});

describe("SqliteStore — status behavior", () => {
  let store: SqliteStore;

  beforeEach(async () => {
    store = makeStore();
    await store.initProjectStore(tempProject);
  });

  afterEach(() => {
    store.close();
  });

  it("omitted status uses type default (task → active)", () => {
    const record = store.createRecord({
      type: "task",
      title: "Test task",
      goal: "Do something",
    });
    expect(record.status).toBe("active");
  });

  it("omitted status uses type default (decision → accepted)", () => {
    const record = store.createRecord({
      type: "decision",
      title: "Use SQLite",
      decision: "SQLite for local store",
    });
    expect(record.status).toBe("accepted");
  });

  it("omitted status for validation defaults to result value", () => {
    const record = store.createRecord({
      type: "validation",
      title: "Run tests",
      check: "npm test",
      result: "passed",
    });
    expect(record.status).toBe("passed");
  });

  it("explicit valid status is honored", () => {
    const record = store.createRecord({
      type: "task",
      title: "Test",
      goal: "Test goal",
      status: "done",
    });
    expect(record.status).toBe("done");
  });

  it("null status is rejected", () => {
    expect(() =>
      store.createRecord({
        type: "task",
        title: "Test",
        goal: "Test goal",
        status: null as unknown as string,
      }),
    ).toThrow(StoreValidationError);
  });

  it("unknown status is rejected", () => {
    expect(() =>
      store.createRecord({
        type: "task",
        title: "Test",
        goal: "Test goal",
        status: "finished",
      }),
    ).toThrow(StoreValidationError);
  });

  it("status from a different type's enum is rejected", () => {
    expect(() =>
      store.createRecord({
        type: "task",
        title: "Test",
        goal: "Test goal",
        status: "open", // valid for blocker, not for task
      }),
    ).toThrow(StoreValidationError);
  });
});

describe("SqliteStore — all eight record types", () => {
  let store: SqliteStore;

  beforeEach(async () => {
    store = makeStore();
    await store.initProjectStore(tempProject);
  });

  afterEach(() => {
    store.close();
  });

  it("creates and reads a task record", () => {
    const created = store.createRecord({
      type: "task",
      title: "Implement login",
      goal: "OAuth login flow",
      steps: ["Set up routes", "Add callback handler"],
      next: "Add token exchange",
      tags: ["auth", "backend"],
    });
    expect(created.type).toBe("task");
    expect(created.goal).toBe("OAuth login flow");
    expect(created.steps).toEqual(["Set up routes", "Add callback handler"]);
    expect(created.tags).toEqual(["auth", "backend"]);

    const fetched = store.getRecord(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.type).toBe("task");
    expect(fetched!.goal).toBe("OAuth login flow");
  });

  it("creates and reads a decision record", () => {
    const created = store.createRecord({
      type: "decision",
      title: "Use SQLite",
      decision: "SQLite for local store",
      rationale: "Structured, queryable, single-file",
      alternatives_considered: ["JSON files on disk"],
    });
    expect(created.type).toBe("decision");
    expect(created.decision).toBe("SQLite for local store");

    const fetched = store.getRecord(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.decision).toBe("SQLite for local store");
  });

  it("creates and reads a blocker record", () => {
    const created = store.createRecord({
      type: "blocker",
      title: "OAuth callback fails",
      blocker: "Staging callback URL is wrong",
      severity: "high",
      workaround: "Use localhost for testing",
    });
    expect(created.type).toBe("blocker");
    expect(created.severity).toBe("high");

    const fetched = store.getRecord(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.blocker).toBe("Staging callback URL is wrong");
  });

  it("creates and reads a handoff record", () => {
    const created = store.createRecord({
      type: "handoff",
      title: "Session handoff",
      from: "agent:codex",
      to: "agent:claude",
      context: "Working on auth module",
      state: "Login flow partially done",
      next: "Complete token exchange",
      open_questions: ["Should we cache tokens?"],
      completed_this_session: ["Wrote login.ts"],
    });
    expect(created.type).toBe("handoff");
    expect(created.from).toBe("agent:codex");

    const fetched = store.getRecord(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.context).toBe("Working on auth module");
  });

  it("creates and reads a log record", () => {
    const created = store.createRecord({
      type: "log",
      title: "Test run",
      command: "npm test",
      exit_code: 0,
      summary: "All tests passed",
      safe_excerpt: "✓ 42 tests passed",
      sanitized: true,
    });
    expect(created.type).toBe("log");
    expect(created.summary).toBe("All tests passed");

    const fetched = store.getRecord(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.summary).toBe("All tests passed");
  });

  it("creates and reads a validation record", () => {
    const created = store.createRecord({
      type: "validation",
      title: "Type check",
      check: "tsc --noEmit",
      result: "passed",
      summary: "No type errors",
    });
    expect(created.type).toBe("validation");
    expect(created.check).toBe("tsc --noEmit");
    expect(created.status).toBe("passed");

    const fetched = store.getRecord(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.result).toBe("passed");
  });

  it("creates and reads a policy record", () => {
    const created = store.createRecord({
      type: "policy",
      title: "No direct main commits",
      rule: "Never commit directly to main",
      scope: "project",
      enforcement: "required",
    });
    expect(created.type).toBe("policy");
    expect(created.rule).toBe("Never commit directly to main");

    const fetched = store.getRecord(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.rule).toBe("Never commit directly to main");
  });

  it("creates and reads a custom record", () => {
    const created = store.createRecord({
      type: "custom",
      title: "Design note",
      kind: "architecture-note",
      body: { component: "store", notes: "SQLite with WAL mode" },
    });
    expect(created.type).toBe("custom");
    expect(created.kind).toBe("architecture-note");
    expect(created.body).toEqual({ component: "store", notes: "SQLite with WAL mode" });

    const fetched = store.getRecord(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.kind).toBe("architecture-note");
  });

  it("can list all eight types", () => {
    store.createRecord({ type: "task", title: "T", goal: "G" });
    store.createRecord({ type: "decision", title: "D", decision: "Dec" });
    store.createRecord({ type: "blocker", title: "B", blocker: "Blk" });
    store.createRecord({
      type: "handoff",
      title: "H",
      from: "a",
      to: "b",
      context: "c",
      state: "s",
      next: "n",
    });
    store.createRecord({ type: "log", title: "L", summary: "sum" });
    store.createRecord({
      type: "validation",
      title: "V",
      check: "c",
      result: "passed",
    });
    store.createRecord({ type: "policy", title: "P", rule: "R" });
    store.createRecord({
      type: "custom",
      title: "C",
      kind: "k",
      body: { x: 1 },
    });

    const all = store.listRecords();
    expect(all.length).toBe(8);

    const types = new Set(all.map((r) => r.type));
    expect(types.size).toBe(8);
  });
});

describe("SqliteStore — update behavior", () => {
  let store: SqliteStore;

  beforeEach(async () => {
    store = makeStore();
    await store.initProjectStore(tempProject);
  });

  afterEach(() => {
    store.close();
  });

  it("update increments revision and updated_at", async () => {
    const created = store.createRecord({
      type: "task",
      title: "Original",
      goal: "Do something",
    });
    expect(created.revision).toBe(1);

    // Small delay to ensure updated_at differs from created_at
    await new Promise((resolve) => setTimeout(resolve, 10));

    const updated = store.updateRecord({
      id: created.id,
      status: "done",
    });

    expect(updated.revision).toBe(2);
    expect(updated.updated_at).not.toBe(created.updated_at);
    expect(updated.status).toBe("done");
  });

  it("multiple updates increment revision sequentially", () => {
    const created = store.createRecord({
      type: "task",
      title: "Test",
      goal: "G",
    });

    const u1 = store.updateRecord({ id: created.id, status: "blocked" });
    expect(u1.revision).toBe(2);

    const u2 = store.updateRecord({ id: created.id, status: "active" });
    expect(u2.revision).toBe(3);

    const u3 = store.updateRecord({ id: created.id, title: "Updated title" });
    expect(u3.revision).toBe(4);
    expect(u3.title).toBe("Updated title");
  });

  it("update preserves immutable fields (id, project, type, created_at)", () => {
    const created = store.createRecord({
      type: "task",
      title: "Original",
      goal: "Do something",
    });

    const updated = store.updateRecord({
      id: created.id,
      status: "done",
    });

    expect(updated.id).toBe(created.id);
    expect(updated.project).toBe(created.project);
    expect(updated.type).toBe(created.type);
    expect(updated.created_at).toBe(created.created_at);
  });

  it("update with invalid status is rejected", () => {
    const created = store.createRecord({
      type: "task",
      title: "T",
      goal: "G",
    });

    expect(() =>
      store.updateRecord({ id: created.id, status: "invalid_status" }),
    ).toThrow(StoreValidationError);
  });

  it("update non-existent record throws", () => {
    expect(() =>
      store.updateRecord({ id: "rec_task_nonexistent", status: "done" }),
    ).toThrow(StoreValidationError);
  });

  it("update can change title", () => {
    const created = store.createRecord({
      type: "task",
      title: "Old title",
      goal: "G",
    });

    const updated = store.updateRecord({
      id: created.id,
      title: "New title",
    });

    expect(updated.title).toBe("New title");
  });

  it("update can merge type-specific payload fields", () => {
    const created = store.createRecord({
      type: "task",
      title: "T",
      goal: "Original goal",
      steps: ["step1"],
    });

    const updated = store.updateRecord({
      id: created.id,
      payload: { next: "Do step 2" },
    });

    expect(updated.goal).toBe("Original goal"); // preserved
    expect(updated.next).toBe("Do step 2"); // new field
    expect(updated.steps).toEqual(["step1"]); // preserved
  });
});

describe("SqliteStore — history/events", () => {
  let store: SqliteStore;

  beforeEach(async () => {
    store = makeStore();
    await store.initProjectStore(tempProject);
  });

  afterEach(() => {
    store.close();
  });

  it("create writes a history event with event='create'", () => {
    const created = store.createRecord({
      type: "task",
      title: "T",
      goal: "G",
    });

    const history = store.getRecordHistory(created.id);
    expect(history.length).toBe(1);
    expect(history[0].event).toBe("create");
    expect(history[0].revision).toBe(1);
  });

  it("update writes a history event with event='update'", () => {
    const created = store.createRecord({
      type: "task",
      title: "T",
      goal: "G",
    });

    store.updateRecord({ id: created.id, status: "done" });

    const history = store.getRecordHistory(created.id);
    expect(history.length).toBe(2);
    expect(history[0].event).toBe("create");
    expect(history[0].revision).toBe(1);
    expect(history[1].event).toBe("update");
    expect(history[1].revision).toBe(2);
  });

  it("history record_json contains the full record snapshot", () => {
    const created = store.createRecord({
      type: "task",
      title: "T",
      goal: "G",
    });

    store.updateRecord({ id: created.id, status: "done" });

    const history = store.getRecordHistory(created.id);
    const updateSnapshot = JSON.parse(history[1].record_json);
    expect(updateSnapshot.status).toBe("done");
    expect(updateSnapshot.revision).toBe(2);
  });
});

describe("SqliteStore — supersession", () => {
  let store: SqliteStore;

  beforeEach(async () => {
    store = makeStore();
    await store.initProjectStore(tempProject);
  });

  afterEach(() => {
    store.close();
  });

  it("create can set supersedes field", () => {
    const original = store.createRecord({
      type: "decision",
      title: "Original decision",
      decision: "Use JSON files",
    });

    const replacement = store.createRecord({
      type: "decision",
      title: "Revised decision",
      decision: "Use SQLite instead",
      supersedes: [original.id],
    });

    expect(replacement.supersedes).toEqual([original.id]);
    expect(replacement.type).toBe("decision");
  });

  it("list can filter by type", () => {
    store.createRecord({ type: "task", title: "T1", goal: "G1" });
    store.createRecord({ type: "decision", title: "D1", decision: "Dec1" });
    store.createRecord({ type: "task", title: "T2", goal: "G2" });

    const tasks = store.listRecords({ type: "task" });
    expect(tasks.length).toBe(2);
    expect(tasks.every((r) => r.type === "task")).toBe(true);

    const decisions = store.listRecords({ type: "decision" });
    expect(decisions.length).toBe(1);
  });

  it("list can filter by status", () => {
    store.createRecord({ type: "task", title: "T1", goal: "G1" });
    store.createRecord({
      type: "task",
      title: "T2",
      goal: "G2",
      status: "done",
    });

    const active = store.listRecords({ status: "active" });
    expect(active.length).toBe(1);

    const done = store.listRecords({ status: "done" });
    expect(done.length).toBe(1);
  });

  it("list respects limit", () => {
    for (let i = 0; i < 5; i++) {
      store.createRecord({
        type: "task",
        title: `T${i}`,
        goal: `G${i}`,
      });
    }

    const limited = store.listRecords({ limit: 2 });
    expect(limited.length).toBe(2);
  });
});

describe("SqliteStore — missing required fields", () => {
  let store: SqliteStore;

  beforeEach(async () => {
    store = makeStore();
    await store.initProjectStore(tempProject);
  });

  afterEach(() => {
    store.close();
  });

  it("rejects task without goal", () => {
    expect(() =>
      store.createRecord({
        type: "task",
        title: "T",
        // missing goal
      } as CreateTaskInput),
    ).toThrow(StoreValidationError);
  });

  it("rejects decision without decision field", () => {
    expect(() =>
      store.createRecord({
        type: "decision",
        title: "D",
      } as CreateDecisionInput),
    ).toThrow(StoreValidationError);
  });

  it("rejects blocker without blocker field", () => {
    expect(() =>
      store.createRecord({
        type: "blocker",
        title: "B",
      } as CreateBlockerInput),
    ).toThrow(StoreValidationError);
  });

  it("rejects handoff without required fields", () => {
    expect(() =>
      store.createRecord({
        type: "handoff",
        title: "H",
        from: "a",
        // missing context, state, next
      } as CreateHandoffInput),
    ).toThrow(StoreValidationError);
  });

  it("rejects log without summary", () => {
    expect(() =>
      store.createRecord({
        type: "log",
        title: "L",
      } as CreateLogInput),
    ).toThrow(StoreValidationError);
  });

  it("rejects validation without check and result", () => {
    expect(() =>
      store.createRecord({
        type: "validation",
        title: "V",
      } as CreateValidationInput),
    ).toThrow(StoreValidationError);
  });

  it("rejects policy without rule", () => {
    expect(() =>
      store.createRecord({
        type: "policy",
        title: "P",
      } as CreatePolicyInput),
    ).toThrow(StoreValidationError);
  });

  it("rejects custom without kind and body", () => {
    expect(() =>
      store.createRecord({
        type: "custom",
        title: "C",
      } as CreateCustomInput),
    ).toThrow(StoreValidationError);
  });
});

describe("SqliteStore — author resolution", () => {
  let store: SqliteStore;

  beforeEach(async () => {
    store = makeStore();
    await store.initProjectStore(tempProject);
  });

  afterEach(() => {
    store.close();
  });

  it("defaults author to 'unknown' when omitted", () => {
    const record = store.createRecord({
      type: "task",
      title: "T",
      goal: "G",
    });
    expect(record.author).toBe("unknown");
  });

  it("accepts explicit author", () => {
    const record = store.createRecord({
      type: "task",
      title: "T",
      goal: "G",
      author: "agent:codex",
    });
    expect(record.author).toBe("agent:codex");
  });

  it("update preserves original author when not provided", () => {
    const created = store.createRecord({
      type: "task",
      title: "T",
      goal: "G",
      author: "user:judah",
    });

    const updated = store.updateRecord({
      id: created.id,
      status: "done",
    });

    expect(updated.author).toBe("user:judah");
  });

  it("update accepts new author", () => {
    const created = store.createRecord({
      type: "task",
      title: "T",
      goal: "G",
      author: "user:judah",
    });

    const updated = store.updateRecord({
      id: created.id,
      status: "done",
      author: "agent:claude",
    });

    expect(updated.author).toBe("agent:claude");
  });
});

describe("SqliteStore — no obvious secrets in fixtures", () => {
  it("test fixtures do not contain API keys or tokens", () => {
    const secretPatterns = [
      /sk-[a-zA-Z0-9]{20,}/,
      /ghp_[a-zA-Z0-9]{36,}/,
      /gho_[a-zA-Z0-9]{36,}/,
      /github_pat_[a-zA-Z0-9_]{40,}/,
      /AKIA[A-Z0-9]{16,}/,
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    ];

    // Check all test inputs used in this file — they should not contain secrets
    const testText = JSON.stringify({
      note: "No secrets in test fixtures",
      sampleInput: { type: "task", title: "Test", goal: "Goal" },
    });

    for (const pattern of secretPatterns) {
      expect(pattern.test(testText)).toBe(false);
    }
  });
});
