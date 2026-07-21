/**
 * Canonical write domain for Zentext.
 *
 * All memory mutations flow through this layer. No CLI, MCP, or other adapter
 * should write to the store directly.
 */

import type { Store } from "../types/store.js";
import type { TransactionScope } from "../store/sqlite-store.js";
import type {
  AnyRecord,
  CreateRecordInput,
  RecordType,
  UpdateRecordInput,
} from "../types/records.js";
import { ALLOWED_STATUSES, DEFAULT_STATUSES } from "../types/records.js";

// ---------------------------------------------------------------------------
// Domain errors
// ---------------------------------------------------------------------------

export class MemoryWriterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemoryWriterError";
  }
}

export class MemoryWriterNotFoundError extends MemoryWriterError {
  constructor(message: string) {
    super(message);
    this.name = "MemoryWriterNotFoundError";
  }
}

export class MemoryWriterConflictError extends MemoryWriterError {
  constructor(
    message: string,
    public readonly currentRevision: number,
  ) {
    super(message);
    this.name = "MemoryWriterConflictError";
  }
}

export class MemoryWriterValidationError extends MemoryWriterError {
  constructor(message: string) {
    super(message);
    this.name = "MemoryWriterValidationError";
  }
}

export class MemoryWriterStateError extends MemoryWriterError {
  constructor(message: string) {
    super(message);
    this.name = "MemoryWriterStateError";
  }
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface UpdateOptions {
  /** If supplied, the operation succeeds only when the record's current revision matches. */
  expectedRevision?: number;
  /** Override author for this mutation. */
  author?: string;
}

export interface SupersedeOptions {
  expectedRevision?: number;
  author?: string;
}

export interface ArchiveOptions {
  expectedRevision?: number;
  author?: string;
}

export interface HandoffOptions {
  author?: string;
}

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------

export interface MemoryWriter {
  createRecord(input: CreateRecordInput): AnyRecord;
  updateRecord(id: string, patch: Partial<AnyRecord>, options?: UpdateOptions): AnyRecord;
  supersedeRecord(sourceId: string, replacementInput: CreateRecordInput, options?: SupersedeOptions): {
    source: AnyRecord;
    replacement: AnyRecord;
  };
  archiveRecord(id: string, options?: ArchiveOptions): AnyRecord;
  createHandoff(input: CreateRecordInput, options?: HandoffOptions): AnyRecord;
}

export function createMemoryWriter(
  store: Store & TransactionScope & {
    createRecord(input: CreateRecordInput): AnyRecord;
    updateRecord(input: UpdateRecordInput): AnyRecord;
    getRecord(id: string): AnyRecord | null;
    getRecordHistory(id: string): Array<{ record_json: string }>;
  },
): MemoryWriter {
  return new MemoryWriterImpl(store);
}

class MemoryWriterImpl implements MemoryWriter {
  constructor(
    private readonly store: Store & TransactionScope & {
      createRecord(input: CreateRecordInput): AnyRecord;
      updateRecord(input: UpdateRecordInput): AnyRecord;
      getRecord(id: string): AnyRecord | null;
      getRecordHistory(id: string): Array<{ record_json: string }>;
    },
  ) {}

  createRecord(input: CreateRecordInput): AnyRecord {
    this.validateCreateInput(input);
    return this.store.withTransaction(() => {
      return this.store.createRecord(input);
    });
  }

  updateRecord(id: string, patch: Partial<AnyRecord>, options: UpdateOptions = {}): AnyRecord {
    const existing = this.store.getRecord(id);
    if (!existing) {
      throw new MemoryWriterNotFoundError(`Record not found: ${id}`);
    }
    this.checkMutable(existing);

    if (options.expectedRevision !== undefined && existing.revision !== options.expectedRevision) {
      throw new MemoryWriterConflictError(
        `Expected revision ${options.expectedRevision}, but current revision is ${existing.revision}.`,
        existing.revision,
      );
    }

    const updateInput = this.buildUpdateInput(existing, patch, options.author);
    if (this.isNoOp(existing, updateInput)) {
      return existing;
    }

    return this.store.withTransaction(() => {
      return this.store.updateRecord(updateInput);
    });
  }

  supersedeRecord(
    sourceId: string,
    replacementInput: CreateRecordInput,
    options: SupersedeOptions = {},
  ): { source: AnyRecord; replacement: AnyRecord } {
    const source = this.store.getRecord(sourceId);
    if (!source) {
      throw new MemoryWriterNotFoundError(`Source record not found: ${sourceId}`);
    }
    if (source.superseded_by) {
      throw new MemoryWriterStateError(
        `Record '${sourceId}' is already superseded by '${source.superseded_by}'.`,
      );
    }

    if (options.expectedRevision !== undefined && source.revision !== options.expectedRevision) {
      throw new MemoryWriterConflictError(
        `Expected revision ${options.expectedRevision}, but source revision is ${source.revision}.`,
        source.revision,
      );
    }

    this.validateCreateInput(replacementInput);

    const replacementWithLink: CreateRecordInput = {
      ...replacementInput,
      supersedes: [...(replacementInput.supersedes ?? []), sourceId],
    };

    return this.store.withTransaction(() => {
      const replacement = this.store.createRecord(replacementWithLink);
      const updatedSource = this.store.getRecord(sourceId)!;
      return { source: updatedSource, replacement };
    });
  }

