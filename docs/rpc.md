# Structured stdio RPC

`zentext rpc` exposes the stable memory interface as newline-delimited JSON
(NDJSON). It is intended for local tools and harnesses that should not scrape
terminal output.

Protocol version: `1.0`
Schema version: `1`
Maximum request line: `1,048,576` bytes

Standard output contains response JSON only. Diagnostics go to standard error.

## Request and response

Request:

```json
{"protocol_version":"1.0","id":"open-1","method":"project.open","params":{"cwd":"/project"}}
```

Success:

```json
{"protocol_version":"1.0","schema_version":1,"id":"open-1","ok":true,"result":{"project_id":"0123456789abcdef","project_name":"owner/project","store_schema_version":1}}
```

Failure:

```json
{"protocol_version":"1.0","schema_version":1,"id":"read-1","ok":false,"error":{"code":"STALE_STATE","message":"The current handoff is stale."}}
```

The path above is illustrative. Do not persist or publish personal absolute
paths in evidence.

## Methods

| Method | Kind | Purpose |
|---|---|---|
| `capabilities.get` | read | Discover protocol, schema, methods, limits, and safety behavior. |
| `project.open` | read | Resolve a project from `cwd`; optionally verify a supplied ID. |
| `continuation.get` | read | Return the validated canonical continuation. |
| `task.active` | read | Return the current actionable task. |
| `handoff.validate` | read | Validate the latest or a specified handoff. |
| `progress.record` | write | Record structured progress and create a new current handoff. |
| `task.update` | write | Update a task with optimistic revision checking. |
| `memory.query` | read | Deterministic structured-record search. |
| `memory.search` | read | Bounded canonical lexical search with match metadata. |

All methods after `project.open` require both `cwd` and the discovered
`project_id`. A mismatch returns `PROJECT_IDENTITY_MISMATCH`.

## Example continuation read

```json
{"protocol_version":"1.0","id":"continue-1","method":"continuation.get","params":{"cwd":"/project","project_id":"0123456789abcdef"}}
```

The result is the same semantic object returned by `zentext continue --json`,
the SDK's `getContinuation`, and MCP `memory.continuation`.

`memory.search` is additive to RPC 1.0. Its `input` object uses the contract in
[`memory-search.md`](./memory-search.md); CLI, SDK, RPC, and MCP return the same
`MemorySearchPage`.

## Safety

RPC rejects malformed JSON, unknown fields, oversized input, control
characters, terminal escapes, malformed Unicode, unsafe file paths, likely
binary input, stale revisions, and identity mismatches. Likely secrets are
rejected before persistence. Outputs are redacted defensively.

Requests are processed sequentially in input order. Each request is independent;
callers must supply the current revision for writes. RPC provides no agent
orchestration, leases, concurrency protocol, authentication, or network
transport.
