import { z } from "zod";

import { ALLOWED_STATUSES, RECORD_TYPES } from "./types/records.js";
import type {
  AnyRecord,
  CreateRecordInput,
  RecordType,
  UpdateRecordInput,
} from "./types/records.js";
import type { StructuredHandoff } from "./handoff.js";
import { ZentextInputError } from "./errors.js";

export const ZENTEXT_SCHEMA_VERSION = 1;

const shortText = z.string().min(1).max(512);
const text = z.string().min(1).max(8_000);
const optionalText = z.string().max(8_000).optional();
const stringList = z.array(z.string().min(1).max(2_000)).max(256);

export const ProjectIdSchema = z.string().regex(/^[0-9a-f]{16}$/u);
export const RecordIdSchema = z.string().regex(
  /^rec_(?:task|decision|blocker|handoff|log|validation|policy|custom)_[0-9A-HJKMNP-TV-Z]{26}$/u,
);
export const IsoTimestampSchema = z.string().datetime({ offset: true });

export const RecordRefsSchema = z
  .object({
    files: stringList.optional(),
    commits: stringList.optional(),
    branches: stringList.optional(),
  })
  .strict();

export const RecordProvenanceSchema = z
  .object({
    source_environment: shortText,
    captured_at: IsoTimestampSchema,
    project_id: ProjectIdSchema,
    task_id: RecordIdSchema.optional(),
    task_revision: z.number().int().positive().optional(),
    files_inspected: stringList.optional(),
    commands_executed: stringList.optional(),
    verification: stringList.optional(),
    parent_record_id: RecordIdSchema.optional(),
    parent_handoff_id: RecordIdSchema.optional(),
    secret_override_used: z.boolean().optional(),
  })
  .strict();

const createBase = {
  title: shortText,
  summary: optionalText,
  author: shortText.optional(),
  tags: stringList.optional(),
  refs: RecordRefsSchema.optional(),
  supersedes: z.array(RecordIdSchema).max(64).optional(),
  provenance: RecordProvenanceSchema.optional(),
};

const CreateTaskSchema = z
  .object({
    ...createBase,
    type: z.literal("task"),
    status: z.enum(ALLOWED_STATUSES.task as ["active", "blocked", "done", "canceled"]).optional(),
    goal: text,
    steps: stringList.optional(),
    next: optionalText,
    notes: stringList.optional(),
    related: z.array(RecordIdSchema).max(256).optional(),
  })
  .strict();

const CreateDecisionSchema = z
  .object({
    ...createBase,
    type: z.literal("decision"),
    status: z
      .enum(ALLOWED_STATUSES.decision as ["proposed", "accepted", "superseded", "rejected"])
      .optional(),
    decision: text,
    rationale: optionalText,
    alternatives_considered: stringList.optional(),
  })
  .strict();

const CreateBlockerSchema = z
  .object({
    ...createBase,
    type: z.literal("blocker"),
    status: z.enum(ALLOWED_STATUSES.blocker as ["open", "resolved", "canceled"]).optional(),
    blocker: text,
    severity: z.enum(["high", "medium", "low"]).optional(),
    workaround: optionalText,
    related: z.array(RecordIdSchema).max(256).optional(),
  })
  .strict();

const CreateHandoffSchema = z
  .object({
    ...createBase,
    type: z.literal("handoff"),
    status: z.enum(ALLOWED_STATUSES.handoff as ["latest", "archived", "superseded"]).optional(),
    structured_handoff: z.record(z.string(), z.unknown()).optional(),
    from: shortText,
    to: shortText,
    context: text,
    state: text,
    next: text,
    open_questions: stringList.optional(),
    completed_this_session: stringList.optional(),
  })
  .strict();

const CreateLogSchema = z
  .object({
    ...createBase,
    type: z.literal("log"),
    status: z.enum(ALLOWED_STATUSES.log as ["recorded", "redacted"]).optional(),
    command: optionalText,
    exit_code: z.number().int().optional(),
    summary: text,
    safe_excerpt: z.string().max(8_000).optional(),
    sanitized: z.boolean().optional(),
  })
  .strict();

