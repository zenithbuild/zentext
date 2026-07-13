# Agent Sync Dogfood Run 004

**Date:** 2026-07-12
**Branch:** `field-test/agent-sync-dogfood`
**Repo:** `zenithbuild/zentext`
**Agent/session:** Codex, fresh session / reconciliation-compression stress test
**Mode:** stale-context reconciliation / compression stress
**Product impact:** none

## What Was Tested

This run stress-tested whether the manual `AGENT_SYNC.md` substrate can stay accurate and usable after three prior runs accumulated verbose, partially stale, or duplicated state. Instead of adding normal field-test progress, the session:

- evaluated compression: whether `AGENT_SYNC.md` was becoming too long for a quick handoff;
- evaluated reconciliation: whether stale, duplicated, or conflicting entries were identifiable;
- evaluated rollback/supersession: whether correction should be overwrite, append-only note, supersession entry, or reconciliation entry;
- produced a concise "Current Truth" section inside `AGENT_SYNC.md` to reduce scan overhead;
- decided whether Stage 0.5 now has enough evidence to summarize or whether a fifth handoff is still needed.

## Source Docs Used

- `AGENT_SYNC.md`
- `docs/field-tests/agent-sync-field-test.md`
- `docs/field-tests/runs/001-agent-sync-dogfood.md`
- `docs/field-tests/runs/002-agent-sync-continuation.md`
- `docs/field-tests/runs/003-agent-sync-review.md`
- `README.md`
- `docs/staged-roadmap.md`
- `docs/implementation/stage-1-plan.md`

## Whether The Handoff Still Worked

Yes. Even with accumulated verbosity, a fresh session could recover the current branch, HEAD, active task, locked decisions, blockers, validation state, and next action from `AGENT_SYNC.md` plus the run notes. The new "Current Truth" section made the top-level scan faster.

## What Was Compressed Or Clarified

- Added a concise **Current Truth** section at the top of `AGENT_SYNC.md` containing branch, HEAD, progress, next action, unresolved blockers, latest validation, and Stage 1 status.
- Trimmed the Shared Context run-history list to a compact summary; full narrative remains in run notes 001–003.
- Marked the old "no second agent/session" blocker as resolved/stale rather than deleting it, preserving history.
- Marked the Stage-0.5-vs-Stage-1 timing reconciliation item as resolved by the accepted locked decision, preserving the claim trail.
- Marked the stale `b892c83` commit reference from run 003 as resolved, since actual HEAD is now `51bbe90` and run 004 continued from it.
- Kept the SQLite vs. graph/vector/unified substrate question and the manual-substrate verbosity question open for future evidence.

## What Was Stale Or Duplicated

- The "no second agent/session" blocker was true before run 002 but has been false since run 002; it was marked resolved/stale in run 004.
- The reconciliation entry "Stage 1 could begin after planning gates alone" vs "Stage 0.5 must run before Phase 1 coding" is now accepted doctrine; it was marked resolved by the locked decision.
- Shared Context had grown a blow-by-blow run narrative that duplicated the run notes; it was compressed into a short chronology.
- Multiple sections (blockers, reconciliation, handoff) repeated the same "more handoffs needed" message; the Current Truth section now carries the single next-action summary.

## Reconciliation Rules: Enough?

Yes, with friction. The rules prevented silent deletion and forced stale claims to be marked rather than erased. However, the manual file made it tempting to simply delete old text to reduce noise. The field-test rule "mark stale / supersede / escalate instead of overwrite" worked, but it also explains why the future product needs structured records: so a repack view can be concise without destroying history.

## Rollback Model: Overwrite Vs Supersession

This run concluded that correction in shared memory should almost never be a raw overwrite. The better patterns, in order:

1. **Supersession** for accepted new doctrine (e.g., Stage 0.5 gate is now accepted).
2. **Mark stale** for resolved observations that should stay visible (e.g., the old "no second agent/session" blocker).
3. **Reconciliation entry** for unresolved competing claims (e.g., SQLite vs. richer substrate).
4. **Overwrite** only for session-local scratch or handoff replacement, never for locked decisions or validation history.

This supports the field-test guide's expected product direction: canonical state is revisioned; rollback means a new event, not history rewrite.

## Should AGENT_SYNC.md Remain A Flat File In Stage 0.5?

Yes, for the remainder of Stage 0.5. The flat file is the cheapest way to observe the failure modes. But this run strongly suggests that the future product should not expose agents to the full flat file. Instead, Zentext should:

- store the full history in a structured local store;
- generate a concise, prioritized repack/current-view for each handoff;
- keep the verbose substrate out of the agent's default context window.

## Does Future Zentext Need A Repack / Current-View Layer?

Yes. The manual substrate proved that handoff works, but also proved that a long flat file is noisy. A deterministic repack layer that produces a tight "current truth" view is not a nice-to-have; it is the core value proposition suggested by the field test.

## Enough Evidence To Summarize Stage 0.5?

Yes, with a caveat.

Evidence gathered:
- Run 001 seeded the substrate.
- Run 002 proved a fresh continuation works.
- Run 003 proved the substrate survives a stale external commit reference and a review/validation pass.
- Run 004 proved the substrate can be reconciled and compressed without losing history.

That is three continuation handoffs plus a compression/reconciliation stress test, which meets the low end of the "3 to 5 real handoffs" guidance. The success criteria from `agent-sync-field-test.md` are satisfied:
- at least two different agents/sessions continued from the sync file;
- handoffs required no re-explanation;
- locked decisions and blockers remained visible;
- stale/conflicting state was identifiable;
- observations map cleanly to Zentext record types and support the need for structured records + deterministic repacking.

Caveat: no concrete contract issue was discovered, so no Stage 1 planning-doc patches are required. The next step should be a field-test summary run note (or a deliberate decision to proceed to Stage 1) rather than another handoff, unless someone wants more samples.

## Stage 1 Contract Issues

None discovered. The observations reinforce the accepted plan rather than contradict it:
- `task`, `decision`, `blocker`, `validation`, and `handoff` record types map cleanly to the manual sections.
- `reconciliation` items may map to audit/staleness reports or a dedicated record type, but the current plan already leaves room for audit/staleness in Stage 1.
- Session-local state should stay excluded from canonical repack, which matches the current plan.

## SQLite Vs. Graph/Vector/Unified Data Layer

SQLite remains acceptable for Stage 1. The handoff and reconciliation behavior observed in runs 001–004 does not require graph or vector semantics. The richer substrate question should remain a later spike, not a Stage 1 scope change.

## Validation

- 2026-07-12 - `git diff --check`
  - result: passed
  - scope: field-test docs only
  - notes: no whitespace errors
  - blocks next step: no

## Handoff To Next Agent

Next agent/session should:

1. Read root `AGENT_SYNC.md` (especially the **Current Truth** section).
2. Read run notes 001, 002, 003, and 004.
3. Either write a Stage 0.5 field-test summary run note, or run one final handoff if more evidence is desired.
4. If writing the summary, decide whether any Stage 1 planning docs need patches. The default should be "no patches unless a concrete contract issue is found."
5. Keep all product code, package setup, MCP server, CLI, database, UI, and Zenith Framework changes out of scope.

Success for the next step is a deliberate decision about whether Stage 0.5 is complete, not code output.
