# Continuation, revisions, and stale state

## Continuation view

The canonical continuation view is a derived, read-only representation of:

- project identity;
- one current active or blocked task;
- one current handoff tied to that task;
- accepted decisions;
- completed work;
- changed files;
- blockers;
- verification;
- references;
- notes;
- stopping point;
- exact next action;
- task and handoff revisions;
- handoff record ID;
- quality warnings; and
- validation status.

The view currently uses `schema_version: 1`. It is derived only after canonical
records pass validation.

## Selection

Zentext chooses the latest non-superseded handoff with status `latest`, then
resolves the exact task referenced by that handoff. It does not replace the
referenced task merely because another task was created more recently.

The referenced task must belong to the same project, remain non-superseded, and
have active or blocked status.

## Revision semantics

Each task starts at revision `1`. A material task update advances the revision
contiguously. Revision-conditional writes compare the expected revision at the
SQLite write boundary in the same transaction as the mutation.

Two writers using the same expected revision cannot both succeed. One succeeds;
the other receives `REVISION_CONFLICT`. Failed writes leave the prior canonical
state readable and unchanged.

## Handoff currency

A handoff records the task ID and task revision on which it is based.

```text
handoff task revision == live task revision  → current
handoff task revision != live task revision  → stale
```

Updating the task makes every earlier handoff for an older revision stale.
Stale state is never returned as a usable continuation.

CLI continuation and handoff validation use stable exit code `4` for stale
state. SDK and RPC consumers receive typed stale-state errors or validation
results with handoff and live revisions.

Displaying a current handoff does not acknowledge or mutate it.

## Invalid and missing state

The contract distinguishes:

- project not initialized;
- no active or blocked task;
- no current handoff;
- malformed canonical handoff;
- project identity mismatch;
- stale revision; and
- unsafe or secret-bearing external input.

Consumers must preserve these distinctions instead of turning every failure
into an empty summary.

## Implementation references

- `src/continuation.ts`
- `src/handoff.ts`
- `src/domain/memory-writer.ts`
- `src/store/sqlite-store.ts`
- `tests/continuation.test.ts`
- `tests/write-domain.test.ts`
- `tests/memory-interface.test.ts`
