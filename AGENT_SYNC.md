# Agent Sync

This file is a manual field-test artifact for Zentext. It is not the future
database and should not be treated as hidden model state. It is shared external
project memory for agent handoff testing.

## Current Role

- Agent: Codex
- Role: fresh session / reconciliation-compression stress test
- Session started: 2026-07-12

## Active Task

- Task: Stress-test the manual `AGENT_SYNC.md` substrate by compressing
  stale/duplicate state and adding a concise current-truth view.
- Goal: Determine whether the substrate can stay accurate as it becomes verbose,
  and whether Stage 0.5 now has enough evidence to summarize or needs a final
  handoff.
- Current status: run 004 reconciliation/compression pass is being recorded in
  `docs/field-tests/runs/004-agent-sync-reconciliation.md`.
- Owner: current Codex stress-test session until handoff; next agent/session
  should continue from this file plus run notes 001–004.

## Current Truth

Concise current context. Full history lives in the run notes and the sections
below.

- **Branch:** `field-test/agent-sync-dogfood`
- **HEAD:** `51bbe90`
- **Field-test progress:** 3 of 3–5 handoffs completed; run 004 is the
  reconciliation/compression stress test
- **Active next action:** evaluate whether the substrate is still usable after
  compression; then decide whether to write a field-test summary or run one more
  handoff
- **Unresolved blockers:**
  - Stage 0.5 still needs a deliberate field-test summary before Stage 1 coding.
  - Field-test findings are not yet mapped back to Stage 1 docs (only if a
    concrete contract issue emerges).
- **Latest validation:** 2026-07-12 - `git diff --check` passed
- **Stage 1 implementation:** still blocked. No product code until the field-test
  summary or one more handoff confirms contracts.

## Shared Context

Durable facts every agent should know:

- Zentext is a standalone repo at `zenithbuild/zentext`; it is separate from
  Zenith Framework.
- The repo is still planning/docs only. No product implementation exists.
- PR #5 merged the Stage 0.5 manual field-test gate into `main` at
  `1005b6fc0ce4b3ff75a5ddbd772cc53ce98cb11e`.
- Stage 0.5 must be run before Phase 1 product coding.
- Stage 0.5 uses a temporary root-level `AGENT_SYNC.md` to observe agent
  handoff behavior.
- `AGENT_SYNC.md` is a manual field-test artifact only. It is not the future
  canonical store.
- The Stage 1 product plan remains local memory store + MCP server + thin CLI
  + shared repack engine, but coding should not start until this field test
  gives enough evidence or patches the planning docs.
- Run chronology (details are in the run notes):
  - Run 001 seeded the substrate.
  - Run 002 proved a fresh continuation works.
  - Run 003 reconciled a stale external commit reference (`b892c83`) against
    actual HEAD (`9813aee`) and completed a review/validation pass.
  - Run 004 is a reconciliation/compression stress test from HEAD `51bbe90`.
- Product boundary on this branch: no MCP server, CLI, database, UI, package
  setup, or Zenith Framework changes.

## Locked Decisions

Append or supersede. Do not silently rewrite prior decisions.

- Decision: Stage 0.5 is a required pre-coding evidence gate.
  - status: accepted
  - reason: The repo now explicitly requires the manual field test before Phase 1
    coding so the product is built from a proven workflow.
  - supersedes: earlier wording that allowed Stage 0.5 to be skipped with a
    documented reason
- Decision: No product implementation on this branch.
  - status: accepted
  - reason: `field-test/agent-sync-dogfood` is for manual workflow evidence only.
  - supersedes:
- Decision: `AGENT_SYNC.md` is a view/substrate for observation, not the future
  database.
  - status: accepted
  - reason: The long-term product direction remains structured memory with
    revision/reconciliation behavior; this file tests the workflow shape first.
  - supersedes:
- Decision: Generated implementation artifacts remain out of scope.
  - status: accepted
  - reason: The test should not create MCP, CLI, database, package setup, UI, or
    Zenith Framework changes.
  - supersedes:

## Mutable State

State agents may update with a reason.

