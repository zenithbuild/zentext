/**
 * SQLite driver loader with automatic fallback.
 *
 * Zentext prefers better-sqlite3 for its synchronous, transaction-friendly
 * API. better-sqlite3 is a native dependency, so its install step must
 * download or compile a platform binding. When that step fails — common with
 * blocked npm lifecycle scripts, missing prebuilt binaries, or unsupported
 * Node ABIs — this module falls back to Node's built-in `node:sqlite` module
 * (available in Node 22 and later) so the CLI remains usable.
 */

import { createRequire } from "node:module";
import { platform, arch } from "node:os";

const require = createRequire(import.meta.url);

export class SqliteBindingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SqliteBindingError";
  }
}

export const SUPPORTED_NODE_ENGINES = "22.13+, 24.x, and 26.x (26.x is experimental)";

function runtimeSummary(): string {
  return `Node ${process.version} on ${platform()} ${arch()}`;
}

function friendlyBindingMessage(original: string): string {
  return `Zentext could not load a usable SQLite binding.

Detected runtime: ${runtimeSummary()}
Supported Node versions: ${SUPPORTED_NODE_ENGINES}

Most likely causes:
1. better-sqlite3 install scripts were blocked. Some npm configurations
   (such as LavaMoat allow-scripts) block lifecycle scripts by default.
   better-sqlite3 needs its install script to download or compile the
   native binding.

2. The current Node version does not have a prebuilt better-sqlite3 binary.
   Prebuilt binaries are usually available for the supported LTS versions
   listed above.

How to fix:
- Allow better-sqlite3 install scripts and reinstall Zentext:

    npm install-scripts approve better-sqlite3
    npm install -g zentext@next

  Or run npx with the restriction overridden:

    npm_config_allow_scripts=better-sqlite3 npx zentext@next init

- Or switch to a supported Node LTS version:

    Node 20.x, 22.x, or 24.x

Original error: ${original.split("\n")[0]}`;
}

// ---------------------------------------------------------------------------
// Driver interface
// ---------------------------------------------------------------------------

export interface SqliteStatement {
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
}

export interface SqliteDatabase {
  prepare(sql: string): SqliteStatement;
  exec(sql: string): void;
  pragma(sql: string, options?: { simple?: boolean }): unknown;
  transaction<T extends (...args: unknown[]) => unknown>(fn: T): T;
  close(): void;
}

// ---------------------------------------------------------------------------
// better-sqlite3 backend
// ---------------------------------------------------------------------------

type BetterSqlite3Database = import("better-sqlite3").Database;
type BetterSqlite3Statement = import("better-sqlite3").Statement;

class BetterSqliteStatement implements SqliteStatement {
  constructor(private readonly stmt: BetterSqlite3Statement) {}

  run(...params: unknown[]) {
    return this.stmt.run(...params);
  }

  all(...params: unknown[]) {
    return this.stmt.all(...params);
  }

  get(...params: unknown[]) {
    return this.stmt.get(...params);
  }
}

class BetterSqliteDatabase implements SqliteDatabase {
  private txDepth = 0;

  constructor(private readonly db: BetterSqlite3Database) {}

  prepare(sql: string): SqliteStatement {
    return new BetterSqliteStatement(this.db.prepare(sql));
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  pragma(sql: string, options?: { simple?: boolean }): unknown {
    return this.db.pragma(sql, options);
  }

  transaction<T extends (...args: unknown[]) => unknown>(fn: T): T {
    const db = this.db;
    const self = this;
    return ((...args: unknown[]) => {
      const depth = self.txDepth;
      const savepoint = `zentext_tx_${depth}`;
      if (depth === 0) {
        db.exec("BEGIN");
      } else {
        db.exec(`SAVEPOINT ${savepoint}`);
      }
      self.txDepth += 1;
      try {
        const result = fn(...args);
        if (depth === 0) {
          db.exec("COMMIT");
        } else {
          db.exec(`RELEASE SAVEPOINT ${savepoint}`);
        }
        return result;
      } catch (err) {
        if (depth === 0) {
          try {
            db.exec("ROLLBACK");
          } catch {
            // Ignore rollback errors.
          }
        } else {
          try {
            db.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);
          } catch {
            // Ignore rollback errors.
          }
        }
        throw err;
      } finally {
        self.txDepth -= 1;
      }
    }) as T;
  }

  close(): void {
    this.db.close();
  }
}

