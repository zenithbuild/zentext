# Context Repacking

Context repacking is how Zentext turns structured project memory into agent-ready
context. It is the core differentiator over a hand-maintained markdown file: rather
than dumping the entire memory store, Zentext selects, prioritizes, and formats the
records that the next agent actually needs.

## Why repacking matters

- **Agents have limited context windows.** Dumping every record wastes tokens and
  dilutes signal.
- **Relevance changes by task.** The context needed to continue an auth task is
  different from the context needed to start a migration.
- **A markdown file is static.** It cannot be queried, prioritized, or scoped to a
  focus. Repacking can.
- **Stale context misleads.** Repacking must avoid serving outdated records as if
  they were current.

## Critical reminder

Zentext does **not** transfer hidden model state. Repacking works only with
external project memory that was written down. It repacks records, not model
internals.

## Default output format

**Structured markdown.** Markdown is well-handled by current coding agents and is
human-inspectable. The default repack output is a markdown document with clear
sections, not a raw JSON dump.

A later stage may support per-agent output customization, but the MVP default is
structured markdown.

## Context priority order

When repacking, records are included in this priority order:

1. **Active task** — the current task and its next step.
2. **Blockers** — active blockers that affect the task.
3. **Decisions** — active architecture/implementation decisions relevant to the
   task.
4. **Current handoff** — the latest handoff record.
5. **Validation state** — recent validation results (what has passed/failed).
6. **Relevant repo references** — file paths, commits, branches (references only,
   never file contents).
7. **Recent safe logs** — sanitized command summaries, recent only.
8. **Older history** — included only if needed and if space allows; summarized,
   not full records.

## What to include

- Active and recently-updated records.
- Records tagged or referenced by the active task.
- Records matching the `--focus` filter when provided.
- Compact summaries over full bodies where possible.
- Repo references (paths, SHAs, branches), not contents.

## What to exclude

- Secrets (never stored, but excluded defensively).
- Full repository file contents.
- Raw unsanitized command output.
- Resolved/superseded records unless explicitly relevant.
- Stale records (see staleness handling below).
- Bloated logs beyond a recent, safe excerpt.
- Hidden model state (impossible to capture; never attempted).

## Avoiding stale or bloated context

- **Staleness detection (MVP):** age-based, status-based, completed-task, and
  manually-marked staleness (see
  [`implementation/staleness-and-audit-spec.md`](./implementation/staleness-and-audit-spec.md)).
  Stale records are either omitted from repacking or included with a clear
  `stale` marker.
- **Reference-based staleness (Stretch, not MVP):** detecting records whose
  `refs` point to code that has since changed, using repo state, is deferred to a
  post-MVP stretch goal; it is not part of Stage 1 repack/audit behavior.
- **Size budget:** The repack respects a size budget (configurable via `max_size`).
  Lower-priority records are dropped or summarized first.
- **Status filtering:** Resolved blockers and superseded decisions are excluded by
  default unless the focus explicitly asks for history.
- **Log pruning:** Only recent, sanitized log excerpts are included; older logs are
  summarized or omitted.

## How this differs from dumping a markdown file

| Aspect | Markdown file (CLAUDE.md, etc.) | Zentext repack |
|--------|----------------------------------|----------------|
| Source | Manually written, manually updated | Structured records written by agents and humans |
| Selection | Static; everything or nothing | Prioritized by task and focus |
| Staleness | Human must notice and fix | Detected and flagged automatically |
| Format | One fixed file | Generated per repack, scoped and sized |
| Queryability | Read the whole file | `memory.query` and `memory.list` for specific answers |
| Authorship | Human only | Agents write via MCP; humans edit via CLI |
| Versioning | Git only (if committed) | Internal versioning + optional git export |

The repack output is generated from the current memory state each time, so it is
always a focused snapshot of what the next agent needs — not a stale, hand-maintained
file that may or may not reflect reality.
