# Agent Sync

This file is a manual field-test artifact for Zentext. It is not the future
database and should not be treated as hidden model state. It is shared external
project memory for agent handoff testing.

## Current Role

- Agent: Codex
- Role: reviewer / field-test continuation
- Session started: 2026-07-10 11:47 CDT

## Active Task

- Task: Continue the Stage 0.5 Agent Sync dogfood test as a fresh session.
- Goal: Test whether repo state plus `AGENT_SYNC.md` are sufficient to continue
  without the user re-explaining the project.
- Current status: second-session continuation is being recorded in
  `docs/field-tests/runs/002-agent-sync-continuation.md`.
- Owner: current Codex continuation session until handoff; next agent/session
  should continue from this file plus run notes 001 and 002.

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
  - value: not complete; this is handoff 2 of the 3 to 5 recommended handoffs
  - reason: the second session could continue, but the field test still needs
    more handoffs or a deliberate field-test summary before Stage 1 coding
  - last updated by: Codex, 2026-07-10 11:47 CDT

## Session-Local State

Notes for the current agent/session only. Promote to shared context, decision,
blocker, validation, or handoff only if it should become durable project memory.

- This continuation session used `AGENT_SYNC.md` as the primary handoff
  substrate, then verified it against the field-test guide, run 001, README,
  roadmap, and Stage 1 plan.
- The prior handoff was sufficient for task reconstruction; the user did not
  need to restate product direction or branch state.
- The file is verbose enough that a future repack engine will need stricter
  prioritization than this manual substrate.

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

- 2026-07-10 11:10 CDT - `git diff --check`
  - result: passed
  - scope: field-test docs only
  - notes: no whitespace errors
  - blocks next step: no
- 2026-07-10 11:47 CDT - `git diff --check`
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

- What was attempted: continued the field test as a fresh session by reading
  `AGENT_SYNC.md`, the field-test guide, run 001, README, roadmap, and Stage 1
  plan before acting.
- What changed: root `AGENT_SYNC.md` was updated with second-session findings;
  `docs/field-tests/runs/002-agent-sync-continuation.md` was added.
- Decisions made: no product scope changed; the manual substrate worked for this
  continuation, but Stage 0.5 is not complete.
- Blockers found/resolved: resolved the "no second agent/session" blocker; kept
  open the need for more handoffs and a later summary before coding.
- Validation run: `git diff --check` passed for the field-test docs.
- Files/docs referenced:
  - `AGENT_SYNC.md`
  - `docs/field-tests/AGENT_SYNC.template.md`
  - `docs/field-tests/agent-sync-field-test.md`
  - `docs/field-tests/runs/001-agent-sync-dogfood.md`
  - `docs/staged-roadmap.md`
  - `docs/implementation/stage-1-plan.md`
  - `README.md`
- Next agent should:
  - read this file first;
  - read `docs/field-tests/runs/001-agent-sync-dogfood.md` and
    `docs/field-tests/runs/002-agent-sync-continuation.md`;
  - verify the branch and validation state;
  - continue the field test with another role, preferably review or validation;
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
    audit output, or repack priority rule.