function tryBetterSqlite3(path: string): SqliteDatabase | undefined {
  let DatabaseCtor: new (path: string) => BetterSqlite3Database;
  try {
    const mod = require("better-sqlite3") as
      | { default?: new (path: string) => BetterSqlite3Database }
      | (new (path: string) => BetterSqlite3Database);
    DatabaseCtor =
      (mod as { default?: new (path: string) => BetterSqlite3Database }).default ??
      (mod as new (path: string) => BetterSqlite3Database);
  } catch {
    return undefined;
  }

  try {
    return new BetterSqliteDatabase(new DatabaseCtor(path));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("Could not locate the bindings file") ||
      message.includes("NODE_MODULE_VERSION") ||
      message.includes("was compiled against a different Node.js version")
    ) {
      return undefined;
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// node:sqlite backend (Node 22+)
// ---------------------------------------------------------------------------

type NodeSqliteDatabaseCtor = typeof import("node:sqlite").DatabaseSync;
type NodeSqliteDatabaseType = import("node:sqlite").DatabaseSync;
type NodeSqliteStatementType = import("node:sqlite").StatementSync;

let nodeSqliteConstructor: NodeSqliteDatabaseCtor | undefined;

function getNodeSqliteConstructor(): NodeSqliteDatabaseCtor | undefined {
  if (nodeSqliteConstructor !== undefined) return nodeSqliteConstructor;
  try {
    nodeSqliteConstructor = (require("node:sqlite") as typeof import("node:sqlite"))
      .DatabaseSync;
    return nodeSqliteConstructor;
  } catch {
    nodeSqliteConstructor = undefined;
    return undefined;
  }
}

class NodeSqliteStatement implements SqliteStatement {
  constructor(private readonly stmt: NodeSqliteStatementType) {}

  run(...params: unknown[]) {
    return this.stmt.run(...(params as import("node:sqlite").SQLInputValue[]));
  }

  all(...params: unknown[]) {
    return this.stmt.all(...(params as import("node:sqlite").SQLInputValue[]));
  }

  get(...params: unknown[]) {
    return this.stmt.get(...(params as import("node:sqlite").SQLInputValue[]));
  }
}

class NodeSqliteDatabase implements SqliteDatabase {
  constructor(private readonly db: NodeSqliteDatabaseType) {}

  prepare(sql: string): SqliteStatement {
    return new NodeSqliteStatement(this.db.prepare(sql));
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  pragma(sql: string, options?: { simple?: boolean }): unknown {
    let body = sql.trim();
    const lower = body.toLowerCase();
    // Callers pass the pragma body without the PRAGMA keyword (e.g.
    // "journal_mode = WAL"). Strip a leading PRAGMA keyword if present so we
    // always emit a single, valid PRAGMA statement.
    if (lower.startsWith("pragma ")) {
      body = body.slice(7);
    } else if (lower === "pragma") {
      body = "";
    }

    // Setting pragmas contain '='; read-only pragmas do not.
    if (body.includes("=")) {
      this.db.exec(`PRAGMA ${body}`);
      return undefined;
    }

    const stmt = this.db.prepare(`PRAGMA ${body}`);
    const row = stmt.get() as Record<string, unknown> | undefined;
    if (options?.simple && row) {
      return Object.values(row)[0];
    }
    return row;
  }

  private txDepth = 0;

  transaction<T extends (...args: unknown[]) => unknown>(fn: T): T {
    const db = this.db;
    const self = this;
    return ((...args: unknown[]) => {
      const depth = self.txDepth;
      const savepoint = `zentext_tx_${depth}`;
      if (depth === 0) {
        db.exec("BEGIN");
      } else {
        db.exec(`SAVEPOINT ${savepoint}`);
      }
      self.txDepth += 1;
      try {
        const result = fn(...args);
        if (depth === 0) {
          db.exec("COMMIT");
        } else {
          db.exec(`RELEASE SAVEPOINT ${savepoint}`);
        }
        return result;
      } catch (err) {
        if (depth === 0) {
          try {
            db.exec("ROLLBACK");
          } catch {
            // Ignore rollback errors.
          }
        } else {
          try {
            db.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);
          } catch {
            // Ignore rollback errors.
          }
        }
        throw err;
      } finally {
        self.txDepth -= 1;
      }
    }) as T;
  }

  close(): void {
    this.db.close();
  }
}

/** Test-only entry point to exercise the node:sqlite backend directly. */
export function tryNodeSqlite(path: string): SqliteDatabase | undefined {
  const Ctor = getNodeSqliteConstructor();
  if (!Ctor) return undefined;
  try {
    return new NodeSqliteDatabase(new Ctor(path));
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export function openDatabase(path: string): SqliteDatabase {
  const better = tryBetterSqlite3(path);
  if (better) return better;

  const nodeSqlite = tryNodeSqlite(path);
  if (nodeSqlite) return nodeSqlite;

  throw new SqliteBindingError(
    friendlyBindingMessage(
      "Could not locate the bindings file for better-sqlite3 and node:sqlite is not available.",
    ),
  );
}
