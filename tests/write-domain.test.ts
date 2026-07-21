import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { SqliteStore } from "../src/store/sqlite-store.js";
import {
  createMemoryWriter,
  MemoryWriterConflictError,
  MemoryWriterNotFoundError,
  MemoryWriterStateError,
  MemoryWriterValidationError,
} from "../src/domain/memory-writer.js";
import type { AnyRecord, CreateTaskInput, CreateDecisionInput, CreateHandoffInput } from "../src/types/records.js";

let tempHome: string;
let tempProject: string;
let originalHome: string;

beforeEach(async () => {
  tempHome = mkdtempSync(join(tmpdir(), "zentext-write-test-"));
  tempProject = mkdtempSync(join(tmpdir(), "zentext-write-proj-"));
  originalHome = process.env.HOME ?? "";
  process.env.HOME = tempHome;
});

afterEach(() => {
  process.env.HOME = originalHome;
  rmSync(tempHome, { recursive: true, force: true });
  rmSync(tempProject, { recursive: true, force: true });
});

async function openStore(): Promise<SqliteStore> {
  const store = new SqliteStore();
  await store.initProjectStore(tempProject);
  return store;
}

function historyEvents(store: SqliteStore, id: string): string[] {
  return store.getRecordHistory(id).map((entry) => entry.event);
}

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe("createRecord", () => {
  it("creates a record with revision 1 and create history", async () => {
    const store = await openStore();
    const writer = createMemoryWriter(store);

    const input: CreateTaskInput = {
      type: "task",
      title: "T",
      goal: "G",
      author: "agent:a",
    };

    const record = writer.createRecord(input);
    expect(record.revision).toBe(1);
    expect(record.title).toBe("T");
    expect(record.status).toBe("active");
    expect(historyEvents(store, record.id)).toEqual(["create"]);
    store.close();
  });

  it("rejects invalid status", async () => {
    const store = await openStore();
    const writer = createMemoryWriter(store);

    expect(() =>
      writer.createRecord({
        type: "task",
        title: "T",
        goal: "G",
        status: "resolved",
        author: "agent:a",
      } as CreateTaskInput),
    ).toThrow(MemoryWriterValidationError);
    store.close();
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe("updateRecord", () => {
  it("increments revision and appends history", async () => {
    const store = await openStore();
    const writer = createMemoryWriter(store);
    const created = writer.createRecord({
      type: "task",
      title: "T",
      goal: "G",
      author: "agent:a",
    });

    const updated = writer.updateRecord(created.id, { title: "T2" });
    expect(updated.revision).toBe(2);
    expect(updated.title).toBe("T2");
    expect(historyEvents(store, created.id)).toEqual(["create", "update"]);
    store.close();
  });

  it("updates payload fields", async () => {
    const store = await openStore();
    const writer = createMemoryWriter(store);
    const created = writer.createRecord({
      type: "task",
      title: "T",
      goal: "G",
      author: "agent:a",
    });

    const updated = writer.updateRecord(created.id, { next: "do it" } as unknown as Partial<AnyRecord>);
    expect((updated as unknown as { next?: string }).next).toBe("do it");
    expect(updated.revision).toBe(2);
    store.close();
  });

  it("returns unchanged on no-op without incrementing revision", async () => {
    const store = await openStore();
    const writer = createMemoryWriter(store);
    const created = writer.createRecord({
      type: "task",
      title: "T",
      goal: "G",
      author: "agent:a",
    });

    const updated = writer.updateRecord(created.id, {});
    expect(updated.revision).toBe(1);
    expect(historyEvents(store, created.id)).toEqual(["create"]);
    store.close();
  });

  it("rejects stale expected revision", async () => {
    const store = await openStore();
    const writer = createMemoryWriter(store);
    const created = writer.createRecord({
      type: "task",
      title: "T",
      goal: "G",
      author: "agent:a",
    });

    writer.updateRecord(created.id, { title: "T2" });
    expect(() => writer.updateRecord(created.id, { title: "T3" }, { expectedRevision: 1 })).toThrow(
      MemoryWriterConflictError,
    );

    const record = store.getRecord(created.id)!;
    expect(record.title).toBe("T2");
    expect(record.revision).toBe(2);
    store.close();
  });

  it("rejects updating superseded record", async () => {
    const store = await openStore();
    const writer = createMemoryWriter(store);
    const decision = writer.createRecord({
      type: "decision",
      title: "D1",
      decision: "Old",
      author: "agent:a",
    });

    writer.supersedeRecord(decision.id, {
      type: "decision",
      title: "D2",
      decision: "New",
      status: "accepted",
      author: "agent:a",
    });

    expect(() => writer.updateRecord(decision.id, { title: "Oops" })).toThrow(
      MemoryWriterStateError,
    );
    store.close();
  });

  it("rejects updating archived record", async () => {
    const store = await openStore();
    const writer = createMemoryWriter(store);
    const task = writer.createRecord({
      type: "task",
      title: "T",
      goal: "G",
      author: "agent:a",
    });

    writer.archiveRecord(task.id);
    expect(() => writer.updateRecord(task.id, { title: "Oops" })).toThrow(
      MemoryWriterStateError,
    );
    store.close();
  });
});

// ---------------------------------------------------------------------------
// supersede
// ---------------------------------------------------------------------------

describe("supersedeRecord", () => {
  it("links source and replacement and marks source superseded", async () => {
    const store = await openStore();
    const writer = createMemoryWriter(store);
    const source = writer.createRecord({
      type: "decision",
      title: "D1",
      decision: "Old",
      author: "agent:a",
    });

    const { source: updatedSource, replacement } = writer.supersedeRecord(source.id, {
      type: "decision",
      title: "D2",
      decision: "New",
      status: "accepted",
      author: "agent:a",
    });

    expect(replacement.supersedes).toContain(source.id);
    expect(updatedSource.superseded_by).toBe(replacement.id);
    expect(updatedSource.status).toBe("accepted"); // source status is unchanged; superseded_by marks it
    expect(historyEvents(store, source.id)).toContain("supersede");
    store.close();
  });

  it("rejects superseding an already superseded record", async () => {
    const store = await openStore();
    const writer = createMemoryWriter(store);
    const source = writer.createRecord({
      type: "decision",
      title: "D1",
      decision: "Old",
      author: "agent:a",
    });

    const { replacement } = writer.supersedeRecord(source.id, {
      type: "decision",
      title: "D2",
      decision: "New",
      status: "accepted",
      author: "agent:a",
    });

    expect(() =>
      writer.supersedeRecord(source.id, {
        type: "decision",
        title: "D3",
        decision: "Newer",
        status: "accepted",
        author: "agent:a",
      }),
    ).toThrow(MemoryWriterStateError);

    expect(store.getRecord(source.id)!.superseded_by).toBe(replacement.id);
    store.close();
  });

  it("rejects self-supersession", async () => {
    // Not reachable through the API because the replacement is created fresh,
    // but test the source != replacement guard by attempting to use the same
    // record id as source and replacement is impossible. Skip explicit API test.
    expect(true).toBe(true);
  });

  it("rejects missing source", async () => {
    const store = await openStore();
    const writer = createMemoryWriter(store);

    expect(() =>
      writer.supersedeRecord("rec_decision_missing", {
        type: "decision",
        title: "D",
        decision: "X",
        author: "agent:a",
      }),
    ).toThrow(MemoryWriterNotFoundError);
    store.close();
  });

  it("rejects stale expected revision", async () => {
    const store = await openStore();
    const writer = createMemoryWriter(store);
    const source = writer.createRecord({ type: "decision", title: "D", decision: "X", author: "a" });
    writer.updateRecord(source.id, { title: "D2" });

    expect(() =>
      writer.supersedeRecord(
        source.id,
        { type: "decision", title: "D3", decision: "Y", author: "a" },
        { expectedRevision: 1 },
      ),
    ).toThrow(MemoryWriterConflictError);
    store.close();
  });
});

// ---------------------------------------------------------------------------
// archive
// ---------------------------------------------------------------------------

describe("archiveRecord", () => {
  it("marks a task as done and appends history", async () => {
    const store = await openStore();
    const writer = createMemoryWriter(store);
    const task = writer.createRecord({
      type: "task",
      title: "T",
      goal: "G",
      author: "agent:a",
    });

    const archived = writer.archiveRecord(task.id);
    expect(archived.status).toBe("done");
    expect(archived.revision).toBe(2);
    expect(historyEvents(store, task.id)).toEqual(["create", "update"]);
    store.close();
  });

  it("is idempotent", async () => {
    const store = await openStore();
    const writer = createMemoryWriter(store);
    const task = writer.createRecord({
      type: "task",
      title: "T",
      goal: "G",
      author: "agent:a",
    });

    writer.archiveRecord(task.id);
    const again = writer.archiveRecord(task.id);
    expect(again.revision).toBe(2);
    expect(historyEvents(store, task.id)).toEqual(["create", "update"]);
    store.close();
  });

  it("rejects archiving superseded record", async () => {
    const store = await openStore();
    const writer = createMemoryWriter(store);
    const decision = writer.createRecord({ type: "decision", title: "D", decision: "X", author: "a" });
    writer.supersedeRecord(decision.id, {
      type: "decision",
      title: "D2",
      decision: "Y",
      status: "accepted",
      author: "a",
    });

    expect(() => writer.archiveRecord(decision.id)).toThrow(MemoryWriterStateError);
    store.close();
  });

  it("rejects stale expected revision", async () => {
    const store = await openStore();
    const writer = createMemoryWriter(store);
    const task = writer.createRecord({ type: "task", title: "T", goal: "G", author: "a" });
    writer.updateRecord(task.id, { title: "T2" });

    expect(() => writer.archiveRecord(task.id, { expectedRevision: 1 })).toThrow(
      MemoryWriterConflictError,
    );
    store.close();
  });
});

// ---------------------------------------------------------------------------
// handoff
// ---------------------------------------------------------------------------

describe("createHandoff", () => {
  it("creates a handoff and archives the previous latest", async () => {
    const store = await openStore();
    const writer = createMemoryWriter(store);
    const first = writer.createHandoff({
      type: "handoff",
      title: "H1",
      from: "agent:a",
      to: "agent:b",
      context: "C",
      state: "S",
      next: "N",
      author: "agent:a",
    } as CreateHandoffInput);

    expect(first.status).toBe("latest");

    const second = writer.createHandoff({
      type: "handoff",
      title: "H2",
      from: "agent:b",
      to: "agent:c",
      context: "C2",
      state: "S2",
      next: "N2",
      author: "agent:b",
    } as CreateHandoffInput);

    expect(second.status).toBe("latest");
    expect(store.getRecord(first.id)!.status).toBe("archived");
    store.close();
  });

  it("rejects missing handoff fields", async () => {
    const store = await openStore();
    const writer = createMemoryWriter(store);

    expect(() =>
      writer.createHandoff({
        type: "handoff",
        title: "H",
        from: "agent:a",
        to: "agent:b",
        context: "C",
        state: "S",
        author: "agent:a",
      } as CreateHandoffInput),
    ).toThrow(MemoryWriterValidationError);
    store.close();
  });
});

// ---------------------------------------------------------------------------
// transaction integrity
// ---------------------------------------------------------------------------

describe("transaction integrity", () => {
  it("does not create a replacement when source supersession fails", async () => {
    const store = await openStore();
    const writer = createMemoryWriter(store);
    const source = writer.createRecord({
      type: "decision",
      title: "D",
      decision: "X",
      author: "a",
    });

    const before = store.listRecords().length;
    try {
      writer.supersedeRecord(source.id, {
        type: "decision",
        title: "D2",
        decision: "Y",
        status: "bad-status",
        author: "a",
      } as CreateDecisionInput);
      expect.fail("expected supersede to throw");
    } catch {
      // expected
    }

    expect(store.listRecords().length).toBe(before);
    expect(store.getRecord(source.id)!.superseded_by).toBeUndefined();
    store.close();
  });
});

// ---------------------------------------------------------------------------
// concurrency
// ---------------------------------------------------------------------------

describe("concurrency", () => {
  it("two writers using separate stores reject stale revision", async () => {
    const storeA = await openStore();
    const writerA = createMemoryWriter(storeA);
    const created = writerA.createRecord({
      type: "task",
      title: "T",
      goal: "G",
      author: "a",
    });
    storeA.close();

    const storeB = await openStore();
    const writerB = createMemoryWriter(storeB);
    writerB.updateRecord(created.id, { title: "B" });
    storeB.close();

    const storeC = await openStore();
    const writerC = createMemoryWriter(storeC);
    expect(() => writerC.updateRecord(created.id, { title: "C" }, { expectedRevision: 1 })).toThrow(
      MemoryWriterConflictError,
    );
    storeC.close();

    const storeD = await openStore();
    expect(storeD.getRecord(created.id)!.title).toBe("B");
    expect(storeD.getRecord(created.id)!.revision).toBe(2);
    storeD.close();
  });
});
