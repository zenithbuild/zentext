# Revision-aware search cache

Zentext caches only derived, redacted project-memory search pages. SQLite
records remain canonical, and every search validates input and reads current
record envelopes before cache lookup.

## Key contract

Cache key version `1` includes:

- project ID;
- canonical state fingerprint;
- active task ID and task revision;
- normalized query;
- sorted record-type and status filters;
- task scope and record-revision bounds;
- supersession and freshness modes;
- limit and offset;
- memory-search schema version; and
- retrieval strategy.

There is no interface or formatter dimension because CLI, SDK, RPC, and MCP
consume the same semantic page.

The state fingerprint uses `sha256-envelope-v1` over an ID-sorted projection of
record identity, type, status, revision, update timestamp, stored schema,
supersession, and provenance task revision. This covers every canonical domain
write without hashing record text or file contents. The active task revision is
also explicit in the key and returned search snapshot.

## Invalidation and concurrency

Every read recomputes canonical state from SQLite. A changed fingerprint cannot
hit an older key. When a new state is observed, older entries for that project
are physically evicted.

Successful writes therefore invalidate logically on the next read, including
writes through another store instance. Failed, stale-revision, and no-op writes
do not change canonical state and preserve a valid warm entry.

A page describes the synchronous SQLite snapshot identified by its returned
state fingerprint. This is local snapshot semantics, not a lock, lease,
distributed cache, or coordination system.

## Lifetime and bounds

- in-process only; a new process starts empty;
- shared by store instances in that process;
- least-recently-used eviction;
- at most 64 pages;
- at most 4 MiB of serialized redacted pages;
- diagnostics retained for at most 128 recently observed projects;
- an individual page larger than the byte budget is not cached; and
- cache hits return defensive copies.

`project.getSearchCacheStats()` exposes hits, misses, stores, evictions,
oversized skips, current entries/bytes, and configured bounds for diagnostics.
Hit/miss state never appears in `MemorySearchPage`, so cached and uncached
semantic results remain equal.

Zentext does not persist the cache, add a SQLite cache table, use Redis, call a
network service, or make canonical reads depend on cached state.
