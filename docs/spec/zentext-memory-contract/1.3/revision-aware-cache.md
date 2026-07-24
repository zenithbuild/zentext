# Revision-aware cache contract

Search schema `3` adds a canonical state descriptor to every
`MemorySearchPage`:

- fingerprint algorithm and value;
- record count;
- active task ID; and
- active task revision.

Implementations may cache the page only after input validation, canonical
record reading, output redaction, and state derivation.

Cache key version `1` contains project identity, state fingerprint, active task
identity/revision, canonicalized query and filters, pagination, search schema,
and retrieval strategy. A semantically relevant input or canonical state
change must produce a different key.

Canonical records must never depend on the cache. A successful write makes
prior-state entries unusable. Failed and no-op writes do not create a new
state. Cached pages must be bounded, process-local, redacted, and defensively
copied. Implementations must not expose a hit or miss as semantic search
content.

The Developer Preview reference implementation uses a 64-entry, 4-MiB
process-local LRU. Persistent or distributed caching would require a later
contract and evidence; it is not implied here.
