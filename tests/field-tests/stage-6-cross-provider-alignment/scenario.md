# Stage 6 Scenario

## Canonical project state

- **Project goal:** Add secure OAuth-based login and session management for the dashboard.
- **Accepted decision:** Use OAuth 2.0 authorization code flow with PKCE for dashboard login.
  - Rationale: Balances security with implementation complexity; avoids password storage.
- **Active task:** Implement SaaS dashboard authentication.
- **Task status:** active
- **Initial task next step:** Wire OAuth callback handler and session store.
- **Handoff:** Initial auth handoff from agent:A to agent:B.
  - Context: Authentication scope and decision are documented.
  - State: Task created, decision accepted, no code written yet.
  - Handoff next step: Implement OAuth callback handler and session middleware.
- **Blockers:** none

## Identical prompt contract

Every model received the same `sharedSystem` prompt, the same repack output, and the same JSON schema request. No prompt was tuned per provider.

For Ollama and OpenAI-compatible providers, system and user prompts are sent as separate chat messages. For the Antigravity CLI, `agy --print` accepts a single prompt argument, so the adapter forwards both prompts inside one argument separated by deterministic delimiters:

```
--- ZENTEXT_SYSTEM ---
<shared system prompt>
--- ZENTEXT_USER ---
<per-agent user prompt>
```

This ensures each Antigravity model sees the exact same complete prompt content as every other model.

### Agent B prompt requirements

1. State understanding:
   - current_goal
   - latest_decision
   - active_task
   - next_action
2. Propose one update to the active task only.
3. Use the exact task `id` shown in the repack output.
4. Use the exact current `revision` shown in the repack output.
5. Patch only mutable task fields (`next`, `summary`, etc.).

### Agent C prompt requirements

1. Use the OLD context captured before the Agent B update.
2. Use the stale revision number from that old context.
3. Propose an outdated update.
4. Expect it to be rejected by optimistic concurrency if the task has advanced.

### Agent D prompt requirements

1. Summarize current state, completed work, rejected stale work, and next implementation step from the current repack output.

## Mutation contract

- Target record: active task only.
- Valid mutation: advance the task with a non-overlapping `next` step.
- Invalid mutation: change the accepted decision, target the handoff, invent a task id, or use a stale revision.

## Stale context

For each model, Agent C used the repack snapshot captured immediately before that model's Agent B update. The stale revision therefore equals the revision the model's Agent B used.
