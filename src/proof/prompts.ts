/**
 * Prompts for the Stage 3 multi-agent proof.
 *
 * Each prompt is designed to be model-agnostic and to elicit structured JSON
 * that the harness can parse and evaluate programmatically.
 */

export const sharedSystem = `You are an AI coding agent participating in a reproducible multi-agent collaboration proof.
You have NO memory of any prior conversation. Your only source of truth is the Zentext project context provided below.
Zentext is a local-first structured memory layer for coding agents.
Respond with valid JSON only. Do not include markdown, commentary, or explanations outside the JSON object.`;

export function agentACreatePrompt(): string {
  return `Agent A: create the initial project state.

You are starting a new SaaS dashboard authentication system. Use Zentext to create three records:
1. An active task describing the implementation goal.
2. An accepted decision describing the chosen approach.
3. A handoff summarizing the current state and next step for the next agent.

Return JSON in this exact shape:
{
  "task": { "type": "task", "title": "...", "goal": "...", "status": "active", "next": "...", "author": "agent:A" },
  "decision": { "type": "decision", "title": "...", "decision": "...", "status": "accepted", "author": "agent:A" },
  "handoff": { "type": "handoff", "title": "...", "from": "agent:A", "to": "agent:B", "context": "...", "state": "...", "next": "...", "author": "agent:A" }
}`;
}

export function agentBContinuePrompt(context: string): string {
  return `Agent B: continue work from a fresh session.

You have no prior context. Here is the current Zentext project memory:

${context}

Read it carefully. Then:
1. State your understanding of the project in the fields below.
2. Propose one small, legitimate update that moves the active TASK forward. Only update the active task record. Do not update the handoff, decision, or any other record.

Rules for the update:
- Use the exact \"id\" of the active task record shown in the context above. Do not invent a record id.
- The \"expected_revision\" must be the current \"revision\" value of that task record shown in the context above.
- The patch should contain only changed task fields, such as \"next\" or \"summary\". Do not change \"id\", \"project\", \"type\", \"created_at\", \"updated_at\", \"revision\", or \"schema_version\".
- The update must match the current revision so it fails if newer work already exists.

Return JSON:
{
  "understanding": {
    "current_goal": "...",
    "latest_decision": "...",
    "active_task": "...",
    "next_action": "..."
  },
  "update": {
    "record_id": "rec_...",
    "expected_revision": 1,
    "patch": { /* only changed task fields, e.g. { "next": "..." } */ },
    "reason": "..."
  }
}`;
}

export function agentCStalePrompt(staleContext: string, staleRevision: number): string {
  return `Agent C: attempt to continue from outdated information.

You were handed the following OLD context and told the active task is still at revision ${staleRevision}. You do not know a newer agent has already updated it.

${staleContext}

Propose an update to the active task based only on this stale context.

Rules for the update:
- Use the exact \"id\" of the active task record shown in the old context above.
- The \"expected_revision\" must be ${staleRevision}, the revision from the old context.
- The patch should contain only changed task fields, such as \"next\" or \"summary\".

Return JSON:
{
  "update": {
    "record_id": "rec_...",
    "expected_revision": ${staleRevision},
    "patch": { /* outdated change */ },
    "reason": "..."
  }
}`;
}

export function agentDSummarizePrompt(context: string): string {
  return `Agent D: summarize the current state from a fresh session.

You have no prior context. Here is the current Zentext project memory:

${context}

Return JSON:
{
  "current_state": "one-sentence summary",
  "completed_work": "what has been done",
  "rejected_stale_work": "what was attempted but rejected due to stale information",
  "next_implementation_step": "the immediate next action"
}`;
}

/**
 * Extract the first JSON object from a string, tolerating markdown fences.
 */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  let content = trimmed;

  // Remove markdown fences if present
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/);
  if (fenceMatch) {
    content = fenceMatch[1]!;
  }

  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error("No JSON object found in model output");
  }
  return JSON.parse(content.slice(firstBrace, lastBrace + 1));
}
