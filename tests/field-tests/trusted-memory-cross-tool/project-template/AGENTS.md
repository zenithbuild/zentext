# Trusted-memory field-test participant

This repository is a serial cross-tool continuation fixture. Zentext's SQLite
records are the canonical project memory.

When asked to read the project memory and continue:

1. Run `node .agents/skills/zentext-memory/scripts/memory.mjs read`.
2. Require `ok: true` and `validation.status: "current"`.
   Save `result.handoff.record_id` as the prior handoff ID for the progress
   link and stale-state check.
3. Before editing, explain the task, revision, accepted decisions, completed
   work, changed files, blockers, verification, stopping point, and exact next
   action.
4. Inspect only the source file named by the exact next action and the current
   report. Do not recalculate or rewrite completed regions.
5. Append exactly the assigned region to `work/report.md`, update the final
   `Total:` line, and append real evidence to `work/verification.log`.
6. Run `npm run verify`.
7. Record progress with the revision returned by the read:

   ```sh
   node .agents/skills/zentext-memory/scripts/memory.mjs record-progress '<json>'
   ```

   `accepted_decisions` means decisions newly made during this turn. Do not
   resubmit decisions that were already present in the recovered continuation.

8. Re-read memory, confirm the revision advanced exactly once, and validate the
   prior handoff ID to prove it is stale.
9. Stop after that single revision advance. Report the newly recorded next
   action, but do not execute it in the same session. Each fresh participant
   completes exactly one region and performs exactly one progress write.

Use repository-relative paths. Never write credentials, private transcripts,
personal paths, hidden reasoning, or provider session state into Zentext.
