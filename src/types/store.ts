/**
 * Store interface — the abstraction boundary for the Zentext local memory store.
 *
 * All code outside of `src/store/sqlite-store.ts` should depend on this
 * interface, not on the concrete SQLite implementation. This keeps the store
 * swappable if Stage 2 needs a different backend (per ADR 0002 risk mitigation).
 *
 * The interface does NOT over-abstract for cloud, sync, or distributed
 * coordination. It is a local single-user store interface for Stage 1.
 */

import type { AnyRecord, CreateRecordInput, ListFilter, UpdateRecordInput } from "./records.js";

export interface StoreMeta {
  projectName: string;
  projectId: string;
  storePath: string;
  schemaVersion: number;
  createdAt: string;
}

export interface StoreWriteOptions {
  allowSecretOverride?: boolean;
  /** Atomically reject the write unless the stored record is at this revision. */
  expectedRevision?: number;
}

export interface Store {
  /**
   * Initialize the project store: create directory + database if absent.
   * Idempotent — if the store already exists, it is opened.
   */
  initProjectStore(cwd: string): Promise<StoreMeta>;

  /**
   * Open an existing project store. Throws if the store does not exist.
   */
  openProjectStore(cwd: string): Promise<StoreMeta>;

  /**
   * Create a new record. Generated fields (id, project, created_at,
   * updated_at, revision) are assigned by the store, not the caller.
   */
  createRecord(input: CreateRecordInput, options?: StoreWriteOptions): AnyRecord;

  /**
   * Read a single record by id. Returns null if not found.
   */
  getRecord(id: string): AnyRecord | null;

  /**
   * List records for the current project, optionally filtered by type/status.
   */
  listRecords(filter?: ListFilter): AnyRecord[];

  /**
   * Update an existing record. Increments revision, updates updated_at,
   * and writes a history/event entry. Immutable fields cannot be changed.
   */
  updateRecord(input: UpdateRecordInput, options?: StoreWriteOptions): AnyRecord;

  /**
   * Close the database connection.
   */
  close(): void;
}
