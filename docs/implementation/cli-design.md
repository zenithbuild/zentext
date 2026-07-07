# CLI Design

**Status:** planning only — no code, no CLI scaffold, no package setup.

## Purpose

Lock the Stage 1 CLI command contracts: arguments, flags, output formats, exit
codes, and editor integration. [`cli-reference.md`](../cli-reference.md) is
conceptual; this is the contract Phase 2/6 implement against, including the new
`zentext add` command added for human authoring. No implementation.

## Foundation docs this derives from

- [`cli-reference.md`](../cli-reference.md) — the conceptual command set
- [`stage-1-plan.md`](./stage-1-plan.md) — adds `zentext add`, locks export via `repack --out`
- [`memory-schema.md`](../memory-schema.md) — record types for `add`
- [`repacking-spec.md`](./repacking-spec.md) — `repack` output
- [`staleness-and-audit-spec.md`](./staleness-and-audit-spec.md) — `audit` output

## Stage 1 scope

Nine commands: `init`, `status`, `show`, `list`, `add`, `handoff`, `repack`,
`edit`, `audit`. Local only — no network calls in the Stage 1 CLI.

## Non-goals

- No cloud sync, auth/login, team/workspace, dashboard/TUI, secret management, or
  agent execution commands.
- No separate `zentext export` command (export is `repack --out`).
- No complex interactive UI; `add`/`handoff`/`edit` may use flags and/or an
  editor, kept simple.
- No network calls.

## Command contracts

### zentext init
- **Args/flags:** (none required; optional `--name` to override project name)
- **Behavior:** create the local store for the current project (project-id per
  [`data-model-and-store.md`](./data-model-and-store.md)), write `meta.json`,
  print the store path and next steps. Idempotent (no-op or confirm prompt).
- **Output:** human-readable; store path prominent.

### zentext status
- **Args/flags:** (none)
- **Output:** compact summary — project name, store path, record counts, active
  task, open blockers, latest handoff, decisions count, last-updated timestamps.

### zentext show <id>
- **Args/flags:** `<id>`; optional/stretch `--json`
- **Output:** full record, readable by default; raw JSON with `--json`.

### zentext list
- **Args/flags:** `[--type <type>]` `[--status <status>]` `[--tag <tag>]` `[--limit <n>]` optional/stretch `[--json]`
- **Output:** summarized table (id, type, title, status, updated_at); JSON with
  `--json`.

### zentext add <type> (new in Stage 1)
- **Subcommands:** `add task`, `add decision`, `add blocker`, `add validation`,
  `add policy`, `add custom`.
- **Purpose:** let a human create structured memory without an agent. This is the
  clean correction/authoring path so Zentext is not wholly dependent on agents
  writing good memory.
- **Args/flags:** type-specific flags for required/recommended fields; falls back
  to opening an editor for longer text fields if flags are omitted. Implementation
  details stay planning-level — no complex interactive UI required in the plan.
- **Inputs:** only user/agent-supplied fields (`type`, `title`, optional `status`,
  type-specific content, plus recommended `summary`/`tags`/`refs`). Generated
  fields (`id`, `project`, `created_at`, `updated_at`) are assigned by Zentext on
  create and are not accepted as input.
- **Author:** recorded as `user:<name>`.
- **Output:** the created record's id and a readable summary.
- **Safety:** same secret-rejection heuristics as `memory.write` (see
  [`safety-and-secrets.md`](./safety-and-secrets.md)).
- **Log note:** `add log` is not a primary Stage 1 human command. Logs are mostly
  agent/system-written through `memory.write`; humans can correct logs with
  `edit` or use `custom` for manual notes.

### zentext handoff
- **Args/flags:** flags for `context`, `state`, `next`, `open_questions`,
  `completed_this_session`; opens an editor for longer fields if omitted.
- **Behavior:** create a handoff record and mark it latest.
- **Author:** `user:<name>` (or `agent:*` if invoked by an agent wrapper — out of
  Stage 1 scope).

### zentext repack
- **Args/flags:** `[--focus <topic>]` `[--max-size <chars>]` `[--out <path>]`
- **Behavior:** produce a structured markdown payload via the **shared repack
  engine** (same as `memory.repack`). `--out` writes to a file — this is the
  in-repo export path (`.zentext/context.md`) and the non-MCP fallback artifact.
  JSON snapshot/export output is optional later, not required for Stage 1.
- **Output:** markdown to stdout by default; file with `--out`; warns if the
  exported snapshot is stale relative to the live store.

### zentext edit <id>
- **Args/flags:** `<id>`
- **Behavior:** open the record in an editor for human correction or status
  change. Useful for correcting agent-written records or resolving a blocker.
- **Safety:** re-run secret rejection on save.

### zentext audit
- **Args/flags:** optional/stretch `[--json]`
- **Output:** a report flagging stale/suspicious records and suggesting cleanup
  (see [`staleness-and-audit-spec.md`](./staleness-and-audit-spec.md)).

## Output format rules

- Default: human-readable (tables/sections) for terminal use.
- Optional/stretch `--json`: machine-readable JSON may be added for inspection
  commands (`show`, `list`, `audit`) if cheap, but it is not required for Stage 1
  acceptance and is not the repack/export format.
- No secrets in any output. No full file contents.

## Exit codes

- `0` success.
- `1` invalid args or validation/secret rejection.
- `2` project/store not initialized.
- `3` record not found.
- `4` retryable store-busy/concurrent write conflict.
- `5` store/internal error.

## Decisions and assumptions

- `zentext add` is a Stage 1 command (resolves the human-authoring gap; the
  foundation's `policy`/"human-authored via CLI" needs a path).
- Export = `repack --out`; no separate `export` command.
- `repack` uses the shared repack engine (see [`repacking-spec.md`](./repacking-spec.md)).
- Editor integration: rely on `$EDITOR` (or a sensible default); no bespoke TUI.

## Acceptance criteria

- All nine commands work locally with no network.
- A human can initialize, author (task/decision/blocker/validation/policy/custom),
  inspect, hand off, repack, edit, and audit without an agent.
- `repack --out .zentext/context.md` produces a pasteable/exportable snapshot.
- Structured markdown is the only required repack/export output.
- No secrets appear in any output.

## Doc-level acceptance tests

- `zentext init` creates or finds the cwd-resolved project store, prints the store
  path, and is idempotent.
- `zentext add task` with `title` and `goal` creates a task with generated
  `id`, resolved `project`, timestamps, `revision=1`, and default status `active`.
- `zentext add decision` with `title` and `decision` creates a decision with
  default status `accepted`.
- `zentext add log` is not required for Stage 1.
- `zentext show <id>` prints a full record; `zentext list --type blocker` prints a
  summarized list.
- `zentext repack --out .zentext/context.md` writes a point-in-time markdown
  snapshot and does not create or mutate the live store.
- Optional/stretch `--json` support, if present, must not be required by any Stage
  1 workflow.

## Risks

- **Editor UX friction** for `add`/`handoff`/`edit` on systems without a sane
  `$EDITOR`. Mitigation: flag-based input as the primary path; editor as fallback.
- **`add` flag explosion** across six types. Mitigation: keep required fields
  minimal; use editor for the rest.
- **Output format drift** between `repack` and `memory.repack`. Mitigated by the
  shared engine mandate.
