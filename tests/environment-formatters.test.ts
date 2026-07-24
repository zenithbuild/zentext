import { describe, expect, it } from "vitest";

import type { ContinuationView } from "../src/continuation.js";
import {
  ENVIRONMENT_FORMATTER_IDS,
  ENVIRONMENT_FORMATTER_VERSION,
  UnsupportedEnvironmentFormatterError,
  getEnvironmentFormatterDescriptor,
  renderEnvironmentContinuation,
  resolveEnvironmentFormatterId,
} from "../src/environment-formatters.js";
import { ZentextUnsafeInputError } from "../src/errors.js";

const fixture: ContinuationView = {
  schema_version: 1,
  project: {
    id: "0123456789abcdef",
    name: "adapter-fixture",
  },
  task: {
    id: "rec_task_01ADAPTERFIXTURE",
    title: "Finish the portable report",
    goal: "Preserve every canonical field across environment presentation.",
    status: "active",
    revision: 7,
    summary: "Alpha and Beta are complete.",
    notes: ["Keep source order", "Unicode ✓ remains intact"],
    next_action: "Verify Gamma before writing it.",
  },
  handoff: {
    record_id: "rec_handoff_01ADAPTERFIXTURE",
    previous_agent: "tool-a",
    created_at: "2026-07-24T00:00:00.000Z",
    based_on_task_revision: 7,
    accepted_decisions: ["Keep labels in source order"],
    completed: ["Recorded Alpha", "Verified Beta"],
    files_changed: ["work/report.md", "work/verification.log"],
    blockers: ["Gamma is not verified"],
    verification: ["Alpha source matched", "Beta subtotal passed"],
    references: {
      files: ["fixture/gamma.txt"],
      commits: ["abc1234"],
      branches: ["feature/report"],
    },
    stopping_point: "Beta is complete and Gamma is intentionally untouched.",
    next_action: "Inspect fixture/gamma.txt and verify Gamma.",
  },
  validation: {
    status: "current",
    task_revision: 7,
    handoff_revision: 7,
  },
  quality_warnings: [],
};

function canonicalState(output: string): ContinuationView {
  const match = output.match(
    /--- BEGIN VALIDATED ZENTEXT STATE ---\n\n```json\n([\s\S]+?)\n```\n\n--- END VALIDATED ZENTEXT STATE ---/u,
  );
  if (!match) throw new Error("Formatter output is missing canonical state.");
  return JSON.parse(match[1]) as ContinuationView;
}

describe("environment continuation formatters", () => {
  it("uses explicit environment identifiers and preserves original aliases", () => {
    expect(ENVIRONMENT_FORMATTER_IDS).toEqual([
      "generic",
      "codex",
      "claude-code",
      "ollama-host",
    ]);
    expect(ENVIRONMENT_FORMATTER_VERSION).toBe("1.0");
    expect(resolveEnvironmentFormatterId("CLAUDE")).toBe("claude-code");
    expect(resolveEnvironmentFormatterId("ollama")).toBe("ollama-host");
    expect(resolveEnvironmentFormatterId(" codex ")).toBe("codex");

    expect(() => resolveEnvironmentFormatterId("gemini")).toThrow(
      UnsupportedEnvironmentFormatterError,
    );
    try {
      resolveEnvironmentFormatterId("gemini");
    } catch (error) {
      expect(error).toMatchObject({
        code: "UNSUPPORTED_ENVIRONMENT_FORMATTER",
        requested: "gemini",
        supported: [...ENVIRONMENT_FORMATTER_IDS],
      });
      expect((error as Error).message).toContain("claude -> claude-code");
    }
  });

  it("keeps one exact canonical semantic payload across every adapter", () => {
    const outputs = ENVIRONMENT_FORMATTER_IDS.map((id) =>
      renderEnvironmentContinuation(fixture, id),
    );
    const states = outputs.map(canonicalState);

    for (const state of states) {
      expect(state).toEqual(fixture);
      expect(state.task.revision).toBe(7);
      expect(state.handoff.record_id).toBe("rec_handoff_01ADAPTERFIXTURE");
      expect(state.handoff.next_action).toBe(
        "Inspect fixture/gamma.txt and verify Gamma.",
      );
      expect(state.handoff.references).toEqual(fixture.handoff.references);
      expect(state.validation.status).toBe("current");
    }
    expect(new Set(outputs).size).toBe(ENVIRONMENT_FORMATTER_IDS.length);
  });

  it("is deterministic and gives every supported environment an explicit wrapper", () => {
    const descriptors = ENVIRONMENT_FORMATTER_IDS.map((id) =>
      getEnvironmentFormatterDescriptor(id),
    );
    expect(
      descriptors.map(({ id, version, label }) => ({ id, version, label })),
    ).toMatchInlineSnapshot(`
      [
        {
          "id": "generic",
          "label": "Generic local tool or harness",
          "version": "1.0",
        },
        {
          "id": "codex",
          "label": "Codex project environment",
          "version": "1.0",
        },
        {
          "id": "claude-code",
          "label": "Claude Code project environment",
          "version": "1.0",
        },
        {
          "id": "ollama-host",
          "label": "Ollama host application",
          "version": "1.0",
        },
      ]
    `);
    for (const id of ENVIRONMENT_FORMATTER_IDS) {
      expect(renderEnvironmentContinuation(fixture, id)).toBe(
        renderEnvironmentContinuation(fixture, id),
      );
    }
  });

  it("supports compact wrappers and optional full tool-neutral instructions", () => {
    const normal = renderEnvironmentContinuation(fixture, "codex");
    const compact = renderEnvironmentContinuation(fixture, "codex", {
      compact: true,
    });
    const instructed = renderEnvironmentContinuation(fixture, "codex", {
      includeInstructions: true,
    });

    expect(compact.length).toBeLessThan(normal.length);
    expect(compact).not.toContain("## Environment guidance");
    expect(canonicalState(compact)).toEqual(fixture);
    expect(instructed).toContain("## Tool-neutral continuation contract");
    expect(instructed).toContain("Do not repeat completed work");
    expect(canonicalState(instructed)).toEqual(fixture);
  });

  it("redacts likely secrets and rejects control characters", () => {
    const secretFixture = structuredClone(fixture);
    secretFixture.task.notes = ["sk-proj-abcdefghijklmnopqrstuvwxyz"];
    const secretOutput = renderEnvironmentContinuation(secretFixture, "generic");
    expect(secretOutput).not.toContain("sk-proj-abcdefghijklmnopqrstuvwxyz");
    expect(canonicalState(secretOutput).task.notes).toEqual(["[REDACTED]"]);

    const unsafeFixture = structuredClone(fixture);
    unsafeFixture.handoff.next_action = "Run safe command\u001b[31m";
    expect(() =>
      renderEnvironmentContinuation(unsafeFixture, "generic"),
    ).toThrow(ZentextUnsafeInputError);
  });
});