- State: field-test branch
  - value: `field-test/agent-sync-dogfood`
  - reason: isolate the manual dogfood artifacts from `main`
  - last updated by: Codex, 2026-07-10 11:10 CDT
- State: field-test artifacts
  - value: root `AGENT_SYNC.md` plus
    `docs/field-tests/runs/001-agent-sync-dogfood.md`,
    `docs/field-tests/runs/002-agent-sync-continuation.md`,
    `docs/field-tests/runs/003-agent-sync-review.md`, and
    `docs/field-tests/runs/004-agent-sync-reconciliation.md`
  - reason: field-test runs should leave both the shared substrate and specific
    run notes
  - last updated by: Codex, 2026-07-12
- State: Stage 0.5 completion
  - value: not complete; 3 of the 3 to 5 recommended handoffs are done; run 004
    evaluates whether to summarize or continue
  - reason: continuation, stale-reference reconciliation, and compression stress
    all worked, but a deliberate field-test summary (or one more handoff) is
    still needed before Stage 1 coding
  - last updated by: Codex, 2026-07-12

## Session-Local State

Notes for the current agent/session only. Promote to shared context, decision,
blocker, validation, or handoff only if it should become durable project memory.

- This session is a reconciliation/compression stress test, not normal planning.
- The manual substrate is usable but noisy; the new **Current Truth** section is
  an experiment to reduce scan overhead without erasing history.
- The rollback model in the field-test guide (supersede / restore / mark stale /
  escalate) was applied to stale entries instead of deleting them.

## Open Blockers

- Blocker: Stage 0.5 still needs a deliberate field-test summary before Stage 1
  coding.
  - status: open
  - blocks: declaring the field test complete or starting Phase 1 coding
  - evidence: 3 continuation handoffs plus the run 004 compression/reconciliation
    stress test have been completed. The manual workflow works, but the
    observations need to be summarized before deciding if planning docs need
    patches.
  - resolution needed: add a field-test summary run note, or run one more handoff
    if more evidence is desired.
- Blocker: field-test findings are not yet mapped back to Stage 1 docs.
  - status: open
  - blocks: deciding whether Stage 1 contracts need changes before coding
  - evidence: runs 001–004 discovered no concrete contract issue. The accepted
    Stage 1 plan still fits the observed workflow.
  - resolution needed: if a concrete contract issue emerges from the summary,
    patch the relevant planning doc; otherwise close this blocker with the
    summary.
- Blocker: no second agent/session has continued from `AGENT_SYNC.md` yet.
  - status: resolved / stale
  - blocks: no longer blocks anything
  - evidence: runs 002, 003, and 004 all continued from the manual substrate
    without the user restating the project.
  - resolution needed: none

## Last Validation

Newest first. Store safe summaries, not full unsanitized logs.

- 2026-07-12 - `git diff --check`
  - result: passed
  - scope: field-test docs only
  - notes: no whitespace errors
  - blocks next step: no
- 2026-07-12 - `git diff --check`
  - result: passed
  - scope: field-test docs only
  - notes: no whitespace errors
  - blocks next step: no
- 2026-07-10 11:47 CDT - `git diff --check`
  - result: passed
  - scope: field-test docs only
  - notes: no whitespace errors
  - blocks next step: no
- 2026-07-10 11:10 CDT - `git diff --check`
  - result: passed
  - scope: field-test docs only
  - notes: no whitespace errors
  - blocks next step: no

## Reconciliation Needed

Use this when state conflicts or looks stale. Do not overwrite competing claims
until the conflict is resolved.

- Conflict:
  - old claim: the current commit / starting point for run 003 is `b892c83`.
  - new claim: actual repo HEAD was `9813aee` then and is `51bbe90` now; run 004
    continued from `51bbe90`.
  - evidence: `git log --oneline` shows `51bbe90` as HEAD on
    `field-test/agent-sync-dogfood`; run notes 002 and 003 are committed.
  - blocks active task: no
  - proposed resolution: treat actual repo state as authoritative; continue
    with run 004.
  - human decision needed: no
  - status: resolved
