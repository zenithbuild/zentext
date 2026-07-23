import type { ContinuationStaleError, ContinuationView } from "./continuation.js";
import { renderToolNeutralContinuationPrompt } from "./continuation-prompt.js";

export type ContinuationFormat = "human" | "json" | "markdown" | "prompt";

function bulletList(values: string[], empty = "None recorded"): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : [`- ${empty}`];
}

function humanList(label: string, values: string[]): string[] {
  return [label, ...(values.length > 0 ? values.map((value) => `  - ${value}`) : ["  (none)"])];
}

export function renderContinuationHuman(view: ContinuationView): string {
  return [
    "Zentext continuation — validated current",
    "",
    `Project: ${view.project.name}`,
    `Project ID: ${view.project.id}`,
    `Active task: ${view.task.title}`,
    `Task ID: ${view.task.id}`,
    `Goal: ${view.task.goal}`,
    `Status: ${view.task.status}`,
    `Task revision: ${view.task.revision}`,
    `Previous agent: ${view.handoff.previous_agent}`,
    ...humanList("Completed work:", view.handoff.completed),
    ...humanList("Changed files:", view.handoff.files_changed),
    ...humanList("Blockers:", view.handoff.blockers),
    ...humanList("Verification:", view.handoff.verification),
    ...humanList("Notes:", view.task.notes),
    "Stopping point:",
    `  ${view.handoff.stopping_point}`,
    "Exact next action:",
    `  ${view.handoff.next_action}`,
    "",
    `Validation: current (handoff revision ${view.validation.handoff_revision}, task revision ${view.validation.task_revision})`,
  ].join("\n");
}

export function renderContinuationMarkdown(view: ContinuationView): string {
  return [
    "# Zentext continuation",
    "",
    "> Validation: current. This handoff matches the live task revision.",
    "",
    "## Project and task",
    "",
    `- Project: ${view.project.name}`,
    `- Project ID: \`${view.project.id}\``,
    `- Task: ${view.task.title}`,
    `- Task ID: \`${view.task.id}\``,
    `- Goal: ${view.task.goal}`,
    `- Status: ${view.task.status}`,
    `- Task revision: ${view.task.revision}`,
    `- Handoff revision: ${view.handoff.based_on_task_revision}`,
    `- Previous agent: ${view.handoff.previous_agent}`,
    "",
    "## Completed work",
    "",
    ...bulletList(view.handoff.completed),
    "",
    "## Changed files",
    "",
    ...bulletList(view.handoff.files_changed),
    "",
    "## Blockers",
    "",
    ...bulletList(view.handoff.blockers),
    "",
    "## Verification",
    "",
    ...bulletList(view.handoff.verification),
    "",
    "## Notes",
    "",
    ...bulletList(view.task.notes),
    "",
    "## Stopping point",
    "",
    view.handoff.stopping_point,
    "",
    "## Exact next action",
    "",
    view.handoff.next_action,
  ].join("\n");
}

export function renderContinuationPrompt(view: ContinuationView): string {
  return renderToolNeutralContinuationPrompt(renderContinuationMarkdown(view));
}

export function renderContinuation(
  view: ContinuationView,
  format: ContinuationFormat,
): string {
  switch (format) {
    case "json":
      return `${JSON.stringify(view, null, 2)}\n`;
    case "markdown":
      return renderContinuationMarkdown(view);
    case "prompt":
      return renderContinuationPrompt(view);
    case "human":
      return renderContinuationHuman(view);
  }
}

export function renderStaleContinuation(
  error: ContinuationStaleError,
  format: ContinuationFormat,
): string {
  const payload = {
    schema_version: 1,
    continuation: null,
    validation: {
      status: "stale",
      reason: error.message,
      task_id: error.taskId,
      handoff_revision: error.handoffRevision,
      live_revision: error.liveRevision,
    },
  };

  if (format === "json") return `${JSON.stringify(payload, null, 2)}\n`;

  const heading = format === "markdown" || format === "prompt" ? "# Zentext continuation refused" : "Zentext continuation refused";
  return [
    heading,
    "",
    "The handoff is stale and cannot be used to continue.",
    `Reason: ${error.message}`,
    `Task ID: ${error.taskId}`,
    `Handoff revision: ${error.handoffRevision}`,
    `Live revision: ${error.liveRevision}`,
    "Create a new handoff from the live task state before continuing.",
  ].join("\n");
}
