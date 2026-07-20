/**
 * SQLite implementation of the Zentext Store interface.
 *
 * This is the concrete store backend for Stage 1. All other code should
 * depend on the Store interface, not this class directly.
 */

import Database from "better-sqlite3";
import { ulid } from "ulid";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";

import type { Store, StoreMeta } from "../types/store.js";
import type {
  AnyRecord,
  CreateRecordInput,
  ListFilter,
  RecordType,
  RecordRefs,
  UpdateRecordInput,
} from "../types/records.js";
import {
  ALLOWED_STATUSES,
  DEFAULT_STATUSES,
  ENVELOPE_FIELDS,
  GENERATED_FIELDS,
  IMMUTABLE_FIELDS,
  MINIMUM_CREATE_FIELDS,
  RECORD_TYPES,
} from "../types/records.js";
import { deriveProjectId, deriveProjectName } from "./project-id.js";
import { runMigrations, getSchemaVersion } from "./migrations.js";

// ---------------------------------------------------------------------------
// Validation error
// ---------------------------------------------------------------------------

export class StoreValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreValidationError";
  }
}

export class StoreNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreNotFoundError";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowIso(): string {
  return new Date().toISOString();
}

function getStoreRoot(): string {
  return join(homedir(), ".zentext", "projects");
}

function getProjectStorePath(projectId: string): string {
  return join(getStoreRoot(), projectId);
}

function getDbPath(projectId: string): string {
  return join(getProjectStorePath(projectId), "store.sqlite");
}


const PROJECT_ID_RE = /^[0-9a-f]{16}$/;

function validateProjectId(projectId: string): void {
  if (!PROJECT_ID_RE.test(projectId)) {
    throw new StoreNotFoundError("Project not found.");
  }
}

function generateId(type: RecordType): string {
  return `rec_${type}_${ulid()}`;
}

// ---------------------------------------------------------------------------
// Type-specific payload extraction from create input
// ---------------------------------------------------------------------------

