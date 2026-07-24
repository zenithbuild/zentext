import { z } from "zod";

import { RecordIdSchema, RecordTypeSchema } from "./schemas.js";
import {
  ALLOWED_STATUSES,
  type AnyRecord,
  type RecordProvenance,
  type RecordRefs,
  type RecordType,
} from "./types/records.js";

export const MEMORY_SEARCH_SCHEMA_VERSION = 2;
export const MEMORY_SEARCH_STRATEGY =
  "lexical-relevance-freshness-v2" as const;
export const MEMORY_SEARCH_MAX_QUERY_LENGTH = 512;
export const MEMORY_SEARCH_DEFAULT_LIMIT = 20;
export const MEMORY_SEARCH_MAX_LIMIT = 100;
export const MEMORY_SEARCH_MAX_OFFSET = 10_000;
export const MEMORY_SEARCH_EXCERPT_LENGTH = 240;
export const MEMORY_SEARCH_FRESHNESS_MODES = [
  "prefer-current",
  "current-only",
  "historical-only",
] as const;
export const MEMORY_SEARCH_RANKING_TUPLE = [
  "freshness",
  "active_task_relationship",
  "match_quality",
  "verification_confidence",
  "direct_file_match",
  "record_type_priority",
  "task_revision",
  "record_revision",
  "updated_at_epoch_ms",
] as const;

const allStatuses = new Set(Object.values(ALLOWED_STATUSES).flat());

export const MemorySearchInputSchema = z
  .object({
    query: z
      .string()
      .max(MEMORY_SEARCH_MAX_QUERY_LENGTH)
      .refine((value) => value.trim().length > 0, "Search query must not be empty."),
    record_types: z.array(RecordTypeSchema).max(8).optional(),
    statuses: z.array(z.string().min(1).max(64)).max(32).optional(),
    task_id: RecordIdSchema.optional(),
    min_revision: z.number().int().positive().optional(),
    max_revision: z.number().int().positive().optional(),
    include_superseded: z.boolean().default(false),
    freshness_mode: z
      .enum(MEMORY_SEARCH_FRESHNESS_MODES)
      .default("prefer-current"),
    limit: z
      .number()
      .int()
      .positive()
      .max(MEMORY_SEARCH_MAX_LIMIT)
      .default(MEMORY_SEARCH_DEFAULT_LIMIT),
    offset: z.number().int().nonnegative().max(MEMORY_SEARCH_MAX_OFFSET).default(0),
  })
  .strict()
  .superRefine((input, context) => {
    for (const [field, values] of [
      ["record_types", input.record_types],
      ["statuses", input.statuses],
    ] as const) {
      if (values && new Set(values).size !== values.length) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: `${field} must not contain duplicate values.`,
        });
      }
    }
    if (
      input.min_revision !== undefined &&
      input.max_revision !== undefined &&
      input.min_revision > input.max_revision
    ) {
      context.addIssue({
        code: "custom",
        path: ["min_revision"],
        message: "min_revision must be less than or equal to max_revision.",
      });
    }

    const selectedTypes = input.record_types ?? [];
    for (const [index, status] of (input.statuses ?? []).entries()) {
      const known = selectedTypes.length
        ? selectedTypes.some((type) => ALLOWED_STATUSES[type].includes(status))
        : allStatuses.has(status);
      if (!known) {
        context.addIssue({
          code: "custom",
          path: ["statuses", index],
          message:
            selectedTypes.length > 0
              ? `Status '${status}' is not valid for the selected record types.`
              : `Unknown record status '${status}'.`,
        });
      }
    }
  });

export type MemorySearchInput = z.input<typeof MemorySearchInputSchema>;
export type ParsedMemorySearchInput = z.output<typeof MemorySearchInputSchema>;
export type MemorySearchMatchKind = "exact" | "phrase" | "tokens";
export type MemorySearchFreshness =
  | "current"
  | "unknown"
  | "historical"
  | "stale"
  | "superseded";
export type MemorySearchVerificationConfidence =
  | "passed"
  | "supported"
  | "inconclusive"
  | "failed"
  | "none";

export interface MemorySearchMatch {
  kind: MemorySearchMatchKind;
  fields: string[];
  terms: string[];
  excerpt: {
    field: string;
    text: string;
  };
}

