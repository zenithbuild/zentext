# Zentext MCP Server

The Stage 1 MCP adapter exposes Zentext’s already-proven local memory system to
MCP-compatible agents. It is a thin read-only wrapper around the SQLite store
and the shared repack engine.

## What it exposes

Exactly five read-only tools:

| Tool | Purpose |
|------|---------|
| `memory.continuation` | Return the same validated continuation object used by CLI JSON, SDK, and RPC. |
| `memory.read` | Read one canonical record by ID, optionally with revision history. |
| `memory.list` | List records for a project, filtered by type/status/limit. |
| `memory.query` | Deterministic substring search across title, summary, and tags. |
| `memory.repack` | Return the current-context markdown payload from the shared engine. |

No mutation tools are exposed in Stage 1.

## How to start it

```bash
zentext-mcp
```

The server speaks MCP over stdio. It writes no normal logs to stdout; diagnostics
go to stderr.

## Example MCP client configuration

```json
{
  "mcpServers": {
    "zentext": {
      "command": "zentext-mcp",
      "args": [],
      "env": {}
    }
  }
}
```

## Required `project_id`

Every tool requires a `project_id`. The server does not infer a project from
cwd and does not guess among projects. Unknown project IDs return a structured
`Project not found.` error without exposing filesystem paths or SQL details.

## Read-only guarantee

All tools are annotated with `readOnlyHint: true`. They do not create, edit,
archive, supersede, or otherwise mutate canonical records or revision history.
Tests verify that record counts, revision counts, statuses, payloads, and
supersession state are unchanged after each tool call.

## `memory.query` vs `memory.repack`

- `memory.query` is a deterministic structured text search. It searches the
  `title`, `summary`, and `tags` fields with a case-insensitive substring
  match. It returns the matching records; it does not rank or summarize them.
- `memory.repack` is the curated current-context payload. It uses the shared
  repack engine to prioritize primary tasks, blockers, decisions, handoffs,
  validations, policies, and other active work, and applies a character budget.

## History ordering

`memory.read` with `include_history` returns the current record under `record`
and a `history` array ordered from oldest revision to newest revision
(`revision` ascending). The current record reflects the newest revision; the
history array ends with the same revision so callers can see how the record
arrived at its current state.

## Installation note

`zentext-mcp` depends on `better-sqlite3`, which includes a native SQLite
binding. On npm 12+ the binding is built by an install script that is blocked
by default. After installing the package, approve and rebuild the dependency:

```bash
npm install-scripts approve better-sqlite3
npm rebuild better-sqlite3
```

On supported Node 22.13+ and Node 24 runtimes, Zentext can instead use the
built-in `node:sqlite` fallback when install scripts are blocked.

## Current limitations

- No write tools (`memory.add`, `memory.edit`, `memory.handoff`, etc.).
- No model calls, semantic search, embeddings, or fuzzy matching.
- No network, cloud, sync, auth, or multi-user features.
- No HTTP/SSE/WebSocket transport; stdio only.
- `memory.query` searches only `title`, `summary`, and `tags`.

Machine-readable writes are available through the TypeScript SDK and structured
stdio RPC. MCP remains intentionally read-only; future MCP write tools must
reuse the same validated memory interface rather than writing directly to
SQLite.
