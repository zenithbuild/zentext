# Zentext memory contract 1.1

Status: additive Developer Preview product contract.

Contract 1.1 incorporates all of
[contract 1.0](../1.0/README.md) and adds deterministic lexical project-memory
search. Stored record schema version `1`, continuation schema version `1`, and
NDJSON RPC protocol `1.0` remain unchanged.

| Layer | Version |
|---|---:|
| Stored record schema | `1` |
| Continuation view schema | `1` |
| MemoryStore interface | `1.1` |
| Memory search schema | `1` |
| NDJSON RPC protocol | `1.0` |
| NDJSON RPC response schema | `1` |
| Environment formatter contract | `1.0` |

See [deterministic search](./deterministic-search.md) for the additive
capability.

This is a Zentext product contract, not a universal standard. It adds no cloud,
semantic retrieval, graph storage, vector storage, or model dependency.
