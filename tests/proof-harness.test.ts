import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { extractJson } from "../src/proof/prompts.js";
import { runProof } from "../src/proof/harness.js";
import { StubAdapter } from "../src/proof/model-adapter.js";

describe("proof harness - JSON extraction", () => {
  it("parses raw JSON", () => {
    const out = extractJson(`{"a":1}`);
    expect(out).toEqual({ a: 1 });
  });

  it("parses fenced JSON", () => {
    const out = extractJson("```json\n{\"a\":1}\n```");
    expect(out).toEqual({ a: 1 });
  });

  it("parses JSON embedded in markdown", () => {
    const out = extractJson("Here is the JSON:\n```json\n{\"a\":1}\n```\nDone.");
    expect(out).toEqual({ a: 1 });
  });

  it("throws when no JSON object exists", () => {
    expect(() => extractJson("no json here")).toThrow();
  });
});

describe("proof harness - stub dry-run", () => {
  it("runs the full multi-agent proof and captures all artifacts", async () => {
    const home = mkdtempSync(join(tmpdir(), "zentext-proof-harness-"));
    const originalHome = process.env.HOME ?? "";
    process.env.HOME = home;

    const stub = new StubAdapter("Stub", {
      agentA: JSON.stringify({
        task: {
          type: "task",
          title: "T",
          goal: "G",
          status: "active",
          author: "agent:A",
        },
        decision: {
          type: "decision",
          title: "D",
          decision: "use X",
          status: "accepted",
          author: "agent:A",
        },
        handoff: {
          type: "handoff",
          title: "H",
          from: "agent:A",
          to: "agent:B",
          context: "C",
          state: "S",
          next: "N",
          author: "agent:A",
        },
      }),
      agentB: JSON.stringify({
        understanding: {
          current_goal: "G",
          latest_decision: "use X",
          active_task: "T",
          next_action: "N",
        },
        update: {
          record_id: "rec_task_PLACEHOLDER",
          expected_revision: 1,
          patch: { next: "N2" },
          reason: "progress",
        },
      }),
      agentC: JSON.stringify({
        update: {
          record_id: "rec_task_PLACEHOLDER",
          expected_revision: 1,
          patch: { next: "old" },
          reason: "stale",
        },
      }),
      agentD: JSON.stringify({
        current_state: "active",
        completed_work: "B updated",
        rejected_stale_work: "C conflict",
        next_implementation_step: "N2",
      }),
    });

    const report = await runProof({ adapters: [stub] });
    expect(report.models).toHaveLength(1);
    expect(report.models[0].provider).toBe("stub");
    expect(report.models[0].model).toBe("stub");
    expect(report.models[0].runs).toHaveLength(4);

    const [agentA, agentB, agentC, agentD] = report.models[0].runs;
    expect(agentA.role).toBe("A");
    expect(agentA.parsed).toBeDefined();

    expect(agentB.role).toBe("B");
    expect(agentB.mutation?.attempted).toBe(true);
    expect(agentB.mutation?.applied).toBe(true);

    expect(agentC.role).toBe("C");
    expect(agentC.mutation?.attempted).toBe(true);
    expect(agentC.mutation?.applied).toBe(false);
    expect(agentC.mutation?.conflict).toBe(true);

    expect(agentD.role).toBe("D");
    expect(agentD.parsed).toBeDefined();

    process.env.HOME = originalHome;
    rmSync(home, { recursive: true, force: true });
  });
});
