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

Normalization rules for Stage 1: strip trailing `.git`, lowercase scheme/host,
drop credentials from the URL, normalize SSH/HTTPS variants to the same owner/repo
shape where practical, and normalize path casing on case-insensitive filesystems
only where safe. The hash is opaque and stable; it is not security-sensitive.

`zentext status` and `zentext init` print the store path prominently so the
out-of-repo location is discoverable (per ADR 0002 risk mitigation).

Branch/worktree caveat: branch and worktree are **not** part of `project-id` in
Stage 1. Multiple clones/worktrees with the same origin intentionally share a
project memory space. Store the current branch in repo snapshots/refs where
available, and rely on task/focus tags to keep simultaneous work distinct.
Branch-aware memory spaces are future scope if real usage demands them.

## Record model

### Common envelope (all types)

```
id            stable unique id (see id scheme)
type          task | decision | blocker | handoff | log | validation | policy | custom
project       project-id
title         short human title
summary       1-3 sentence summary
status        type-specific status (see status model)
created_at    ISO-8601
updated_at    ISO-8601
revision      integer, starts at 1 and increments on update
author        agent:codex | agent:claude | user:<name> | ci:<name>
tags          [string]
refs          { files: [path], commits: [sha], branches: [name] }  // refs only, never contents
schema_version  integer, for graceful evolution
supersedes       [record id], optional
superseded_by    record id, optional
```

`refs` stores references only — never file contents or secrets.

### Type-specific key fields

Inherited from [`memory-schema.md`](../memory-schema.md), with Stage 1 status
values locked here:

- **task**: `goal`, `steps`, `next`, `related`; status
  `active | blocked | done | canceled`.
- **decision**: `decision`, `rationale`, `alternatives_considered`,
  `supersedes`, `superseded_by`; status
  `proposed | accepted | superseded | rejected`.
- **blocker**: `blocker`, `severity` (high|medium|low), `workaround`,
  `related`; status `open | resolved | canceled`.
- **handoff**: `from`, `to`, `context`, `state`, `next`, `open_questions`,
  `completed_this_session`; status `latest | archived | superseded`.
- **log**: `command`, `exit_code`, `summary`, `safe_excerpt`, `sanitized`;
  status `recorded | redacted`.
- **validation**: `check`, `result` (passed|failed|inconclusive), `summary`,
  `run_at`, `details_ref`; status mirrors `result`.
- **policy**: `rule`, `scope` (project|team|workspace), `enforcement`
  (advisory|required); status `active | inactive | superseded`.
- **custom**: `kind` (sub-type string), `body` (freeform structured fields);
  status `active | archived`.

### Required vs recommended fields, and generated vs supplied fields

Per ADR 0005: a small set of truly required fields per type is enforced on write;
the rest are recommended, not enforced. Missing recommended fields are surfaced
by `audit` (see [`staleness-and-audit-spec.md`](./staleness-and-audit-spec.md)),
not rejected.

It is critical to distinguish **create-input fields** (what an agent/CLI/user
supplies) from **stored/output envelope fields** (what Zentext generates and
returns). Generated fields must **not** be required on create; otherwise normal
agent/CLI create requests would be invalid or be forced to mint server-owned
values. This resolves the ambiguity raised in PR #2 review: `id`, `created_at`,
and `updated_at` (and `project`) are server-owned, not client-supplied.

**Generated by Zentext (not required create input):**
- `id` — generated by Zentext on create, immutable thereafter.
- `project` — resolved by Zentext from the current working directory on create
  (the store-level API takes it; MCP/CLI clients do not supply it).
- `created_at` — generated by Zentext on create.
- `updated_at` — generated by Zentext on create and changed by Zentext on every
  update.
- `revision` — generated by Zentext, starts at `1`, increments on every update.
- `supersedes` / `superseded_by` — stored only when an update/create explicitly
  supersedes another record.

**Required create input (user/agent-supplied):**
- `type` — one of the eight types.
- `title` — short human title.
- `status` — optional on create; defaults by type below.
- Type-specific minimum fields below.

Recommended (not enforced) create input: `summary`, `author`/`source`, `tags`,
`refs`.

Type-specific minimum create inputs:

| Type | Minimum create input | Default status |
|------|----------------------|----------------|
| `task` | `type`, `title`, `goal` | `active` |
| `decision` | `type`, `title`, `decision` | `accepted` |
| `blocker` | `type`, `title`, `blocker` | `open` |
| `handoff` | `type`, `title`, `context`, `state`, `next` | `latest` |
| `log` | `type`, `title`, `summary` | `recorded` |
| `validation` | `type`, `title`, `check`, `result` | same as `result` |
| `policy` | `type`, `title`, `rule` | `active` |
| `custom` | `type`, `title`, `kind`, `body` | `active` |

