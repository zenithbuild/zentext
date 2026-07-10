# Stage 1 Implementation Plan

**Branch:** `plan/zentext-mvp-implementation-plan-v1`
**Status:** planning only — no code, no scaffold, no package setup
**Date:** 2026-07-05

## Purpose

This is the master plan for building Zentext Stage 1 (the Local MVP) without
over-engineering. It defines Stage 1 scope, deliverables, acceptance criteria,
build order, and a traceability matrix back to the foundation docs. Every other
document under `docs/implementation/` derives from this one and from the
foundation docs it references.

This is a **docs-only** plan. It contains no implementation code, no package
manifests, no scaffolding, and no UI.

## Foundation docs this derives from

- [`mvp-specification.md`](../mvp-specification.md) — MVP definition, success/failure criteria, demo flow
- [`staged-roadmap.md`](../staged-roadmap.md) — Stage 1 deliverables, acceptance criteria, non-goals, trigger to Stage 2
- [`open-decisions.md`](../open-decisions.md) — Stage 1-relevant open decisions
- [`decision-records/0002-memory-storage-location.md`](../decision-records/0002-memory-storage-location.md)
- [`decision-records/0003-better-than-markdown-demo.md`](../decision-records/0003-better-than-markdown-demo.md)
- [`decision-records/0004-mcp-tool-naming.md`](../decision-records/0004-mcp-tool-naming.md)
- [`decision-records/0005-schema-rigidity.md`](../decision-records/0005-schema-rigidity.md)
- [`mcp-tools.md`](../mcp-tools.md), [`memory-schema.md`](../memory-schema.md),
  [`context-repacking.md`](../context-repacking.md), [`cli-reference.md`](../cli-reference.md)

## Stage 1 scope

Stage 1 is the **Local MVP**: a developer can switch between AI coding agents
while preserving the same external project memory, and the next agent continues
without the developer re-explaining the project.

Stage 1 coding should start only after the Stage 0.5 manual field test either
supports this plan or produces specific docs patches. The field test is a
pre-coding evidence gate, not an implementation phase. See
[`../field-tests/agent-sync-field-test.md`](../field-tests/agent-sync-field-test.md).

Stage 1 includes exactly:

1. **Local memory store** (per-project, out-of-repo).
2. **MCP server** exposing: `memory.read`, `memory.write`, `memory.query`,
   `memory.handoff`, `memory.repack`, `memory.update`, `memory.list`.
3. **Thin CLI**: `init`, `status`, `show`, `list`, `add`, `handoff`, `repack`,
   `edit`, `audit`.
4. **Baseline memory schema**: task, decision, blocker, handoff, log, validation,
   policy, custom (baseline types + `custom` escape hatch).
5. **Context repacking**: structured markdown payload from current memory state,
   optimized for agent consumption. One shared repack engine backing both the
   `zentext repack` CLI command and the `memory.repack` MCP tool.
6. **Non-MCP fallback**: `zentext repack` (with `--out`) emits a pasteable
   payload and serves as the in-repo export target. No separate `zentext export`
   command in Stage 1.

## Explicit non-goals (Stage 1 boundaries)

- No cloud, no sync, no accounts, no authentication, no billing.
- No UI, dashboard, GUI, or TUI.
- No editor plugins (VS Code, JetBrains, etc.).
- No vector search / semantic search.
- No team workspaces, shared memory, multi-user.
- No enterprise controls (RBAC, SSO, audit export, governance).
- No custom agent runtime / agent orchestration.
- No hidden model state transfer (impossible; never in scope).
- No pluggable schema templates (ADR 0005 Option D — deferred to Stage 2+).
- No per-agent custom repack formats (later stage).
- No separate `zentext export` command (folded into `repack --out`).
- No Zenith Framework files are touched by this plan.

## Decisions and assumptions

### Accepted Stage 1 ADRs

ADR 0002, 0004, 0005, and 0006 are **accepted for Stage 1**. They are not
necessarily permanent beyond Stage 1 and can be revisited after Stage 1 evidence
accumulates:

- **ADR 0002** — storage location: out-of-repo store
  (`~/.zentext/projects/<project-id>/`) + optional in-repo export via
  `repack --out .zentext/context.md`.
- **ADR 0004** — MCP tool naming: `memory.*` namespace with action-oriented
  descriptions. In Stage 1, MCP tools resolve the project from the server cwd and
  do not accept a required `project` input.
- **ADR 0005** — schema rigidity: opinionated baseline types + `custom` escape
  hatch.
- **ADR 0006** — tech stack: TypeScript/Node, SQLite, MCP TypeScript SDK if stable
  enough for implementation, structured markdown repack output, and the accepted
  project-id rule.

License status is unchanged: it remains an unresolved release gate and does not
block Stage 1 implementation.

