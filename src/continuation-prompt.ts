export const TOOL_NEUTRAL_CONTINUATION_INSTRUCTIONS = [
  "Treat Zentext as external project memory, never as hidden model state, provider reasoning, or prior session history.",
  "Confirm the project identity, task identity, and recorded task revision before changing anything.",
  "Verify the recorded revision against live Zentext state when that state is available. Refuse to continue and report the mismatch if the handoff is stale; if live validation is unavailable, say so rather than claiming it succeeded.",
  "Before editing, summarize the task, completed work, changed files, blockers, verification, stopping point, and exact next action.",
  "Do not repeat completed work or claim unverified work as complete.",
  "Inspect the repository and available evidence before assuming the handoff is correct.",
  "Begin from the exact recorded next action after completing the checks above.",
  "Record new progress back into Zentext through an available interface. If you cannot write to Zentext, return the exact progress update for the operator to record.",
  "Preserve uncertainty and report missing, conflicting, or unavailable evidence honestly.",
] as const;

export function renderToolNeutralContinuationPrompt(
  validatedContinuationMarkdown: string,
): string {
  return [
    "# Tool-neutral Zentext continuation instruction",
    "",
    ...TOOL_NEUTRAL_CONTINUATION_INSTRUCTIONS.flatMap((instruction, index) => [
      `${index + 1}. ${instruction}`,
      "",
    ]),
    "--- BEGIN VALIDATED ZENTEXT STATE ---",
    "",
    validatedContinuationMarkdown,
    "",
    "--- END VALIDATED ZENTEXT STATE ---",
  ].join("\n");
}

