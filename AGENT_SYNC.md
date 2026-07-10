# Agent Sync

This file is a manual field-test artifact for Zentext. It is not the future
database and should not be treated as hidden model state. It is shared external
project memory for agent handoff testing.

## Current Role

- Agent: Codex
- Role: planner / field-test initiator
- Session started: 2026-07-10 11:10 CDT

## Active Task

- Task: Start the Stage 0.5 Agent Sync dogfood test in the Zentext repo.
- Goal: Prove the manual agent-sync workflow before building the product around
  it.
- Current status: initial sync file and first run note are being created on
  `field-test/agent-sync-dogfood`.
- Owner: current Codex session until handoff; next agent/session should continue
  from this file and the run note.

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
    `docs/field-tests/runs/001-agent-sync-dogfood.md`
  - reason: first manual run should leave both the shared substrate and a
    specific run note
  - last updated by: Codex, 2026-07-10 11:10 CDT
- State: Stage 0.5 completion
  - value: not complete; this is handoff 1 of the 3 to 5 recommended handoffs
  - reason: at least one different agent/session still needs to read this file
    and attempt to continue
  - last updated by: Codex, 2026-07-10 11:10 CDT

## Session-Local State

Notes for the current agent/session only. Promote to shared context, decision,
blocker, validation, or handoff only if it should become durable project memory.

- This session used the merged Stage 0.5 docs and template as source material.
- The current agent is the first writer of the manual sync file, so this pass
  can only seed the system. It cannot prove cross-agent continuation yet.
- The next session should test whether it can reconstruct the current project
  state from this file plus the repo without needing the prior chat.

## Open Blockers

- Blocker: no second agent/session has continued from `AGENT_SYNC.md` yet.
  - status: open
  - blocks: declaring Stage 0.5 useful or moving toward Phase 1 coding
  - evidence: this file is the initial seed; the field-test procedure requires
    3 to 5 real handoffs.
  - resolution needed: have a different agent/session read the repo plus this
    file and continue the field test.
- Blocker: field-test findings are not yet mapped back to Stage 1 docs.
  - status: open
  - blocks: deciding whether Stage 1 contracts need changes before coding
  - evidence: `docs/field-tests/runs/001-agent-sync-dogfood.md` is the first
    note and does not yet include follow-up agent behavior.
  - resolution needed: after additional handoffs, summarize findings and patch
    planning docs only if evidence shows a contract issue.

## Last Validation

Newest first. Store safe summaries, not full unsanitized logs.

- 2026-07-10 11:10 CDT - `git diff --check`
  - result: passed
  - scope: field-test docs only
  - notes: no whitespace errors
  - blocks next step: no

## Reconciliation Needed

Use this when state conflicts or looks stale. Do not overwrite competing claims
until the conflict is resolved.

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

## Handoff

Update this before ending the session.

- What was attempted: started the first Zentext Stage 0.5 dogfood branch and
  seeded the manual project-memory artifact from the approved template.
- What changed: root `AGENT_SYNC.md` was created; a first run note was added
  under `docs/field-tests/runs/`.
- Decisions made: no product scope changed; Stage 0.5 remains a manual,
  pre-coding evidence gate.
- Blockers found/resolved: open blocker remains that a different agent/session
  must continue from this file before the workflow is actually proven.
- Validation run: `git diff --check` passed for the field-test docs.
- Files/docs referenced:
  - `docs/field-tests/AGENT_SYNC.template.md`
  - `docs/field-tests/agent-sync-field-test.md`
  - `docs/staged-roadmap.md`
  - `docs/implementation/stage-1-plan.md`
  - `README.md`
- Next agent should:
  - read this file first;
  - read `docs/field-tests/runs/001-agent-sync-dogfood.md`;
  - verify the branch and validation state;
  - update this file with what it used, ignored, or found vague;
  - add the next run note rather than starting product implementation.
- Next agent should avoid:
  - adding package setup, MCP server, CLI, database, UI, or product code;
  - treating this file as canonical product storage;
  - rewriting locked decisions instead of superseding them.
- Reconciliation needed:
  - determine whether this structure is too verbose for real handoff use;
  - determine whether session-local state should be excluded, summarized, or
    promoted into a future Zentext record type.