const CreateValidationSchema = z
  .object({
    ...createBase,
    type: z.literal("validation"),
    status: z.enum(ALLOWED_STATUSES.validation as ["passed", "failed", "inconclusive"]).optional(),
    check: text,
    result: z.enum(["passed", "failed", "inconclusive"]),
    summary: optionalText,
    run_at: IsoTimestampSchema.optional(),
    details_ref: z.string().max(2_000).optional(),
  })
  .strict();

const CreatePolicySchema = z
  .object({
    ...createBase,
    type: z.literal("policy"),
    status: z.enum(ALLOWED_STATUSES.policy as ["active", "inactive", "superseded"]).optional(),
    rule: text,
    scope: z.enum(["project", "team", "workspace"]).optional(),
    enforcement: z.enum(["advisory", "required"]).optional(),
  })
  .strict();

const CreateCustomSchema = z
  .object({
    ...createBase,
    type: z.literal("custom"),
    status: z.enum(ALLOWED_STATUSES.custom as ["active", "archived"]).optional(),
    kind: shortText,
    body: z.record(z.string(), z.unknown()),
  })
  .strict();

export const CreateRecordInputSchema = z.discriminatedUnion("type", [
  CreateTaskSchema,
  CreateDecisionSchema,
  CreateBlockerSchema,
  CreateHandoffSchema,
  CreateLogSchema,
  CreateValidationSchema,
  CreatePolicySchema,
  CreateCustomSchema,
]);

const updateBase = {
  id: RecordIdSchema,
  title: shortText.optional(),
  summary: optionalText,
  tags: stringList.optional(),
  refs: RecordRefsSchema.optional(),
  author: shortText.optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
};

export const UpdateRecordInputSchema = z
  .object({
    ...updateBase,
    status: shortText.optional(),
  })
  .strict();

const patchBase = {
  title: shortText.optional(),
  status: shortText.optional(),
  summary: optionalText,
  tags: stringList.optional(),
  refs: RecordRefsSchema.optional(),
  provenance: RecordProvenanceSchema.optional(),
};

const RecordPatchSchemas: Record<RecordType, z.ZodType> = {
  task: z
    .object({
      ...patchBase,
      goal: text.optional(),
      steps: stringList.optional(),
      next: optionalText,
      notes: stringList.optional(),
      related: z.array(RecordIdSchema).max(256).optional(),
    })
    .strict(),
  decision: z
    .object({
      ...patchBase,
      decision: text.optional(),
      rationale: optionalText,
      alternatives_considered: stringList.optional(),
    })
    .strict(),
  blocker: z
    .object({
      ...patchBase,
      blocker: text.optional(),
      severity: z.enum(["high", "medium", "low"]).optional(),
      workaround: optionalText,
      related: z.array(RecordIdSchema).max(256).optional(),
    })
    .strict(),
  handoff: z
    .object({
      ...patchBase,
      structured_handoff: z.record(z.string(), z.unknown()).optional(),
      from: shortText.optional(),
      to: shortText.optional(),
      context: optionalText,
      state: optionalText,
      next: optionalText,
      open_questions: stringList.optional(),
      completed_this_session: stringList.optional(),
    })
    .strict(),
  log: z
    .object({
      ...patchBase,
      command: optionalText,
      exit_code: z.number().int().optional(),
      safe_excerpt: z.string().max(8_000).optional(),
      sanitized: z.boolean().optional(),
    })
    .strict(),
  validation: z
    .object({
      ...patchBase,
      check: text.optional(),
      result: z.enum(["passed", "failed", "inconclusive"]).optional(),
      run_at: IsoTimestampSchema.optional(),
      details_ref: z.string().max(2_000).optional(),
    })
    .strict(),
  policy: z
    .object({
      ...patchBase,
      rule: text.optional(),
      scope: z.enum(["project", "team", "workspace"]).optional(),
      enforcement: z.enum(["advisory", "required"]).optional(),
    })
    .strict(),
  custom: z
    .object({
      ...patchBase,
      kind: shortText.optional(),
      body: z.record(z.string(), z.unknown()).optional(),
    })
    .strict(),
};

