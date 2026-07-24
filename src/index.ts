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
  RecordProvenance,
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
export {
  ENVIRONMENT_FORMATTER_VERSION,
  ENVIRONMENT_FORMATTER_IDS,
  UnsupportedEnvironmentFormatterError,
  resolveEnvironmentFormatterId,
  getEnvironmentFormatterDescriptor,
  renderEnvironmentContinuation,
  type EnvironmentFormatterId,
  type EnvironmentFormatterDescriptor,
  type EnvironmentFormatterOptions,
} from "./environment-formatters.js";

export {
  openProject,
  getContinuation,
  getActiveTask,
  validateHandoff,
  recordProgress,
  updateTask,
  queryMemory,
  searchMemory,
  type ZentextProject,
} from "./sdk.js";
export {
  MEMORY_INTERFACE_VERSION,
  SqliteMemoryStore,
  openMemoryStore,
  type MemoryStore,
  type CurrentHandoff,
  type HandoffValidationResult,
  type ProgressResult,
} from "./memory-interface.js";
export {
  MEMORY_SEARCH_SCHEMA_VERSION,
  MEMORY_SEARCH_STRATEGY,
  MEMORY_SEARCH_MAX_QUERY_LENGTH,
  MEMORY_SEARCH_DEFAULT_LIMIT,
  MEMORY_SEARCH_MAX_LIMIT,
  MEMORY_SEARCH_MAX_OFFSET,
  MEMORY_SEARCH_FRESHNESS_MODES,
  MEMORY_SEARCH_RANKING_TUPLE,
  MemorySearchInputSchema,
  renderMemorySearch,
  type MemorySearchInput,
  type ParsedMemorySearchInput,
  type MemorySearchMatch,
  type MemorySearchMatchKind,
  type MemorySearchFreshness,
  type MemorySearchVerificationConfidence,
  type MemorySearchResult,
  type MemorySearchPage,
  type MemorySearchState,
} from "./memory-search.js";
export {
  MEMORY_SEARCH_CACHE_KEY_VERSION,
  MEMORY_SEARCH_CACHE_MAX_ENTRIES,
  MEMORY_SEARCH_CACHE_MAX_BYTES,
  MEMORY_SEARCH_CACHE_MAX_TRACKED_PROJECTS,
  type MemorySearchCacheStats,
} from "./memory-search-cache.js";
export {
  ZENTEXT_SCHEMA_VERSION,
  CreateRecordInputSchema,
  UpdateRecordInputSchema,
  StructuredHandoffSchema,
  HandoffAcknowledgementSchema,
  ExportRequestSchema,
  StoredRecordSchema,
  OpenProjectInputSchema,
  TaskUpdateInputSchema,
  RecordProgressInputSchema,
  MemoryQueryInputSchema,
  type OpenProjectInput,
  type TaskUpdateInput,
  type RecordProgressInput,
  type MemoryQueryInput,
} from "./schemas.js";
export {
  ZentextError,
  ZentextInputError,
  ZentextUnsafeInputError,
  ZentextSecretError,
  type ZentextErrorCode,
} from "./errors.js";
export {
  RPC_PROTOCOL_VERSION,
  RPC_SCHEMA_VERSION,
  RPC_METHODS,
  type RpcRequest,
  type RpcResponse,
} from "./rpc/protocol.js";
