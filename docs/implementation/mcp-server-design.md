# MCP Server Design

**Status:** planning only — no code, no server scaffold, no package setup.

## Purpose

Define the MCP server architecture and the tool contracts for Stage 1:
transport, tool registration, request/response shapes, the error model, and
secret-rejection behavior. [`mcp-tools.md`](../mcp-tools.md) gives the tool
*intent*; this gives the *contract* that Phase 4/5 implement against. No
implementation.

## Foundation docs this derives from

- [`mcp-tools.md`](../mcp-tools.md) — the seven tools, inputs/outputs, safety concerns
- ADR 0004 — `memory.*` namespace + action-oriented descriptions
- [`memory-schema.md`](../memory-schema.md) — record types
- [`context-repacking.md`](../context-repacking.md) — repack output
- [`safety-and-secrets.md`](./safety-and-secrets.md) — secret rejection
- [`tech-stack-decision.md`](./tech-stack-decision.md) — MCP TypeScript SDK

## Stage 1 scope

- One local MCP server, stdio transport, per project (resolved by project-id).
- Seven tools: `memory.read`, `memory.write`, `memory.query`, `memory.handoff`,
  `memory.repack`, `memory.update`, `memory.list`.
- `memory.repack` calls the **single shared repack engine** also used by
  `zentext repack` (see [`repacking-spec.md`](./repacking-spec.md)).

## Non-goals

- No HTTP/WebSocket transport in Stage 1 (stdio only).
- No cloud, no sync, no auth, no multi-project routing server.
- No tool for secret storage, agent execution, or team operations.
- No vector search tool.
- No tool that transfers hidden model state.
- No per-agent custom tool surfaces.

## Transport and lifecycle

- **Transport:** stdio (the agent launches/communicates with the server over
  stdin/stdout). Matches the MCP TypeScript SDK's standard local mode.
- **Project resolution:** the server resolves the project from the current working
  directory (project-id per [`data-model-and-store.md`](./data-model-and-store.md)).
  A server instance serves one project at a time for Stage 1.
- **Lifecycle:** the agent starts the server; the server opens the local store;
  the server shuts down with the agent session. No long-running daemon in Stage 1.

## Tool contracts (Stage 1)

Names and action-oriented descriptions follow ADR 0004. Each description tells
the agent *when* to call the tool, the constraints, and the record types. Full
description text is finalized in implementation and tuned against real agents
(see [`demo-and-validation-plan.md`](./demo-and-validation-plan.md)).

### memory.read
- **Input:** `{ project: string, id: string }`
- **Output:** the full record (refs only, never file contents; never secrets).
- **When:** to load a specific record by id.

### memory.write
- **Input:** a record of one of the eight types supplying only user/agent
  fields: `type`, `title`, optional `status` (defaults to `active`), and
  type-specific content. Do **not** send `id`, `project`, `created_at`, or
  `updated_at` — Zentext generates them on create (`project` is resolved from
  the current working directory). Recommended fields (`summary`, `author`,
  `tags`, `refs`) are accepted but not enforced.
- **Output:** the created record with the full envelope — assigned `id`,
  resolved `project`, generated `created_at`/`updated_at`, and the rest.
- **When:** on a non-obvious decision, a blocker, a completed step, a validation,
  or before a handoff. Do not write trivial noise or secrets.
- **Safety:** reject obvious secrets; cap payload size; sanitize log excerpts.

### memory.query
- **Input:** `{ project: string, type?: string, status?: string, tags?: string[], text?: string }`
- **Output:** a list of matching records, summarized.
- **When:** to answer specific questions ("current blockers?", "auth decisions?").

### memory.handoff
- **Input:** `{ project: string, context, state, next, open_questions?, completed_this_session? }`
- **Output:** the created handoff record, marked latest for the project.
- **When:** at end of session, before a switch, or when asked to hand off.

### memory.repack
- **Input:** `{ project: string, focus?: string, max_size?: number }`
- **Output:** a structured markdown context payload (same engine as
  `zentext repack`).
- **When:** at session start to load ready context, or for a compact sub-task
  summary. The recommended way to load context.

### memory.update
- **Input:** `{ id: string, fields: { ... } }`
- **Output:** the updated record.
- **When:** mark a task done, resolve a blocker, supersede a decision. Prefer
  supersession over silent destructive deletes.
- **Safety:** reject updates that introduce secrets.

### memory.list
- **Input:** `{ project: string, type?: string, limit?: number }`
- **Output:** a summarized list (id, type, title, status, updated_at).
- **When:** quick overview before deciding what to read in detail.

## Error model

- Validation errors (missing required fields, unknown type, oversized payload)
  return a structured error, not a silent success.
- Secret-rejection is a validation error with a clear message; the record is not
  written.
- Unknown record id on read/update returns a not-found error.
- Store/format errors surface as a generic internal error with a stable code; no
  secrets leak in error text.

## Shared repack engine constraint

`memory.repack` and `zentext repack` **must** call the same underlying repacking
logic so their outputs do not drift for identical store state. The repack engine
is specified in [`repacking-spec.md`](./repacking-spec.md) and built in Phase 3.

## Decisions and assumptions

- Namespace: `memory.*` (ADR 0004, working assumption).
- Descriptions: action-oriented, treated as a first-class testable artifact, tuned
  against real agents during Phase 9.
- SDK: MCP TypeScript SDK, pending stability confirmation before Phase 4 (per
  [`tech-stack-decision.md`](./tech-stack-decision.md)).
- ADR 0004 is a working assumption, not yet accepted.

## Acceptance criteria

- An MCP-compatible agent can list all seven tools and call them.
- Read-side tools return summaries/focused payloads, never secrets, never full
  file contents.
- `memory.repack` output is identical to `zentext repack` for the same store
  state.
- `memory.write` accepts all eight types and rejects obvious secrets.
- `memory.update` preserves prior state via supersession where it matters.

## Risks

- **Agent call reliability** is the largest risk (ADR 0004). Mitigation: tune
  descriptions; provide CLI `add` fallback; seed memory via CLI for the demo.
- **`memory.*` namespace collision** with other memory MCP servers (unlikely in
  Stage 1 target environment). Mitigation: monitor; further namespace if needed.
- **SDK instability** could force a runtime change. Mitigation: confirm before
  Phase 4; keep the server thin.
- **Agents over-write noise.** Mitigation: description guidance; `audit` cleanup;
  consider dedup in a later phase.