export const StructuredHandoffSchema = z
  .object({
    schema_version: z.literal(1),
    project_id: ProjectIdSchema,
    project_name: shortText,
    previous_agent: shortText,
    active_task: z
      .object({
        id: RecordIdSchema,
        title: shortText,
        revision: z.number().int().positive(),
        status: z.enum(["active", "blocked", "done", "canceled"]),
      })
      .strict(),
    accepted_decisions: stringList,
    completed: stringList,
    stopping_point: text,
    next_action: z.string().max(8_000),
    blockers: stringList,
    references: RecordRefsSchema,
    files_changed: stringList,
    verification: stringList,
    previous_response: optionalText,
    created_at: IsoTimestampSchema,
  })
  .strict();

export const HandoffAcknowledgementSchema = z
  .object({
    acknowledged: z.boolean(),
    current: z.boolean().optional(),
    active_task_title: shortText.optional(),
    task_id: RecordIdSchema,
    task_revision: z.number().int().positive().optional(),
    handoff_revision: z.number().int().positive().optional(),
    live_revision: z.number().int().positive().optional(),
    previous_agent: shortText.optional(),
    completed_summary: z.string().max(16_000).optional(),
    stopping_point: optionalText,
    next_action: z.string().max(8_000).optional(),
    blockers: stringList.optional(),
    reason: optionalText,
  })
  .strict();

export const ExportRequestSchema = z
  .object({
    format: z.enum(["json", "markdown", "prompt"]),
  })
  .strict();

const storedBase = {
  id: RecordIdSchema,
  project: ProjectIdSchema,
  title: shortText,
  summary: optionalText,
  created_at: IsoTimestampSchema,
  updated_at: IsoTimestampSchema,
  revision: z.number().int().positive(),
  author: shortText,
  tags: stringList,
  refs: RecordRefsSchema,
  schema_version: z.number().int().positive(),
  supersedes: z.array(RecordIdSchema).max(64).optional(),
  superseded_by: RecordIdSchema.optional(),
  provenance: RecordProvenanceSchema.optional(),
};

