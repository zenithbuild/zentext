import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, tryNodeSqlite, SUPPORTED_NODE_ENGINES } from "../src/store/sqlite-binding.js";

async function nodeSqliteAvailable(): Promise<boolean> {
  try {
    const mod = await import("node:sqlite");
    return !!mod.DatabaseSync;
  } catch {
    return false;
  }
}

describe("sqlite binding diagnostics", () => {
  it("opens an in-memory database successfully when binding is present", () => {
    const db = openDatabase(":memory:");
    expect(db).toBeDefined();
    db.close();
  });

  it("reports supported engines", () => {
    expect(SUPPORTED_NODE_ENGINES).toContain("22.13+");
    expect(SUPPORTED_NODE_ENGINES).toContain("24.x");
  });
});

describe("node:sqlite backend", () => {
  it("executes setting and read pragmas without the PRAGMA keyword", async () => {
    if (!(await nodeSqliteAvailable())) return;
    const dir = mkdtempSync(join(tmpdir(), "zt-sqlite-binding-"));
    const db = tryNodeSqlite(join(dir, "test.db"));
    if (!db) {
      rmSync(dir, { recursive: true, force: true });
      return;
    }

    db.pragma("journal_mode = WAL");
    const mode = db.pragma("journal_mode", { simple: true });
    expect(mode).toBe("wal");

    db.pragma("user_version = 5");
    const version = db.pragma("user_version", { simple: true });
    expect(version).toBe(5);

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("strips a defensive PRAGMA prefix if present", async () => {
    if (!(await nodeSqliteAvailable())) return;
    const dir = mkdtempSync(join(tmpdir(), "zt-sqlite-binding-prefix-"));
    const db = tryNodeSqlite(join(dir, "test.db"));
    if (!db) {
      rmSync(dir, { recursive: true, force: true });
      return;
    }

    db.pragma("PRAGMA journal_mode = WAL");
    const mode = db.pragma("journal_mode", { simple: true });
    expect(mode).toBe("wal");

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("runs transactions with rollback on error", async () => {
    if (!(await nodeSqliteAvailable())) return;
    const db = tryNodeSqlite(":memory:");
    if (!db) return;

    db.exec("CREATE TABLE counters (name TEXT PRIMARY KEY, value INTEGER)");
    const txn = db.transaction((...args: unknown[]) => {
      const [name, value] = args as [string, number];
      db.prepare("INSERT INTO counters (name, value) VALUES (?, ?)").run(name, value);
      if (value < 0) throw new Error("negative");
    });

    txn("positive", 1);
    const row = db.prepare("SELECT value FROM counters WHERE name = ?").get("positive") as {
      value: number;
    };
    expect(row.value).toBe(1);

    expect(() => txn("negative", -1)).toThrow("negative");
    const missing = db.prepare("SELECT value FROM counters WHERE name = ?").get("negative");
    expect(missing).toBeUndefined();

    db.close();
  });

  it("supports nested transactions via savepoints", async () => {
    if (!(await nodeSqliteAvailable())) return;
    const dir = mkdtempSync(join(tmpdir(), "zt-sqlite-nested-"));
    const db = tryNodeSqlite(join(dir, "test.db"));
    if (!db) {
      rmSync(dir, { recursive: true, force: true });
      return;
    }

    db.exec("CREATE TABLE counters (name TEXT PRIMARY KEY, value INTEGER)");

    const outer = db.transaction(() => {
      db.prepare("INSERT INTO counters (name, value) VALUES (?, ?)").run("outer", 1);
      const inner = db.transaction(() => {
        db.prepare("INSERT INTO counters (name, value) VALUES (?, ?)").run("inner", 2);
      });
      inner();
    });
    outer();

    const outerRow = db.prepare("SELECT value FROM counters WHERE name = ?").get("outer") as {
      value: number;
    };
    const innerRow = db.prepare("SELECT value FROM counters WHERE name = ?").get("inner") as {
      value: number;
    };
    expect(outerRow.value).toBe(1);
    expect(innerRow.value).toBe(2);

    // Verify rollback of nested transaction does not affect outer.
    const outerThenFail = db.transaction(() => {
      db.prepare("INSERT INTO counters (name, value) VALUES (?, ?)").run("rollback-test", 3);
      const innerFail = db.transaction(() => {
        db.prepare("INSERT INTO counters (name, value) VALUES (?, ?)").run("rollback-inner", 4);
        throw new Error("force rollback");
      });
      expect(() => innerFail()).toThrow("force rollback");
    });
    outerThenFail();

    const rollbackTest = db.prepare("SELECT value FROM counters WHERE name = ?").get("rollback-test") as
      | { value: number }
      | undefined;
    const rollbackInner = db.prepare("SELECT value FROM counters WHERE name = ?").get("rollback-inner") as
      | { value: number }
      | undefined;
    expect(rollbackTest?.value).toBe(3);
    expect(rollbackInner).toBeUndefined();

    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});