- Conflict:
  - old claim: Stage 1 could begin after planning gates alone.
  - new claim: Stage 0.5 must run before Phase 1 coding.
  - evidence: README, staged roadmap, Stage 1 plan, and the accepted locked
    decision all include the field-test gate.
  - blocks active task: no
  - proposed resolution: treat Stage 0.5 as the current gate; do not start
    `feature/stage-1-schema-store` until the field-test summary confirms
    contracts.
  - human decision needed: no
  - status: resolved by accepted locked decision
- Conflict:
  - old claim: SQLite is accepted for Stage 1.
  - new claim: Rayan's feedback raised a graph/relational/vector substrate
    question.
  - evidence: Stage 0.5 field-test doc asks whether SQLite remains sufficient or
    a graph/vector/unified data layer is needed now.
  - blocks active task: no
  - proposed resolution: keep SQLite as default unless actual handoff evidence
    shows Stage 1 needs a richer substrate before coding. Runs 001–004 did not
    produce such evidence.
  - human decision needed: not yet
- Conflict:
  - old claim: a single shared markdown substrate may be enough for manual
    handoff.
  - new claim: the current file is useful but already noisy after three runs.
  - evidence: runs 002–004 could continue from it, but the most important
    context was spread across multiple sections and run notes. Run 004 added a
    **Current Truth** section to reduce scan overhead.
  - blocks active task: no
  - proposed resolution: keep using the flat manual file for Stage 0.5, but treat
    the noise as evidence that the future product needs a separate, prioritized
    repack / current-view layer rather than exposing agents to the full
    substrate.
  - human decision needed: not yet

## Handoff

Update this before ending the session.

- What was attempted: a reconciliation/compression stress test on the manual
  `AGENT_SYNC.md` substrate after three prior runs.
- What changed: root `AGENT_SYNC.md` was compressed and clarified; a new
  **Current Truth** section was added; stale entries were marked resolved/stale
  rather than deleted; `docs/field-tests/runs/004-agent-sync-reconciliation.md`
  was added.
- Decisions made: no product scope changed. The accepted rollback model is
  supersession / mark stale / escalate, not raw overwrite. Stage 0.5 has enough
  evidence to summarize, but no concrete contract issue was found.
- Blockers found/resolved: resolved the old "no second agent/session" blocker as
  stale; kept open the need for a field-test summary and the mapping of findings
  to Stage 1 docs.
- Validation run: `git diff --check` passed for the field-test docs.
- Files/docs referenced:
  - `AGENT_SYNC.md`
  - `docs/field-tests/AGENT_SYNC.template.md`
  - `docs/field-tests/agent-sync-field-test.md`
  - `docs/field-tests/runs/001-agent-sync-dogfood.md`
  - `docs/field-tests/runs/002-agent-sync-continuation.md`
  - `docs/field-tests/runs/003-agent-sync-review.md`
  - `docs/field-tests/runs/004-agent-sync-reconciliation.md`
  - `docs/staged-roadmap.md`
  - `docs/implementation/stage-1-plan.md`
  - `README.md`
- Next agent should:
  - read this file first, especially the **Current Truth** section;
  - read run notes 001–004;
  - either write a Stage 0.5 field-test summary run note or run one final
    handoff if more evidence is desired;
  - decide whether any Stage 1 planning docs need patches — default to "no"
    unless a concrete contract issue is found;
  - update this file with what it used, ignored, or found vague.
- Next agent should avoid:
  - adding package setup, MCP server, CLI, database, UI, or product code;
  - treating this file as canonical product storage;
  - rewriting locked decisions instead of superseding them;
  - deleting stale history instead of marking it stale/superseded.
- Reconciliation needed:
  - confirm whether 3 continuation handoffs + run 004 compression stress test is
    enough evidence to write the field-test summary, or whether a fifth handoff is
    needed;
  - decide whether reconciliation items should feed into a future record type,
    audit output, or repack priority rule;
  - keep watching whether the **Current Truth** section stays accurate as the
    next agent updates the file.
