import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve("tests/field-tests/codex-app-memory");

describe("Codex app field-test contract", () => {
  it("keeps the exact prompt, isolation boundary, real fixture, and revision proof executable", () => {
    const scenario = JSON.parse(
      readFileSync(resolve(root, "scenario.json"), "utf8"),
    );
    const readme = readFileSync(resolve(root, "README.md"), "utf8");
    const setup = readFileSync(resolve(root, "setup.mjs"), "utf8");
    const validate = readFileSync(resolve(root, "validate.mjs"), "utf8");
    const deterministicResult = JSON.parse(
      readFileSync(
        resolve(root, "results/deterministic-packed-harness.json"),
        "utf8",
      ),
    );
    const codexResult = readFileSync(
      resolve(root, "results/codex-app-manual-result.md"),
      "utf8",
    );
    const skill = readFileSync(
      resolve(".agents/skills/zentext-memory/SKILL.md"),
      "utf8",
    );

    expect(scenario.exact_prompt).toBe(
      "Read the current Zentext project memory, explain where the work stopped, then continue from the recorded next action. Do not repeat completed work.",
    );
    expect(scenario.tool_a_completed).toHaveLength(2);
    expect(readme).toContain("must not receive Tool A's conversation");
    expect(readme).toContain("original handoff by ID");
    expect(setup).toContain("await project.recordProgress");
    expect(setup).toContain("accepted_decisions");
    expect(setup).toContain("commands_executed");
    expect(validate).toContain("startingRevision + 1");
    expect(validate).toContain("stale.current");
    expect(skill).toContain("validation.status: \"current\"");
    expect(skill).toContain("Do not repeat completed work");
    expect(skill).toContain("record-progress");
    expect(skill).toContain("actual-tool-or-environment");
    expect(skill).toContain("One continuation request must not silently become an unbounded work");
    expect(deterministicResult).toMatchObject({
      result: "passed",
      starting_revision: 2,
      ending_revision: 3,
      original_handoff_current: false,
      codex_app_exercised: false,
    });
    expect(codexResult).toContain("pending manual UI execution");
  });
});