Specialized helper tools may derive some create fields. For example,
`memory.handoff` sets `type=handoff` and may generate a title from the timestamp
if no title is supplied by the helper contract. The stored/output record still
contains the full envelope.

**Stored/output envelope (full record returned by reads/repacks):**
`id`, `type`, `project`, `title`, `status`, `created_at`, `updated_at`,
`revision`, `summary`, `author`, `tags`, `refs`, `schema_version`,
`supersedes`, `superseded_by`, plus type-specific fields. This is the full common
envelope above; it always includes generated fields because Zentext assigned them
on create.

## Id scheme

- Format: `rec_<type>_<sortable/time-based token>_<short random>`, e.g.
  `rec_task_01HZ...`. Final scheme decided in implementation; must be stable,
  unique, and human-greppable in the CLI.
- Ids are immutable; a record keeps its id across updates and supersession.

## Internal versioning

Per open-decision #6 (internal versioning + optional git export), Stage 1 uses a
minimal buildable versioning model:

- Records have a `revision` integer starting at `1`.
- Updates increment `revision` and change `updated_at`.
- Immutable fields: `id`, `project`, `type`, `created_at`.
- Mutable fields: `title`, `status`, `summary`, `tags`, `refs`, type-specific
  content, `updated_at`, `revision`, and supersession links where applicable.
- Destructive delete is out of scope for Stage 1. Use status changes,
  archiving/canceling, or explicit supersession.
- Supersession is explicit: when a record replaces another, the new record lists
  `supersedes: [old_id]` and the old record stores `superseded_by: new_id` where
  applicable.
- The SQLite store keeps a simple `record_history`/event model: each create/update
  writes a revision snapshot or equivalent event with `record_id`, `revision`,
  `event` (`create`, `update`, `supersede`), `occurred_at`, `author`/`source`, and
  the record JSON for that revision. This is enough for audit/revision tracking
  without building git-style history.
- The live store is not coupled to git. Git-based sharing is via the read-only
  export snapshot (`repack --out`), not the store itself.
- `schema_version` on each record lets repack/audit handle legacy fields
  gracefully rather than rejecting them (per ADR 0005 risk mitigation).

## SQLite concurrency

Stage 1 is local single-user, but CLI and MCP can still touch the store at the
same time. Use simple SQLite discipline:

- Use WAL mode if practical.
- Set a busy timeout (default expectation: 5000 ms).
- Keep write transactions short-lived.
- Route CLI and MCP writes through the same store layer.
- If a write conflict cannot be resolved within the busy timeout, return a clear
  retryable store-busy error. Do not silently drop or merge writes.
- No distributed locking, sync, or multi-machine coordination in Stage 1.

## Decisions and assumptions

- Store format: SQLite (per [`tech-stack-decision.md`](./tech-stack-decision.md),
  accepted for Stage 1). The store API should be abstracted so the backend could
  be swapped if Stage 2 needs it.
- Project-id: hash of normalized origin URL or absolute path (per
  [`tech-stack-decision.md`](./tech-stack-decision.md)).
- Export = `repack --out` (no separate `export` command).
- ADR 0002/0005/0006 are accepted for Stage 1 and can be revisited after Stage 1
  evidence.

## Acceptance criteria

- All eight record types can be created, read, updated (status/supersede), and
  listed via the store API.
- Create requests reject missing minimum fields and never require generated
  fields.
- Created records include generated `id`, resolved `project`, timestamps,
  `revision=1`, and `schema_version`.
- Updates increment `revision`, change `updated_at`, preserve immutable fields,
  and write a history/event entry.
- Project-id is stable for the same remote and distinct for different remotes or
  paths; branch/worktree is not part of the id in Stage 1; the human-readable name
  and current branch snapshot are stored separately where available.
- Required fields are enforced; recommended fields are not rejected.
- `custom` records carry `kind` + freeform `body`.
- SQLite concurrent write conflicts return clear retryable errors after the busy
  timeout.
- No record stores file contents or secrets.

## Risks

- **Storage location regret** (out-of-repo is hard to migrate). Mitigation:
  validate ADR 0002 against real usage before making it permanent beyond Stage 1.
- **Project-id collision** for repos with no remote and identical paths on
  different machines. Acceptable for Stage 1 (single-user, local); revisit at
  Stage 2.
- **Schema evolution** invalidates old records. Mitigation: `schema_version` +
  graceful repack handling.
- **SQLite vs JSON lock-in.** Mitigation: abstracted store API + schema
  versioning.
- **Same-origin worktree confusion.** Multiple worktrees with the same origin share
  memory in Stage 1. Mitigation: store branch refs, use focus tags/tasks, and
  revisit branch-aware spaces only with evidence.
