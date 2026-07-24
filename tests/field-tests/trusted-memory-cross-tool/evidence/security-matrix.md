# Security and failure matrix

| Boundary | Result |
|---|---|
| Malformed RPC JSON and unknown methods | typed rejection |
| Multiple and partially chunked NDJSON requests | correctly framed |
| Oversized RPC and record payloads | `PAYLOAD_TOO_LARGE` |
| Nulls, control characters, terminal escapes | `UNSAFE_INPUT` |
| Malformed Unicode and binary-like input | rejected |
| Absolute paths and path traversal | rejected |
| Missing fields, invalid enums, invalid provenance | schema rejection |
| Secret-bearing write | `SECRET_DETECTED`, value absent from error |
| Explicit secret override | recorded as override; every returned view redacted |
| Vague or contradictory handoff | actionable quality warnings |
| Stale revision and project mismatch | typed rejection |
| Duplicate/concurrent write | one success, one `REVISION_CONFLICT` |
| Failed/interrupted write | canonical state remains readable and unchanged |
| Concurrent independent RPC opens | 32 source-built and 16 packed, zero failures |
| Stdout purity / stderr diagnostics | valid NDJSON only on stdout |
| Native and fallback SQLite | validated on Node 22 and Node 24 |

## Dependency advisory

`npm audit` reports two moderate entries for
`GHSA-frvp-7c67-39w9`, an encoded-backslash static-file traversal on Windows
in `@hono/node-server`, transitively installed by
`@modelcontextprotocol/sdk`.

Zentext's MCP binary uses local stdio transport and does not import or start
Hono's HTTP static-file server, so the vulnerable serving path is not
reachable in the shipped Zentext execution surface. The dependency remains
present and the audit remains non-zero. The available npm remediation proposes
a breaking SDK change; this batch does not downgrade or replace the SDK merely
to silence the audit.
