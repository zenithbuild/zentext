# Deterministic project-memory search

Zentext search is a local lexical read over canonical, redacted project
records. It does not call a model, create an embedding, traverse a graph, read
source files, or depend on a network service.

Search schema version: `3`

Strategy: `lexical-relevance-freshness-v2`

## CLI

```sh
zentext search "CSS determinism"
zentext search "CSS determinism" --json
zentext search "CSS determinism" --type task --status active
zentext search "CSS determinism" --freshness current-only
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
| `include_superseded` | Include records replaced by another record or explicitly marked superseded; default false. |
| `freshness_mode` | `prefer-current` (default), `current-only`, or `historical-only`. |
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
- the canonical state fingerprint, record count, and active task
  identity/revision for the SQLite snapshot;
- normalized query and unique tokens;
- explicit filters and pagination metadata;
- deterministic strategy identifier;
- canonical record ID, type, status, revision, timestamps, refs, and redacted
  provenance;
- match kind, matching fields, terms, and a redacted excerpt capped at 240
  characters; and
- an explainable freshness classification, ranking tuple, named ranking
  components, and stable reason codes.

## Freshness semantics

Freshness is canonical state evidence, not wall-clock recency:

- `current`: the record remains operative by status or revision;
- `stale`: the selected latest handoff's task revision differs from the live
  task;
- `superseded`: a newer record or explicit superseded status replaces it;
- `historical`: terminal, archived, event, or older-revision evidence; and
- `unknown`: canonical fields are insufficient to decide.

An accepted decision or open blocker does not become stale merely because the
task revision advances. Its explicit status remains authoritative. Validation
evidence tied to an older task revision is historical. Logs are historical
events. Unknown evidence remains unknown rather than being guessed current.

`prefer-current` retains useful history. `current-only` returns only current
records. `historical-only` returns historical, stale, and—when
`include_superseded` is true—superseded records.

## Explainable ordering

The strategy compares this tuple lexicographically in descending order:

```text
freshness priority
active-task relationship
lexical match quality
verification confidence
direct-file match
record-type priority
canonical task revision
record revision
valid canonical updated_at epoch
```

Canonical record ID ascending is the final tie-breaker. Freshness priorities
are current 4, unknown 3, historical 2, stale 1, and superseded 0. Match
priorities are exact 3, phrase 2, and all-tokens 1. Record-type priorities are
task 8, handoff 7, decision 6, blocker 5, validation 4, policy 3, log 2, and
custom 1.

The tuple uses integers, not a floating score or hidden heuristic. Every result
returns its tuple and component reasons. Current state therefore cannot be
outranked by stale state merely because stale text happens to be a closer
lexical match.

## Revision-aware derived cache

Search schema 3 adds the canonical state descriptor used by the process-local
cache. The cache key includes that state, every semantic input dimension, the
search schema, and the retrieval strategy. Cache hit/miss state is deliberately
absent from the result, so a warm page is semantically equal to a cold page.

The reference implementation is bounded to 64 entries and 4 MiB, returns
defensive copies, and recomputes canonical state before every lookup. See
[`memory-search-cache.md`](./memory-search-cache.md).

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
