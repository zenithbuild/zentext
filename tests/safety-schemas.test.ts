import { describe, expect, it } from "vitest";

import {
  assertSafeExternalInput,
  detectSecrets,
  MAX_RECORD_INPUT_BYTES,
  redactForOutput,
} from "../src/safety.js";
import {
  CreateRecordInputSchema,
  RecordProvenanceSchema,
  StructuredHandoffSchema,
  TaskUpdateInputSchema,
} from "../src/schemas.js";
import { validateHandoffQuality } from "../src/handoff-quality.js";
import { ZentextError, ZentextSecretError, ZentextUnsafeInputError } from "../src/errors.js";

describe("formal schemas", () => {
  it("accepts a complete task and rejects unknown fields, invalid enums, and missing requirements", () => {
    expect(
      CreateRecordInputSchema.safeParse({
        type: "task",
        title: "Task",
        goal: "Complete the fixture",
        status: "active",
      }).success,
    ).toBe(true);
    expect(
      CreateRecordInputSchema.safeParse({
        type: "task",
        title: "Task",
        goal: "Complete the fixture",
        status: "resolved",
      }).success,
    ).toBe(false);
    expect(
      CreateRecordInputSchema.safeParse({
        type: "task",
        title: "Task",
        extra: "not canonical",
      }).success,
    ).toBe(false);
  });

  it("validates task revisions and structured handoff timestamps and arrays", () => {
    expect(
      TaskUpdateInputSchema.safeParse({
        expected_revision: 0,
        source_environment: "codex",
        next_action: "Continue",
      }).success,
    ).toBe(false);
    expect(
      StructuredHandoffSchema.safeParse({
        schema_version: 1,
        project_id: "0123456789abcdef",
        project_name: "fixture",
        previous_agent: "tool-a",
        active_task: {
          id: "rec_task_01ARZ3NDEKTSV4RRFFQ69G5FAV",
          title: "Task",
          revision: 1,
          status: "active",
        },
        accepted_decisions: [],
        completed: [],
        stopping_point: "Stopped at the parser boundary.",
        next_action: "Add the parser regression test.",
        blockers: [],
        references: { files: [], commits: [], branches: [] },
        files_changed: [],
        verification: [],
        created_at: "not-a-timestamp",
      }).success,
    ).toBe(false);
  });

  it("rejects incomplete or malformed provenance", () => {
    expect(
      RecordProvenanceSchema.safeParse({
        source_environment: "codex",
        captured_at: "not-a-timestamp",
        project_id: "not-a-project-id",
        task_revision: 0,
      }).success,
    ).toBe(false);
  });
});

describe("I/O sanitization", () => {
  it.each([
    ["control character", { text: "unsafe\u0000value" }],
    ["terminal escape", { text: "\u001b[31mred" }],
    ["malformed Unicode", { text: "\ud800" }],
    ["replacement character from malformed input", { text: "\ufffd" }],
    ["path traversal", { files_changed: ["../secret.txt"] }],
    ["absolute path", { files_inspected: ["/Users/private/file.txt"] }],
  ])("rejects %s", (_name, input) => {
    expect(() => assertSafeExternalInput(input)).toThrow(ZentextUnsafeInputError);
  });

  it("rejects oversized input with a stable typed code", () => {
    try {
      assertSafeExternalInput({ text: "x".repeat(MAX_RECORD_INPUT_BYTES + 1) });
      throw new Error("expected size rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(ZentextError);
      expect((error as ZentextError).code).toBe("PAYLOAD_TOO_LARGE");
    }
  });
});

describe("secret protection", () => {
  it.each([
    ["API key", "api_key=super-secret-value"],
    ["GitHub token", "ghp_abcdefghijklmnopqrstuvwxyz1234567890"],
    ["private key", "-----BEGIN PRIVATE KEY-----"],
    ["password", "password=correct-horse-battery-staple"],
    ["connection string", "postgres://user:password@example.invalid/db"],
    ["environment secret", "SERVICE_TOKEN=abcdefghijklmno"],
  ])("detects %s without returning the sensitive value", (_kind, value) => {
    const findings = detectSecrets(value);
    expect(findings.length).toBeGreaterThan(0);
    expect(JSON.stringify(findings)).not.toContain(value);
    expect(() => assertSafeExternalInput(value)).toThrow(ZentextSecretError);
  });

  it("requires an explicit override and always redacts output", () => {
    const value = { note: "api_key=super-secret-value" };
    expect(assertSafeExternalInput(value, { allowSecretOverride: true })).toEqual({
      secretOverrideUsed: true,
    });
    const output = redactForOutput(value);
    expect(output.note).toContain("[REDACTED]");
    expect(output.note).not.toContain("super-secret-value");
  });
});

describe("handoff quality validation", () => {
  it("returns actionable warnings for every roadmap quality failure", () => {
    const warnings = validateHandoffQuality({
      schema_version: 1,
      project_id: "0123456789abcdef",
      project_name: "fixture",
      previous_agent: "tool-a",
      active_task: {
        id: "rec_task_01ARZ3NDEKTSV4RRFFQ69G5FAV",
        title: "Done task",
        revision: 1,
        status: "done",
      },
      accepted_decisions: [],
      completed: [],
      stopping_point: "done",
      next_action: "Continue anyway",
      blockers: [],
      references: { files: [], commits: [], branches: [] },
      files_changed: [],
      verification: [],
      created_at: new Date().toISOString(),
    });
    expect(warnings.map((warning) => warning.code).sort()).toEqual([
      "CONFLICTING_STATUS",
      "MISSING_COMPLETED_WORK",
      "MISSING_FILE_REFERENCES",
      "MISSING_VERIFICATION",
      "VAGUE_STOPPING_POINT",
    ]);
    for (const warning of warnings) {
      expect(warning.remediation.length).toBeGreaterThan(10);
    }
    const activeWarnings = validateHandoffQuality({
      ...({
        schema_version: 1,
        project_id: "0123456789abcdef",
        project_name: "fixture",
        previous_agent: "tool-a",
        active_task: {
          id: "rec_task_01ARZ3NDEKTSV4RRFFQ69G5FAV",
          title: "Active task",
          revision: 1,
          status: "active",
        },
        accepted_decisions: [],
        completed: ["Started the task"],
        stopping_point: "The parser is open at the next branch.",
        next_action: "go",
        blockers: [],
        references: { files: ["src/parser.ts"], commits: [], branches: [] },
        files_changed: [],
        verification: ["Parser fixture loaded"],
        created_at: new Date().toISOString(),
      }),
    });
    expect(activeWarnings.map((warning) => warning.code)).toContain(
      "MISSING_NEXT_ACTION",
    );
  });
});
