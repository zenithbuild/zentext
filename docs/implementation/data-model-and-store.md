# Data Model and Store

**Status:** planning only — no code, no schema migrations, no package setup.

## Purpose

Define the concrete shape of the local memory store: directory layout, record
file/store format, project-id derivation, id scheme, internal versioning, and
the typed record model. The foundation docs define *what* records are; this
defines *how the store is shaped* so Phase 1 can be planned. No implementation.

## Foundation docs this derives from

- [`memory-schema.md`](../memory-schema.md) — record types, common envelope, when to read/write
- ADR 0002 — out-of-repo store + optional in-repo export
- ADR 0005 — baseline types + `custom` escape hatch
- [`tech-stack-decision.md`](./tech-stack-decision.md) — SQLite recommendation, project-id rule
- [`open-decisions.md`](../open-decisions.md) #6 (internal versioning + optional git export)

## Stage 1 scope

- One local store per project, out-of-repo.
- Typed records for the eight baseline/custom types.
- Internal versioning of records.
- A stable project-id and a separate human-readable project name.
- Read/write/query/list/update of records at the store level (no CLI/MCP yet in
  this doc — those are separate docs).

## Non-goals

- No cloud, no sync, no multi-machine replication.
- No vector embeddings or semantic index.
- No file contents stored in any record (only refs).
- No secret storage in any record.
- No pluggable schema templates (ADR 0005 Option D — deferred).
- No in-repo live store (the in-repo artifact is a read-only export via
  `repack --out`, not a live store).

## Store location and layout

Canonical store root (per ADR 0002 + tech-stack recommendation):

```
~/.zentext/
  projects/
    <project-id>/
      meta.json          # human-readable name, origin/path, created_at, schema version
      store.sqlite       # the canonical local store (per tech-stack-decision.md)
      exports/           # optional point-in-time snapshots written by repack --out
```

The in-repo export (`.zentext/context.md` or a snapshot) is **read-only** and
written only when the user runs `zentext repack --out`. It is never the live
store. No separate `zentext export` command in Stage 1.

## Project-id derivation

Per [`tech-stack-decision.md`](./tech-stack-decision.md):

- If a git remote `origin` exists: `project-id = hash(normalize(origin URL))`.
- Else: `project-id = hash(absolute project path)`.
- The human-readable project name (e.g., folder basename or repo name) is stored
  in `meta.json`, separate from the stable id.

Normalization rules (to be finalized in implementation): strip trailing `.git`,
lowercase scheme/host, drop credentials from the URL, normalize path casing on
case-insensitive filesystems only where safe. The hash is opaque and stable; it
is not security-sensitive.

`zentext status` and `zentext init` print the store path prominently so the
out-of-repo location is discoverable (per ADR 0002 risk mitigation).

## Record model

### Common envelope (all types)

```
id            stable unique id (see id scheme)
type          task | decision | blocker | handoff | log | validation | policy | custom
project       project-id
title         short human title
summary       1-3 sentence summary
status        active | resolved | stale | superseded
created_at    ISO-8601
updated_at    ISO-8601
author        agent:codex | agent:claude | user:<name> | ci:<name>
tags          [string]
refs          { files: [path], commits: [sha], branches: [name] }  // refs only, never contents
schema_version  integer, for graceful evolution
```

`refs` stores references only — never file contents or secrets.

### Type-specific key fields

Inherited verbatim from [`memory-schema.md`](../memory-schema.md):

- **task**: `goal`, `steps`, `progress` (in-progress|blocked|done|abandoned),
  `next`, `related`.
- **decision**: `decision`, `rationale`, `alternatives_considered`, `status`
  (active|superseded|reverted), `supersedes`.
- **blocker**: `blocker`, `severity` (high|medium|low), `workaround`,
  `status` (active|resolved), `related`.
- **handoff**: `from`, `to`, `context`, `state`, `next`, `open_questions`,
  `completed_this_session`.
- **log**: `command`, `exit_code`, `summary`, `safe_excerpt`, `sanitized`.
- **validation**: `check`, `result` (pass|fail|unknown), `summary`, `run_at`,
  `details_ref`.
- **policy**: `rule`, `scope` (project|team|workspace), `enforcement`
  (advisory|required), `status`.
- **custom**: `kind` (sub-type string), `body` (freeform structured fields).

### Required vs recommended fields

Per ADR 0005: a small set of truly required fields per type is enforced on write;
the rest are recommended, not enforced. Missing recommended fields are surfaced
by `audit` (see [`staleness-and-audit-spec.md`](./staleness-and-audit-spec.md)),
not rejected.

Required fields (minimum, all types): `id`, `type`, `project`, `title`,
`status`, `created_at`, `updated_at`. Type-specific required fields are
identified in implementation but kept minimal.

## Id scheme

- Format: `rec_<type>_<sortable/time-based token>_<short random>`, e.g.
  `rec_task_01HZ...`. Final scheme decided in implementation; must be stable,
  unique, and human-greppable in the CLI.
- Ids are immutable; a record keeps its id across updates and supersession.

## Internal versioning

Per open-decision #6 (internal versioning + optional git export):

- The store version records internally (audit trail of updates/status changes).
- Supersession is preferred over silent destructive deletes: when a decision is
  replaced, the old record is marked `superseded` and `supersedes` links the new
  one. Blockers/tasks resolve via status, not deletion.
- The live store is not coupled to git. Git-based sharing is via the read-only
  export snapshot (`repack --out`), not the store itself.
- `schema_version` on each record lets repack/audit handle legacy fields
  gracefully rather than rejecting them (per ADR 0005 risk mitigation).

## Decisions and assumptions

- Store format: SQLite (per [`tech-stack-decision.md`](./tech-stack-decision.md),
  proposed). The store API should be abstracted so the backend could be swapped
  if Stage 2 needs it.
- Project-id: hash of normalized origin URL or absolute path (per
  [`tech-stack-decision.md`](./tech-stack-decision.md)).
- Export = `repack --out` (no separate `export` command).
- ADR 0002/0005 are working assumptions, not yet accepted.

## Acceptance criteria

- All eight record types can be created, read, updated (status/supersede), and
  listed via the store API.
- Project-id is stable for the same remote and distinct for different remotes or
  paths; the human-readable name is stored separately.
- Required fields are enforced; recommended fields are not rejected.
- `custom` records carry `kind` + freeform `body`.
- No record stores file contents or secrets.

## Risks

- **Storage location regret** (out-of-repo is hard to migrate). Mitigation:
  validate ADR 0002 against real usage before promoting to accepted.
- **Project-id collision** for repos with no remote and identical paths on
  different machines. Acceptable for Stage 1 (single-user, local); revisit at
  Stage 2.
- **Schema evolution** invalidates old records. Mitigation: `schema_version` +
  graceful repack handling.
- **SQLite vs JSON lock-in.** Mitigation: abstracted store API + schema
  versioning.
