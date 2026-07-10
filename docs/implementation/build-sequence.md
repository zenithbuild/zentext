# Build Sequence — Stage 1

**Status:** planning only — no code, no scaffold, no package setup.

## Purpose

Define the ordered phases for building Stage 1, with inputs, exit criteria, and
what each phase unblocks. This answers "what order should implementation be
planned in" and keeps Stage 1 lean: each phase is the minimum needed to verify
the next, and nothing is built ahead of its trigger.

This document is a plan, not an implementation. It contains no code, packages,
or scaffolding.

## Foundation docs this derives from

- [`stage-1-plan.md`](./stage-1-plan.md) — master scope and decisions
- [`mvp-specification.md`](../mvp-specification.md)
- [`mcp-tools.md`](../mcp-tools.md), [`cli-reference.md`](../cli-reference.md)
- [`memory-schema.md`](../memory-schema.md), [`context-repacking.md`](../context-repacking.md)

## Stage 1 scope

See [`stage-1-plan.md`](./stage-1-plan.md). Only the phases below are in scope.

## Non-goals

- No phase produces cloud, sync, auth, billing, UI, editor plugin, vector search,
  enterprise, team, or agent-runtime functionality.
- No phase builds ref-based staleness (Stretch) or pluggable schema.
- No phase ahead of its trigger.

## Phases

### Phase 1 — Schema + store

**Inputs:** ADR 0005 (baseline types + custom), ADR 0002 (out-of-repo store),
[`data-model-and-store.md`](./data-model-and-store.md),
[`tech-stack-decision.md`](./tech-stack-decision.md).

**Build:** the typed record data model, the store layout under
`~/.zentext/projects/<project-id>/`, project-id derivation, id scheme, internal
versioning, and read/write of the eight record types (task, decision, blocker,
handoff, log, validation, policy, custom).

**Exit criteria:**
- Records of all eight types can be created, read, updated, and listed by a
  store-level API (no CLI/MCP yet).
- Project-id is stable for the same remote, distinct for different remotes or
  paths.
- Required fields are enforced; recommended fields are surfaced (not rejected).
- `custom` records carry a `kind` discriminator and freeform `body`.

**Unblocks:** Phases 2, 3, 4, 5, 6, 7 (everything reads/writes the store).

### Phase 2 — CLI read/inspect

**Inputs:** [`cli-design.md`](./cli-design.md), the store API from Phase 1.

**Build:** `zentext init`, `zentext status`, `zentext show`, `zentext list`.

**Exit criteria:**
- `init` creates a store for the current project, prints the store path and next
  steps, and is idempotent.
- `status` prints active task, open blockers, latest handoff, record counts, and
  last-updated timestamps.
- `show <id>` prints a full record readably.
- `list [--type]` prints a summarized table.
- A human can verify the store works with no agent in the loop.

**Unblocks:** Phase 3 verification (human can seed data to test repack).

### Phase 3 — Repack engine + `zentext repack`

**Inputs:** [`repacking-spec.md`](./repacking-spec.md), the store API.

**Build:** the single shared repack engine (selection, priority order, size
budget, `--focus` filtering, stale handling) and the `zentext repack` CLI
command (stdout and `--out`).

**Exit criteria:**
- `zentext repack` produces structured markdown following the priority order in
  [`context-repacking.md`](../context-repacking.md).
- `--focus` filters records by tag/topic.
- `--out` writes to a file (this is the in-repo export path; no separate
  `export` command).
- Size budget is respected; lower-priority records are summarized/dropped first.
- Repack works on a hand-seeded store with no agent involved.

**Unblocks:** Phase 4 (`memory.repack` calls this same engine).

### Phase 4 — MCP server read-side

**Inputs:** [`mcp-server-design.md`](./mcp-server-design.md), ADR 0004,
[`mcp-tools.md`](../mcp-tools.md), the repack engine from Phase 3.

**Build:** MCP server over stdio, tool registration, and the read-side tools:
`memory.read`, `memory.query`, `memory.list`, `memory.repack`.

**Exit criteria:**
- An MCP-compatible agent can list the four read-side tools and call them.
- `memory.repack` returns identical output to `zentext repack` for the same
  store state (shared engine).
- Read tools return summaries / focused payloads, never secrets, never full file
  contents.

**Unblocks:** Phase 5 (write-side); the demo can already consume context.

### Phase 5 — MCP server write-side

**Inputs:** [`mcp-server-design.md`](./mcp-server-design.md),
[`safety-and-secrets.md`](./safety-and-secrets.md), the store API.

**Build:** `memory.write`, `memory.update`, `memory.handoff`.

**Exit criteria:**
- `memory.write` creates typed records for all eight types.
- `memory.update` changes status / resolves / supersedes, preserving prior state
  by supersession where it matters (no silent destructive deletes).
- `memory.handoff` creates a handoff and marks it latest.
- Secret-rejection heuristics reject obvious secrets on write.
- An agent can populate a store end-to-end via MCP.

**Unblocks:** Phase 9 (the demo needs agents writing).

