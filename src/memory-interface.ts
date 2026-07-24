import {
  buildContinuationView,
  ContinuationInvalidError,
  ContinuationNotFoundError,
  ContinuationStaleError,
  type ContinuationView,
} from "./continuation.js";
import {
  buildHandoff,
  handoffToCreateInput,
  HandoffValidationError,
  isHandoffCurrent,
  recordToHandoff,
  type StructuredHandoff,
} from "./handoff.js";
import {
  validateHandoffQuality,
  type HandoffQualityWarning,
} from "./handoff-quality.js";
import {
  createMemoryWriter,
  MemoryWriterConflictError,
  MemoryWriterNotFoundError,
  MemoryWriterStateError,
  MemoryWriterValidationError,
} from "./domain/memory-writer.js";
import { ZentextError } from "./errors.js";
import {
  MemoryQueryInputSchema,
  OpenProjectInputSchema,
  RecordProgressInputSchema,
  TaskUpdateInputSchema,
  type MemoryQueryInput,
  type OpenProjectInput,
  type RecordProgressInput,
  type TaskUpdateInput,
} from "./schemas.js";
import { assertSafeExternalInput, redactForOutput } from "./safety.js";
import {
  MemorySearchInputSchema,
  searchMemoryRecords,
  type MemorySearchInput,
  type MemorySearchPage,
} from "./memory-search.js";
import {
  SqliteStore,
  StoreNotFoundError,
  StoreRevisionConflictError,
  StoreValidationError,
} from "./store/sqlite-store.js";
import { ZodError } from "zod";
import type {
  AnyRecord,
  RecordProvenance,
  TaskRecord,
} from "./types/records.js";
import type { StoreMeta } from "./types/store.js";

export const MEMORY_INTERFACE_VERSION = "1.1";

export interface CurrentHandoff {
  record_id: string;
  handoff: StructuredHandoff;
  quality_warnings: HandoffQualityWarning[];
}

export interface HandoffValidationResult {
  current: boolean;
  handoff_id: string;
  task_id: string;
  handoff_revision: number;
  live_revision: number | null;
  reason?: string;
  quality_warnings: HandoffQualityWarning[];
}

export interface ProgressResult {
  task: TaskRecord;
  handoff: CurrentHandoff;
  created_records: AnyRecord[];
}

export interface MemoryStore {
  readonly meta: StoreMeta;
  getActiveTask(): Promise<TaskRecord | null>;
  getCurrentHandoff(): Promise<CurrentHandoff | null>;
  getContinuation(): Promise<ContinuationView>;
  validateHandoff(handoffId?: string): Promise<HandoffValidationResult>;
  recordProgress(input: RecordProgressInput): Promise<ProgressResult>;
  updateTask(input: TaskUpdateInput): Promise<TaskRecord>;
  searchMemory(input: MemorySearchInput): Promise<MemorySearchPage>;
  queryMemory(input: MemoryQueryInput): Promise<AnyRecord[]>;
  close(): void;
}

function sortNewest(a: AnyRecord, b: AnyRecord): number {
  if (a.updated_at > b.updated_at) return -1;
  if (a.updated_at < b.updated_at) return 1;
  return a.id.localeCompare(b.id);
}

function recordText(record: AnyRecord): string {
  return JSON.stringify({
    title: record.title,
    summary: record.summary,
    tags: record.tags,
    refs: record.refs,
    payload: Object.fromEntries(
      Object.entries(record).filter(
        ([key]) =>
          ![
            "id",
            "project",
            "type",
            "status",
            "created_at",
            "updated_at",
            "revision",
            "author",
            "schema_version",
          ].includes(key),
      ),
    ),
  }).toLowerCase();
}

function verificationText(
  entry: RecordProgressInput["verification"][number],
): string {
  return `${entry.check}: ${entry.result}${entry.summary ? ` — ${entry.summary}` : ""}`;
}

