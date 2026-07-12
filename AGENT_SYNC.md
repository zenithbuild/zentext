# Agent Sync

This file is a manual field-test artifact for Zentext. It is not the future
database and should not be treated as hidden model state. It is shared external
project memory for agent handoff testing.

## Current Role

- Agent: Codex
- Role: fresh session / review-validation pass
- Session started: 2026-07-12

## Active Task

- Task: Continue the Stage 0.5 Agent Sync dogfood test as a fresh session.
- Goal: Validate the updated `AGENT_SYNC.md` handoff substrate after run 002,
  assess whether the manual file is stabilizing or becoming noisy, and record
  run 003. No product implementation.
- Current status: third-session review/validation pass is being recorded in
  `docs/field-tests/runs/003-agent-sync-review.md`.
- Owner: current Codex review-validation session until handoff; next agent/session
  should continue from this file plus run notes 001, 002, and 003.

## Shared Context

- Durable facts every agent should know:
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
  - Run 001 seeded the manual substrate and explicitly did not prove cross-agent
    continuation.
  - Run 002 found the handoff sufficient to recover the current task, branch,
    locked decisions, blockers, validation state, and next action without asking
    the user to restate the project.
  - Run 002 is committed at `9813aee` on branch `field-test/agent-sync-dogfood`.
  - Run 003 is a review/validation pass that reconciled a stale external commit
    reference (`b892c83`) against actual repo HEAD (`9813aee`) and updated only
    `AGENT_SYNC.md` plus field-test run docs.

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
    `docs/field-tests/runs/001-agent-sync-dogfood.md` and
    `docs/field-tests/runs/002-agent-sync-continuation.md`
  - reason: field-test runs should leave both the shared substrate and specific
    run notes
  - last updated by: Codex, 2026-07-10 11:47 CDT
- State: Stage 0.5 completion
  - value: not complete; 2 of the 3 to 5 recommended handoffs are done; run 003 is the review/validation pass
  - reason: the third session could continue and validate the substrate, but the field test still needs a deliberate summary or at least one more handoff before Stage 1 coding
  - last updated by: Codex, 2026-07-12

## Session-Local State

Notes for the current agent/session only. Promote to shared context, decision,
blocker, validation, or handoff only if it should become durable project memory.

- This review-validation session started from actual repo state
  (`HEAD` `9813aee`), not the stale `b892c83` reference in the incoming prompt.
- The agent reconciled the stale commit reference in `Reconciliation Needed`
  before updating any other state.
- Run 003's main observation is that the manual substrate works for continuation
  but is becoming verbose; this is a finding for the run note, not durable project
  truth until more runs confirm it.

## Open Blockers

- Blocker: no second agent/session has continued from `AGENT_SYNC.md` yet.
  - status: resolved
  - blocks: no longer blocks proving the first continuation step
  - evidence: this continuation session recovered the current task, scope,
    branch, blockers, validation state, and next action from `AGENT_SYNC.md`,
    run 001, and the repo docs without needing the user to restate the project.
  - resolution needed: none for this blocker
- Blocker: Stage 0.5 does not yet have the recommended 3 to 5 handoffs.
  - status: open
  - blocks: declaring the field test complete or starting Phase 1 coding
  - evidence: run 002 is only the first continuation after the seed run.
  - resolution needed: run at least one more continuation/review/validation pass
    or write a field-test summary explaining why the observed evidence is enough.
- Blocker: field-test findings are not yet mapped back to Stage 1 docs.
  - status: open
  - blocks: deciding whether Stage 1 contracts need changes before coding
  - evidence: run 002 adds follow-up agent behavior, but there is not yet enough
    repeated evidence to patch Stage 1 contracts.
  - resolution needed: after additional handoffs, summarize findings and patch
    planning docs only if evidence shows a contract issue.

## Last Validation

