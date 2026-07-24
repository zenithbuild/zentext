import { z } from "zod";

import {
  MemoryQueryInputSchema,
  OpenProjectInputSchema,
  ProjectIdSchema,
  RecordIdSchema,
  RecordProgressInputSchema,
  TaskUpdateInputSchema,
} from "../schemas.js";
import type { ZentextErrorCode } from "../errors.js";
import { MemorySearchInputSchema } from "../memory-search.js";

export const RPC_PROTOCOL_VERSION = "1.0";
export const RPC_SCHEMA_VERSION = 1;

export const RPC_METHODS = [
  "capabilities.get",
  "project.open",
  "continuation.get",
  "task.active",
  "handoff.validate",
  "progress.record",
  "task.update",
  "memory.query",
  "memory.search",
] as const;

export type RpcMethod = (typeof RPC_METHODS)[number];
export type RpcId = string | number | null;

export interface RpcSuccess {
  protocol_version: typeof RPC_PROTOCOL_VERSION;
  schema_version: typeof RPC_SCHEMA_VERSION;
  id: RpcId;
  ok: true;
  result: unknown;
}

export interface RpcFailure {
  protocol_version: typeof RPC_PROTOCOL_VERSION;
  schema_version: typeof RPC_SCHEMA_VERSION;
  id: RpcId;
  ok: false;
  error: {
    code: ZentextErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type RpcResponse = RpcSuccess | RpcFailure;

export const RpcRequestSchema = z
  .object({
    protocol_version: z.literal(RPC_PROTOCOL_VERSION),
    id: z.union([z.string().min(1).max(256), z.number().int()]),
    method: z.enum(RPC_METHODS),
    params: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export const ProjectParamsSchema = OpenProjectInputSchema.extend({
  project_id: ProjectIdSchema,
});

export const HandoffValidateParamsSchema = ProjectParamsSchema.extend({
  handoff_id: RecordIdSchema.optional(),
});

export const ProgressRecordParamsSchema = ProjectParamsSchema.extend({
  input: RecordProgressInputSchema,
});

export const TaskUpdateParamsSchema = ProjectParamsSchema.extend({
  input: TaskUpdateInputSchema,
});

export const MemoryQueryParamsSchema = ProjectParamsSchema.extend({
  input: MemoryQueryInputSchema,
});

export const MemorySearchParamsSchema = ProjectParamsSchema.extend({
  input: MemorySearchInputSchema,
});

export type RpcRequest = z.infer<typeof RpcRequestSchema>;
