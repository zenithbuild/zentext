# Zentext memory contract 1.3

Status: additive Developer Preview product contract.

Contract 1.3 incorporates all of
[contract 1.2](../1.2/README.md) and adds revision-aware caching for derived
project-memory search pages. Stored record schema version `1`, continuation
schema version `1`, retrieval strategy, and NDJSON RPC protocol `1.0` remain
unchanged.

| Layer | Version |
|---|---:|
| Stored record schema | `1` |
| Continuation view schema | `1` |
| MemoryStore interface | `1.3` |
| Memory search schema | `3` |
| Search cache key | `1` |
| NDJSON RPC protocol | `1.0` |
| NDJSON RPC response schema | `1` |
| Environment formatter contract | `1.0` |

See [revision-aware cache](./revision-aware-cache.md) for the additive
contract.

This is a Zentext product contract, not a universal standard. It adds no
persistent cache, cloud service, distributed coordination, semantic retrieval,
graph storage, vector storage, or model dependency.