export interface MemorySearchResult {
  id: string;
  project: string;
  type: RecordType;
  status: string;
  title: string;
  summary?: string;
  created_at: string;
  updated_at: string;
  revision: number;
  schema_version: number;
  refs: RecordRefs;
  provenance?: RecordProvenance;
  superseded_by?: string;
  match: MemorySearchMatch;
  ranking: {
    tuple: [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    freshness: MemorySearchFreshness;
    freshness_reason: string;
    active_task_relationship: boolean;
    match_quality: MemorySearchMatchKind;
    verification_confidence: MemorySearchVerificationConfidence;
    direct_file_match: boolean;
    record_type_priority: number;
    task_revision: number | null;
    updated_at_valid: boolean;
    reasons: string[];
  };
}

export interface MemorySearchPage {
  schema_version: typeof MEMORY_SEARCH_SCHEMA_VERSION;
  strategy: typeof MEMORY_SEARCH_STRATEGY;
  project_id: string;
  query: {
    text: string;
    normalized: string;
    terms: string[];
  };
  filters: {
    record_types: RecordType[];
    statuses: string[];
    task_id?: string;
    min_revision?: number;
    max_revision?: number;
    include_superseded: boolean;
    freshness_mode: (typeof MEMORY_SEARCH_FRESHNESS_MODES)[number];
  };
  ranking: {
    tuple_order: typeof MEMORY_SEARCH_RANKING_TUPLE;
    active_task_id: string | null;
  };
  page: {
    offset: number;
    limit: number;
    returned: number;
    total: number;
    has_more: boolean;
  };
  results: MemorySearchResult[];
}

interface SearchField {
  field: string;
  text: string;
  normalized: string;
}

function normalizeText(value: string): string {
  return value.normalize("NFKC").toLowerCase().trim().replace(/\s+/gu, " ");
}

function addStrings(
  fields: SearchField[],
  field: string,
  value: unknown,
  depth = 0,
): void {
  if (depth > 6 || value === undefined || value === null) return;
  if (typeof value === "string") {
    const normalized = normalizeText(value);
    if (normalized) fields.push({ field, text: value, normalized });
    return;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    const text = String(value);
    fields.push({ field, text, normalized: normalizeText(text) });
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) addStrings(fields, field, entry, depth + 1);
    return;
  }
  if (typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      addStrings(fields, `${field}.${key}`, entry, depth + 1);
    }
  }
}

function searchableFields(record: AnyRecord): SearchField[] {
  const fields: SearchField[] = [];
  addStrings(fields, "id", record.id);
  addStrings(fields, "title", record.title);
  addStrings(fields, "summary", record.summary);
  addStrings(fields, "tags", record.tags);
  addStrings(fields, "refs.files", record.refs.files);
  addStrings(fields, "refs.commits", record.refs.commits);
  addStrings(fields, "refs.branches", record.refs.branches);
  addStrings(fields, "provenance.files_inspected", record.provenance?.files_inspected);
  addStrings(fields, "provenance.verification", record.provenance?.verification);

  switch (record.type) {
    case "task":
      addStrings(fields, "task.goal", record.goal);
      addStrings(fields, "task.steps", record.steps);
      addStrings(fields, "task.next", record.next);
      addStrings(fields, "task.notes", record.notes);
      addStrings(fields, "task.related", record.related);
      break;
    case "decision":
      addStrings(fields, "decision.decision", record.decision);
      addStrings(fields, "decision.rationale", record.rationale);
      addStrings(
        fields,
        "decision.alternatives_considered",
        record.alternatives_considered,
      );
      break;
    case "blocker":
      addStrings(fields, "blocker.blocker", record.blocker);
      addStrings(fields, "blocker.workaround", record.workaround);
      addStrings(fields, "blocker.related", record.related);
      break;
    case "handoff":
      addStrings(fields, "handoff.from", record.from);
      addStrings(fields, "handoff.to", record.to);
      addStrings(fields, "handoff.context", record.context);
      addStrings(fields, "handoff.state", record.state);
      addStrings(fields, "handoff.next", record.next);
      addStrings(fields, "handoff.open_questions", record.open_questions);
      addStrings(
        fields,
        "handoff.completed_this_session",
        record.completed_this_session,
      );
      addStrings(fields, "handoff.structured", record.structured_handoff);
      break;
    case "log":
      addStrings(fields, "log.command", record.command);
      addStrings(fields, "log.summary", record.summary);
      addStrings(fields, "log.safe_excerpt", record.safe_excerpt);
      break;
    case "validation":
      addStrings(fields, "validation.check", record.check);
      addStrings(fields, "validation.summary", record.summary);
      addStrings(fields, "validation.details_ref", record.details_ref);
      break;
    case "policy":
      addStrings(fields, "policy.rule", record.rule);
      break;
    case "custom":
      addStrings(fields, "custom.kind", record.kind);
      addStrings(fields, "custom.body", record.body);
      break;
  }
  return fields;
}

