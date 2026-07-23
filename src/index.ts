/**
 * Zentext — local-first shared context and memory layer for AI coding agents.
 *
 * Phase 1 public API: schema + local store foundation.
 *
 * No MCP server, CLI, repack engine, audit, or cloud features are included
 * in Phase 1. This module exports only the store interface and implementation
 * needed for schema + store operations.
 */

export type { Store, StoreMeta } from "./types/store.js";
export type {
  AnyRecord,
  BaseRecord,
  CreateRecordInput,
  CreateTaskInput,
  CreateDecisionInput,
  CreateBlockerInput,
  CreateHandoffInput,
  CreateLogInput,
  CreateValidationInput,
  CreatePolicyInput,
  CreateCustomInput,
  UpdateRecordInput,
  ListFilter,
  RecordType,
  RecordRefs,
  TaskRecord,
  DecisionRecord,
  BlockerRecord,
  HandoffRecord,
  LogRecord,
  ValidationRecord,
  PolicyRecord,
  CustomRecord,
  TaskPayload,
  DecisionPayload,
  BlockerPayload,
  HandoffPayload,
  LogPayload,
  ValidationPayload,
  PolicyPayload,
  CustomPayload,
} from "./types/records.js";

export {
  RECORD_TYPES,
  ALLOWED_STATUSES,
  DEFAULT_STATUSES,
  MINIMUM_CREATE_FIELDS,
  GENERATED_FIELDS,
  IMMUTABLE_FIELDS,
} from "./types/records.js";

export { SqliteStore, StoreValidationError, StoreNotFoundError } from "./store/sqlite-store.js";
export { deriveProjectId, deriveProjectName, normalizeGitUrl, getGitOriginUrl } from "./store/project-id.js";
export { runMigrations, getSchemaVersion, MIGRATIONS } from "./store/migrations.js";

export {
  CONTINUATION_SCHEMA_VERSION,
  buildContinuationView,
  ContinuationInvalidError,
  ContinuationNotFoundError,
  ContinuationStaleError,
  type ContinuationView,
} from "./continuation.js";
export {
  renderContinuation,
  renderContinuationHuman,
  renderContinuationMarkdown,
  renderContinuationPrompt,
  renderStaleContinuation,
  type ContinuationFormat,
} from "./continuation-format.js";
export {
  TOOL_NEUTRAL_CONTINUATION_INSTRUCTIONS,
  renderToolNeutralContinuationPrompt,
} from "./continuation-prompt.js";
