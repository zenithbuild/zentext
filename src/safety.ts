import { isAbsolute, normalize, sep } from "node:path";

import {
  ZentextError,
  ZentextSecretError,
  ZentextUnsafeInputError,
} from "./errors.js";

export const MAX_RECORD_INPUT_BYTES = 32_000;
export const MAX_LOG_EXCERPT_LENGTH = 8_000;
export const MAX_RPC_LINE_BYTES = 1_048_576;

const CONTROL_CHARACTER = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u;
const TERMINAL_ESCAPE = /\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\)?)/u;
const UNPAIRED_SURROGATE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;

interface SecretPattern {
  name: string;
  pattern: RegExp;
}

const SECRET_PATTERNS: readonly SecretPattern[] = [
  { name: "private-key", pattern: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/iu },
  { name: "github-token", pattern: /\b(?:gh[opusr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/u },
  { name: "aws-access-key", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u },
  { name: "openai-key", pattern: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b/u },
  {
    name: "credential-assignment",
    pattern:
      /(?:^|[\s;])(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password|passwd|secret)\s*[:=]\s*["']?[^\s"',;]{8,}/iu,
  },
  {
    name: "connection-string",
    pattern: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^/\s:@]+:[^@\s/]+@/iu,
  },
  {
    name: "environment-secret",
    pattern: /(?:^|\n)\s*[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY)[A-Z0-9_]*\s*=\s*\S+/u,
  },
];

const PATH_KEYS = new Set([
  "files",
  "files_changed",
  "files_inspected",
  "details_ref",
]);

function byteLength(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    throw new ZentextUnsafeInputError("Input must be JSON-serializable.");
  }
}

function assertSafeString(value: string, path: string): void {
  if (UNPAIRED_SURROGATE.test(value) || value.includes("\uFFFD")) {
    throw new ZentextUnsafeInputError(`Malformed Unicode is not allowed at ${path}.`);
  }
  if (CONTROL_CHARACTER.test(value)) {
    throw new ZentextUnsafeInputError(`Control characters are not allowed at ${path}.`);
  }
  if (TERMINAL_ESCAPE.test(value) || value.includes("\u001B")) {
    throw new ZentextUnsafeInputError(`Terminal escape sequences are not allowed at ${path}.`);
  }
}

function assertSafePath(value: string, path: string): void {
  assertSafeString(value, path);
  if (isAbsolute(value) || /^[A-Za-z]:[\\/]/u.test(value)) {
    throw new ZentextUnsafeInputError(`Absolute file paths are not portable at ${path}.`);
  }
  const normalized = normalize(value);
  if (
    normalized === ".." ||
    normalized.startsWith(`..${sep}`) ||
    normalized.split(/[\\/]/u).includes("..")
  ) {
    throw new ZentextUnsafeInputError(`Path traversal is not allowed at ${path}.`);
  }
}

function visitInput(value: unknown, path: string, parentKey?: string): void {
  if (typeof value === "string") {
    if (parentKey && PATH_KEYS.has(parentKey)) {
      assertSafePath(value, path);
    } else {
      assertSafeString(value, path);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => visitInput(entry, `${path}[${index}]`, parentKey));
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, entry] of Object.entries(value)) {
      visitInput(entry, `${path}.${key}`, key);
    }
  }
}

function visitSecrets(value: unknown, path: string, findings: Set<string>): void {
  if (typeof value === "string") {
    for (const candidate of SECRET_PATTERNS) {
      if (candidate.pattern.test(value)) {
        findings.add(`${candidate.name} at ${path}`);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => visitSecrets(entry, `${path}[${index}]`, findings));
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, entry] of Object.entries(value)) {
      visitSecrets(entry, `${path}.${key}`, findings);
    }
  }
}

export function detectSecrets(value: unknown): string[] {
  const findings = new Set<string>();
  visitSecrets(value, "$", findings);
  return [...findings].sort();
}

export function assertSafeExternalInput(
  value: unknown,
  options: { allowSecretOverride?: boolean; maxBytes?: number } = {},
): { secretOverrideUsed: boolean } {
  const maxBytes = options.maxBytes ?? MAX_RECORD_INPUT_BYTES;
  const bytes = byteLength(value);
  if (bytes > maxBytes) {
    throw new ZentextError(
      "PAYLOAD_TOO_LARGE",
      `Input is ${bytes} bytes; the limit is ${maxBytes} bytes.`,
      { actual_bytes: bytes, maximum_bytes: maxBytes },
    );
  }
  visitInput(value, "$");
  const findings = detectSecrets(value);
  if (findings.length > 0 && options.allowSecretOverride !== true) {
    throw new ZentextSecretError(findings);
  }
  return { secretOverrideUsed: findings.length > 0 };
}

function redactString(value: string): string {
  let redacted = value;
  for (const candidate of SECRET_PATTERNS) {
    redacted = redacted.replace(new RegExp(candidate.pattern.source, candidate.pattern.flags + (candidate.pattern.global ? "" : "g")), "[REDACTED]");
  }
  return redacted
    .replace(/\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\)?)/gu, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/gu, "")
    .replace(/\u001B/gu, "");
}

export function redactForOutput<T>(value: T): T {
  if (typeof value === "string") {
    return redactString(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactForOutput(entry)) as T;
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, redactForOutput(entry)]),
    ) as T;
  }
  return value;
}
