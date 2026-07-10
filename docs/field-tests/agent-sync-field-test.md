# Stage 0.5 Agent Sync Field Test

**Status:** planning-only field test
**Scope:** manual workflow validation before Stage 1 coding
**Canonical store impact:** none
**Product code impact:** none

## Purpose

This field test validates the agent handoff workflow manually before Zentext
implements the local store, MCP server, CLI, or repack engine.

The goal is not to replace the accepted Stage 1 plan. The goal is to gather
evidence about what agents actually need, ignore, corrupt, or overwrite when
they share project context.

Zentext should be built as the automation layer around a workflow that already
proves useful in real projects.

## Why This Exists

The planning docs define Zentext as a local-first shared context and memory layer
for AI coding agents. That direction is still correct, but the highest-risk
assumption is behavioral:

> Will multiple agents reliably continue from shared external project memory
> without the developer restating the task?

Before building storage and MCP contracts around that assumption, this field
test uses one manual sync document to observe real handoff behavior.

## Non-Goals

- Do not implement product code.
- Do not add a package setup.
- Do not add UI.
- Do not build an MCP server.
- Do not build a CLI.
- Do not change the accepted Stage 1 architecture.
- Do not treat `AGENT_SYNC.md` as the future canonical store.
- Do not claim hidden model state transfer.
- Do not touch Zenith Framework.

## Test Artifact

Use a temporary manual file in one real project:

```txt
AGENT_SYNC.md
```

This file is a field-test artifact only. It is a generated/manual view of the
state Zentext may later store structurally. It is not the long-term database.
Start from [`AGENT_SYNC.template.md`](./AGENT_SYNC.template.md) unless the test
repo already has a stronger local format.

## Suggested Shape

```md
# Agent Sync

## Current Role
Planner / implementer / reviewer / tester.

## Active Task
The task the next agent should continue.

## Shared Context
Facts every agent should know before acting.

## Locked Decisions
Decisions that should not change unless explicitly superseded.

## Mutable State
State agents are allowed to update.

## Session-Local State
Notes specific to the current agent/session that should not become global truth
without review.

## Open Blockers
Known blockers and what would resolve them.

## Last Validation
Commands/checks run, result, and date.

## Reconciliation Needed
Conflicts, stale claims, uncertain facts, or state that needs human review.

## Handoff
What the next agent should do, avoid, and verify.
```

## Field-Test Procedure

1. Pick one real repo with ongoing planning or implementation work.
2. Create `AGENT_SYNC.md` using the shape above.
3. Ask Agent A to work with the file as its external project memory.
4. Require Agent A to update the file before handoff.
5. Switch to Agent B.
6. Ask Agent B to continue using only the repo plus `AGENT_SYNC.md`.
7. Record whether Agent B continues correctly without re-explanation.
8. Repeat for 3 to 5 real handoffs.

Use different task modes if possible:

- planning to review
- review to implementation
- implementation to validation
- blocked task to continuation
- stale information to reconciliation

## Agent Update Rules

Each agent must treat `AGENT_SYNC.md` as shared project memory, not a private
scratchpad.

Rules:

- Read the full file before starting work.
- Update the handoff section before ending a session.
- Do not delete locked decisions; supersede them explicitly.
- Do not mark blockers resolved unless the resolving evidence is included.
- Do not replace validation history with a vague summary.
- Do not paste raw secrets, credentials, or full unsanitized logs.
- Keep session-local notes out of shared truth unless they are promoted through
  a handoff, decision, blocker, or validation entry.
- If state conflicts, add it to `Reconciliation Needed` instead of guessing.

## Locked Vs Mutable Sections

| Section | Rule |
|---------|------|
| Current Role | Mutable by the active session. |
| Active Task | Mutable, but changes should be explained in the handoff. |
| Shared Context | Mutable only for facts that should survive the session. |
| Locked Decisions | Append or supersede; do not silently rewrite. |
| Mutable State | Safe for agents to update with a reason. |
| Session-Local State | Private to the current session unless promoted. |
| Open Blockers | Append, resolve with evidence, or mark stale. |
| Last Validation | Append-only during the test; newest result goes first. |
| Reconciliation Needed | Append conflicts or stale claims; human clears them. |
| Handoff | Replaced by each session, but prior handoffs may be copied to history if useful. |

## Handoff Format

Each handoff should include:

- what was attempted;
- what changed;
- decisions made;
- blockers found or resolved;
- validation run and result;
- files or docs referenced;
- what the next agent should do;
- what the next agent should avoid;
- what needs human reconciliation.

Keep the handoff focused. If it becomes a transcript, the format is failing.

## Validation Log Format

Use a short, repeatable format:

```md
- 2026-07-10 14:30 CT - `git diff --check`
  - result: passed
  - scope: docs only
  - notes: no whitespace errors
```

If a command fails, record:

- command;
- result;
- failure reason if known;
- whether the failure blocks the next step;
- whether the result may be stale.

Do not store full command output by default. Store a safe summary and a short
excerpt only when it helps the next agent.

## Conflict And Reconciliation Process

When an agent sees conflicting state:

1. Do not overwrite either claim.
2. Add a reconciliation item with the conflicting claims.
3. Include the evidence or missing evidence for each claim.
4. Mark whether the conflict blocks the active task.
5. Propose a resolution if obvious, but leave final authority to the user unless
   the task instructions explicitly allow the agent to decide.

Reconciliation outcomes:

- keep old state;
- accept new state;
- supersede both with corrected state;
- mark one claim stale;
- create a new decision explaining the correction.

## What To Observe

For each handoff, record:

- Which sections the next agent used.
- Which sections the next agent ignored.
- Whether the next agent respected locked decisions.
- Whether mutable state was updated safely.
- Whether stale information was detected.
- Whether blockers stayed visible.
- Whether validation history affected behavior.
- Whether the handoff was shorter than re-explaining the project.
- Whether a human had to reconcile conflicting claims.

## Conflict And Rollback Questions

This test should surface whether Zentext needs a stronger state model than a
simple current-record update.

Observe:

- Can an agent overwrite state that another agent relied on?
- Does a wrong update need rollback, supersession, or human reconciliation?
- Which fields should be immutable?
- Which updates should create a new revision instead of replacing text?
- Which conflicts should block repacking until reviewed?
- Which conflicts can be resolved by creating a new handoff or decision?

The expected long-term direction remains:

- canonical state is structured, not one mutable markdown blob;
- generated markdown/context files are views, not the database;
- updates should be revisioned;
- stale writes should not silently overwrite newer state;
- rollback should mean a new revision or supersession event, not history rewrite.

## Rollback And Supersession Behavior

During the manual test, do not rewrite history to hide a bad agent update.

Use one of these patterns:

- **Supersede:** add a new locked decision that marks the older decision wrong or
  outdated.
- **Restore:** copy a previous known-good state into a new entry and explain why
  it is being restored.
- **Mark stale:** keep the old claim visible but mark it stale or no longer
  trusted.
- **Escalate:** add a reconciliation item when the correct state is unclear.

This mirrors the expected product direction: Zentext should preserve enough
history to explain why the current context is trusted.

## Mapping To Zentext Concepts

| Field-test section | Likely Zentext concept |
|--------------------|------------------------|
| Active Task | `task` record |
| Locked Decisions | `decision` records |
| Open Blockers | `blocker` records |
| Last Validation | `validation` records |
| Handoff | `handoff` record |
| Shared Context | repack output |
| Mutable State | update rules |
| Session-Local State | agent run notes or excluded context |
| Reconciliation Needed | audit/staleness/conflict report |

## Success Criteria

The field test succeeds if:

- at least two different agents can continue from the manual sync file;
- handoffs require materially less re-explanation by the developer;
- locked decisions and blockers remain visible across agent switches;
- stale or conflicting state is identifiable;
- the observations confirm the need for structured records and deterministic
  repacking.

## Failure Criteria

The field test fails or requires rethinking if:

- agents ignore the sync file unless repeatedly prompted;
- the file becomes as noisy as a generic `CLAUDE.md`;
- agents overwrite important state without noticing;
- the developer still has to restate the task each time;
- the useful state cannot be mapped cleanly to Zentext record types.

## How Findings Should Feed Back

After the field test, update the planning docs only if evidence shows a real
contract issue.

Likely docs to adjust:

- [`memory-schema.md`](../memory-schema.md)
- [`context-repacking.md`](../context-repacking.md)
- [`implementation/data-model-and-store.md`](../implementation/data-model-and-store.md)
- [`implementation/repacking-spec.md`](../implementation/repacking-spec.md)
- [`implementation/demo-and-validation-plan.md`](../implementation/demo-and-validation-plan.md)

Do not expand Stage 1 scope unless the field test proves the current MVP cannot
demonstrate the product thesis.

## Decision Gate Before Coding

Before starting `feature/stage-1-schema-store`, answer:

1. Did the manual workflow make agent handoff easier?
2. Which sections became required record types?
3. Which sections should stay session-local and excluded from repack?
4. What state needs revision history?
5. What conflicts require human reconciliation?
6. Is SQLite still sufficient for Stage 1?
7. Is a graph/vector/unified data layer needed now, or only later?

The default assumption remains: Stage 1 uses the accepted TypeScript/Node +
SQLite plan unless field-test evidence proves the store contract needs to change
before implementation.

## Product Assumptions This Validates

This field test validates these assumptions from the current Zentext plan:

- external project memory is enough to improve agent handoff;
- typed records map cleanly to real agent coordination needs;
- deterministic repacking can beat a single static markdown wall;
- session-local state should stay separate from durable project memory;
- conflicts need explicit reconciliation instead of silent overwrite;
- Stage 1 can start with SQLite unless real handoffs prove graph/vector behavior
  is needed immediately.

## Decisions Blocked Until The Field Test Runs

- Whether the current record types are sufficient.
- Whether rollback/supersession needs a richer event model in Stage 1.
- Whether session-local state should become a first-class record type or stay out
  of canonical memory.
- Whether the repack priority order matches what agents actually need.
- Whether SQLite remains enough for the first implementation branch.
