# Agent Sync

This file is a manual field-test artifact for Zentext. It is not the future
database and should not be treated as hidden model state. It is shared external
project memory for agent handoff testing.

## Current Role

- Agent:
- Role: planner / implementer / reviewer / tester
- Session started:

## Active Task

- Task:
- Goal:
- Current status:
- Owner:

## Shared Context

- Durable facts every agent should know:
  - [add durable fact]

## Locked Decisions

Append or supersede. Do not silently rewrite prior decisions.

- Decision:
  - status: accepted / superseded / rejected / proposed
  - reason:
  - supersedes:

## Mutable State

State agents may update with a reason.

- State:
  - value:
  - reason:
  - last updated by:

## Session-Local State

Notes for the current agent/session only. Promote to shared context, decision,
blocker, validation, or handoff only if it should become durable project memory.

- [add session note]

## Open Blockers

- Blocker:
  - status: open / resolved / stale
  - blocks:
  - evidence:
  - resolution needed:

## Last Validation

Newest first. Store safe summaries, not full unsanitized logs.

- YYYY-MM-DD HH:MM TZ - `command`
  - result: passed / failed / inconclusive / not run
  - scope:
  - notes:
  - blocks next step: yes / no

## Reconciliation Needed

Use this when state conflicts or looks stale. Do not overwrite competing claims
until the conflict is resolved.

- Conflict:
  - old claim:
  - new claim:
  - evidence:
  - blocks active task: yes / no
  - proposed resolution:
  - human decision needed: yes / no

## Handoff

Update this before ending the session.

- What was attempted:
- What changed:
- Decisions made:
- Blockers found/resolved:
- Validation run:
- Files/docs referenced:
- Next agent should:
- Next agent should avoid:
- Reconciliation needed:
