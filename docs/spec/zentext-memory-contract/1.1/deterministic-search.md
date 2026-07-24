# Deterministic search contract

`MemoryStore.searchMemory`, the top-level SDK helper, CLI search command, RPC
`memory.search`, and MCP `memory.search` consume one schema-versioned lexical
search operation.

## Conformance requirements

A conforming implementation must:

- require a non-empty bounded query;
- validate every filter before reading records;
- search only the resolved project;
- search redacted canonical text rather than raw secret-bearing output;
- cover tasks, handoffs, decisions, blockers, validations, notes, refs, and
  provenance evidence;
- return bounded redacted excerpts and canonical record identity;
- preserve deterministic ordering and pagination metadata;
- return typed input and safety errors;
- make no canonical mutation; and
- produce semantically equal pages across every exposed interface and SQLite
  binding.

Search schema `1` uses the strategy `lexical-updated-v1`:

1. normalize the query with NFKC, lowercasing, trimming, and whitespace
   collapse;
2. match exact field text, a complete phrase substring, or all lexical tokens
   across fields;
3. filter by explicit record, status, task, revision, and supersession
   constraints; and
4. order by `updated_at` descending, then canonical record ID ascending.

The ordering is not a relevance score. Contract 1.1 reserves relevance and
freshness semantics for a later additive strategy.

The implementation may replace the full scan with an index only if executable
parity tests prove identical matching, redaction, ordering, pagination, and
errors.
