/**
 * Zentext memory record type definitions.
 *
 * These types define the baseline structured memory records for the
 * local store. They are derived from docs/memory-schema.md and
 * docs/implementation/data-model-and-store.md.
 */

// ---------------------------------------------------------------------------
// Record type enum
// ---------------------------------------------------------------------------

export type RecordType =
  | "task"
  | "decision"
  | "blocker"
  | "handoff"
  | "log"
  | "validation"
  | "policy"
  | "custom";

export const RECORD_TYPES: readonly RecordType[] = [
  "task",
  "decision",
  "blocker",
  "handoff",
  "log",
  "validation",
  "policy",
  "custom",
] as const;

// ---------------------------------------------------------------------------
// Status enums per type
// ---------------------------------------------------------------------------

export type TaskStatus = "active" | "blocked" | "done" | "canceled";
export type DecisionStatus = "proposed" | "accepted" | "superseded" | "rejected";
export type BlockerStatus = "open" | "resolved" | "canceled";
export type HandoffStatus = "latest" | "archived" | "superseded";
export type LogStatus = "recorded" | "redacted";
export type ValidationStatus = "passed" | "failed" | "inconclusive";
export type PolicyStatus = "active" | "inactive" | "superseded";
export type CustomStatus = "active" | "archived";

export type RecordStatus =
  | TaskStatus
  | DecisionStatus
  | BlockerStatus
  | HandoffStatus
  | LogStatus
  | ValidationStatus
  | PolicyStatus
  | CustomStatus;

/** Allowed status values for each record type. */
export const ALLOWED_STATUSES: Readonly<Record<RecordType, readonly string[]>> = {
  task: ["active", "blocked", "done", "canceled"],
  decision: ["proposed", "accepted", "superseded", "rejected"],
  blocker: ["open", "resolved", "canceled"],
  handoff: ["latest", "archived", "superseded"],
  log: ["recorded", "redacted"],
  validation: ["passed", "failed", "inconclusive"],
  policy: ["active", "inactive", "superseded"],
  custom: ["active", "archived"],
};

/** Default status for each record type when omitted on create. */
export const DEFAULT_STATUSES: Readonly<Record<RecordType, string>> = {
  task: "active",
  decision: "accepted",
  blocker: "open",
  handoff: "latest",
  log: "recorded",
  // validation uses `result` field — handled specially in store logic
  validation: "passed",
  policy: "active",
  custom: "active",
};

// ---------------------------------------------------------------------------
// Refs (repo references, never file contents or secrets)
// ---------------------------------------------------------------------------

export interface RecordRefs {
  files?: string[];
  commits?: string[];
  branches?: string[];
}

// ---------------------------------------------------------------------------
// Common envelope (all record types) — stored/output shape
// ---------------------------------------------------------------------------

export interface BaseRecord {
  id: string;
  project: string;
  type: RecordType;
  title: string;
  status: string;
  summary?: string;
  created_at: string; // ISO-8601
  updated_at: string; // ISO-8601
  revision: number;
  author: string;
  tags: string[];
  refs: RecordRefs;
  schema_version: number;
  supersedes?: string[];
  superseded_by?: string;
}

// ---------------------------------------------------------------------------
// Type-specific payload interfaces
// ---------------------------------------------------------------------------

export interface TaskPayload {
  goal: string;
  steps?: string[];
  next?: string;
  related?: string[];
}

export interface DecisionPayload {
  decision: string;
  rationale?: string;
  alternatives_considered?: string[];
}

export interface BlockerPayload {
  blocker: string;
  severity?: "high" | "medium" | "low";
  workaround?: string;
  related?: string[];
}

export interface HandoffPayload {
  from: string;
  to: string;
  context: string;
  state: string;
  next: string;
  open_questions?: string[];
  completed_this_session?: string[];
}

export interface LogPayload {
  command?: string;
  exit_code?: number;
  summary: string;
  safe_excerpt?: string;
  sanitized?: boolean;
}

export interface ValidationPayload {
  check: string;
  result: "passed" | "failed" | "inconclusive";
  summary?: string;
  run_at?: string; // ISO-8601
  details_ref?: string;
}

export interface PolicyPayload {
  rule: string;
  scope?: "project" | "team" | "workspace";
  enforcement?: "advisory" | "required";
}

