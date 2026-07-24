# Relevance and freshness contract

Memory search schema `2` uses strategy
`lexical-relevance-freshness-v2`. Every public search surface consumes the same
redacted canonical records and returns the same result page.

## Freshness

Each matching record is classified from canonical status, supersession, task
identity, and task revision evidence:

- `current`: operative status or current revision evidence;
- `unknown`: insufficient canonical evidence;
- `historical`: terminal, archived, event, or older-revision evidence;
- `stale`: the selected latest handoff references a non-current task revision;
- `superseded`: replacement or explicit superseded status.

Implementations must not infer freshness from wall-clock age alone. Accepted
decisions and open blockers remain current until canonical status or
supersession changes them. Missing evidence remains unknown.

The default `prefer-current` mode retains all non-superseded classifications.
`current-only` returns current records. `historical-only` returns historical,
stale, and superseded records, subject to `include_superseded`.

## Ordering

Results compare the following integer tuple lexicographically in descending
order, then compare canonical record ID by ascending code-unit order:

1. freshness priority;
2. active-task relationship;
3. lexical match quality;
4. verification confidence;
5. direct referenced-file match;
6. record-type priority;
7. canonical task revision when known;
8. record revision; and
9. valid canonical `updated_at` epoch.

The implementation returns the tuple, named components, classification reason,
and concise reason codes with every result. It must use no floating score,
hidden heuristic, model call, or provider state.

Current results outrank stale results in the default mode even when stale text
is an exact lexical match. Invalid or missing timestamps contribute zero and
cannot introduce runtime-dependent date parsing.

## Compatibility

Search schema `1` remains documented in contract 1.1. Contract 1.2 adds fields
to `MemorySearchPage`, adds `freshness_mode` to search input, and changes the
strategy identifier and result ordering. Stored records and RPC framing do not
change.