function mapError(error: unknown): never {
  if (error instanceof ZentextError) throw error;
  if (error instanceof ZodError) {
    throw new ZentextError("INVALID_INPUT", "Input failed schema validation.", {
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
  if (error instanceof StoreNotFoundError) {
    throw new ZentextError("PROJECT_NOT_FOUND", "No Zentext store exists for this project.");
  }
  if (error instanceof StoreValidationError) {
    throw new ZentextError("INVALID_INPUT", error.message);
  }
  if (error instanceof StoreRevisionConflictError) {
    throw new ZentextError("REVISION_CONFLICT", error.message, {
      current_revision: error.currentRevision,
    });
  }
  if (error instanceof ContinuationStaleError) {
    throw new ZentextError("STALE_STATE", error.message, {
      handoff_revision: error.handoffRevision,
      live_revision: error.liveRevision,
    });
  }
  if (error instanceof ContinuationNotFoundError) {
    const code = error.message.includes("handoff") ? "NO_HANDOFF" : "NO_ACTIVE_TASK";
    throw new ZentextError(code, error.message);
  }
  if (error instanceof ContinuationInvalidError) {
    throw new ZentextError("INVALID_STATE", error.message);
  }
  if (error instanceof HandoffValidationError) {
    throw new ZentextError("INVALID_STATE", error.message);
  }
  if (error instanceof MemoryWriterConflictError) {
    throw new ZentextError("REVISION_CONFLICT", error.message, {
      current_revision: error.currentRevision,
    });
  }
  if (error instanceof MemoryWriterNotFoundError) {
    throw new ZentextError("RECORD_NOT_FOUND", error.message);
  }
  if (
    error instanceof MemoryWriterStateError ||
    error instanceof MemoryWriterValidationError
  ) {
    throw new ZentextError("INVALID_STATE", error.message);
  }
  throw error;
}

export class SqliteMemoryStore implements MemoryStore {
  private constructor(
    private readonly store: SqliteStore,
    public readonly meta: StoreMeta,
  ) {}

  static async open(input: OpenProjectInput): Promise<SqliteMemoryStore> {
    const parsed = OpenProjectInputSchema.parse(input);
    assertSafeExternalInput(parsed);
    const store = new SqliteStore();
    try {
      const meta = await store.openProjectStore(parsed.cwd);
      if (parsed.project_id && parsed.project_id !== meta.projectId) {
        throw new ZentextError(
          "PROJECT_IDENTITY_MISMATCH",
          "The supplied project_id does not match the project resolved from cwd.",
          { expected_project_id: meta.projectId },
        );
      }
      return new SqliteMemoryStore(store, meta);
    } catch (error) {
      store.close();
      mapError(error);
    }
  }

  static async openById(projectId: string): Promise<SqliteMemoryStore> {
    assertSafeExternalInput(projectId);
    const store = new SqliteStore();
    try {
      const meta = await store.openProjectStoreById(projectId);
      return new SqliteMemoryStore(store, meta);
    } catch (error) {
      store.close();
      mapError(error);
    }
  }

  async getActiveTask(): Promise<TaskRecord | null> {
    try {
      const current = await this.getCurrentHandoff();
      if (current) {
        const referenced = this.store.getRecord(current.handoff.active_task.id);
        if (
          referenced?.type === "task" &&
          !referenced.superseded_by &&
          ["active", "blocked"].includes(referenced.status)
        ) {
          return redactForOutput(referenced);
        }
      }
      const task = (this.store.listRecords({ type: "task" }) as TaskRecord[])
        .filter(
          (candidate) =>
            !candidate.superseded_by &&
            ["active", "blocked"].includes(candidate.status),
        )
        .sort(sortNewest)[0];
      return task ? redactForOutput(task) : null;
    } catch (error) {
      mapError(error);
    }
  }

  async getCurrentHandoff(): Promise<CurrentHandoff | null> {
    try {
      const record = this.store
        .listRecords({ type: "handoff", status: "latest" })
        .sort(sortNewest)[0];
      if (!record) return null;
      const handoff = recordToHandoff(record);
      return redactForOutput({
        record_id: record.id,
        handoff,
        quality_warnings: validateHandoffQuality(handoff),
      });
    } catch (error) {
      mapError(error);
    }
  }

  async getContinuation(): Promise<ContinuationView> {
    try {
      return redactForOutput(buildContinuationView(this.store, this.meta));
    } catch (error) {
      mapError(error);
    }
  }

  async validateHandoff(handoffId?: string): Promise<HandoffValidationResult> {
    try {
      const record = handoffId
        ? this.store.getRecord(handoffId)
        : this.store
            .listRecords({ type: "handoff", status: "latest" })
            .sort(sortNewest)[0];
      if (!record || record.type !== "handoff") {
        throw new ZentextError("NO_HANDOFF", "No matching handoff exists.");
      }
      const handoff = recordToHandoff(record);
      const validation = isHandoffCurrent(handoff, this.store);
      const liveTask = this.store.getRecord(handoff.active_task.id);
      return redactForOutput({
        current: validation.current,
        handoff_id: record.id,
        task_id: handoff.active_task.id,
        handoff_revision: handoff.active_task.revision,
        live_revision: liveTask?.type === "task" ? liveTask.revision : null,
        ...(!validation.current ? { reason: validation.reason } : {}),
        quality_warnings: validateHandoffQuality(handoff),
      });
    } catch (error) {
      mapError(error);
    }
  }

  async updateTask(input: TaskUpdateInput): Promise<TaskRecord> {
    try {
      const parsed = TaskUpdateInputSchema.parse(input);
      const safety = assertSafeExternalInput(parsed, {
        allowSecretOverride: parsed.allow_secret_override,
      });
      const active = await this.resolveTask(parsed.task_id);
      const provenance = this.provenance({
        sourceEnvironment: parsed.source_environment,
        task: active,
        filesInspected: parsed.files_inspected,
        commandsExecuted: parsed.commands_executed,
        verification: parsed.verification,
        parentRecordId: parsed.parent_record_id,
        parentHandoffId: parsed.parent_handoff_id,
        secretOverrideUsed: safety.secretOverrideUsed,
      });
      const patch: Partial<TaskRecord> = {
        ...(parsed.title !== undefined ? { title: parsed.title } : {}),
        ...(parsed.summary !== undefined ? { summary: parsed.summary } : {}),
        ...(parsed.status !== undefined ? { status: parsed.status } : {}),
        ...(parsed.notes !== undefined ? { notes: parsed.notes } : {}),
        ...(parsed.next_action !== undefined ? { next: parsed.next_action } : {}),
        provenance: {
          ...provenance,
          task_revision: active.revision + 1,
        },
      };
      const writer = createMemoryWriter(this.store);
      const updated = writer.updateRecord(active.id, patch, {
        expectedRevision: parsed.expected_revision,
        author: parsed.author ?? parsed.source_environment,
        allowSecretOverride: parsed.allow_secret_override,
      });
      if (updated.type !== "task") {
        throw new ZentextError("INVALID_STATE", "Task update returned a non-task record.");
      }
      return redactForOutput(updated);
    } catch (error) {
      mapError(error);
    }
  }

  async recordProgress(input: RecordProgressInput): Promise<ProgressResult> {
    try {
      const parsed = RecordProgressInputSchema.parse(input);
      const safety = assertSafeExternalInput(parsed, {
        allowSecretOverride: parsed.allow_secret_override,
      });
      const task = await this.resolveTask(parsed.task_id);
      if (task.revision !== parsed.expected_revision) {
        throw new ZentextError(
          "REVISION_CONFLICT",
          `Expected revision ${parsed.expected_revision}, but current revision is ${task.revision}.`,
          { current_revision: task.revision },
        );
      }
      const previousHandoff = this.store
        .listRecords({ type: "handoff", status: "latest" })
        .sort(sortNewest)[0];
      const baseProvenance = this.provenance({
        sourceEnvironment: parsed.source_environment,
        task,
        filesInspected: parsed.files_inspected,
        commandsExecuted: parsed.commands_executed,
        verification: parsed.verification.map(verificationText),
        parentRecordId: parsed.parent_record_id,
        parentHandoffId: parsed.parent_handoff_id ?? previousHandoff?.id,
        secretOverrideUsed: safety.secretOverrideUsed,
      });
      const result = this.store.withTransaction(() => {
        const writer = createMemoryWriter(this.store);
        const created: AnyRecord[] = [];

        for (const decision of parsed.accepted_decisions ?? []) {
          created.push(
            writer.createRecord(
              {
                type: "decision",
                title: decision.title,
                decision: decision.decision,
                rationale: decision.rationale,
                status: "accepted",
                author: parsed.author ?? parsed.source_environment,
                provenance: baseProvenance,
              },
              { allowSecretOverride: parsed.allow_secret_override },
            ),
          );
        }
        for (const blocker of parsed.blockers ?? []) {
          created.push(
            writer.createRecord(
              {
                type: "blocker",
                title: blocker.title,
                blocker: blocker.blocker,
                severity: blocker.severity,
                workaround: blocker.workaround,
                status: "open",
                author: parsed.author ?? parsed.source_environment,
                provenance: baseProvenance,
              },
              { allowSecretOverride: parsed.allow_secret_override },
            ),
          );
        }
        for (const verification of parsed.verification) {
          created.push(
            writer.createRecord(
              {
                type: "validation",
                title: verification.check,
                check: verification.check,
                result: verification.result,
                summary: verification.summary,
                run_at: new Date().toISOString(),
                author: parsed.author ?? parsed.source_environment,
                provenance: baseProvenance,
              },
              { allowSecretOverride: parsed.allow_secret_override },
            ),
          );
        }

        const updated = writer.updateRecord(
          task.id,
          {
            notes: [...(task.notes ?? []), ...(parsed.notes ?? [])],
            next: parsed.next_action,
            refs: {
              ...task.refs,
              files: [
                ...new Set([
                  ...(task.refs.files ?? []),
                  ...parsed.changed_files,
                  ...(parsed.files_inspected ?? []),
                ]),
              ],
            },
            provenance: {
              ...baseProvenance,
              task_revision: task.revision + 1,
            },
          },
          {
            expectedRevision: parsed.expected_revision,
            author: parsed.author ?? parsed.source_environment,
            allowSecretOverride: parsed.allow_secret_override,
          },
        );
        if (updated.type !== "task") {
          throw new ZentextError("INVALID_STATE", "Progress update returned a non-task record.");
        }

        const handoff = buildHandoff(this.store, this.meta, {
          previous_agent: parsed.source_environment,
          completed: parsed.completed,
          blockers: (parsed.blockers ?? []).map(
            (entry) => `${entry.title}: ${entry.blocker}`,
          ),
          files_changed: parsed.changed_files,
          verification: parsed.verification.map(verificationText),
          stopping_point: parsed.stopping_point,
          next_action: parsed.next_action,
          references: {
            files: [
              ...new Set([
                ...parsed.changed_files,
                ...(parsed.files_inspected ?? []),
              ]),
            ],
            commits: [],
            branches: [],
          },
        });
        const handoffInput = {
          ...handoffToCreateInput(handoff, parsed.source_environment),
          provenance: {
            ...baseProvenance,
            task_revision: updated.revision,
            parent_handoff_id: parsed.parent_handoff_id ?? previousHandoff?.id,
          },
        };
        const handoffRecord = writer.createHandoff(handoffInput, {
          author: parsed.author ?? parsed.source_environment,
          allowSecretOverride: parsed.allow_secret_override,
        });
        created.push(handoffRecord);
        return {
          task: updated,
          handoff: {
            record_id: handoffRecord.id,
            handoff,
            quality_warnings: validateHandoffQuality(handoff),
          },
          created_records: created,
        };
      });
      return redactForOutput(result);
    } catch (error) {
      mapError(error);
    }
  }

  async queryMemory(input: MemoryQueryInput): Promise<AnyRecord[]> {
    try {
      const parsed = MemoryQueryInputSchema.parse(input);
      assertSafeExternalInput(parsed);
      const query = parsed.query.trim().toLowerCase();
      let records = this.store.listRecords({
        ...(parsed.type ? { type: parsed.type } : {}),
        ...(parsed.status ? { status: parsed.status } : {}),
      });
      if (query) records = records.filter((record) => recordText(record).includes(query));
      return redactForOutput(records.sort(sortNewest).slice(0, parsed.limit));
    } catch (error) {
      mapError(error);
    }
  }

  async searchMemory(input: MemorySearchInput): Promise<MemorySearchPage> {
    try {
      const parsed = MemorySearchInputSchema.parse(input);
      assertSafeExternalInput(parsed);
      const safeRecords = redactForOutput(this.store.listRecords()) as AnyRecord[];
      return redactForOutput(
        searchMemoryRecords(safeRecords, parsed, this.meta.projectId),
      );
    } catch (error) {
      mapError(error);
    }
  }

  close(): void {
    this.store.close();
  }

  private async resolveTask(taskId?: string): Promise<TaskRecord> {
    if (taskId) {
      const record = this.store.getRecord(taskId);
      if (!record || record.type !== "task") {
        throw new ZentextError("RECORD_NOT_FOUND", `Task not found: ${taskId}`);
      }
      if (record.superseded_by || !["active", "blocked"].includes(record.status)) {
        throw new ZentextError("INVALID_STATE", "The selected task is not actionable.");
      }
      return record;
    }
    const active = await this.getActiveTask();
    if (!active) {
      throw new ZentextError("NO_ACTIVE_TASK", "No active or blocked task exists.");
    }
    return active;
  }

  private provenance(input: {
    sourceEnvironment: string;
    task: TaskRecord;
    filesInspected?: string[];
    commandsExecuted?: string[];
    verification?: string[];
    parentRecordId?: string;
    parentHandoffId?: string;
    secretOverrideUsed?: boolean;
  }): RecordProvenance {
    return {
      source_environment: input.sourceEnvironment,
      captured_at: new Date().toISOString(),
      project_id: this.meta.projectId,
      task_id: input.task.id,
      task_revision: input.task.revision,
      files_inspected: input.filesInspected ?? [],
      commands_executed: input.commandsExecuted ?? [],
      verification: input.verification ?? [],
      parent_record_id: input.parentRecordId,
      parent_handoff_id: input.parentHandoffId,
      secret_override_used: input.secretOverrideUsed || undefined,
    };
  }
}

export async function openMemoryStore(
  input: OpenProjectInput,
): Promise<MemoryStore> {
  try {
    return await SqliteMemoryStore.open(input);
  } catch (error) {
    mapError(error);
  }
}
