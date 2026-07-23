import { describe, expect, it } from "vitest";

import {
  TOOL_NEUTRAL_CONTINUATION_INSTRUCTIONS,
  renderToolNeutralContinuationPrompt,
} from "../src/continuation-prompt.js";

describe("canonical tool-neutral continuation prompt", () => {
  const instructions = TOOL_NEUTRAL_CONTINUATION_INSTRUCTIONS.join("\n");

  it("retains the critical continuation semantics without prescribing wording", () => {
    expect(instructions).toMatch(/external project memory/i);
    expect(instructions).toMatch(/project identity.*task identity.*revision/i);
    expect(instructions).toMatch(/refuse to continue.*stale/i);
    expect(instructions).toMatch(/before editing.*summarize/i);

    for (const concept of [
      "task",
      "completed work",
      "changed files",
      "blockers",
      "verification",
      "stopping point",
      "exact next action",
    ]) {
      expect(instructions.toLowerCase()).toContain(concept);
    }

    expect(instructions).toMatch(/do not repeat completed work/i);
    expect(instructions).toMatch(/inspect the repository/i);
    expect(instructions).toMatch(/begin from the exact recorded next action/i);
    expect(instructions).toMatch(/record new progress back into Zentext/i);
    expect(instructions).toMatch(/preserve uncertainty/i);
    expect(instructions).toMatch(/missing.*evidence.*honestly/i);
  });

  it("states permanent boundaries and capability limits", () => {
    expect(instructions).toMatch(/never as hidden model state/i);
    expect(instructions).toMatch(/if you cannot write to Zentext/i);
    expect(instructions).toMatch(/if live validation is unavailable/i);
    expect(instructions).not.toMatch(/Codex|Claude|Kimi|Ollama|Gemini/i);
    expect(instructions).not.toMatch(/\/Users\/|[A-Z]:\\|~\/\.zentext/);
  });

  it("wraps validated state once with explicit boundaries", () => {
    const state = "# Zentext continuation\n\nExact next action";
    const prompt = renderToolNeutralContinuationPrompt(state);

    expect(prompt.match(/BEGIN VALIDATED ZENTEXT STATE/g)).toHaveLength(1);
    expect(prompt.match(/END VALIDATED ZENTEXT STATE/g)).toHaveLength(1);
    expect(prompt.match(/# Zentext continuation/g)).toHaveLength(1);
    expect(prompt).toContain(state);
  });
});
