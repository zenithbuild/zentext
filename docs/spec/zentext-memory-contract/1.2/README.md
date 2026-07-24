# Zentext memory contract 1.2

Status: additive Developer Preview product contract.

Contract 1.2 incorporates all of
[contract 1.1](../1.1/README.md) and adds deterministic relevance and
freshness semantics to lexical project-memory search. Stored record schema
version `1`, continuation schema version `1`, and NDJSON RPC protocol `1.0`
remain unchanged.

| Layer | Version |
|---|---:|
| Stored record schema | `1` |
| Continuation view schema | `1` |
| MemoryStore interface | `1.2` |
| Memory search schema | `2` |
| NDJSON RPC protocol | `1.0` |
| NDJSON RPC response schema | `1` |
| Environment formatter contract | `1.0` |

See [relevance and freshness](./relevance-and-freshness.md) for the additive
search semantics.

This is a Zentext product contract, not a universal standard. It adds no cloud,
semantic retrieval, graph storage, vector storage, model dependency, or
provider-specific memory.
