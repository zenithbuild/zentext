export type ZentextErrorCode =
  | "INVALID_INPUT"
  | "UNSAFE_INPUT"
  | "SECRET_DETECTED"
  | "PROJECT_NOT_FOUND"
  | "PROJECT_IDENTITY_MISMATCH"
  | "RECORD_NOT_FOUND"
  | "NO_ACTIVE_TASK"
  | "NO_HANDOFF"
  | "STALE_STATE"
  | "REVISION_CONFLICT"
  | "INVALID_STATE"
  | "PAYLOAD_TOO_LARGE"
  | "METHOD_NOT_FOUND"
  | "INTERNAL_ERROR";

export class ZentextError extends Error {
  constructor(
    public readonly code: ZentextErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ZentextError";
  }
}

export class ZentextInputError extends ZentextError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("INVALID_INPUT", message, details);
    this.name = "ZentextInputError";
  }
}

export class ZentextUnsafeInputError extends ZentextError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("UNSAFE_INPUT", message, details);
    this.name = "ZentextUnsafeInputError";
  }
}

export class ZentextSecretError extends ZentextError {
  constructor(
    public readonly findings: readonly string[],
  ) {
    super(
      "SECRET_DETECTED",
      "Likely secret-bearing input was rejected. Remove or redact the sensitive value before retrying.",
      { finding_types: [...findings] },
    );
    this.name = "ZentextSecretError";
  }
}
