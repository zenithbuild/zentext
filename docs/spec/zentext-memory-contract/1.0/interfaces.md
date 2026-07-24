# MemoryStore, SDK, RPC, and MCP

All interfaces must reuse the same validated domain behavior. An adapter may
not bypass input schemas, sanitization, secret handling, provenance, stale
checks, or atomic revision enforcement.

## MemoryStore 1.0

The storage-independent contract supports:

- opening project identity;
- reading the active task;
- reading the current handoff;
- building the current continuation;
- validating a handoff;
- recording progress atomically;
- updating a task conditionally; and
- deterministic project-memory queries.

SQLite is the canonical 1.0 adapter. A future adapter must demonstrate
behavioral parity before it can replace or coexist with it.

## TypeScript SDK

The package root exposes typed equivalents for:

- `openProject`;
- `getContinuation`;
- `getActiveTask`;
- `validateHandoff`;
- `recordProgress`;
- `updateTask`; and
- `queryMemory`.

The SDK returns typed domain results and errors. It does not require terminal
text parsing and does not expose a validation bypass.

## NDJSON RPC 1.0

`zentext rpc` accepts one newline-delimited JSON request per frame and emits one
JSON response per request. Standard output contains protocol responses only;
diagnostics use standard error.

Methods:

- `capabilities.get`;
- `project.open`;
- `continuation.get`;
- `task.active`;
- `handoff.validate`;
- `progress.record`;
- `task.update`; and
- `memory.query`.

Responses disclose `protocol_version: "1.0"` and `schema_version: 1`.
Malformed, oversized, unsafe, secret-bearing, stale, revision-conflicting, and
identity-mismatched requests receive typed errors.

Multiple framed requests may be processed by one stdio process. Independent
processes still share SQLite revision and locking semantics.

## MCP boundary

The shipped MCP server uses local stdio and remains read-only. It exposes:

- `memory.continuation`;
- `memory.read`;
- `memory.list`;
- `memory.query`; and
- `memory.repack`.

MCP returns the same redacted canonical read state. MCP write tools are not part
of contract 1.0; machine-readable writes use the SDK or RPC.

## CLI boundary

CLI commands are human and fallback surfaces. Machine consumers should prefer
SDK, RPC, or MCP rather than scrape terminal prose. CLI JSON and exports remain
views over the same canonical continuation.

## Capability discovery

A caller should inspect SDK/package types or `capabilities.get` instead of
assuming every implementation supports writes, MCP, formatting, or future
retrieval features.

## Implementation references

- `src/memory-interface.ts`
- `src/sdk.ts`
- `src/rpc/protocol.ts`
- `src/rpc/server.ts`
- `src/mcp/server.ts`
- `tests/memory-interface.test.ts`
- `tests/rpc.test.ts`
- `tests/mcp.test.ts`
- `tests/npm-pack.test.ts`
