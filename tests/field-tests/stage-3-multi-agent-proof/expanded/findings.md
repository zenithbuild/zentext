# Stage 5 Expanded Multi-Round Continuation Proof — Findings

Date: 2026-07-20
Models evaluated: GLM, Kimi, MiniMax (Qwen unavailable locally)
Provider: Ollama
Rounds per model: 3 continuation rounds + 1 stale attempt + 1 final summary

## Summary

This expanded proof tested whether independent local models can take turns continuing the same active task through Zentext, without shared conversation history, and without overwriting each other's work.

## Metrics

| Metric | Result |
|---|---|
| Continuation rounds applied | 9/9 (3 models × 3 rounds) |
| Stale updates rejected | 3/3 |
| Revision conflicts detected | 3/3 |
| Hallucinated record ids | 0 |
| Final task revision | 10 |
| Decision preserved | Yes (revision 1, accepted) |
| Handoff preserved | Yes (revision 1, latest) |

## Per-model progression

All three models:
1. Read the active task id and revision from the repack output.
2. Applied a non-overlapping update with the correct expected revision.
3. Advanced the task from "no code written" through callback handler, session middleware, route guards, and integration tests.
4. Failed their stale-attempt round with `conflict: true`.
5. Produced a final summary matching the canonical Zentext state.

## Observations

- Models did not duplicate work. Each round built on the previous round's `next` step.
- MiniMax sometimes included the prior model's phrasing in its summary, but still advanced the task.
- Kimi and GLM produced concise, forward-moving updates.
- No model attempted to modify the accepted decision or the handoff.
- Revisions remained contiguous: 1 → 2 → 3 → ... → 10.

## Manual review question answers

1. **Can a fresh model continue the task across multiple independent rounds without overwriting prior work?**
   Yes. 9/9 continuation rounds applied successfully.

2. **Do revisions stay contiguous and free of gaps or regressions?**
   Yes. Final task revision was 10 after 9 applied updates.

3. **Are updates meaningfully advancing the task rather than restating it?**
   Yes. Each round progressed through callback handler, session middleware, route guards, and integration tests.

4. **Do stale-attempt rounds fail consistently?**
   Yes. 3/3 stale attempts were rejected by optimistic concurrency.

5. **Does the final summary accurately describe the completed chain of work?**
   Yes. All final summaries matched the final Zentext state.

6. **What is the smallest improvement required before Developer Preview?**
   None required by this evidence. The system demonstrated the target behavior.

## Conclusion

Zentext successfully enabled three independent local models to collaborate on the same task through structured memory alone. Continuation was safe, stale work was rejected, and the canonical state advanced predictably across autonomous rounds.

This supports preparing the Developer Preview.
