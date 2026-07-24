# Zentext memory contract 1.0

Status: product contract for the Developer Preview.

This contract defines how Zentext represents, validates, reads, writes, and
presents local project memory. It covers the current implementation; it does
not define cloud synchronization or claim universal standard status.

## Contract layers

1. [Canonical records and safety](./records-and-safety.md)
2. [Continuation, revisions, and stale state](./continuation-and-revisions.md)
3. [MemoryStore, SDK, RPC, and MCP](./interfaces.md)
4. [Formatters, exports, and portability](./formatters-and-portability.md)

## Current version identifiers

| Layer | Version |
|---|---:|
| Stored record schema | `1` |
| Continuation view schema | `1` |
| MemoryStore interface | `1.0` |
| NDJSON RPC protocol | `1.0` |
| NDJSON RPC response schema | `1` |
| Environment formatter contract | `1.0` |

These identifiers are not interchangeable. A consumer must inspect the version
for the layer it consumes.

## Permanent boundary

Zentext transfers explicit external project memory. It never transfers hidden
model state, private reasoning, provider session history, a model's context
window, or live execution state.

## Conformance

A conforming implementation or adapter must:

- preserve project, record, task, handoff, and revision identity;
- validate externally supplied input before persistence;
- enforce current revision for conditional writes;
- reject stale handoffs as current continuation;
- preserve provenance and record history;
- redact likely secrets from returned views;
- keep machine-readable stdout free of decorative prose;
- disclose its supported protocol/schema versions; and
- never create a provider-specific canonical memory system.

Presentation-only consumers may implement a subset, but must identify the
capabilities they do and do not support.

## Out of scope

Contract 1.0 does not specify cloud accounts, synchronization, encryption
protocols, billing, hosted databases, teams, source upload, graph/vector
retrieval, orchestration, concurrency, or a GUI.