function extractPayload(input: CreateRecordInput): Record<string, unknown> {
  const knownKeys = new Set([
    "type", "title", "status", "summary", "author", "tags", "refs", "supersedes",
  ]);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!knownKeys.has(key) && value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateCreateInput(input: CreateRecordInput): void {
  // Reject generated fields if present on create input
  for (const field of GENERATED_FIELDS) {
    if (field in input) {
      throw new StoreValidationError(
        `Generated field '${field}' must not be supplied on create; it is assigned by Zentext.`,
      );
    }
  }

  // Validate record type
  if (!RECORD_TYPES.includes(input.type)) {
    throw new StoreValidationError(`Unknown record type: '${input.type}'`);
  }

  // Validate minimum required fields
  const required = MINIMUM_CREATE_FIELDS[input.type];
  for (const field of required) {
    const value = (input as unknown as Record<string, unknown>)[field];
    if (value === undefined || value === null || value === "") {
      throw new StoreValidationError(
        `Missing required field '${field}' for record type '${input.type}'`,
      );
    }
  }

  // Validate status: null is rejected, unknown is rejected, omitted uses default
  if (input.status !== undefined) {
    if (input.status === null) {
      throw new StoreValidationError(
        `Status cannot be null for record type '${input.type}'. Omit it to use the default.`,
      );
    }
    validateStatus(input.type, input.status);
  }

  // Validation-specific: result is required, and if status is omitted,
  // status defaults to result
  if (input.type === "validation") {
    const result = (input as unknown as Record<string, unknown>).result;
    if (result === undefined || result === null) {
      throw new StoreValidationError(
        "Missing required field 'result' for record type 'validation'",
      );
    }
    const validResults = ["passed", "failed", "inconclusive"];
    if (!validResults.includes(result as string)) {
      throw new StoreValidationError(
        `Invalid validation result: '${result}'. Must be one of: ${validResults.join(", ")}`,
      );
    }
  }
}

function validateStatus(type: RecordType, status: string): void {
  const allowed = ALLOWED_STATUSES[type];
  if (!allowed.includes(status)) {
    throw new StoreValidationError(
      `Invalid status '${status}' for record type '${type}'. Allowed: ${allowed.join(", ")}`,
    );
  }
}

function resolveStatus(input: CreateRecordInput): string {
  // Explicit status — validate it
  if (input.status !== undefined && input.status !== null) {
    validateStatus(input.type, input.status);
    return input.status;
  }

  // Validation: default to the result field
  if (input.type === "validation") {
    const result = (input as unknown as Record<string, unknown>).result as string;
    return result;
  }

  // Other types: use type default
  return DEFAULT_STATUSES[input.type];
}

// ---------------------------------------------------------------------------
// Record row ↔ AnyRecord conversion
// ---------------------------------------------------------------------------

interface RecordRow {
  id: string;
  project_id: string;
  type: string;
  title: string;
  status: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
  revision: number;
  author: string;
  tags_json: string | null;
  refs_json: string | null;
  supersedes_json: string | null;
  superseded_by: string | null;
  schema_version: number;
  payload_json: string;
}

function rowToRecord(row: RecordRow): AnyRecord {
  const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
  const tags = row.tags_json ? (JSON.parse(row.tags_json) as string[]) : [];
  const refs = row.refs_json ? (JSON.parse(row.refs_json) as RecordRefs) : {};
  const supersedes = row.supersedes_json ? (JSON.parse(row.supersedes_json) as string[]) : undefined;
  const supersededBy = row.superseded_by ?? undefined;
  const summary = row.summary ?? undefined;

  const base = {
    id: row.id,
    project: row.project_id,
    type: row.type as RecordType,
    title: row.title,
    status: row.status,
    summary,
    created_at: row.created_at,
    updated_at: row.updated_at,
    revision: row.revision,
    author: row.author,
    tags,
    refs,
    schema_version: row.schema_version,
    supersedes,
    superseded_by: supersededBy,
  };

  // Merge payload fields into the record
  return { ...base, ...payload } as AnyRecord;
}

// ---------------------------------------------------------------------------
// SqliteStore implementation
// ---------------------------------------------------------------------------

export class SqliteStore implements Store {
  private db: Database.Database | null = null;
  private projectId: string | null = null;

  // ------------------------------------------------------------------
  // init / open
  // ------------------------------------------------------------------

  async initProjectStore(cwd: string): Promise<StoreMeta> {
    const projectId = deriveProjectId(cwd);
    const projectName = deriveProjectName(cwd);
    const storePath = getProjectStorePath(projectId);
    const dbPath = getDbPath(projectId);

    // Create directory structure
    mkdirSync(join(storePath, "exports"), { recursive: true });

    // Open or create the database
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("busy_timeout = 5000");

    // Run migrations
    runMigrations(this.db);

    // Store meta
    this.projectId = projectId;


    // Write project meta to the meta table
    const insertMeta = this.db.prepare(
      "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)",
    );
    const createdAt = nowIso();
    insertMeta.run("project_name", projectName);
    insertMeta.run("project_id", projectId);
    insertMeta.run("created_at", createdAt);

    const schemaVersion = getSchemaVersion(this.db);

    return {
      projectName,
      projectId,
      storePath,
      schemaVersion,
      createdAt,
    };
  }

  async openProjectStore(cwd: string): Promise<StoreMeta> {
    const projectId = deriveProjectId(cwd);
    const storePath = getProjectStorePath(projectId);
    const dbPath = getDbPath(projectId);

    if (!existsSync(dbPath)) {
      throw new StoreNotFoundError(
        `No Zentext store found for project at '${cwd}'. Run init first.`,
      );
    }

    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("busy_timeout = 5000");

    // Run any pending migrations
    runMigrations(this.db);

    this.projectId = projectId;

    // Read meta
    const getMeta = this.db.prepare("SELECT value FROM meta WHERE key = ?");
    const projectName = (getMeta.get("project_name") as { value: string } | undefined)?.value ?? deriveProjectName(cwd);
    const createdAt = (getMeta.get("created_at") as { value: string } | undefined)?.value ?? nowIso();


    const schemaVersion = getSchemaVersion(this.db);

    return {
      projectName,
      projectId,
      storePath,
      schemaVersion,
      createdAt,
    };
  }
  // ------------------------------------------------------------------
  // open by project id
  // ------------------------------------------------------------------

  async openProjectStoreById(projectId: string): Promise<StoreMeta> {
    validateProjectId(projectId);
    const storePath = getProjectStorePath(projectId);
    const dbPath = getDbPath(projectId);

    if (!existsSync(dbPath)) {
      throw new StoreNotFoundError("Project not found.");
    }

    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("busy_timeout = 5000");

    runMigrations(this.db);

    this.projectId = projectId;

    const getMeta = this.db.prepare("SELECT value FROM meta WHERE key = ?");
    const projectName = (getMeta.get("project_name") as { value: string } | undefined)?.value ?? projectId;
    const createdAt = (getMeta.get("created_at") as { value: string } | undefined)?.value ?? nowIso();

    const schemaVersion = getSchemaVersion(this.db);

    return {
      projectName,
      projectId,
      storePath,
      schemaVersion,
      createdAt,
    };
  }


  // ------------------------------------------------------------------
  // create
  // ------------------------------------------------------------------

  createRecord(input: CreateRecordInput): AnyRecord {
    this.ensureOpen();

    // Validate
    validateCreateInput(input);

    // Generate fields
    const id = generateId(input.type);
    const project = this.projectId!;
    const now = nowIso();
    const revision = 1;
    const author = input.author ?? "unknown";
    const status = resolveStatus(input);
    const tags = input.tags ?? [];
    const refs = input.refs ?? {};
    const summary = input.summary;
    const supersedes = input.supersedes;
    const payload = extractPayload(input);
    const schemaVersion = 1;

    // Build the row
    const row = {
      id,
      project_id: project,
      type: input.type,
      title: input.title,
      status,
      summary: summary ?? null,
      created_at: now,
      updated_at: now,
      revision,
      author,
      tags_json: JSON.stringify(tags),
      refs_json: JSON.stringify(refs),
      supersedes_json: supersedes ? JSON.stringify(supersedes) : null,
      superseded_by: null,
      schema_version: schemaVersion,
      payload_json: JSON.stringify(payload),
    };

    // Insert
    const insert = this.db!.prepare(`
      INSERT INTO records (
        id, project_id, type, title, status, summary,
        created_at, updated_at, revision, author,
        tags_json, refs_json, supersedes_json, superseded_by,
        schema_version, payload_json
      ) VALUES (
        @id, @project_id, @type, @title, @status, @summary,
        @created_at, @updated_at, @revision, @author,
        @tags_json, @refs_json, @supersedes_json, @superseded_by,
        @schema_version, @payload_json
      )
    `);

    // Write history event
    const insertHistory = this.db!.prepare(`
      INSERT INTO record_history (record_id, revision, event, occurred_at, author, record_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const fullRecord: AnyRecord = {
      id,
      project,
      type: input.type,
      title: input.title,
      status,
      summary,
      created_at: now,
      updated_at: now,
      revision,
      author,
      tags,
      refs,
      schema_version: schemaVersion,
      supersedes,
      superseded_by: undefined,
      ...payload,
    } as AnyRecord;

    // Prepare superseded_by update statement (used if supersedes is set)
    const updateSupersededBy = this.db!.prepare(
      "UPDATE records SET superseded_by = ? WHERE id = ? AND superseded_by IS NULL",
    );

    // Prepare statement to fetch old record row for supersede history
    const getRow = this.db!.prepare("SELECT * FROM records WHERE id = ?");

    const tx = this.db!.transaction(() => {
      // If supersedes is set, validate each ID exists and update superseded_by
      if (supersedes && supersedes.length > 0) {
        for (const oldId of supersedes) {
          const oldRow = getRow.get(oldId) as RecordRow | undefined;
          if (!oldRow) {
            throw new StoreValidationError(
              `Cannot supersede record '${oldId}': record not found.`,
            );
          }
        }
        // All IDs are valid — update each old record's superseded_by
        for (const oldId of supersedes) {
          const result = updateSupersededBy.run(id, oldId);
          if (result.changes === 0) {
            throw new StoreValidationError(
              `Cannot supersede record '${oldId}': it is already superseded by another record.`,
            );
          }
          // Write a 'supersede' history event for the old record
          const oldRow = getRow.get(oldId) as RecordRow;
          const oldRecord = rowToRecord(oldRow);
          const supersededRecord = { ...oldRecord, superseded_by: id };
          insertHistory.run(oldId, oldRow.revision, "supersede", now, author, JSON.stringify(supersededRecord));
        }
      }

      insert.run(row);
      insertHistory.run(id, revision, "create", now, author, JSON.stringify(fullRecord));
    });
    tx();

    return fullRecord;
  }

  // ------------------------------------------------------------------
  // get
  // ------------------------------------------------------------------

  getRecord(id: string): AnyRecord | null {
    this.ensureOpen();

    const row = this.db!.prepare("SELECT * FROM records WHERE id = ?").get(id) as RecordRow | undefined;

    if (!row) {
      return null;
    }

    return rowToRecord(row);
  }

  // ------------------------------------------------------------------
  // list
  // ------------------------------------------------------------------

  listRecords(filter?: ListFilter): AnyRecord[] {
    this.ensureOpen();

    let sql = "SELECT * FROM records WHERE project_id = ?";
    const params: unknown[] = [this.projectId];

    if (filter?.type) {
      sql += " AND type = ?";
      params.push(filter.type);
    }

    if (filter?.status) {
      sql += " AND status = ?";
      params.push(filter.status);
    }

    sql += " ORDER BY updated_at DESC";

    if (filter?.limit) {
      sql += " LIMIT ?";
      params.push(filter.limit);
    }

    const rows = this.db!.prepare(sql).all(...params) as RecordRow[];
    return rows.map(rowToRecord);
  }

  // ------------------------------------------------------------------
  // update
  // ------------------------------------------------------------------

  updateRecord(input: UpdateRecordInput): AnyRecord {
    this.ensureOpen();

    // Fetch existing record
    const existing = this.getRecord(input.id);
    if (!existing) {
      throw new StoreValidationError(`Record not found: ${input.id}`);
    }

    // Validate immutable fields are not being changed.
    // 'id' is the selector (used to find the record), not a field to change.
    // 'project', 'type', 'created_at' cannot be changed via update.
    for (const field of IMMUTABLE_FIELDS) {
      if (field === "id") continue; // id is the selector, not an update target
      if (field in input) {
        throw new StoreValidationError(
          `Cannot update immutable field '${field}'.`,
        );
      }
    }

    // Validate status if provided
    if (input.status !== undefined) {
      if (input.status === null) {
        throw new StoreValidationError("Status cannot be null.");
      }
      validateStatus(existing.type, input.status);
    }

    // Reject envelope keys in payload updates
    if (input.payload) {
      for (const key of Object.keys(input.payload)) {
        if ((ENVELOPE_FIELDS as readonly string[]).includes(key)) {
          throw new StoreValidationError(
            `Cannot update envelope field '${key}' through payload; use the top-level update field instead.`,
          );
        }
      }
    }

    // Build updated record
    const newRevision = existing.revision + 1;
    const now = nowIso();
    const author = input.author ?? existing.author;

    const updatedTitle = input.title ?? existing.title;
    const updatedStatus = input.status ?? existing.status;
    const updatedSummary = input.summary !== undefined ? input.summary : existing.summary;
    const updatedTags = input.tags ?? existing.tags;
    const updatedRefs = input.refs ?? existing.refs;

    // Merge payload updates
    const payloadRow = this.db!.prepare("SELECT payload_json FROM records WHERE id = ?").get(input.id) as { payload_json: string };
    const existingPayload = JSON.parse(payloadRow.payload_json) as Record<string, unknown>;
    const updatedPayload = input.payload
      ? { ...existingPayload, ...input.payload }
      : existingPayload;

    // Handle supersession links in payload
    const supersedes = (existing.supersedes !== undefined) ? existing.supersedes : undefined;
    const supersededBy = existing.superseded_by;

    // Build updated row
    const updateRow = {
      title: updatedTitle,
      status: updatedStatus,
      summary: updatedSummary ?? null,
      updated_at: now,
      revision: newRevision,
      author,
      tags_json: JSON.stringify(updatedTags),
      refs_json: JSON.stringify(updatedRefs),
      supersedes_json: supersedes ? JSON.stringify(supersedes) : null,
      superseded_by: supersededBy ?? null,
      payload_json: JSON.stringify(updatedPayload),
    };

    const updateSql = this.db!.prepare(`
      UPDATE records SET
        title = @title,
        status = @status,
        summary = @summary,
        updated_at = @updated_at,
        revision = @revision,
        author = @author,
        tags_json = @tags_json,
        refs_json = @refs_json,
        supersedes_json = @supersedes_json,
        superseded_by = @superseded_by,
        payload_json = @payload_json
      WHERE id = ?
    `);

    const insertHistory = this.db!.prepare(`
      INSERT INTO record_history (record_id, revision, event, occurred_at, author, record_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Build the full updated record for history
    const updatedRecord: AnyRecord = {
      ...existing,
      title: updatedTitle,
      status: updatedStatus,
      summary: updatedSummary,
      updated_at: now,
      revision: newRevision,
      author,
      tags: updatedTags,
      refs: updatedRefs,
      supersedes,
      superseded_by: supersededBy,
      ...updatedPayload,
    } as AnyRecord;

    const tx = this.db!.transaction(() => {
      updateSql.run(updateRow, input.id);
      insertHistory.run(input.id, newRevision, "update", now, author, JSON.stringify(updatedRecord));
    });
    tx();

    return updatedRecord;
  }

  // ------------------------------------------------------------------
  // close
  // ------------------------------------------------------------------

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.projectId = null;
  }

  // ------------------------------------------------------------------
  // Internal helpers
  // ------------------------------------------------------------------

  private ensureOpen(): void {
    if (!this.db) {
      throw new Error("Store is not open. Call initProjectStore or openProjectStore first.");
    }
    if (!this.projectId) {
      throw new Error("Project ID is not set. Call initProjectStore or openProjectStore first.");
    }
  }

  // ------------------------------------------------------------------
  // Test helper: get history entries for a record
  // ------------------------------------------------------------------

  getRecordHistory(recordId: string): Array<{
    id: number;
    record_id: string;
    revision: number;
    event: string;
    occurred_at: string;
    author: string | null;
    record_json: string;
  }> {
    this.ensureOpen();
    return this.db!.prepare(
      "SELECT * FROM record_history WHERE record_id = ? ORDER BY revision ASC",
    ).all(recordId) as Array<{
      id: number;
      record_id: string;
      revision: number;
      event: string;
      occurred_at: string;
      author: string | null;
      record_json: string;
    }>;
  }
}