Newest first. Store safe summaries, not full unsanitized logs.

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
  - old claim: the current commit / starting point for this run is `b892c83`.
  - new claim: actual repo HEAD is `9813aee`; run 002 is already committed.
  - evidence: `git log --oneline` shows `9813aee test: continue Agent Sync dogfood field test` as HEAD on `field-test/agent-sync-dogfood`; `docs/field-tests/runs/002-agent-sync-continuation.md` exists and is committed.
  - blocks active task: no
  - proposed resolution: treat actual repo state as authoritative; record the stale external reference here; continue with run 003 instead of rewriting run 002.
  - human decision needed: no
- Conflict:
  - old claim: Stage 1 could begin after planning gates alone.
  - new claim: Stage 0.5 must run before Phase 1 coding.
  - evidence: README, staged roadmap, and Stage 1 plan now include the field-test
    gate.
  - blocks active task: no
  - proposed resolution: treat Stage 0.5 as the current gate; do not start
    `feature/stage-1-schema-store` until field-test evidence is captured.
  - human decision needed: no
- Conflict:
  - old claim: SQLite is accepted for Stage 1.
  - new claim: Rayan's feedback raised a graph/relational/vector substrate
    question.
  - evidence: Stage 0.5 field-test doc asks whether SQLite remains sufficient or
    a graph/vector/unified data layer is needed now.
  - blocks active task: no
  - proposed resolution: keep SQLite as default unless actual handoff evidence
    shows Stage 1 needs a richer substrate before coding.
  - human decision needed: not yet
- Conflict:
  - old claim: a single shared markdown substrate may be enough for manual
    handoff.
  - new claim: the current file is useful but already verbose after two runs.
  - evidence: run 002 could continue from it, but the most important context was
    spread across multiple sections and the run note.
  - blocks active task: no
  - proposed resolution: keep using the manual file for Stage 0.5, but watch
    whether verbosity becomes evidence for a stricter repack priority or a
    separate concise handoff view.
  - human decision needed: not yet

## Handoff

Update this before ending the session.

- What was attempted: continued the field test as a fresh review-validation
  session by reading `AGENT_SYNC.md`, the field-test guide, run notes 001, 002,
  README, roadmap, and Stage 1 plan before acting.
- What changed: root `AGENT_SYNC.md` was updated with the stale commit
  reconciliation, run 003 role/task, and new validation entry;
  `docs/field-tests/runs/003-agent-sync-review.md` was added.
- Decisions made: no product scope changed; the manual substrate survived a
  stale external reference and a third-hand review pass, but Stage 0.5 is still
  not complete.
- Blockers found/resolved: resolved no new blockers; kept open the need for a
  field-test summary or at least one more handoff before Stage 1 coding; kept
  open the mapping of findings back to Stage 1 docs unless a later run finds a
  concrete contract issue.
- Validation run: `git diff --check` passed for the field-test docs.
- Files/docs referenced:
  - `AGENT_SYNC.md`
  - `docs/field-tests/AGENT_SYNC.template.md`
  - `docs/field-tests/agent-sync-field-test.md`
  - `docs/field-tests/runs/001-agent-sync-dogfood.md`
  - `docs/field-tests/runs/002-agent-sync-continuation.md`
  - `docs/field-tests/runs/003-agent-sync-review.md`
  - `docs/staged-roadmap.md`
  - `docs/implementation/stage-1-plan.md`
  - `README.md`
- Next agent should:
  - read this file first;
  - read run notes 001, 002, and 003;
  - verify the branch and validation state;
  - continue the field test with another role, preferably stale-context
    reconciliation, planning-to-review, or review-to-validation;
  - decide whether 3 handoffs is enough evidence to write a field-test summary
    or whether a fourth handoff is needed;
  - update this file with what it used, ignored, or found vague;
  - add the next run note rather than starting product implementation.
- Next agent should avoid:
  - adding package setup, MCP server, CLI, database, UI, or product code;
  - treating this file as canonical product storage;
  - rewriting locked decisions instead of superseding them.
- Reconciliation needed:
  - decide after more runs whether this file is too verbose and needs a concise
    current-context section;
  - decide whether reconciliation items should feed into a future record type,
    audit output, or repack priority rule;
  - confirm whether 3 handoffs is enough evidence or whether a fourth is needed.
