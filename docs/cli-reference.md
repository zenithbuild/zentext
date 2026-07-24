# CLI reference

The Zentext CLI is the implemented human and non-MCP interface for local project
memory. Commands operate on the current project's store under
`~/.zentext/projects/<project-id>/store.sqlite`; they do not call a cloud
service.

## Project and record inspection

```sh
zentext init
zentext status
zentext show <record-id>
zentext list [--type <type>] [--status <status>] [--limit <number>]
```

`init` is idempotent. `status`, `show`, and `list` are read-only.

## Project-memory search

```sh
zentext search "CSS determinism"
zentext search "CSS determinism" --json
zentext search "CSS determinism" --type task --status active
zentext search "CSS determinism" --limit 20 --offset 20
zentext search "CSS determinism" --include-superseded
```

Search is a bounded deterministic lexical read over redacted canonical
records. JSON output is one machine-clean `MemorySearchPage`; human output
shows the same records and match reasons. See
[`memory-search.md`](./memory-search.md).

## Task workflow

```sh
zentext task create --title <text> [--goal <text>] [--summary <text>]
  [--status active|blocked|done|canceled]
zentext task show
zentext task update [--title <text>] [--summary <text>] [--status <status>]
  [--note <text> ...] [--next-action <text>]
```

`--note` is repeatable. Values remain separate and retain invocation order;
commas inside one value are not separators.

## Handoff workflow

```sh
zentext handoff create --from <agent> --stopping-point <text>
  --next-action <text> [--completed <text> ...] [--blockers <text> ...]
  [--files-changed <path> ...] [--verification <text> ...]
  [--previous-response <text>]
zentext handoff show [--json]
zentext handoff validate [--json]
zentext handoff acknowledge [--json]
zentext handoff export --format <json|markdown|prompt>
```

`--completed`, `--blockers`, `--files-changed`, and `--verification` are
repeatable and ordered. Handoff validation compares the recorded task revision
with the live task revision. Stale handoffs return exit code 4.

`handoff export` writes one validated portable representation to standard
output. JSON preserves arrays and validation metadata; Markdown is copyable
human-readable state; prompt is a directly usable tool-neutral instruction.
Exports use the same continuation view as `zentext continue` and reject stale
state rather than exporting it as current.

## Validated continuation

```sh
zentext continue
zentext continue --json
zentext continue --markdown
zentext continue --prompt
zentext continue --for generic
zentext continue --for codex
zentext continue --for claude-code
zentext continue --for ollama-host
```

`continue` resolves the project, active or blocked task, and current handoff,
then validates project identity, task identity, and task revision. It is
read-only and never acknowledges a handoff merely because it was displayed.

All four modes render the same canonical continuation view:

- default: readable terminal text;
- `--json`: JSON-only standard output with ordered arrays and validation state;
- `--markdown`: portable Markdown;
- `--prompt`: provider-neutral instruction plus the portable state.

Prompt instructions come from one canonical template documented in
[`continuation-prompt.md`](./continuation-prompt.md). CLI and handoff export do
not maintain separate provider instructions.

`--for <environment>` applies a versioned presentation wrapper to that same
validated state. Supported canonical identifiers are `generic`, `codex`,
`claude-code`, and `ollama-host`; `claude` and `ollama` are aliases for the
last two. `--compact` shortens the wrapper and `--include-instructions` adds
the full tool-neutral continuation contract. These options cannot be combined
with `--json`, `--markdown`, or `--prompt`.

Formatters preserve the complete canonical state and do not create
environment-specific memory. See
[`environment-formatters.md`](./environment-formatters.md).

The standard modes are mutually exclusive. Unknown options fail with exit code 1. A
missing store returns exit code 2, missing actionable task or handoff returns 3,
stale state returns 4, and malformed canonical state returns 5.

## Context repacking

```sh
zentext repack [--focus <text>] [--max-size <characters>] [--out <path>]
```

Repacking produces deterministic Markdown from selected project records. Use
`--out` to write it to a file; otherwise it is printed to standard output.

## Structured stdio

```sh
zentext rpc
```

`rpc` reads versioned NDJSON requests from standard input and writes response
JSON only to standard output. Diagnostics go to standard error. It exposes the
same validated memory interface as the TypeScript SDK, including continuation
reads, progress recording, task updates, handoff validation, capability
discovery, compatibility queries, and canonical deterministic search. See
[`rpc.md`](./rpc.md).

## Current boundaries

The Developer Preview does not implement general `add`, `edit`, or `audit`
commands, MCP mutations, cloud sync, authentication, orchestration, semantic
retrieval, or hidden model-state transfer. Environment adapters are
presentation-only. Zentext carries explicit external project records only.