function belongsToTask(record: AnyRecord, taskId: string): boolean {
  if (record.type === "task" && record.id === taskId) return true;
  if (record.provenance?.task_id === taskId) return true;
  if (record.type !== "handoff") return false;
  const structured = record.structured_handoff;
  if (!structured || typeof structured !== "object") return false;
  const activeTask = (structured as Record<string, unknown>).active_task;
  return (
    typeof activeTask === "object" &&
    activeTask !== null &&
    (activeTask as Record<string, unknown>).id === taskId
  );
}

function excerpt(field: SearchField, normalizedQuery: string, terms: string[]): string {
  const normalized = field.normalized;
  let index = normalized.indexOf(normalizedQuery);
  if (index < 0) {
    index = terms
      .map((term) => normalized.indexOf(term))
      .find((candidate) => candidate >= 0) ?? 0;
  }
  const radius = Math.floor(MEMORY_SEARCH_EXCERPT_LENGTH / 2);
  const start = Math.max(0, index - radius);
  const end = Math.min(field.text.length, start + MEMORY_SEARCH_EXCERPT_LENGTH);
  return `${start > 0 ? "…" : ""}${field.text.slice(start, end)}${
    end < field.text.length ? "…" : ""
  }`;
}

function matchRecord(
  record: AnyRecord,
  normalizedQuery: string,
  terms: string[],
): MemorySearchMatch | null {
  const fields = searchableFields(record);
  const exact = fields.find((field) => field.normalized === normalizedQuery);
  const phrase = fields.find((field) => field.normalized.includes(normalizedQuery));
  const matching = fields.filter((field) =>
    terms.some((term) => field.normalized.includes(term)),
  );
  const allTermsMatch = terms.every((term) =>
    fields.some((field) => field.normalized.includes(term)),
  );
  if (!exact && !phrase && !allTermsMatch) return null;

  const source = exact ?? phrase ?? matching[0]!;
  const matchingFields = [
    ...new Set(
      (exact || phrase ? fields : matching)
        .filter((field) =>
          exact || phrase
            ? field.normalized.includes(normalizedQuery)
            : terms.some((term) => field.normalized.includes(term)),
        )
        .map((field) => field.field),
    ),
  ];

  return {
    kind: exact ? "exact" : phrase ? "phrase" : "tokens",
    fields: matchingFields,
    terms,
    excerpt: {
      field: source.field,
      text: excerpt(source, normalizedQuery, terms),
    },
  };
}