### Locked Stage 1 decisions

| Decision | Resolution |
|----------|------------|
| Export command | No separate `zentext export` in Stage 1. Use `zentext repack --out .zentext/context.md`. The export concept is just a repack output target. |
| Generic CLI authoring | Add `zentext add` in Stage 1: `add task`, `add decision`, `add blocker`, `add validation`, `add policy`, `add custom`. Humans must have a clean correction/authoring path independent of agents. |
| Staleness | MVP: age-based, status-based, completed-task, manually-marked. Stretch: file/reference-based staleness using repo state. |
| Tech stack | Accepted Stage 1 ADR (`tech-stack-decision.md`): TypeScript/Node, SQLite local store, MCP TypeScript SDK if stable enough, structured markdown repack, JSON snapshot only as optional later output. |
| Project ID | If git remote origin exists: hash normalized origin URL. Else: hash absolute project path. Human-readable project name stored separately from stable project id. |
| Repack engine | One shared repack engine. CLI `zentext repack` and MCP `memory.repack` call the same underlying logic so outputs do not drift. |
| Safety | Heuristic safeguards only, not a guarantee. Conservative defaults: reject obvious secrets, redact likely tokens, no full unsanitized command logs, cap stored log size, prefer summaries over raw logs. |
| License | Release gate, not a build gate. Does not block Stage 1 implementation planning. |

## Build order (summary)

Detailed in [`build-sequence.md`](./build-sequence.md). Each phase is
independently verifiable.

1. Schema + store (data model, store layout, typed record read/write).
2. CLI read/inspect: `init`, `status`, `show`, `list`.
3. Repack engine + `zentext repack` (the differentiator; prove on hand-seeded data).
4. MCP server read-side: `memory.read`, `memory.query`, `memory.list`, `memory.repack`.
5. MCP server write-side: `memory.write`, `memory.update`, `memory.handoff`.
6. CLI write/handoff: `add`, `handoff`, `edit`.
7. Audit + staleness (age/status/completed/manual) fed back into repack.
8. Non-MCP fallback hardening (`repack --out`, paste flow, docs).
9. Demo + validation (run ADR 0003 for real; measure call reliability; iterate descriptions).

Rationale for read-before-write: the product fails if agents do not write
reliably. Getting read/repack solid first lets the demo fall back to CLI-seeded
memory while write reliability is tuned.

## Traceability matrix

| Stage 1 deliverable | Defined by |
|---------------------|------------|
| Local memory store | mvp-specification.md, ADR 0002, data-model-and-store.md |
| MCP server + 7 tools | mcp-tools.md, ADR 0004, mcp-server-design.md |
| Thin CLI (9 commands) | cli-reference.md, cli-design.md (`add` added here) |
| Baseline schema (8 types) | memory-schema.md, ADR 0005, data-model-and-store.md |
| Context repacking | context-repacking.md, repacking-spec.md |
| Non-MCP fallback | cli-reference.md, repacking-spec.md |
| Audit + staleness | open-decisions.md #10, staleness-and-audit-spec.md |
| Safety | mcp-tools.md, memory-schema.md, safety-and-secrets.md |
| Demo + validation | ADR 0003, demo-and-validation-plan.md |
| Tech stack | tech-stack-decision.md |

## Acceptance criteria (Stage 1)

Inherited verbatim from `staged-roadmap.md`:

- A developer initializes Zentext in a real project in under one minute.
- At least two different MCP-compatible agents read and write memory without
  custom integration.
- After switching agents, the second agent continues from repacked context
  without the developer restating the project.
- The experience is clearly better than maintaining a `CLAUDE.md` by hand.

Plus the demo success criteria in ADR 0003 / `demo-and-validation-plan.md`.

Pre-coding gate: Stage 0.5 must be run before Phase 1 coding. If Stage 0.5
reveals a contract issue, the relevant planning docs must be patched before
product implementation starts.

## Risks (carried from foundation docs)

- **Agent MCP tool reliability** is the single biggest dependency. If agents do
  not call `memory.write` at the right moments, the store is empty and the demo
  collapses. Mitigation: tune descriptions; provide CLI `add` fallback; seed
  memory via CLI for the demo if needed.
- **Repack output quality.** Too long or poorly ordered → Agent B ignores it.
  Mitigation: strict priority order; size budget; test with two agents.
- **Schema too rigid or too loose.** Mitigated by ADR 0005 Option C; validate
  against the demo scenario before locking.
- **Storage location regret.** Out-of-repo is hard to migrate later. Mitigated by
  validating ADR 0002 against real usage before making it permanent beyond Stage 1.
- **Over-building.** Staleness ref-detection, pluggable schema, and per-agent
  formats are explicitly deferred to keep the MVP lean.