### Phase 6 — CLI write/handoff

**Inputs:** [`cli-design.md`](./cli-design.md) (including the new `zentext add`).

**Build:** `zentext add` (`add task`, `add decision`, `add blocker`,
`add validation`, `add policy`, `add custom`), `zentext handoff`, `zentext edit`.

**Exit criteria:**
- `add` lets a human create the six listed record types without an agent.
  Accepts flags and/or an editor (implementation details stay planning-level;
  no complex interactive UI required).
- `handoff` captures context/state/next/open-questions/completed and marks
  latest.
- `edit <id>` opens a record for human correction or status change.
- Humans have a clean correction path independent of agents.

**Unblocks:** demo fallback (CLI-seeded memory when agents under-write).

### Phase 7 — Audit + staleness (MVP subset)

**Inputs:** [`staleness-and-audit-spec.md`](./staleness-and-audit-spec.md),
[`repacking-spec.md`](./repacking-spec.md).

**Build:** `zentext audit` and the MVP staleness signals: age-based,
status-based, completed-task, and manually-marked stale. Stale flags feed back
into the repack engine (omit or mark stale).

**Exit criteria:**
- `audit` prints a report flagging stale/suspicious records and suggests cleanup.
- Repack respects staleness (stale records omitted or marked, per spec).
- Ref-based staleness is **not** built (Stretch).

**Unblocks:** Phase 9 (audit is part of the contrast vs `CLAUDE.md`).

### Phase 8 — Non-MCP fallback hardening

**Inputs:** [`repacking-spec.md`](./repacking-spec.md),
[`cli-reference.md`](../cli-reference.md).

**Build:** `zentext repack --out .zentext/context.md`, the paste flow, and
user-facing docs for using Zentext with non-MCP agents.

**Exit criteria:**
- A non-MCP agent can continue from a pasted/`--out` repack payload.
- The export target (`.zentext/context.md`) is clearly a point-in-time snapshot,
  not a live store.
- CLI warns if the exported snapshot is stale relative to the live store.

**Unblocks:** the secondary demo path in ADR 0003.

### Phase 9 — Demo + validation

**Inputs:** [`demo-and-validation-plan.md`](./demo-and-validation-plan.md),
ADR 0003.

**Build:** none (no new code). Run the scripted demo with Codex and Claude Code
on a real project, measure MCP tool call reliability, run the markdown contrast,
and iterate on tool descriptions and repack output.

**Exit criteria:** the Stage 1 acceptance criteria in
[`stage-1-plan.md`](./stage-1-plan.md) and the demo success criteria in ADR 0003
are met in a real session.

## Assumptions

- Tech stack per [`tech-stack-decision.md`](./tech-stack-decision.md)
  (TypeScript/Node, SQLite, MCP TS SDK if stable enough) is accepted for Stage 1.
- ADRs 0002/0004/0005/0006 are accepted for Stage 1 and can be revisited after
  Stage 1 evidence, but implementation should treat them as the current contract.

## Acceptance criteria (sequence-level)

- Every phase has a verifiable exit criterion that does not require an agent,
  except Phase 9 which is explicitly the agent validation.
- No phase introduces cloud, sync, UI, or any non-goal from
  [`stage-1-plan.md`](./stage-1-plan.md).

## Doc-level acceptance tests by phase

- **Phase 1:** create/read/update/list all eight record types through the store
  API; generated fields are assigned by Zentext; exact minimum create fields are
  enforced; updates increment `revision` and write history/events.
- **Phase 2:** `init`, `status`, `show`, and `list` work on a hand-seeded store and
  print the resolved store path without an agent.
- **Phase 3:** `zentext repack` is deterministic for fixed input, selects one
  primary active task, respects the 12000-character default budget, and omits or
  marks stale records per spec.
- **Phase 4:** MCP read-side tools omit required `project` inputs, `memory.read`
  is id-only, and `memory.repack` matches CLI repack output.
- **Phase 5:** MCP write-side tools create typed records without caller-supplied
  generated fields, reject obvious secrets, and preserve prior state through
  status changes/history/supersession.
- **Phase 6:** `zentext add` supports task, decision, blocker, validation, policy,
  and custom; `add log` is not required; `edit` re-runs safety checks.
- **Phase 7:** `audit` reports the MVP staleness signals, missing recommended
  fields, secret suspects, and custom overuse without auto-mutating records.
- **Phase 8:** `repack --out .zentext/context.md` writes a labeled point-in-time
  snapshot and warns when the snapshot is stale relative to the live store.
- **Phase 9:** the real-agent demo and competent-markdown contrast pass the
  validation checklist.

## Risks

- **Phase 5 reliability** may lag; Phase 6 (`add`) is the fallback that keeps the
  demo viable.
- **Phase 3 repack quality** determines whether Phase 9 succeeds; iterate early.
- **MCP TypeScript SDK instability** may block Phase 4. Confirm the SDK before
  implementing the MCP server; keep the store/repack layers independent enough to
  survive an SDK change.