function sortByCanonicalRecency(a: AnyRecord, b: AnyRecord): number {
  if (a.updated_at > b.updated_at) return -1;
  if (a.updated_at < b.updated_at) return 1;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

interface TaskReference {
  id: string;
  revision: number;
}

interface SearchContext {
  recordsById: Map<string, AnyRecord>;
  activeTaskId: string | null;
  currentHandoffId: string | null;
}

function handoffTaskReference(record: AnyRecord): TaskReference | null {
  if (record.type !== "handoff") return null;
  const structured = record.structured_handoff;
  if (!structured || typeof structured !== "object") return null;
  const activeTask = (structured as Record<string, unknown>).active_task;
  if (!activeTask || typeof activeTask !== "object") return null;
  const id = (activeTask as Record<string, unknown>).id;
  const revision = (activeTask as Record<string, unknown>).revision;
  return typeof id === "string" &&
    typeof revision === "number" &&
    Number.isSafeInteger(revision) &&
    revision > 0
    ? { id, revision }
    : null;
}

function resolveSearchContext(records: AnyRecord[]): SearchContext {
  const recordsById = new Map(records.map((record) => [record.id, record]));
  const selectedHandoff = records
    .filter(
      (record) =>
        record.type === "handoff" &&
        record.status === "latest" &&
        !record.superseded_by,
    )
    .sort(sortByCanonicalRecency)[0];
  const referencedTask = selectedHandoff
    ? handoffTaskReference(selectedHandoff)
    : null;
  const task = referencedTask ? recordsById.get(referencedTask.id) : undefined;
  const activeTask =
    task?.type === "task" &&
    !task.superseded_by &&
    ["active", "blocked"].includes(task.status)
      ? task
      : records
          .filter(
            (record) =>
              record.type === "task" &&
              !record.superseded_by &&
              ["active", "blocked"].includes(record.status),
          )
          .sort(sortByCanonicalRecency)[0];

  return {
    recordsById,
    activeTaskId: activeTask?.id ?? null,
    currentHandoffId: selectedHandoff?.id ?? null,
  };
}

function recordTaskRevision(record: AnyRecord): number | null {
  if (record.type === "task") return record.revision;
  const handoffReference = handoffTaskReference(record);
  if (handoffReference) return handoffReference.revision;
  return record.provenance?.task_revision ?? null;
}

function classifyFreshness(
  record: AnyRecord,
  context: SearchContext,
): { freshness: MemorySearchFreshness; reason: string } {
  if (record.superseded_by) {
    return { freshness: "superseded", reason: "superseded-by-record" };
  }
  if (record.status === "superseded") {
    return { freshness: "superseded", reason: "status:superseded" };
  }

  switch (record.type) {
    case "task":
      return ["active", "blocked"].includes(record.status)
        ? { freshness: "current", reason: `task-status:${record.status}` }
        : { freshness: "historical", reason: `task-status:${record.status}` };
    case "decision":
      return ["accepted", "proposed"].includes(record.status)
        ? { freshness: "current", reason: `decision-status:${record.status}` }
        : { freshness: "historical", reason: `decision-status:${record.status}` };
    case "blocker":
      return record.status === "open"
        ? { freshness: "current", reason: "blocker-status:open" }
        : { freshness: "historical", reason: `blocker-status:${record.status}` };
    case "handoff": {
      if (
        record.id !== context.currentHandoffId ||
        record.status !== "latest"
      ) {
        return {
          freshness: "historical",
          reason:
            record.status === "latest"
              ? "handoff:not-selected-latest"
              : `handoff-status:${record.status}`,
        };
      }
      const reference = handoffTaskReference(record);
      if (!reference) {
        return { freshness: "unknown", reason: "handoff:missing-task-revision" };
      }
      const task = context.recordsById.get(reference.id);
      if (!task || task.type !== "task") {
        return { freshness: "unknown", reason: "handoff:missing-task" };
      }
      if (reference.revision !== task.revision) {
        return { freshness: "stale", reason: "handoff:task-revision-mismatch" };
      }
      if (
        task.superseded_by ||
        !["active", "blocked"].includes(task.status)
      ) {
        return { freshness: "historical", reason: "handoff:task-not-actionable" };
      }
      return { freshness: "current", reason: "handoff:task-revision-current" };
    }
    case "validation": {
      const taskId = record.provenance?.task_id;
      const taskRevision = record.provenance?.task_revision;
      if (!taskId || taskRevision === undefined) {
        return { freshness: "unknown", reason: "validation:no-task-revision" };
      }
      const task = context.recordsById.get(taskId);
      if (!task || task.type !== "task") {
        return { freshness: "unknown", reason: "validation:missing-task" };
      }
      if (taskRevision === task.revision) {
        return { freshness: "current", reason: "validation:task-revision-current" };
      }
      if (taskRevision < task.revision) {
        return {
          freshness: "historical",
          reason: "validation:older-task-revision",
        };
      }
      return { freshness: "unknown", reason: "validation:future-task-revision" };
    }
    case "log":
      return { freshness: "historical", reason: "log:event-record" };
    case "policy":
      return record.status === "active"
        ? { freshness: "current", reason: "policy-status:active" }
        : { freshness: "historical", reason: `policy-status:${record.status}` };
    case "custom":
      return record.status === "active"
        ? { freshness: "current", reason: "custom-status:active" }
        : { freshness: "historical", reason: `custom-status:${record.status}` };
  }
}

const freshnessPriority: Record<MemorySearchFreshness, number> = {
  current: 4,
  unknown: 3,
  historical: 2,
  stale: 1,
  superseded: 0,
};

const matchPriority: Record<MemorySearchMatchKind, number> = {
  exact: 3,
  phrase: 2,
  tokens: 1,
};

const typePriority: Record<RecordType, number> = {
  task: 8,
  handoff: 7,
  decision: 6,
  blocker: 5,
  validation: 4,
  policy: 3,
  log: 2,
  custom: 1,
};

function verificationConfidence(record: AnyRecord): {
  confidence: MemorySearchVerificationConfidence;
  priority: number;
} {
  if (record.type === "validation") {
    if (record.result === "passed") {
      return { confidence: "passed", priority: 3 };
    }
    if (record.result === "inconclusive") {
      return { confidence: "inconclusive", priority: 2 };
    }
    return { confidence: "failed", priority: 1 };
  }
  if ((record.provenance?.verification?.length ?? 0) > 0) {
    return { confidence: "supported", priority: 2 };
  }
  return { confidence: "none", priority: 0 };
}

const canonicalTimestamp =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

function timestampRank(value: string): { rank: number; valid: boolean } {
  if (!canonicalTimestamp.test(value)) return { rank: 0, valid: false };
  const rank = Date.parse(value);
  return Number.isFinite(rank) && new Date(rank).toISOString() === value
    ? { rank, valid: true }
    : { rank: 0, valid: false };
}

function buildRanking(
  record: AnyRecord,
  match: MemorySearchMatch,
  context: SearchContext,
): MemorySearchResult["ranking"] {
  const freshness = classifyFreshness(record, context);
  const activeTaskRelationship =
    context.activeTaskId !== null &&
    belongsToTask(record, context.activeTaskId);
  const verification = verificationConfidence(record);
  const directFileMatch = match.fields.some(
    (field) =>
      field === "refs.files" ||
      field === "provenance.files_inspected",
  );
  const taskRevision = recordTaskRevision(record);
  const updatedAt = timestampRank(record.updated_at);
  const tuple: MemorySearchResult["ranking"]["tuple"] = [
    freshnessPriority[freshness.freshness],
    activeTaskRelationship ? 1 : 0,
    matchPriority[match.kind],
    verification.priority,
    directFileMatch ? 1 : 0,
    typePriority[record.type],
    taskRevision ?? 0,
    record.revision,
    updatedAt.rank,
  ];

  return {
    tuple,
    freshness: freshness.freshness,
    freshness_reason: freshness.reason,
    active_task_relationship: activeTaskRelationship,
    match_quality: match.kind,
    verification_confidence: verification.confidence,
    direct_file_match: directFileMatch,
    record_type_priority: typePriority[record.type],
    task_revision: taskRevision,
    updated_at_valid: updatedAt.valid,
    reasons: [
      `freshness:${freshness.freshness}`,
      freshness.reason,
      activeTaskRelationship ? "active-task:related" : "active-task:unrelated",
      `match:${match.kind}`,
      `verification:${verification.confidence}`,
      directFileMatch ? "file:direct-match" : "file:no-direct-match",
      `record-type:${record.type}`,
    ],
  };
}

function freshnessAllowed(
  freshness: MemorySearchFreshness,
  mode: ParsedMemorySearchInput["freshness_mode"],
): boolean {
  if (mode === "current-only") return freshness === "current";
  if (mode === "historical-only") {
    return ["historical", "stale", "superseded"].includes(freshness);
  }
  return true;
}

function compareRanked(
  a: { record: AnyRecord; ranking: MemorySearchResult["ranking"] },
  b: { record: AnyRecord; ranking: MemorySearchResult["ranking"] },
): number {
  for (let index = 0; index < a.ranking.tuple.length; index += 1) {
    const difference = b.ranking.tuple[index]! - a.ranking.tuple[index]!;
    if (difference !== 0) return difference;
  }
  if (a.record.id < b.record.id) return -1;
  if (a.record.id > b.record.id) return 1;
  return 0;
}

export function searchMemoryRecords(
  records: AnyRecord[],
  input: ParsedMemorySearchInput,
  projectId: string,
): MemorySearchPage {
  const normalizedQuery = normalizeText(input.query);
  const terms = [...new Set(normalizedQuery.split(" ").filter(Boolean))];
  const selectedTypes = [...(input.record_types ?? [])].sort();
  const selectedStatuses = [...(input.statuses ?? [])].sort();
  const projectRecords = records.filter((record) => record.project === projectId);
  const context = resolveSearchContext(projectRecords);

  const matched = projectRecords
    .filter(
      (record) =>
        selectedTypes.length === 0 || selectedTypes.includes(record.type),
    )
    .filter(
      (record) =>
        selectedStatuses.length === 0 || selectedStatuses.includes(record.status),
    )
    .filter(
      (record) =>
        input.include_superseded ||
        (!record.superseded_by && record.status !== "superseded"),
    )
    .filter(
      (record) =>
        input.min_revision === undefined || record.revision >= input.min_revision,
    )
    .filter(
      (record) =>
        input.max_revision === undefined || record.revision <= input.max_revision,
    )
    .filter((record) => !input.task_id || belongsToTask(record, input.task_id))
    .map((record) => ({ record, match: matchRecord(record, normalizedQuery, terms) }))
    .filter(
      (
        entry,
      ): entry is { record: AnyRecord; match: MemorySearchMatch } =>
        entry.match !== null,
    )
    .map(({ record, match }) => ({
      record,
      match,
      ranking: buildRanking(record, match, context),
    }))
    .filter(({ ranking }) =>
      freshnessAllowed(ranking.freshness, input.freshness_mode),
    )
    .sort(compareRanked);

  const pageEntries = matched.slice(input.offset, input.offset + input.limit);
  const results = pageEntries.map(({ record, match, ranking }) => ({
    id: record.id,
    project: record.project,
    type: record.type,
    status: record.status,
    title: record.title,
    ...(record.summary !== undefined ? { summary: record.summary } : {}),
    created_at: record.created_at,
    updated_at: record.updated_at,
    revision: record.revision,
    schema_version: record.schema_version,
    refs: record.refs,
    ...(record.provenance ? { provenance: record.provenance } : {}),
    ...(record.superseded_by ? { superseded_by: record.superseded_by } : {}),
    match,
    ranking,
  }));

  return {
    schema_version: MEMORY_SEARCH_SCHEMA_VERSION,
    strategy: MEMORY_SEARCH_STRATEGY,
    project_id: projectId,
    query: {
      text: input.query.trim(),
      normalized: normalizedQuery,
      terms,
    },
    filters: {
      record_types: selectedTypes,
      statuses: selectedStatuses,
      ...(input.task_id ? { task_id: input.task_id } : {}),
      ...(input.min_revision !== undefined
        ? { min_revision: input.min_revision }
        : {}),
      ...(input.max_revision !== undefined
        ? { max_revision: input.max_revision }
        : {}),
      include_superseded: input.include_superseded,
      freshness_mode: input.freshness_mode,
    },
    ranking: {
      tuple_order: MEMORY_SEARCH_RANKING_TUPLE,
      active_task_id: context.activeTaskId,
    },
    page: {
      offset: input.offset,
      limit: input.limit,
      returned: results.length,
      total: matched.length,
      has_more: input.offset + results.length < matched.length,
    },
    results,
  };
}

export function renderMemorySearch(page: MemorySearchPage): string {
  const lines = [
    `Search: ${page.query.text}`,
    `Project: ${page.project_id}`,
    `Strategy: ${page.strategy}`,
    `Results: ${page.page.returned} of ${page.page.total}`,
  ];
  for (const result of page.results) {
    lines.push(
      "",
      `${result.type} ${result.id}`,
      `  ${result.title}`,
      `  Status: ${result.status} · revision ${result.revision}`,
      `  Freshness: ${result.ranking.freshness} (${result.ranking.freshness_reason})`,
      `  Match: ${result.match.kind} in ${result.match.fields.join(", ")}`,
      `  Why: ${result.ranking.reasons.join(", ")}`,
      `  ${result.match.excerpt.text}`,
    );
  }
  if (page.results.length === 0) lines.push("", "No matching project memory.");
  if (page.page.has_more) {
    lines.push("", `More results: rerun with --offset ${page.page.offset + page.page.returned}`);
  }
  return lines.join("\n");
}
