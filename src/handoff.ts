/**
 * Structured handoff contract and agent startup acknowledgement for Zentext.
 *
 * A handoff captures the canonical state a fresh agent needs to continue
 * work without reading the prior conversation. It is derived from the live
 * Zentext store and must reference the live task revision.
 *
 * previous_response is optional supporting prose only and never overrides
 * canonical task state.
 */

import type {
  AnyRecord,
  CreateHandoffInput,
  DecisionRecord,
  HandoffRecord,
  RecordRefs,
  TaskRecord,
} from "./types/records.js";
import type { Store, StoreMeta } from "./types/store.js";

export const HANDOFF_SCHEMA_VERSION = 1;

export interface StructuredHandoffTask {
  id: string;
  title: string;
  revision: number;
  status: string;
}

export interface StructuredHandoff {
  schema_version: number;
  project_id: string;
  project_name: string;
  previous_agent: string;
  active_task: StructuredHandoffTask;
  accepted_decisions: string[];
  completed: string[];
  stopping_point: string;
  next_action: string;
  blockers: string[];
  references: RecordRefs;
  files_changed: string[];
  verification: string[];
  previous_response?: string;
  created_at: string;
}

export interface HandoffBuildOptions {
  previous_agent: string;
  stopping_point: string;
  next_action: string;
  completed?: string[];
  blockers?: string[];
  references?: RecordRefs;
  files_changed?: string[];
  verification?: string[];
  previous_response?: string;
}

export interface AcknowledgementResult {
  ok: true;
  text: string;
  json: {
    acknowledged: boolean;
    active_task_title: string;
    task_id: string;
    task_revision: number;
    previous_agent: string;
    completed_summary: string;
    stopping_point: string;
    next_action: string;
    blockers: string[];
  };
}

export class HandoffValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HandoffValidationError";
  }
}

export class HandoffStaleError extends Error {
  constructor(
    message: string,
    public readonly handoffRevision: number,
    public readonly liveRevision: number,
  ) {
    super(message);
    this.name = "HandoffStaleError";
  }
}

function pickActiveTask(store: Store): TaskRecord | null {
  const tasks = store.listRecords({ type: "task" }) as TaskRecord[];
  if (tasks.length === 0) return null;

  const active = tasks
    .filter((t) => t.status === "active")
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime() ||
        a.id.localeCompare(b.id),
    )[0];
  if (active) return active;

  // Fall back to blocked tasks when no active task exists.
  const blocked = tasks
    .filter((t) => t.status === "blocked")
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime() ||
        a.id.localeCompare(b.id),
    )[0];
  if (blocked) return blocked;

  // Completed tasks are valid for final handoffs when no actionable work remains.
  const done = tasks
    .filter((t) => t.status === "done" || t.status === "canceled")
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime() ||
        a.id.localeCompare(b.id),
    )[0];
  return done ?? null;
}


function pickAcceptedDecisions(store: Store): string[] {
  return (store.listRecords({ type: "decision" }) as DecisionRecord[])
    .filter((d) => d.status === "accepted")
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime() ||
        a.id.localeCompare(b.id),
    )
    .map((d) => `${d.title}: ${d.decision}`);
}

function pickBlockers(store: Store): string[] {
  return store
    .listRecords({ type: "blocker", status: "open" })
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime() ||
        a.id.localeCompare(b.id),
    )
    .map((b) => `${b.title}: ${(b as unknown as { blocker?: string }).blocker ?? ""}`);
}

export function buildHandoff(
  store: Store,
  meta: StoreMeta,
  options: HandoffBuildOptions,
): StructuredHandoff {
  const activeTask = pickActiveTask(store);
  if (!activeTask) {
    throw new HandoffValidationError(
      "Cannot build handoff: no active or blocked task exists in the store.",
    );
  }

  if (!options.stopping_point || options.stopping_point.trim() === "") {
    throw new HandoffValidationError("stopping_point is required.");
  }
  const isCompleteTask = activeTask.status === "done" || activeTask.status === "canceled";
  if (!isCompleteTask && (!options.next_action || options.next_action.trim() === "")) {
    throw new HandoffValidationError("next_action is required for an incomplete task.");
  }

  const now = new Date().toISOString();

  return {
    schema_version: HANDOFF_SCHEMA_VERSION,
    project_id: meta.projectId,
    project_name: meta.projectName,
    previous_agent: options.previous_agent,
    active_task: {
      id: activeTask.id,
      title: activeTask.title,
      revision: activeTask.revision,
      status: activeTask.status,
    },
    accepted_decisions: pickAcceptedDecisions(store),
    completed: options.completed ?? [],
    stopping_point: options.stopping_point.trim(),
    next_action: options.next_action.trim(),
    blockers: options.blockers ?? pickBlockers(store),
    references: options.references ?? { files: [], commits: [], branches: [] },
    files_changed: options.files_changed ?? [],
    verification: options.verification ?? [],
    previous_response: options.previous_response?.trim(),
    created_at: now,
  };
}

export function validateHandoff(handoff: unknown): asserts handoff is StructuredHandoff {
  if (typeof handoff !== "object" || handoff === null) {
    throw new HandoffValidationError("Handoff must be an object.");
  }
  const h = handoff as Partial<StructuredHandoff>;

  if (h.schema_version !== HANDOFF_SCHEMA_VERSION) {
    throw new HandoffValidationError(
      `Unsupported handoff schema_version: ${h.schema_version ?? "missing"}.`,
    );
  }
  if (!h.project_id || typeof h.project_id !== "string") {
    throw new HandoffValidationError("project_id is required and must be a string.");
  }
  if (!h.project_name || typeof h.project_name !== "string") {
    throw new HandoffValidationError("project_name is required and must be a string.");
  }
  if (!h.previous_agent || typeof h.previous_agent !== "string") {
    throw new HandoffValidationError("previous_agent is required and must be a string.");
  }
  if (!h.active_task || typeof h.active_task !== "object") {
    throw new HandoffValidationError("active_task is required.");
  }
  const task = h.active_task as Partial<StructuredHandoffTask>;
  if (!task.id || typeof task.id !== "string") {
    throw new HandoffValidationError("active_task.id is required.");
  }
  if (!task.title || typeof task.title !== "string") {
    throw new HandoffValidationError("active_task.title is required.");
  }
  if (typeof task.revision !== "number" || task.revision < 1) {
    throw new HandoffValidationError("active_task.revision must be a positive number.");
  }
  if (!task.status || typeof task.status !== "string") {
    throw new HandoffValidationError("active_task.status is required.");
  }
  if (!h.stopping_point || typeof h.stopping_point !== "string") {
    throw new HandoffValidationError("stopping_point is required.");
  }
  const isCompleteTask = task.status === "done" || task.status === "canceled";
  if (!isCompleteTask && (!h.next_action || typeof h.next_action !== "string")) {
    throw new HandoffValidationError("next_action is required for an incomplete task.");
  }
  if (!Array.isArray(h.accepted_decisions)) {
    throw new HandoffValidationError("accepted_decisions must be an array.");
  }
  if (!Array.isArray(h.completed)) {
    throw new HandoffValidationError("completed must be an array.");
  }
  if (!Array.isArray(h.blockers)) {
    throw new HandoffValidationError("blockers must be an array.");
  }
  if (!Array.isArray(h.files_changed)) {
    throw new HandoffValidationError("files_changed must be an array.");
  }
  if (!Array.isArray(h.verification)) {
    throw new HandoffValidationError("verification must be an array.");
  }
  if (
    h.references !== undefined &&
    (typeof h.references !== "object" ||
      h.references === null ||
      !Array.isArray(h.references.files) ||
      !Array.isArray(h.references.commits) ||
      !Array.isArray(h.references.branches))
  ) {
    throw new HandoffValidationError("references must be a valid RecordRefs shape.");
  }
}

export function renderAcknowledgement(
  handoff: StructuredHandoff,
  format: "human" | "json" = "human",
): string | AcknowledgementResult["json"] {
  const json: AcknowledgementResult["json"] = {
    acknowledged: true,
    active_task_title: handoff.active_task.title,
    task_id: handoff.active_task.id,
    task_revision: handoff.active_task.revision,
    previous_agent: handoff.previous_agent,
    completed_summary: handoff.completed.join("; ") || "(none recorded)",
    stopping_point: handoff.stopping_point,
    next_action: handoff.next_action,
    blockers:
      handoff.blockers.length > 0 ? handoff.blockers : ["none"],
  };

  if (format === "json") {
    return json;
  }

  const lines: string[] = [
    "Zentext context loaded.",
    "",
    `Active task: ${handoff.active_task.title}`,
    `Task ID: ${handoff.active_task.id}`,
    `Task revision: ${handoff.active_task.revision}`,
    `Previous agent: ${handoff.previous_agent}`,
    `Completed: ${json.completed_summary}`,
    `Stopping point: ${handoff.stopping_point}`,
    `Next action: ${handoff.next_action}`,
    `Blockers: ${handoff.blockers.length > 0 ? handoff.blockers.join("; ") : "none"}`,
    "",
    "I will continue from this stopping point without restarting completed work.",
  ];
  return lines.join("\n");
}

