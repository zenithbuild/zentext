import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(
  process.cwd(),
  "tests/field-tests/trusted-memory-cross-tool",
);

describe("trusted-memory cross-tool field-test contract", () => {
  it("ships a persistent packed-consumer fixture and evidence workflow", () => {
    for (const relative of [
      "README.md",
      "scenario.json",
      "prepare.mjs",
      "validate.mjs",
      "run-ollama.mjs",
      "render-report.mjs",
      "project-template/AGENTS.md",
      "project-template/package.json",
      "project-template/fixture/source-alpha.txt",
      "project-template/fixture/source-beta.txt",
      "project-template/fixture/source-gamma.txt",
      "project-template/fixture/source-delta.txt",
      "evidence/results.json",
      "evidence/report.html",
    ]) {
      expect(existsSync(resolve(root, relative)), relative).toBe(true);
    }

    const scenario = JSON.parse(
      readFileSync(resolve(root, "scenario.json"), "utf8"),
    );
    expect(scenario.exact_prompt).toBe(
      "Read the current Zentext project memory, explain where the work stopped, then continue from the recorded next action. Do not repeat completed work.",
    );
    expect(scenario.participants.map((entry: { id: string }) => entry.id)).toEqual([
      "codex",
      "openclaw",
      "gemini",
      "ollama",
    ]);
    expect(scenario.required_interfaces).toEqual([
      "cli",
      "sdk",
      "rpc",
      "mcp",
    ]);
  });
});
