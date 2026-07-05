# CLI Reference

The Zentext CLI is the human and fallback interface. It lets a developer inspect,
edit, hand off, and repack project memory without an agent in the loop, and it
serves as the non-MCP fallback for agents without MCP support.

This document is conceptual. It defines commands, purposes, example invocations,
expected behavior, and MVP/future status. It is not final syntax or implementation.

## Design principles

- **Human-readable first.** Output should be readable in a terminal without an
  agent.
- **Fallback for non-MCP agents.** `zentext repack` emits a pasteable payload so
  any agent — even one without MCP — can receive Zentext context.
- **No secrets in output.** The CLI never prints or accepts secrets.
- **Local only (MVP).** No network calls in the MVP CLI.

## Commands

### zentext init

**Purpose:** Initialize a local Zentext memory store for the current project.

**Example invocation:** `zentext init`

**Expected behavior:** Creates a local store for the project, records project
metadata, and prints next steps (how to point an MCP-compatible agent at the
server, how to use the CLI). Idempotent: re-running on an initialized project is a
no-op or a confirm prompt.

**MVP status:** MVP.

---

### zentext status

**Purpose:** Show the current state of the project memory: active task, open
blockers, latest handoff, record counts, and last-updated timestamps.

**Example invocation:** `zentext status`

**Expected behavior:** Prints a compact summary suitable for a quick glance before
switching agents.

**MVP status:** MVP.

---

### zentext show

**Purpose:** Show a single memory record in full, by id.

**Example invocation:** `zentext show rec_01HZ...`

**Expected behavior:** Prints the full record in a readable format.

**MVP status:** MVP.

---

### zentext list

**Purpose:** List memory records, optionally filtered by type.

**Example invocation:** `zentext list --type decision`

**Expected behavior:** Prints a summarized table (id, type, title, status,
updated_at).

**MVP status:** MVP.

---

### zentext handoff

**Purpose:** Create a handoff record from the human side, summarizing the current
session for the next agent or teammate.

**Example invocation:** `zentext handoff`

**Expected behavior:** Opens an editor (or interactive prompt) to capture context,
state, next, open questions, and completed items. Creates a handoff record and marks
it as the latest.

**MVP status:** MVP.

---

### zentext repack

**Purpose:** Generate a focused, agent-ready context payload from current project
memory and print it to stdout (or write to a file with `--out`).

**Example invocation:** `zentext repack --focus auth --out .zentext/context.md`

**Expected behavior:** Produces a structured markdown payload (see
[`context-repacking.md`](./context-repacking.md)) following the default priority
order. This is the non-MCP fallback: paste the output into any agent's prompt.

**MVP status:** MVP.

---

### zentext edit

**Purpose:** Edit an existing record (human-authored correction, status change,
resolution).

**Example invocation:** `zentext edit rec_01HZ...`

**Expected behavior:** Opens the record in an editor for manual editing. Useful for
correcting agent-written records or resolving a blocker from the human side.

**MVP status:** MVP.

---

### zentext audit

**Purpose:** Audit the memory store for staleness, inconsistencies, and potential
issues (e.g., records referencing code that has since changed, unresolved blockers
older than a threshold, records that look like they may contain secrets).

**Example invocation:** `zentext audit`

**Expected behavior:** Prints a report flagging stale or suspicious records and
suggests cleanup actions.

**MVP status:** MVP.

## Non-MCP fallback

For agents that do not support MCP (or where MCP integration is unreliable),
`zentext repack` is the bridge:

1. Run `zentext repack` (optionally with `--focus` and `--out`).
2. The command emits a structured markdown context payload.
3. Paste the payload into the agent's prompt, or reference the output file if the
   agent can read files.

This ensures Zentext works with any agent, not only MCP-compatible ones, without
requiring per-agent integrations.

## Out of scope for the MVP CLI

- No cloud sync commands.
- No auth/login commands.
- No team/workspace management commands.
- No dashboard or TUI.
- No secret management commands.
- No agent execution commands.