export interface CustomPayload {
  kind: string;
  body: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Full record types (envelope + payload)
// ---------------------------------------------------------------------------

export type TaskRecord = BaseRecord & { type: "task" } & TaskPayload;
export type DecisionRecord = BaseRecord & { type: "decision" } & DecisionPayload;
export type BlockerRecord = BaseRecord & { type: "blocker" } & BlockerPayload;
export type HandoffRecord = BaseRecord & { type: "handoff" } & HandoffPayload;
export type LogRecord = BaseRecord & { type: "log" } & LogPayload;
export type ValidationRecord = BaseRecord & { type: "validation" } & ValidationPayload;
export type PolicyRecord = BaseRecord & { type: "policy" } & PolicyPayload;
export type CustomRecord = BaseRecord & { type: "custom" } & CustomPayload;

export type AnyRecord =
  | TaskRecord
  | DecisionRecord
  | BlockerRecord
  | HandoffRecord
  | LogRecord
  | ValidationRecord
  | PolicyRecord
  | CustomRecord;

// ---------------------------------------------------------------------------
// Create input types (what the caller supplies — no generated fields)
// ---------------------------------------------------------------------------

export interface CreateInputBase {
  type: RecordType;
  title: string;
  status?: string; // optional — uses type default if omitted
  summary?: string;
  author?: string; // optional — defaults to "unknown"
  tags?: string[];
  refs?: RecordRefs;
  supersedes?: string[];
}

export interface CreateTaskInput extends CreateInputBase {
  type: "task";
  goal: string;
  steps?: string[];
  next?: string;
  related?: string[];
}

export interface CreateDecisionInput extends CreateInputBase {
  type: "decision";
  decision: string;
  rationale?: string;
  alternatives_considered?: string[];
}

export interface CreateBlockerInput extends CreateInputBase {
  type: "blocker";
  blocker: string;
  severity?: "high" | "medium" | "low";
  workaround?: string;
  related?: string[];
}

export interface CreateHandoffInput extends CreateInputBase {
  type: "handoff";
  from: string;
  to: string;
  context: string;
  state: string;
  next: string;
  open_questions?: string[];
  completed_this_session?: string[];
}

export interface CreateLogInput extends CreateInputBase {
  type: "log";
  command?: string;
  exit_code?: number;
  summary: string;
  safe_excerpt?: string;
  sanitized?: boolean;
}

export interface CreateValidationInput extends CreateInputBase {
  type: "validation";
  check: string;
  result: "passed" | "failed" | "inconclusive";
  summary?: string;
  run_at?: string;
  details_ref?: string;
}

export interface CreatePolicyInput extends CreateInputBase {
  type: "policy";
  rule: string;
  scope?: "project" | "team" | "workspace";
  enforcement?: "advisory" | "required";
}

export interface CreateCustomInput extends CreateInputBase {
  type: "custom";
  kind: string;
  body: Record<string, unknown>;
}

export type CreateRecordInput =
  | CreateTaskInput
  | CreateDecisionInput
  | CreateBlockerInput
  | CreateHandoffInput
  | CreateLogInput
  | CreateValidationInput
  | CreatePolicyInput
  | CreateCustomInput;

// ---------------------------------------------------------------------------
// Update input
// ---------------------------------------------------------------------------

export interface UpdateRecordInput {
  id: string;
  title?: string;
  status?: string;
  summary?: string;
  tags?: string[];
  refs?: RecordRefs;
  author?: string;
  // type-specific payload fields to merge
  payload?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// List filter
// ---------------------------------------------------------------------------

export interface ListFilter {
  type?: RecordType;
  status?: string;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Minimum required fields per type (for create validation)
// ---------------------------------------------------------------------------

export const MINIMUM_CREATE_FIELDS: Readonly<Record<RecordType, string[]>> = {
  task: ["type", "title", "goal"],
  decision: ["type", "title", "decision"],
  blocker: ["type", "title", "blocker"],
  handoff: ["type", "title", "context", "state", "next"],
  log: ["type", "title", "summary"],
  validation: ["type", "title", "check", "result"],
  policy: ["type", "title", "rule"],
  custom: ["type", "title", "kind", "body"],
};

// ---------------------------------------------------------------------------
// Generated fields (assigned by Zentext, never required from caller)
// ---------------------------------------------------------------------------

export const GENERATED_FIELDS = [
  "id",
  "project",
  "created_at",
  "updated_at",
  "revision",
] as const;

// ---------------------------------------------------------------------------
// Immutable fields (cannot be changed after create)
// ---------------------------------------------------------------------------

export const IMMUTABLE_FIELDS = [
  "id",
  "project",
  "type",
  "created_at",
] as const;
