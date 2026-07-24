import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import { ZodError } from "zod";

import { ZentextError } from "../errors.js";
import { openProject } from "../sdk.js";
import { OpenProjectInputSchema } from "../schemas.js";
import { MAX_RPC_LINE_BYTES, redactForOutput } from "../safety.js";
import { MEMORY_INTERFACE_VERSION } from "../memory-interface.js";
import {
  HandoffValidateParamsSchema,
  MemoryQueryParamsSchema,
  MemorySearchParamsSchema,
  ProgressRecordParamsSchema,
  ProjectParamsSchema,
  RPC_METHODS,
  RPC_PROTOCOL_VERSION,
  RPC_SCHEMA_VERSION,
  RpcRequestSchema,
  TaskUpdateParamsSchema,
  type RpcId,
  type RpcRequest,
  type RpcResponse,
} from "./protocol.js";

export interface RpcCapabilities {
  protocol_version: typeof RPC_PROTOCOL_VERSION;
  schema_version: typeof RPC_SCHEMA_VERSION;
  memory_interface_version: typeof MEMORY_INTERFACE_VERSION;
  framing: "ndjson";
  methods: readonly string[];
  limits: {
    maximum_request_bytes: number;
  };
  safety: {
    stdout_machine_clean: true;
    diagnostics_stream: "stderr";
    secret_output_redaction: true;
    revision_checks: true;
  };
}

export function getRpcCapabilities(): RpcCapabilities {
  return {
    protocol_version: RPC_PROTOCOL_VERSION,
    schema_version: RPC_SCHEMA_VERSION,
    memory_interface_version: MEMORY_INTERFACE_VERSION,
    framing: "ndjson",
    methods: RPC_METHODS,
    limits: { maximum_request_bytes: MAX_RPC_LINE_BYTES },
    safety: {
      stdout_machine_clean: true,
      diagnostics_stream: "stderr",
      secret_output_redaction: true,
      revision_checks: true,
    },
  };
}

function failure(
  id: RpcId,
  code: RpcFailureCode,
  message: string,
  details?: Record<string, unknown>,
): RpcResponse {
  const safeId = redactForOutput(id);
  return {
    protocol_version: RPC_PROTOCOL_VERSION,
    schema_version: RPC_SCHEMA_VERSION,
    id: safeId,
    ok: false,
    error: {
      code,
      message: redactForOutput(message),
      ...(details ? { details: redactForOutput(details) } : {}),
    },
  };
}

type RpcFailureCode =
  | ZentextError["code"]
  | "INVALID_INPUT"
  | "PAYLOAD_TOO_LARGE"
  | "INTERNAL_ERROR";

async function withOpenedProject<T>(
  params: unknown,
  operation: (project: Awaited<ReturnType<typeof openProject>>) => Promise<T>,
): Promise<T> {
  const candidate =
    typeof params === "object" && params !== null
      ? (params as Record<string, unknown>)
      : {};
  const parsed = ProjectParamsSchema.parse({
    cwd: candidate.cwd,
    project_id: candidate.project_id,
  });
  const project = await openProject(parsed);
  try {
    return await operation(project);
  } finally {
    project.close();
  }
}

export async function executeRpcRequest(request: RpcRequest): Promise<unknown> {
  switch (request.method) {
    case "capabilities.get":
      return getRpcCapabilities();
    case "project.open": {
      const parsed = OpenProjectInputSchema.parse(request.params);
      const project = await openProject(parsed);
      try {
        return {
          project_id: project.meta.projectId,
          project_name: project.meta.projectName,
          store_schema_version: project.meta.schemaVersion,
          capabilities: getRpcCapabilities(),
        };
      } finally {
        project.close();
      }
    }
    case "continuation.get":
      return withOpenedProject(request.params, (project) => project.getContinuation());
    case "task.active":
      return withOpenedProject(request.params, (project) => project.getActiveTask());
    case "handoff.validate": {
      const parsed = HandoffValidateParamsSchema.parse(request.params);
      return withOpenedProject(parsed, (project) =>
        project.validateHandoff(parsed.handoff_id),
      );
    }
    case "progress.record": {
      const parsed = ProgressRecordParamsSchema.parse(request.params);
      return withOpenedProject(parsed, (project) =>
        project.recordProgress(parsed.input),
      );
    }
    case "task.update": {
      const parsed = TaskUpdateParamsSchema.parse(request.params);
      return withOpenedProject(parsed, (project) =>
        project.updateTask(parsed.input),
      );
    }
    case "memory.query": {
      const parsed = MemoryQueryParamsSchema.parse(request.params);
      return withOpenedProject(parsed, (project) =>
        project.queryMemory(parsed.input),
      );
    }
    case "memory.search": {
      const parsed = MemorySearchParamsSchema.parse(request.params);
      return withOpenedProject(parsed, (project) =>
        project.searchMemory(parsed.input),
      );
    }
  }
}

export async function handleRpcLine(line: string): Promise<RpcResponse> {
  if (Buffer.byteLength(line, "utf8") > MAX_RPC_LINE_BYTES) {
    return failure(
      null,
      "PAYLOAD_TOO_LARGE",
      `RPC request exceeds the ${MAX_RPC_LINE_BYTES}-byte limit.`,
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return failure(null, "INVALID_INPUT", "RPC input must be one JSON object per line.");
  }
  const id =
    typeof raw === "object" &&
    raw !== null &&
    ("id" in raw) &&
    (typeof raw.id === "string" || typeof raw.id === "number")
      ? raw.id
      : null;
  if (
    typeof raw === "object" &&
    raw !== null &&
    "method" in raw &&
    typeof raw.method === "string" &&
    !RPC_METHODS.includes(raw.method as (typeof RPC_METHODS)[number])
  ) {
    return failure(id, "METHOD_NOT_FOUND", `Unknown RPC method '${raw.method}'.`);
  }
  try {
    const request = RpcRequestSchema.parse(raw);
    const result = await executeRpcRequest(request);
    return redactForOutput({
      protocol_version: RPC_PROTOCOL_VERSION,
      schema_version: RPC_SCHEMA_VERSION,
      id: request.id,
      ok: true,
      result,
    });
  } catch (error) {
    if (error instanceof ZentextError) {
      return failure(id, error.code, error.message, error.details);
    }
    if (error instanceof ZodError) {
      return failure(id, "INVALID_INPUT", "RPC request failed schema validation.", {
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    return failure(id, "INTERNAL_ERROR", "RPC request failed.");
  }
}

export async function runRpcServer(
  input: Readable,
  output: Writable,
  diagnostics: Writable,
): Promise<void> {
  const lines = createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (line.trim() === "") continue;
    const response = await handleRpcLine(line);
    output.write(`${JSON.stringify(response)}\n`);
    if (!response.ok) {
      diagnostics.write(
        `zentext rpc: ${response.error.code} (request ${String(response.id)})\n`,
      );
    }
  }
}
