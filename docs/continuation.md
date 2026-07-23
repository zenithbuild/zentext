# Zentext continuation guide

Last verified: 2026-07-22

This document is the durable starting point for continuing Zentext from a new
machine. It describes the implemented repository and published package, not the
older planning-only state retained in some design documents for historical
context.

## Permanent product boundary

Zentext is a local-first external project-memory and continuation system. It
stores and repacks explicit project state such as tasks, handoffs, completed
work, stopping points, next actions, decisions, validation results, revisions,
and stale-state information.

Zentext cannot capture or transfer hidden model state, private provider memory,
or an agent's unrecorded reasoning. A receiving tool only gets the records and
repacked context that Zentext explicitly persists or exports.

## Current package and release state

- Package: public, unscoped npm package `zentext`
- Canonical published Developer Preview: `0.1.0-dev.2`
- npm dist-tags: both `latest` and `next` resolve to `0.1.0-dev.2`
- Repository package version on the Developer Preview branch: `0.1.0-dev.2`
- License: MIT
- Binaries: `zentext` and `zentext-mcp`
- Publish configuration: npm tag `next`

The published versions are `0.1.0-dev.0`, `0.1.0-dev.1`, and
`0.1.0-dev.2`. The first two are historical previews; new validation and
continuation work must use `0.1.0-dev.2` or a later version. The original
pre-publish reports remain useful point-in-time evidence, but their readiness
language is not the current registry status.

Verify registry state without changing it:

```bash
npm view zentext versions --json
npm view zentext dist-tags --json
npm view zentext@latest version
npm view zentext@next version
```

Do not publish or change dist-tags as part of ordinary development validation.
See [the recovery runbook](./recovery-runbook.md) for the release procedure and
access prerequisites.

## Supported runtimes

`package.json` is authoritative for supported Node.js versions:

- Supported: Node.js `>=22.13 <25` (Node 22.13+ and Node 24.x)
- Experimentally tolerated: Node 26.x; it has worked in local fallback testing
  but emits `EBADENGINE` and is not a release acceptance runtime
- Unsupported for this Developer Preview: Node 20 and earlier

The supported matrix validates both the preferred `better-sqlite3` path and the
built-in `node:sqlite` fallback. The fallback requires Node 22.13 or newer.

## Implemented architecture

### Project identity and local storage

Zentext derives a stable 16-character project ID from the normalized Git
`origin` URL. HTTPS and SSH forms of the same remote normalize to the same ID.
When no Git origin exists, the ID is derived from the absolute project path.
Branches and worktrees do not alter the ID.

Live stores are outside the repository:

```text
~/.zentext/projects/<project-id>/store.sqlite
~/.zentext/projects/<project-id>/exports/
```

The SQLite store enables WAL mode, applies versioned migrations on open, keeps
canonical records and revision history, and uses transactions for atomic
writes. Store files are private user data: never commit them to the repository.

### SQLite adapters

The runtime prefers `better-sqlite3`. If its native binding cannot load because
install scripts were blocked or a compatible prebuild is unavailable, supported
Node releases fall back to the built-in `node:sqlite` adapter. Both adapters
implement the same synchronous store contract and nested transactions through
savepoints.

### Domain and revision behavior

The transactional memory writer is the canonical mutation layer for record
creation, updates, supersession, archiving, and handoffs. It preserves project
and record identity, contiguous revisions, history, optimistic concurrency, and
rollback behavior.

Handoffs record a task revision. Updating the task advances that revision, so an
older handoff becomes stale. `handoff validate` and `handoff acknowledge` reject
stale handoffs instead of silently presenting them as current.

### CLI surface

The Developer Preview exposes:

- project/store: `init`, `status`
- record inspection: `show`, `list`
- deterministic context: `repack`
- tasks: `task create`, `task show`, `task update`
- handoffs: `handoff create`, `handoff show`, `handoff validate`,
  `handoff acknowledge`, `handoff export`
- validated continuation: `continue` with human, JSON, Markdown, and canonical
  tool-neutral prompt output

Task and handoff mutations flow through the transactional writer. General
record-authoring commands such as `zentext add` and `zentext edit` are not part
of this preview.

### MCP surface

`zentext-mcp` is a stdio MCP server exposing four read-only tools:

- `memory.read`
- `memory.list`
- `memory.query`
- `memory.repack`

MCP mutation tools are not implemented. The public CLI is the supported write
surface for tasks and handoffs in this preview.

### Repacking and proof artifacts

The repack engine deterministically selects and renders relevant structured
records into continuation context. Field-test runners and their captured
results prove behavior across tools and providers, but they are not part of the
published runtime package.

## Install, build, test, and pack

From a fresh clone on a supported Node release:

```bash
npm ci
npm run typecheck
npm run typecheck:test
npm test
npm run build
npm pack --dry-run
npm pack
```

The generated tarball must then be installed into a separate temporary consumer
directory. Verify the CLI workflow, stale-handoff rejection, MCP startup and
tool listing, package contents, and both SQLite adapters as described in
[the portability audit](./portability-audit.md).

## Known limitations

- No hidden model state or provider memory transfer
- No MCP write tools or general-purpose write CLI
- No cloud sync, accounts, auth, UI, vector retrieval, or concurrent-agent
  coordination
- Node 26 is experimental; Node 20 is unsupported
- A project without a Git origin uses a path-derived ID, so moving it to a
  different absolute path does not automatically discover the old store
- Repeatable task notes and handoff completed work, blockers, changed files,
  and verification values are stored as ordered arrays
- Provider/model field tests may expose response-format or availability
  failures unrelated to the deterministic local store

## Key architecture decisions

- TypeScript/Node runtime and SQLite local store
- Live memory stored outside the repository
- Stable project identity from normalized Git origin where available
- Opinionated structured record types with revision history
- Deterministic repacking as the non-MCP fallback
- Thin read-only MCP adapter over the same canonical store
- One transactional domain writer for mutations
- Explicit local-first boundary; cloud and synchronization are not required

The detailed reasoning is retained in `docs/decision-records/`,
`docs/open-decisions.md`, and `docs/implementation/`. Those files may describe
the stage when a decision was proposed; this guide records the current result.

## Sources of truth and artifact ownership

Canonical repository artifacts:

- `package.json` and `package-lock.json` for package/runtime state
- `src/` for implemented behavior
- `tests/` for executable acceptance coverage
- `README.md` and this guide for current public and maintainer state
- `LICENSE` for licensing
- GitHub issues and PRs for the active roadmap and review history

Canonical external state:

- npm registry metadata for what is actually published
- each user's SQLite store for that user's live project memory

Historical or regenerable artifacts:

- `RELEASE_REPORT.md`, `ZENTEXT_DEV_2_FIX_REPORT.md`, and field-test outputs are
  point-in-time evidence
- `dist/`, `node_modules/`, and `*.tgz` are regenerated and must not be committed
- local SQLite databases are not regenerable from source; back them up securely
  if their project memory must be preserved

## Current roadmap position

The active milestone is **M1: Cross-Platform Text Proof**:

1. #26 — preserve repeated CLI option values
2. #22 — run the official isolated cross-platform field test
3. #23 — provide one validated `zentext continue` entry point
4. #24 — export the same state as JSON, Markdown, and prompt text
5. #25 — keep one canonical tool-neutral continuation template

After this batch, the next ordered issue is
[#27 — Define formal input schemas](https://github.com/zenithbuild/zentext/issues/27).
