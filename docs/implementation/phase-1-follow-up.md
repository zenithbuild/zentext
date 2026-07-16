# Phase 1 Follow-up Items

These items were identified during the PR #7 review of the Stage 1 schema + store
foundation. They are **non-blocking** and intentionally deferred so Phase 1 could
land cleanly.

## Deferred P2 items from Codex review

1. **Normalize `.git/` remotes the same as `.git` and no suffix**
   - File: `src/store/project-id.ts`
   - Issue: `normalizeGitUrl` strips `.git` only when it is the final character.
     A remote URL ending in `.git/` normalizes differently than the same URL
     without the trailing slash, causing `deriveProjectId` to hash the same
     repository to different store paths.
   - Fix: strip trailing slashes before removing `.git`, or explicitly handle
     `.git/`.

2. **Decide whether superseding old records should increment revision/updated_at**
   - File: `src/store/sqlite-store.ts`
   - Issue: when a create request supersedes an existing record, the old
     record's `superseded_by` is updated but its `revision` and `updated_at`
     remain unchanged. Callers listing by `updated_at` or auditing revisions
     cannot immediately see that the old record was modified.
   - Decision needed: should the superseded record get a new revision and
     timestamp, or is the existing `supersede` history event sufficient?
   - If we bump revision, the history table should probably record the supersede
     event at the new revision rather than the original create revision.

## Additional Phase 1 polish noted by human review

- **`meta.json` vs SQLite `meta` table**: docs mention `meta.json` in the store
  layout, but meta is stored in a SQLite `meta` table. Functionally equivalent;
  decide whether to align docs or keep the table.
- **No explicit `refs` round-trip test**: `refs_json` is exercised implicitly
  but not directly asserted.
- **No test for `close()` then operations**: `ensureOpen()` guard is not
  directly tested.
- **No test for list ordering**: `updated_at DESC` ordering is not verified.
- **No explicit `StoreBusyError` type**: `better-sqlite3` propagates
  `SQLITE_BUSY` natively; acceptable for Phase 1 single-user but may need a
  typed wrapper later.
- **`validation` status/result disagreement**: if both `result: "passed"` and
  `status: "failed"` are supplied, both are accepted even though docs say
  "status mirrors result." Edge case; decide on stricter enforcement.

---

All of the above are safe to address in a follow-up commit or in Phase 2 work.
