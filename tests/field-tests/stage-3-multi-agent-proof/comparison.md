# Stage 4/5 Before/After Comparison

## Scenario

One realistic software project: a SaaS dashboard authentication feature.
- Active task: Implement SaaS dashboard authentication.
- Accepted decision: Use OAuth 2.0 authorization code flow with PKCE.
- Latest handoff: Initial auth handoff from agent:A to agent:B.

## Models

- GLM (`glm-5.2:cloud`)
- Kimi (`kimi-k2.7-code:cloud`)
- MiniMax (`minimax-m3:cloud`)
- Qwen (`qwen3:latest`) — not available locally, skipped in both runs.

All runs used the same prompts, harness, and Zentext store behavior. The only difference between the before and after runs was the single repack change described below.

## Single code change

Added minimal action metadata to the repack markdown for current-truth records that a model may need to mutate:

- **Active task:** `ID: <id> | revision: <n>`
- **Each open blocker:** `ID: <id> | revision: <n>`
- **Latest handoff:** `ID: <id> | revision: <n>`

No other record sections were changed. No ids were added to historical, decision, policy, log, or custom records.

## Metrics

| Metric | Before | After |
|---|---|---|
| Agent B continuation applied | 1/3 (GLM attempted, wrong id) | 3/3 |
| Agent C stale update rejected (conflict=true) | 1/3 | 3/3 |
| Hallucinated or missing record ids in Agent B | 2/3 | 0/3 |
| Correct task id used by Agent B | 1/3 | 3/3 |
| Correct expected_revision used by Agent B | 1/3 | 3/3 |
| Agent D summaries consistent | 3/3 | 3/3 |
| Context recovery correct | 3/3 | 3/3 |

## Interpretation

Before the change, models could recover context but could not safely act on it. They either hallucinated a record id, refused to invent one, or targeted the wrong record (the handoff).

After the change, every model used the exact id and revision exposed in the repack output, applied a legitimate task update, and had its stale update rejected by optimistic concurrency.

The failure was not reasoning; it was actionability. The smallest possible metadata addition resolved it.

## Conclusion

One evidence-backed change to repack output measurably improved multi-model collaboration in Zentext. The system now demonstrates:

- Fresh agents recover project context.
- Agents safely continue work.
- Stale writes are rejected.
- Different models converge on the same project state.

This supports moving to Developer Preview rather than continuing internal architecture iteration.