export const StoredRecordSchema = z.discriminatedUnion("type", [
  CreateTaskSchema.extend({
    ...storedBase,
    type: z.literal("task"),
    status: z.enum(["active", "blocked", "done", "canceled"]),
  }),
  CreateDecisionSchema.extend({
    ...storedBase,
    type: z.literal("decision"),
    status: z.enum(["proposed", "accepted", "superseded", "rejected"]),
  }),
  CreateBlockerSchema.extend({
    ...storedBase,
    type: z.literal("blocker"),
    status: z.enum(["open", "resolved", "canceled"]),
  }),
  CreateHandoffSchema.extend({
    ...storedBase,
    type: z.literal("handoff"),
    status: z.enum(["latest", "archived", "superseded"]),
  }),
  CreateLogSchema.extend({
    ...storedBase,
    type: z.literal("log"),
    status: z.enum(["recorded", "redacted"]),
  }),
  CreateValidationSchema.extend({
    ...storedBase,
    type: z.literal("validation"),
    status: z.enum(["passed", "failed", "inconclusive"]),
  }),
  CreatePolicySchema.extend({
    ...storedBase,
    type: z.literal("policy"),
    status: z.enum(["active", "inactive", "superseded"]),
  }),
  CreateCustomSchema.extend({
    ...storedBase,
    type: z.literal("custom"),
    status: z.enum(["active", "archived"]),
  }),
]);

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, name: string): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new ZentextInputError(`${name} failed schema validation.`, {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

export function parseCreateRecordInput(value: unknown): CreateRecordInput {
  return parseOrThrow(CreateRecordInputSchema, value, "Record create input") as CreateRecordInput;
}

export function parseUpdateRecordInput(value: unknown): UpdateRecordInput {
  return parseOrThrow(UpdateRecordInputSchema, value, "Record update input");
}

export function parseRecordPatch(
  type: RecordType,
  value: unknown,
): Record<string, unknown> {
  return parseOrThrow(RecordPatchSchemas[type], value, `${type} update`) as Record<
    string,
    unknown
  >;
}

export function parseStructuredHandoff(value: unknown): StructuredHandoff {
  return parseOrThrow(StructuredHandoffSchema, value, "Structured handoff");
}

export function parseStoredRecord(value: unknown): AnyRecord {
  return parseOrThrow(StoredRecordSchema, value, "Stored record") as AnyRecord;
}

export function assertStatusForType(type: RecordType, status: string): void {
  if (!ALLOWED_STATUSES[type].includes(status)) {
    throw new ZentextInputError(
      `Invalid status '${status}' for type '${type}'. Allowed: ${ALLOWED_STATUSES[type].join(", ")}.`,
    );
  }
}

export const RecordTypeSchema = z.enum(RECORD_TYPES as [RecordType, ...RecordType[]]);

export const OpenProjectInputSchema = z
  .object({
    cwd: z.string().min(1).max(4_096),
    project_id: ProjectIdSchema.optional(),
  })
  .strict();

export const TaskUpdateInputSchema = z
  .object({
    task_id: RecordIdSchema.optional(),
    expected_revision: z.number().int().positive(),
    title: shortText.optional(),
    summary: optionalText,
    status: z.enum(["active", "blocked", "done", "canceled"]).optional(),
    notes: stringList.optional(),
    next_action: optionalText,
    source_environment: shortText,
    author: shortText.optional(),
    files_inspected: stringList.optional(),
    commands_executed: stringList.optional(),
    verification: stringList.optional(),
    parent_record_id: RecordIdSchema.optional(),
    parent_handoff_id: RecordIdSchema.optional(),
    allow_secret_override: z.boolean().optional(),
  })
  .strict()
  .refine(
    (input) =>
      input.title !== undefined ||
      input.summary !== undefined ||
      input.status !== undefined ||
      input.notes !== undefined ||
      input.next_action !== undefined,
    { message: "At least one task field must be updated." },
  );

const ProgressDecisionSchema = z
  .object({
    title: shortText,
    decision: text,
    rationale: optionalText,
  })
  .strict();

const ProgressBlockerSchema = z
  .object({
    title: shortText,
    blocker: text,
    severity: z.enum(["high", "medium", "low"]).optional(),
    workaround: optionalText,
  })
  .strict();

const ProgressVerificationSchema = z
  .object({
    check: text,
    result: z.enum(["passed", "failed", "inconclusive"]),
    summary: optionalText,
  })
  .strict();

export const RecordProgressInputSchema = z
  .object({
    task_id: RecordIdSchema.optional(),
    expected_revision: z.number().int().positive(),
    source_environment: shortText,
    author: shortText.optional(),
    completed: stringList.min(1),
    changed_files: stringList,
    blockers: z.array(ProgressBlockerSchema).max(64).optional(),
    verification: z.array(ProgressVerificationSchema).max(128),
    notes: stringList.optional(),
    stopping_point: text,
    next_action: text,
    accepted_decisions: z.array(ProgressDecisionSchema).max(64).optional(),
    files_inspected: stringList.optional(),
    commands_executed: stringList.optional(),
    parent_record_id: RecordIdSchema.optional(),
    parent_handoff_id: RecordIdSchema.optional(),
    allow_secret_override: z.boolean().optional(),
  })
  .strict();

export const MemoryQueryInputSchema = z
  .object({
    query: z.string().max(2_000).default(""),
    type: RecordTypeSchema.optional(),
    status: shortText.optional(),
    limit: z.number().int().positive().max(500).default(50),
  })
  .strict()
  .superRefine((input, context) => {
    if (!input.status) return;
    if (input.type) {
      if (!ALLOWED_STATUSES[input.type].includes(input.status)) {
        context.addIssue({
          code: "custom",
          path: ["status"],
          message: `Status '${input.status}' is not valid for type '${input.type}'.`,
        });
      }
      return;
    }
    if (!Object.values(ALLOWED_STATUSES).some((values) => values.includes(input.status!))) {
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: `Unknown record status '${input.status}'.`,
      });
    }
  });

export type OpenProjectInput = z.infer<typeof OpenProjectInputSchema>;
export type TaskUpdateInput = z.infer<typeof TaskUpdateInputSchema>;
export type RecordProgressInput = z.infer<typeof RecordProgressInputSchema>;
export type MemoryQueryInput = z.infer<typeof MemoryQueryInputSchema>;
