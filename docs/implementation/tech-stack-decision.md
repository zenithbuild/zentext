# ADR 0006 (proposed) — Stage 1 Tech Stack

**Status:** proposed (not final)
**Date:** 2026-07-05
**Related:** [`stage-1-plan.md`](./stage-1-plan.md), ADR 0002, ADR 0004, ADR 0005

## Purpose

The foundation docs are runtime- and storage-agnostic. Before Phase 1 can begin,
Zentext needs a working tech-stack decision: implementation language/runtime,
local store format, MCP SDK, repack output format, and project-id derivation.
This is a **decision document**, not a design document. It records options and a
current recommendation. It contains no code, packages, or scaffolding.

## Foundation docs this derives from

- [`mvp-specification.md`](../mvp-specification.md) — MVP is local store + MCP server + thin CLI
- [`mcp-tools.md`](../mcp-tools.md) — implies an MCP SDK is required
- ADR 0002 — store lives out-of-repo
- [`open-decisions.md`](../open-decisions.md) #6 (versioning), #11 (license — release gate)

## Stage 1 scope

Decide only what is needed to build Stage 1. Nothing here commits Stage 2+.

## Non-goals

- No production hardening decisions (HA, perf tuning, kernel-level verification).
- No cloud infrastructure choices.
- No choice that forces UI/editor-plugin architecture.
- No license decision (license is a release gate, not a build gate).

## Decisions to make

### 1. Implementation language/runtime

**Options:**
- **TypeScript/Node** — strong MCP SDK story, single language across MCP server +
  CLI, straightforward path to a future Zenith Framework UI, large ecosystem.
- **Go** — single static binary CLI, fast, but weaker MCP SDK story and a second
  language for any UI.
- **Rust** — fast and safe, but higher build friction for product validation;
  better suited to later hardened verification pieces.

**Current recommendation: TypeScript/Node.**

Rationale: Stage 1 is product validation, not kernel hardening. TypeScript keeps
the MCP server, CLI, and a future Zenith UI path in one language. Rust may be
useful later for performance-critical or verification-hardened pieces, but that
is not Stage 1.

### 2. Local store format

**Options:**
- **SQLite** — structured, queryable, single-file, good for typed records and
  future indexing; needs a schema migration story.
- **JSON files on disk** — simplest, human-inspectable, no dependency; weaker
  query/index and concurrency story.

**Current recommendation: SQLite.**

Rationale: the schema is typed and queryable by design (ADR 0005); SQLite matches
that without over-engineering. JSON snapshots remain an optional output format
later (e.g., for `repack --out` snapshots), not the canonical store.

### 3. MCP SDK

**Options:**
- **MCP TypeScript SDK** — matches the recommended runtime.
- Alternative-language MCP SDKs — only if the runtime decision changes.

**Current recommendation: MCP TypeScript SDK, assuming it is stable enough for
the MVP.**

Risk: SDK stability must be confirmed before Phase 4. If the SDK is not stable
enough, this decision is revisited (and may push toward a different runtime).

### 4. Repack output format

**Options:** structured markdown (default), JSON, per-agent custom.

**Current recommendation: structured markdown.**

Rationale: matches [`context-repacking.md`](../context-repacking.md) and
open-decision #3. JSON export/snapshot is an optional later output format, not
the MVP default.

### 5. Project-id derivation

**Current recommendation:**
- If a git remote `origin` exists: hash the normalized origin URL.
- Else: hash the absolute project path.
- Store the human-readable project name separately from the stable project id.

Rationale: avoids collisions between repos with the same folder name and keeps a
cloned repo stable when the remote exists. Detailed in
[`data-model-and-store.md`](./data-model-and-store.md).

## Assumptions

- ADR 0002 (out-of-repo store), ADR 0004 (`memory.*`), ADR 0005 (baseline + custom)
  are treated as Stage 1 working assumptions (see [`stage-1-plan.md`](./stage-1-plan.md)).
- License is a release gate and does not block this decision.

## Acceptance criteria

- A single runtime, store format, SDK, repack format, and project-id rule are
  selected before Phase 1 begins.
- The decision is reversible at low cost for Stage 1 scope (store format is the
  main lock-in risk; SQLite schema versioning mitigates it).

## Risks

- **MCP TypeScript SDK instability** could force a runtime change late. Mitigation:
  confirm SDK maturity before Phase 4; keep the MCP server thin so it is portable.
- **SQLite lock-in vs JSON.** Mitigation: schema versioning on records; keep the
  store API abstracted so the backend could be swapped if Stage 2 needs it.
- **TypeScript not ideal for later hardening.** Acceptable for Stage 1; revisit at
  Stage 2+ for verification-critical pieces.

## What evidence would change the decision

- If the MCP TypeScript SDK is not stable enough for reliable agent calls, switch
  runtime/SDK before Phase 4.
- If SQLite query needs are trivial and JSON-on-disk is clearly simpler in real
  usage, reconsider the store format.
- If a future Zenith UI path is not TypeScript, revisit the runtime (but this is
  Stage 4+ and does not block Stage 1).

## Decision status

**Proposed.** Not final. Must be confirmed before Phase 1 begins. The current
recommendation is the working assumption for the rest of the implementation docs.
