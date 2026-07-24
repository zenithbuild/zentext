# Deterministic project-memory search

Zentext search is a local lexical read over canonical, redacted project
records. It does not call a model, create an embedding, traverse a graph, read
source files, or depend on a network service.

Search schema version: `1`

Strategy: `lexical-updated-v1`

## CLI

```sh
zentext search "CSS determinism"
zentext search "CSS determinism" --json
zentext search "CSS determinism" --type task --status active
zentext search "CSS determinism" --limit 20 --offset 20
zentext search "CSS determinism" --include-superseded
```

Human output and JSON use the same `MemorySearchPage`. Machine consumers should
prefer the SDK, RPC, or read-only MCP tool rather than parse human output.

## TypeScript

```ts
import { openProject } from "zentext";

const project = await openProject({ cwd: process.cwd() });
try {
  const page = await project.searchMemory({
    query: "CSS determinism",
    record_types: ["task", "decision", "validation"],
    limit: 20,
  });
  console.log(page.results);
} finally {
  project.close();
}
```

The top-level `searchMemory(project, input)` helper exposes the same behavior.

## RPC

`memory.search` is an additive RPC 1.0 method:

```json
{"protocol_version":"1.0","id":"search-1","method":"memory.search","params":{"cwd":"/project","project_id":"0123456789abcdef","input":{"query":"CSS determinism","limit":20}}}
```

MCP exposes the same operation as the read-only `memory.search` tool. The
existing `memory.query` compatibility method is unchanged.

## Input contract

| Field | Meaning |
|---|---|
| `query` | Required, non-whitespace lexical text; maximum 512 characters. |
| `record_types` | Optional set of canonical record types. |
| `statuses` | Optional statuses valid for at least one selected type. |
| `task_id` | Optional exact task scope using task identity or provenance. |
| `min_revision`, `max_revision` | Optional inclusive record-revision bounds. |
| `include_superseded` | Include records with `superseded_by`; default false. |
| `limit` | Page size, default 20 and maximum 100. |
| `offset` | Stable-result offset, default 0 and maximum 10,000. |

Offset pagination describes one canonical read. A concurrent write between page
requests can change later offsets; callers that need a stable multi-page
snapshot must detect a project/task revision change and restart.

## Searchable fields

Search covers redacted canonical text from:

- record ID, title, summary, and tags;
- task goals, steps, notes, next actions, and related records;
- decisions and rationale;
- blockers and workarounds;
- handoff context, state, completed work, questions, and next action;
- validation checks and summaries;
- safe log summaries;
- policies and custom structured text;
- referenced files, commits, and branches; and
- provenance file and verification evidence.

The query is normalized with Unicode NFKC, lowercasing, whitespace trimming,
and whitespace collapse. A result matches when one field equals the query, one
field contains the complete query phrase, or every query token appears across
the searchable fields. There is no stemming, fuzzy matching, or synonym
expansion.

## Result contract

Every page contains:

- project identity and search schema version;
- normalized query and unique tokens;
- explicit filters and pagination metadata;
- deterministic strategy identifier;
- canonical record ID, type, status, revision, timestamps, refs, and redacted
  provenance; and
- match kind, matching fields, terms, and a redacted excerpt capped at 240
  characters.

Issue #36 deliberately orders matches by:

```text
updated_at descending
then canonical record ID ascending
```

This is deterministic recency ordering, not relevance ranking. Issue #37
defines the explainable relevance and freshness tuple.

## Safety and isolation

- Input passes the shared schema, sanitization, and likely-secret detector.
- Search is built from redacted records; it never indexes a raw secret-bearing
  output view.
- Results are project-scoped and expose no raw SQL or arbitrary predicate.
- Search never reads a referenced file.
- Both SQLite bindings call the same in-process domain engine.
- The operation is read-only and does not change canonical records or history.

The current implementation performs a bounded in-process scan. That is an
intentional correctness baseline. Add an index only after measured workloads
demonstrate a need and parity tests can preserve the exact contract.
