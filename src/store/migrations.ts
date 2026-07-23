/**
 * SQLite migration system.
 *
 * Uses PRAGMA user_version to track applied migrations.
 * Migrations are ordered functions in code — no external migration files.
 * On open: read user_version, run all migrations with a higher number.
 */

import type { SqliteDatabase } from "./sqlite-binding.js";

export type MigrationFn = (db: SqliteDatabase) => void;

/**
 * Ordered list of migrations. Index 0 = migration #1.
 * Append new migrations to this array — do not reorder or modify existing ones.
 */
export const MIGRATIONS: readonly MigrationFn[] = [
  // Migration #1: initial schema
  (db: SqliteDatabase): void => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS records (
        id              TEXT PRIMARY KEY,
        project_id      TEXT NOT NULL,
        type            TEXT NOT NULL,
        title           TEXT NOT NULL,
        status          TEXT NOT NULL,
        summary         TEXT,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        revision        INTEGER NOT NULL DEFAULT 1,
        author          TEXT NOT NULL,
        tags_json       TEXT,
        refs_json       TEXT,
        supersedes_json TEXT,
        superseded_by   TEXT,
        schema_version  INTEGER NOT NULL DEFAULT 1,
        payload_json    TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_records_project_type
        ON records (project_id, type);

      CREATE INDEX IF NOT EXISTS idx_records_project_status
        ON records (project_id, status);

      CREATE INDEX IF NOT EXISTS idx_records_project_updated
        ON records (project_id, updated_at DESC);

      CREATE TABLE IF NOT EXISTS record_history (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id     TEXT NOT NULL,
        revision      INTEGER NOT NULL,
        event         TEXT NOT NULL,
        occurred_at   TEXT NOT NULL,
        author        TEXT,
        record_json   TEXT NOT NULL,
        FOREIGN KEY (record_id) REFERENCES records(id)
      );

      CREATE INDEX IF NOT EXISTS idx_history_record
        ON record_history (record_id, revision);

      CREATE TABLE IF NOT EXISTS meta (
        key   TEXT PRIMARY KEY,
        value TEXT
      );
    `);
  },
  // Future migrations go here (append only):
  // (db: SqliteDatabase): void => { ... },
];

/**
 * Run all pending migrations on a database.
 * Reads PRAGMA user_version and applies migrations in order.
 */
export function runMigrations(db: SqliteDatabase): void {
  const currentVersion = db.pragma("user_version", { simple: true }) as number;
  const targetVersion = MIGRATIONS.length;

  if (currentVersion < targetVersion) {
    db.transaction(() => {
      for (let i = currentVersion; i < targetVersion; i++) {
        const migrationFn = MIGRATIONS[i];
        if (migrationFn) {
          migrationFn(db);
        }
      }
      db.pragma(`user_version = ${targetVersion}`);
    })();
  }
}

/**
 * Get the current schema version (migration count).
 */
export function getSchemaVersion(db: SqliteDatabase): number {
  return db.pragma("user_version", { simple: true }) as number;
}
