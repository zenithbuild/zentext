import {
  HandoffValidationError,
  isHandoffCurrent,
  recordToHandoff,
  type StructuredHandoff,
} from "./handoff.js";
import type { TaskRecord } from "./types/records.js";
import type { Store, StoreMeta } from "./types/store.js";
import {
  validateHandoffQuality,
  type HandoffQualityWarning,
} from "./handoff-quality.js";

export const CONTINUATION_SCHEMA_VERSION = 1;

export interface ContinuationView {
  schema_version: number;
  project: {
    id: string;
    name: string;
  };
  task: {
    id: string;
    title: string;
    goal: string;
    status: string;
    revision: number;
    summary: string | null;
    notes: string[];
    next_action: string | null;
  };
  handoff: {
    record_id: string;
    previous_agent: string;
    created_at: string;
    based_on_task_revision: number;
    accepted_decisions: string[];
    completed: string[];
    files_changed: string[];
    blockers: string[];
    verification: string[];
    references: {
      files: string[];
      commits: string[];
      branches: string[];
    };
    stopping_point: string;
    next_action: string;
  };
  validation: {
    status: "current";
    task_revision: number;
    handoff_revision: number;
  };
  quality_warnings: HandoffQualityWarning[];
}

export class ContinuationNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContinuationNotFoundError";
  }
}

export class ContinuationInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContinuationInvalidError";
  }
}

export class ContinuationStaleError extends Error {
  constructor(
    message: string,
    public readonly taskId: string,
    public readonly handoffRevision: number,
    public readonly liveRevision: number,
  ) {
    super(message);
    this.name = "ContinuationStaleError";
  }
}

function pickLatestHandoff(store: Store): {
  recordId: string;
  handoff: StructuredHandoff;
} {
  const latest = store
    .listRecords({ type: "handoff", status: "latest" })
    .filter((record) => !record.superseded_by)
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime() ||
        a.id.localeCompare(b.id),
    )[0];

  if (!latest) {
    throw new ContinuationNotFoundError(
      "No current handoff found. Create one with `zentext handoff create`.",
    );
  }

  try {
    return {
      recordId: latest.id,
      handoff: recordToHandoff(latest),
    };
  } catch (error) {
    if (error instanceof HandoffValidationError) {
      throw new ContinuationInvalidError(`Invalid current handoff: ${error.message}`);
    }
    throw error;
  }
}

function requireStringArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new ContinuationInvalidError(`${name} must be an array of strings.`);
  }
  return [...value];
}

function taskNotes(task: TaskRecord): string[] {
  const record = task as TaskRecord & { note?: unknown };
  if (record.notes !== undefined) {
    return requireStringArray(record.notes, "task.notes");
  }
  return typeof record.note === "string" ? [record.note] : [];
}

function taskNextAction(task: TaskRecord): string | null {
  const legacy = task as TaskRecord & { next_action?: unknown };
  if (typeof legacy.next_action === "string") return legacy.next_action;
  return typeof task.next === "string" ? task.next : null;
}

export function buildContinuationView(store: Store, meta: StoreMeta): ContinuationView {
  const latest = pickLatestHandoff(store);
  const handoff = latest.handoff;
  if (handoff.project_id !== meta.projectId) {
    throw new ContinuationInvalidError(
      "The current handoff belongs to a different project and cannot be continued.",
    );
  }

  const referencedTask = store.getRecord(handoff.active_task.id);
  if (!referencedTask || referencedTask.type !== "task") {
    throw new ContinuationInvalidError(
      `The current handoff references missing task ${handoff.active_task.id}.`,
    );
  }
  const task = referencedTask as TaskRecord;
  if (
    task.project !== meta.projectId ||
    task.superseded_by ||
    !["active", "blocked"].includes(task.status)
  ) {
    throw new ContinuationNotFoundError(
      "The task referenced by the current handoff is no longer active or blocked.",
    );
  }

  const current = isHandoffCurrent(handoff, store);
  if (!current.current) {
    throw new ContinuationStaleError(
      current.reason,
      handoff.active_task.id,
      current.handoffRevision,
      current.liveRevision,
    );
  }

  const acceptedDecisions = requireStringArray(
    handoff.accepted_decisions,
    "handoff.accepted_decisions",
  );
  const completed = requireStringArray(handoff.completed, "handoff.completed");
  const filesChanged = requireStringArray(
    handoff.files_changed,
    "handoff.files_changed",
  );
  const blockers = requireStringArray(handoff.blockers, "handoff.blockers");
  const verification = requireStringArray(
    handoff.verification,
    "handoff.verification",
  );

  return {
    schema_version: CONTINUATION_SCHEMA_VERSION,
    project: {
      id: meta.projectId,
      name: meta.projectName,
    },
    task: {
      id: task.id,
      title: task.title,
      goal: task.goal,
      status: task.status,
      revision: task.revision,
      summary: task.summary ?? null,
      notes: taskNotes(task),
      next_action: taskNextAction(task),
    },
    handoff: {
      record_id: latest.recordId,
      previous_agent: handoff.previous_agent,
      created_at: handoff.created_at,
      based_on_task_revision: handoff.active_task.revision,
      accepted_decisions: acceptedDecisions,
      completed,
      files_changed: filesChanged,
      blockers,
      verification,
      references: {
        files: [...(handoff.references.files ?? [])],
        commits: [...(handoff.references.commits ?? [])],
        branches: [...(handoff.references.branches ?? [])],
      },
      stopping_point: handoff.stopping_point,
      next_action: handoff.next_action,
    },
    validation: {
      status: "current",
      task_revision: task.revision,
      handoff_revision: handoff.active_task.revision,
    },
    quality_warnings: validateHandoffQuality(handoff),
  };
}