  archiveRecord(id: string, options: ArchiveOptions = {}): AnyRecord {
    const existing = this.store.getRecord(id);
    if (!existing) {
      throw new MemoryWriterNotFoundError(`Record not found: ${id}`);
    }

    if (existing.superseded_by) {
      throw new MemoryWriterStateError(
        `Cannot archive '${id}': it is superseded by '${existing.superseded_by}'.`,
      );
    }

    const archivedStatus = this.getArchivedStatus(existing.type);
    if (existing.status === archivedStatus) {
      return existing;
    }

    if (options.expectedRevision !== undefined && existing.revision !== options.expectedRevision) {
      throw new MemoryWriterConflictError(
        `Expected revision ${options.expectedRevision}, but current revision is ${existing.revision}.`,
        existing.revision,
      );
    }

    return this.store.withTransaction(() => {
      return this.store.updateRecord({
        id,
        status: archivedStatus,
        author: options.author,
      });
    });
  }

  createHandoff(input: CreateRecordInput, options: HandoffOptions = {}): AnyRecord {
    if (input.type !== "handoff") {
      throw new MemoryWriterValidationError("createHandoff requires type 'handoff'.");
    }
    const handoffFields = input as unknown as Record<string, unknown>;
    if (
      !handoffFields.from ||
      !handoffFields.to ||
      !handoffFields.context ||
      !handoffFields.state ||
      !handoffFields.next
    ) {
      throw new MemoryWriterValidationError(
        "Handoff requires 'from', 'to', 'context', 'state', and 'next'.",
      );
    }

    this.validateCreateInput(input);

    return this.store.withTransaction(() => {
      const latest = this.store
        .listRecords({ type: "handoff", status: "latest" })
        .sort((a, b) => (a.updated_at > b.updated_at ? -1 : 1))[0];

      if (latest) {
        this.store.updateRecord({ id: latest.id, status: "archived", author: options.author });
      }

      return this.store.createRecord(input);
    });
  }

  // ------------------------------------------------------------------
  // Internal helpers
  // ------------------------------------------------------------------

  private validateCreateInput(input: CreateRecordInput): void {
    if (!ALLOWED_STATUSES[input.type].includes(input.status ?? DEFAULT_STATUSES[input.type])) {
      throw new MemoryWriterValidationError(
        `Invalid status '${input.status ?? "(default)"}' for type '${input.type}'.`,
      );
    }
  }

  private checkMutable(record: AnyRecord): void {
    if (record.superseded_by) {
      throw new MemoryWriterStateError(
        `Record '${record.id}' is superseded by '${record.superseded_by}' and cannot be mutated.`,
      );
    }
    const archived = this.getArchivedStatus(record.type);
    if (record.status === archived) {
      throw new MemoryWriterStateError(
        `Record '${record.id}' is archived and cannot be mutated.`,
      );
    }
  }

  private getArchivedStatus(type: RecordType): string {
    const map: Record<RecordType, string> = {
      task: "done",
      decision: "superseded",
      blocker: "resolved",
      handoff: "archived",
      log: "recorded",
      validation: "passed",
      policy: "inactive",
      custom: "archived",
    };
    return map[type];
  }

  private buildUpdateInput(
    existing: AnyRecord,
    patch: Partial<AnyRecord>,
    author?: string,
  ): UpdateRecordInput {
    const input: UpdateRecordInput = { id: existing.id };

    if (author !== undefined) input.author = author;
    if (patch.title !== undefined) input.title = patch.title;
    if (patch.summary !== undefined) input.summary = patch.summary;
    if (patch.status !== undefined) input.status = patch.status;
    if (patch.tags !== undefined) input.tags = patch.tags;
    if (patch.refs !== undefined) input.refs = patch.refs;

    const payloadKeys = Object.keys(patch).filter(
      (key) => !isEnvelopeField(key),
    );
    if (payloadKeys.length > 0) {
      input.payload = {};
      for (const key of payloadKeys) {
        const value = (patch as unknown as Record<string, unknown>)[key];
        if (value !== undefined) {
          (input.payload as Record<string, unknown>)[key] = value;
        }
      }
    }

    if (input.status !== undefined) {
      this.validateStatus(existing.type, input.status);
    }

    return input;
  }

  private isNoOp(existing: AnyRecord, input: UpdateRecordInput): boolean {
    if (input.title !== undefined && input.title !== existing.title) return false;
    if (input.summary !== undefined && input.summary !== existing.summary) return false;
    if (input.status !== undefined && input.status !== existing.status) return false;
    if (input.tags !== undefined && JSON.stringify(input.tags) !== JSON.stringify(existing.tags)) {
      return false;
    }
    if (input.refs !== undefined && JSON.stringify(input.refs) !== JSON.stringify(existing.refs)) {
      return false;
    }
    if (input.payload) {
      for (const [key, value] of Object.entries(input.payload)) {
        const existingValue = (existing as unknown as Record<string, unknown>)[key];
        if (JSON.stringify(value) !== JSON.stringify(existingValue)) {
          return false;
        }
      }
    }
    return true;
  }

  private validateStatus(type: RecordType, status: string): void {
    if (!ALLOWED_STATUSES[type].includes(status)) {
      throw new MemoryWriterValidationError(
        `Invalid status '${status}' for type '${type}'. Allowed: ${ALLOWED_STATUSES[type].join(", ")}`,
      );
    }
  }
}

function isEnvelopeField(key: string): boolean {
  const envelopeFields = new Set([
    "id", "project", "type", "created_at", "updated_at", "revision", "schema_version",
    "supersedes", "superseded_by", "title", "summary", "status", "author", "tags", "refs",
  ]);
  return envelopeFields.has(key);
}
