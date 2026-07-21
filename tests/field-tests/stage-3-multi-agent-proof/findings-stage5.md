# Stage 5 Multi-Model Proof — After Repack Actionability Fix

Date: 2026-07-20
Models evaluated: GLM, Kimi, MiniMax (Qwen unavailable locally)
Provider: Ollama
Change under test: expose active task `id` + `revision`, blocker `id` + `revision`, and latest handoff `id` + `revision` in the repack output.

## Before/after metrics

| Metric | Before | After |
|---|---|---|
| Agent B continuation applied | 1/3 (GLM, wrong id) | 3/3 |
| Agent C stale rejected (conflict=true) | 1/3 (minimax succeeded because B failed) | 3/3 |
| Hallucinated record ids | 2/3 (Kimi null, MiniMax handoff id) | 0/3 |
| Correct task id used | 1/3 | 3/3 |
| Correct expected_revision used | 1/3 | 3/3 |

## What changed

The only code change was adding `ID: ... | revision: ...` lines for the active task, open blockers, and latest handoff in the repack markdown.

## Results

1. **Continuation.** All three models now read the active task id and revision from the repack context and applied a legitimate task update with optimistic concurrency.
2. **Stale rejection.** All three Agent C attempts were rejected with `conflict: true` because the task revision had advanced.
3. **No hallucinated ids.** Every model used the exact id provided in the repack output.
4. **Context recovery remained strong.** All models correctly identified goal, decision, task, and next action.
5. **Agent D summaries stayed consistent.** All three models summarized current state, completed work, and next step accurately.

## Observations

- MiniMax produced the most verbose updates but still targeted the correct record and revision.
- GLM and Kimi produced concise, focused updates.
- All models respected the accepted OAuth 2.0 with PKCE decision.
- No model attempted to mutate the handoff or decision after the prompt and repack metadata clarified the active task target.

## Manual review question answers

1. **Did Zentext preserve enough context?**
   Yes.

2. **Could a completely fresh model continue work?**
   Yes. 3/3 models applied a valid task continuation.

3. **Did stale information remain rejected?**
   Yes. 3/3 stale attempts were rejected by revision conflict.

4. **Did the models generally reach the same understanding?**
   Yes. All models agreed on goal, decision, task, and next action.

5. **What information was consistently missing?**
   Nothing critical was missing in this run. Occasional verbosity or differing granularity in `next` phrasing did not affect correctness.

6. **What is the smallest improvement that would increase continuation quality?**
   The single required improvement has already been applied. Future improvements should be driven by new evidence rather than prediction.

## Conclusion

One evidence-backed change—exposing minimal action metadata for mutable current-truth records—turned a mostly-failing continuation step into a consistently succeeding one across independent local models.

This supports moving to Developer Preview: the core system behavior (context preservation + safe mutation continuation across independent agents) has been demonstrated with real model evidence.
