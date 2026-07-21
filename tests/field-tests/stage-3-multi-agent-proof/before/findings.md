# Stage 4 Real Multi-Model Proof — Findings (Before)

Date: 2026-07-20
Models evaluated: GLM, Kimi, MiniMax (Qwen unavailable locally)
Provider: Ollama

## What worked

1. **Context recovery.** Every model correctly identified the current goal, latest decision, active task, and next action from the Zentext repack output.
2. **Decision preservation.** All models respected the accepted OAuth 2.0 with PKCE decision and did not propose alternatives.
3. **Agent D summaries.** All three models produced consistent, accurate summaries of current state, completed work, and next implementation step.
4. **Stale-context framing.** When models attempted updates with outdated revisions and the target record had actually advanced, Zentext rejected them with optimistic-concurrency conflicts.

## What did not work

1. **Models could not reliably act on the active task.**
   The repack output shows the active task content but does **not** include the task record `id` or current `revision`.
   - GLM hallucinated a task id by replacing `rec_handoff_...` with `rec_task_...` and failed with "Record not found."
   - Kimi and MiniMax explicitly reported that the task id and revision were not visible in the context and refused to invent one.
   - Because the task could not be updated reliably, the continuation step mostly failed.

2. **Stale update succeeded for MiniMax because the record never advanced.**
   MiniMax Agent C targeted the handoff record (whose id *is* visible) at revision 1. Because Agent B had not updated the task, the handoff remained at revision 1, so the stale update applied successfully. This is not a concurrency bug; it is a consequence of the active-task id being missing from the repack output.

3. **Prompt instructions cannot compensate for missing metadata.**
   Telling models to "use the exact id from the context" only made them refuse to act when the id was absent. The root cause is in the repack rendering, not in the prompt.

## Manual review question answers

1. **Did Zentext preserve enough context?**
   Yes. Models consistently recovered goal, decision, task, and next action.

2. **Could a completely fresh model continue work?**
   Partially. Models understood what to do next, but could not reliably identify the correct record to update.

3. **Did stale information remain rejected?**
   Partially. When the target record had advanced, stale updates were rejected. When the target record had not advanced because Agent B failed to act, stale updates could still apply.

4. **Did the models generally reach the same understanding?**
   Yes. All three available models agreed on the project state and next step.

5. **What information was consistently missing?**
   The active task record `id` and current `revision` are missing from the repack output.

6. **What is the smallest improvement that would increase continuation quality?**
   Include the active task `id` and `revision` directly in the repack "Active task" section, and do the same for any record the harness expects a model to mutate. This single change would turn a mostly-failing continuation step into a mostly-working one without adding new commands, MCP tools, or architecture.

## Recommendation

The next change should be limited to the repack engine: surface record ids and revisions for actionable current-truth records (active task, open blockers, latest handoff if it is meant to be updated). Re-run this exact proof with the same models and compare before/after artifacts.
