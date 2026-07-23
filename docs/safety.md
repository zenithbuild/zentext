# Input safety and secret handling

Zentext validates external writes before they reach SQLite and redacts
structured output defensively.

## Rejected input

The shared boundary rejects:

- C0/C1 control characters and null bytes;
- terminal escape sequences;
- unpaired or replacement Unicode from malformed decoding;
- oversized records and RPC lines;
- absolute or traversal-bearing repository file references;
- non-JSON/binary-like structured input;
- unknown fields and invalid schema values;
- likely secrets unless an explicit override is supplied.

Record input is capped at 32,000 serialized bytes. Stored log excerpts are
capped at 8,000 characters. RPC requests are capped at 1,048,576 bytes per
NDJSON line.

## Likely-secret detection

High-signal patterns cover API/access tokens, private-key headers, passwords,
credential assignments, authenticated connection strings, and environment
secret assignments. Detection errors report only finding categories and field
paths, never the matching value.

The detector is heuristic and cannot guarantee that every secret is found.
Users and tools must not place credentials, tokens, `.env` contents, private
keys, recovery codes, or private transcripts in project memory.

## Explicit override

The SDK and RPC accept `allow_secret_override: true` only as an explicit local
false-positive override. The resulting provenance records that the override was
used. Consumers should not set it automatically, and the project-local Codex
skill explicitly forbids secret-bearing writes.

Known raw secrets should be removed, not overridden. Output redaction still
applies after an override.

## Output behavior

SDK, RPC, CLI, and MCP structured views remove likely secret values and terminal
escapes before returning data. RPC standard output remains machine-clean;
diagnostics on standard error contain error codes and request IDs, not submitted
payloads.

This is defense in depth, not a secret-storage feature. Zentext does not encrypt
or manage secrets.