export function isHandoffCurrent(
  handoff: StructuredHandoff,
  store: Store,
): { current: true } | { current: false; reason: string; handoffRevision: number; liveRevision: number } {
  const live = store.getRecord(handoff.active_task.id);
  if (!live) {
    return {
      current: false,
      reason: "active_task no longer exists in the store",
      handoffRevision: handoff.active_task.revision,
      liveRevision: 0,
    };
  }
  if (live.revision !== handoff.active_task.revision) {
    return {
      current: false,
      reason: `active_task revision changed`,
      handoffRevision: handoff.active_task.revision,
      liveRevision: live.revision,
    };
  }
  return { current: true };
}

export function handoffToCreateInput(
  handoff: StructuredHandoff,
  author = handoff.previous_agent,
): CreateHandoffInput {
  return {
    type: "handoff",
    title: `Handoff from ${handoff.previous_agent}`,
    summary: handoff.stopping_point,
    author,
    from: handoff.previous_agent,
    to: "next-agent",
    context: handoff.accepted_decisions.join("\n") || "No accepted decisions recorded.",
    structured_handoff: handoff as unknown as Record<string, unknown>,
    state: JSON.stringify(
      {
        completed: handoff.completed,
        stopping_point: handoff.stopping_point,
        next_action: handoff.next_action,
        blockers: handoff.blockers,
        files_changed: handoff.files_changed,
        verification: handoff.verification,
        previous_response: handoff.previous_response,
      },
      null,
      2,
    ),
    next: handoff.next_action,
    refs: handoff.references,
  };
}

export function recordToHandoff(record: AnyRecord): StructuredHandoff {
  if (record.type !== "handoff") {
    throw new HandoffValidationError(`Record is not a handoff: ${record.type}`);
  }
  const handoffRecord = record as HandoffRecord;

  // Prefer an embedded structured_handoff payload if present.
  const embedded = (handoffRecord as unknown as { structured_handoff?: unknown })
    .structured_handoff;
  if (embedded) {
    validateHandoff(embedded);
    return embedded;
  }

  // Otherwise reconstruct the structured view from the legacy handoff payload.
  // The state field may be JSON; try to parse it.
  let parsedState: Record<string, unknown> = {};
  if (handoffRecord.state) {
    try {
      parsedState = JSON.parse(handoffRecord.state) as Record<string, unknown>;
    } catch {
      parsedState = { stopping_point: handoffRecord.state };
    }
  }

  const completed = Array.isArray(parsedState.completed)
    ? parsedState.completed.map(String)
    : [];
  const blockers = Array.isArray(parsedState.blockers)
    ? parsedState.blockers.map(String)
    : [];
  const filesChanged = Array.isArray(parsedState.files_changed)
    ? parsedState.files_changed.map(String)
    : [];
  const verification = Array.isArray(parsedState.verification)
    ? parsedState.verification.map(String)
    : [];

  const handoff: StructuredHandoff = {
    schema_version: HANDOFF_SCHEMA_VERSION,
    project_id: handoffRecord.project,
    project_name: handoffRecord.title,
    previous_agent: handoffRecord.from,
    active_task: {
      id: "unknown",
      title: "unknown",
      revision: 1,
      status: "active",
    },
    accepted_decisions: handoffRecord.context ? handoffRecord.context.split("\n") : [],
    completed,
    stopping_point:
      typeof parsedState.stopping_point === "string"
        ? parsedState.stopping_point
        : handoffRecord.next,
    next_action: handoffRecord.next,
    blockers,
    references: handoffRecord.refs ?? { files: [], commits: [], branches: [] },
    files_changed: filesChanged,
    verification,
    previous_response:
      typeof parsedState.previous_response === "string"
        ? parsedState.previous_response
        : undefined,
    created_at: handoffRecord.created_at,
  };

  validateHandoff(handoff);
  return handoff;
}
