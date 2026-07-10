# MCP Tools

This document defines the Stage 1 MCP tool surface for Zentext. Tool names and
descriptions matter for agent behavior, so the surface is kept small, clear, and
agent-readable.

## Design principles

- **Small surface.** Fewer tools with clear purposes are more reliably called by
  agents than a large, overlapping set.
- **Agent-readable descriptions.** Tool descriptions are written so an agent can
  decide when to call them. Naming is intentional (see [`open-decisions.md`](./open-decisions.md)).
- **Safe by default.** Tools never return or accept secrets. Logs are sanitized
  before storage.
- **No hidden-state claims.** No tool implies transferring model internal state.

## Tools

### memory.read

**Purpose:** Read one memory record by id.

**Conceptual input:** `{ id: string }`

**Conceptual output:** A single stored/output record, including the resolved
`project` id assigned by Zentext.

**Agent behavior guidance:** Use when you already have a record id and need the
full record. Use `memory.list` for an overview, `memory.query` for filtered search,
and `memory.repack` to load ready-to-use agent context at session start.

**Safety concerns:** Returns only stored structured records. Never returns secrets
(secrets are not stored). `refs` are paths/SHAs, not file contents.

**MVP status:** MVP.

---

### memory.write

**Purpose:** Create a new memory record (task, decision, blocker, handoff, log,
validation, policy, custom).

**Conceptual input:** A create-input record of one of the baseline types with
required fields. Do not send generated fields (`id`, `project`, `created_at`,
`updated_at`, `revision`); Zentext assigns them.

**Conceptual output:** The created record with its assigned id and timestamps.

**Agent behavior guidance:** Write when you make a non-obvious decision, hit a
blocker, complete a task step, run a validation, or are about to hand off. Do not
write trivial noise. Do not write secrets.

**Safety concerns:** Reject records that appear to contain secrets (heuristic
check). Reject overly large payloads. Sanitize log excerpts.

**MVP status:** MVP.

---

### memory.query

**Purpose:** Query memory records for the cwd-resolved project by type, status,
tags, or free-text filter.

**Conceptual input:** `{ type?: string, status?: string, tags?: string[], text?: string }`

**Conceptual output:** A list of matching records, summarized.

**Agent behavior guidance:** Use to answer specific questions ("what are the
current blockers?", "what decisions exist about auth?") without loading everything.

**Safety concerns:** Same as `memory.read`. No secret leakage.

**MVP status:** MVP.

---

### memory.handoff

**Purpose:** Create a handoff record summarizing the current session for the next
agent or teammate.

**Conceptual input:** `{ context: string, state: string, next: string, open_questions?: string[], completed_this_session?: string[] }`

**Conceptual output:** The created handoff record, and a confirmation that it is
marked as the latest handoff for the project.

**Agent behavior guidance:** Call at the end of a session, before a switch, or when
explicitly asked to hand off. This is the primary bridge between agents.

**Safety concerns:** Do not include secrets in handoff text. Sanitize any command
excerpts.

**MVP status:** MVP.

---

### memory.repack

**Purpose:** Generate a focused, agent-ready context payload from current project
memory.

**Conceptual input:** `{ focus?: string, max_size?: number }`

**Conceptual output:** A structured markdown context payload (see
[`context-repacking.md`](./context-repacking.md)).

**Agent behavior guidance:** Call at the start of a session to get ready-to-use
context, or when you need a compact summary for a sub-task. This is the
recommended way to load context.

**Safety concerns:** Output contains no secrets (none are stored). Output excludes
bloated or stale records by default.

**MVP status:** MVP.

---

### memory.update

**Purpose:** Update an existing record (status change, resolution, supersession,
field edits).

**Conceptual input:** `{ id: string, fields: { ... } }`

**Conceptual output:** The updated record.

**Agent behavior guidance:** Use to mark a task done, resolve a blocker, supersede
a decision. Preserve prior state by superseding rather than silently deleting where
possible.

**Safety concerns:** Reject updates that introduce secrets. Reject destructive
silent deletes in favor of status changes where it matters.

**MVP status:** MVP.

---

### memory.list

**Purpose:** List memory records for the cwd-resolved project, optionally filtered
by type.

**Conceptual input:** `{ type?: string, limit?: number }`

**Conceptual output:** A summarized list of records (id, type, title, status,
updated_at).

**Agent behavior guidance:** Use for a quick overview of what exists in the store
before deciding what to read in detail.

**Safety concerns:** Summaries only; no secret content.

**MVP status:** MVP.

## Tool naming note

Tool names affect how reliably agents call them. `memory.*` is accepted for Stage
1. Description wording remains testable and may be tuned with real-agent evidence.
See [`open-decisions.md`](./open-decisions.md).

## Project resolution

In Stage 1, the MCP server resolves the project from its current working
directory and serves one project at a time. Tool inputs do not accept `project`.
Stored/output records still include the resolved `project` id. Explicit project
routing is future scope.

## Out of scope for the MVP tool surface

- No tool for secret storage.
- No tool for running agents or commands.
- No tool for cloud sync or team operations.
- No tool for vector search.
- No tool for transferring hidden model state.
