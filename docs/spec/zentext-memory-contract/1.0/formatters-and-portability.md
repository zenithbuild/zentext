# Formatters, exports, and portability

## One canonical input

Every renderer and environment adapter must consume one validated continuation
object.

```text
canonical records
      ↓
validated ContinuationView
      ↓
human | JSON | Markdown | prompt | environment presentation
```

An adapter may change headings, field order, phrasing, compactness, and
environment invocation guidance. It may not change or omit the semantic
identity of:

- project and task;
- task and handoff revisions;
- handoff record ID;
- accepted decisions;
- completed work;
- changed files;
- blockers;
- verification;
- references and provenance;
- stopping point;
- exact next action;
- current/stale status; or
- security filtering.

Environment formatter contract version `1.0` does not authorize
environment-specific stores or canonical fields. Formatter IDs belong to a
versioned presentation registry, not the record schema.

## Standard exports

JSON export is the stable machine-readable continuation view with arrays
preserved as arrays and validation metadata intact.

Markdown export is portable human-readable state. Prompt export combines the
portable state with the canonical tool-neutral instruction. All three reject
stale state before export.

An export is a portable representation of canonical state at a revision. It is
not hidden model context and does not remain current after the task advances.

## Portability principles

A portable consumer must be able to:

- identify project, task, handoff, and revision;
- distinguish current from stale state;
- preserve ordered arrays and Unicode;
- retain exact next action;
- validate known schema/protocol versions;
- reject unknown incompatible versions explicitly; and
- avoid requiring local absolute paths.

Local stores are user-owned data and are not published package artifacts.
Generated `dist`, tarballs, caches, test runtimes, and screenshots are not
canonical memory.

## Future archive boundary

Contract 1.0 does not yet define a multi-file portable archive, attachment
bundle, encrypted sync envelope, or cloud backup format. That planning belongs
to [issue #68](https://github.com/zenithbuild/zentext/issues/68).

Any future archive must preserve service-independent validation, export, and
restoration. It cannot make Zentext Cloud the only reader of locally created
memory.

## Implementation references

- `src/continuation-format.ts`
- `src/continuation-prompt.ts`
- `src/continuation.ts`
- issue #35 and its environment formatter reference implementation
- `tests/continuation.test.ts`
- `tests/npm-pack.test.ts`
