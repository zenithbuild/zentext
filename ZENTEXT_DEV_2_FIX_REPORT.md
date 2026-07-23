# Zentext 0.1.0-dev.2 Fix Report

> **Publication update — 2026-07-22:** This report is retained as correction and
> validation evidence. `zentext@0.1.0-dev.2` is now published, and both npm
> `latest` and `next` resolve to it. The publish and dist-tag commands below are
> historical procedure, not actions for the M0 portability batch. See
> [`docs/continuation.md`](./docs/continuation.md) for current state.

## 1. Transaction root cause

`zentext handoff create` failed with `cannot start a transaction within a transaction` when the `node:sqlite` fallback was active.

Call path:

- `src/cli/commands.ts:handoffCreate()` calls `createMemoryWriter(store)` and `writer.createHandoff(input)`.
- `src/domain/memory-writer.ts:MemoryWriterImpl.createHandoff()` wraps its work in `this.store.withTransaction(() => { ... })`.
- Inside that transaction it calls `this.store.updateRecord({ id: latest.id, status: "archived" })` and `this.store.createRecord(input)`.
- `src/store/sqlite-store.ts:updateRecord()` and `createRecord()` each call `this.db!.transaction(callback)()` to guarantee atomic record+history writes.
- With better-sqlite3, nested `db.transaction()` calls happened to work (or were not exercised in the dogfood path).
- With `node:sqlite`, the inner `BEGIN` produced `cannot start a transaction within a transaction`.

The intended behavior was atomic multi-step handoff creation, but the store methods and the writer were each adding their own transaction boundary.

## 2. Transaction fix

Added depth-aware transaction wrappers to both SQLite adapters in `src/store/sqlite-binding.ts`:

- `BetterSqliteDatabase.transaction` now tracks `txDepth`.
- `NodeSqliteDatabase.transaction` now tracks `txDepth`.
- Depth 0 uses `BEGIN` / `COMMIT` / `ROLLBACK`.
- Depth > 0 uses `SAVEPOINT zentext_tx_${depth}` / `RELEASE SAVEPOINT ...` / `ROLLBACK TO SAVEPOINT ...`.
- Nested failures roll back only the nested savepoint; outer work remains intact.

This preserves the existing architecture:

- Store methods remain atomic when called directly.
- Writer multi-step operations remain atomic when wrapping store methods.
- The same code path works on both better-sqlite3 and node:sqlite.

## 3. Public task command design

Added the smallest explicit task workflow needed for the Developer Preview:

- `zentext task create --title <text> [--goal <text>] [--summary <text>] [--status active|blocked|done|canceled]`
- `zentext task show`
- `zentext task update [--title <text>] [--summary <text>] [--status <status>] [--note <text>] [--next-action <text>]`

These commands flow through `MemoryWriterImpl` and reuse the existing domain/store abstractions. They do not expose arbitrary low-level record creation.

No hidden task is created inside `handoff create`. The user must explicitly start a task, which keeps the canonical record state visible and structured.

## 4. CLI examples

```bash
# Initialize
npx zentext@next init
npx zentext@next status

# Start a task
npx zentext@next task create \
  --title "Investigate Zenith CSS determinism" \
  --goal "Confirm CSS ordering, hashing, and anchor enforcement"

# Create a handoff
npx zentext@next handoff create \
  --from "kimi" \
  --stopping-point "Inspected the determinism contract and CSS emission paths." \
  --next-action "Run the CSS determinism tests and inspect test_topo_sort_preservation." \
  --completed "Read contracts/DETERMINISM.md" \
  --completed "Read CSS ordering and HTML emission implementation" \
  --files-changed "None. Read-only investigation." \
  --verification "Inspected contracts/DETERMINISM.md, packages/bundler/src/utils.rs, packages/bundler/src/bundler_html_emit.rs, packages/bundler/tests/css_determinism.rs"

# Fresh agent continues
npx zentext@next handoff acknowledge
npx zentext@next handoff show --json

# Record progress
npx zentext@next task update \
  --summary "Ran tests and confirmed bundle hash behavior" \
  --note "Order independence is intentional per test" \
  --next-action "Document the order-independence decision"

# Detect stale handoff
npx zentext@next handoff validate
npx zentext@next handoff acknowledge

# Regenerate handoff when stale
npx zentext@next handoff create --from "kimi" ...
```

## 5. Tests added

- `tests/cli.test.ts`
  - `task create` creates an active task
  - `task create` rejects invalid status
  - `task show` displays the active task
  - `task show` guides the user when no tasks exist
  - `task update` advances task revision
  - `handoff create` fails with guidance when no active task exists
  - `status` guides the user when no active task exists
  - CLI module exposes `taskCreate`, `taskShow`, `taskUpdate`

- `tests/sqlite-binding.test.ts`
  - nested transaction savepoint behavior
  - nested rollback does not affect outer transaction

- `tests/npm-pack.test.ts`
  - installed public task workflow with better-sqlite3 scripts blocked on Node 22+
  - verifies task create, handoff create, acknowledge, task update, stale validation, stale acknowledgement through the installed tarball

## 6. Supported Node matrix

Engine range: `"node": ">=22.13 <25"`

| Runtime | better-sqlite3 scripts allowed | better-sqlite3 scripts blocked (`npm_config_ignore_scripts=true`) |
|---|---|---|
| Node 22.15.0 | ✅ full workflow | ✅ full workflow via `node:sqlite` |
| Node 24.3.0 | ✅ full workflow | ✅ full workflow via `node:sqlite` |

Node 26.4.0 was tested informally and works via the fallback, but emits the expected `EBADENGINE` warning and is not part of the release acceptance gate.

## 7. Tarball install results

- `npm pack` produces `zentext-0.1.0-dev.2.tgz` (~63 kB packed, ~306 kB unpacked).
- Fresh-directory installs succeed on Node 22 and 24 with scripts allowed and blocked.
- `zentext --help`, `init`, `status`, `task create`, `task show`, `task update`, `handoff create`, `handoff show`, `handoff validate`, `handoff acknowledge` all work from the installed package.

## 8. Complete public workflow results

From a clean project using only published-package behavior:

- `zentext init` ✅
- `zentext task create` ✅
- `zentext task show` ✅
- `zentext status` ✅
- `zentext repack --focus` ✅
- `zentext handoff create` ✅
- `zentext handoff show` ✅
- `zentext handoff validate` ✅
- `zentext handoff acknowledge` ✅
- `zentext task update` ✅ (advances revision)
- stale `handoff validate` exits 4 ✅
- stale `handoff acknowledge` exits 4 and reports `acknowledged: false` ✅

## 9. Repository mutation check

Tested inside `/Users/judahsullivan/zenith/framework`:

- `git status --short` remained empty throughout the dogfood session.
- Zentext stores are written only to `~/.zentext/projects/`.

## 10. Remaining warnings

- `prebuild-install@7.1.3` deprecation warning during install on Node 22/24 when better-sqlite3 scripts are allowed. Not release-blocking; fallback works when scripts are blocked.
- Node 26 `EBADENGINE` warning is expected because Node 26 is outside the supported engine range.
- `npm audit` reports moderate severity vulnerabilities in transitive dependencies. These are not introduced by Zentext and do not affect the local-first CLI workflow.

## 11. Known limitations

- General-purpose write commands (`zentext add`, `zentext edit`) remain out of scope.
- MCP write tools remain out of scope.
- Only task and handoff mutations are exposed in the Developer Preview CLI.
- Cloud, sync, auth, UI, vector search, and enterprise features remain out of scope.

## 12. Exact publish command

```bash
npm publish ./zentext-0.1.0-dev.2.tgz --tag next
```

## 13. Exact dist-tag commands

After publication and verification:

```bash
npm dist-tag add zentext@0.1.0-dev.2 latest
npm dist-tag add zentext@0.1.0-dev.2 next
npm view zentext version
npm view zentext@next version
npm dist-tag ls zentext
```

Expected:

```
0.1.0-dev.2
0.1.0-dev.2
latest: 0.1.0-dev.2
next: 0.1.0-dev.2
```

Also deprecate the broken `0.1.0-dev.1` release:

```bash
npm deprecate zentext@0.1.0-dev.1 \
  "Developer Preview workflow incomplete: task creation and handoff creation are being corrected in 0.1.0-dev.2."
```

## 14. Readiness classification

**Ready to publish 0.1.0-dev.2 after explicit human approval.**

Release gates passed:

- ✅ Repository state clean
- ✅ Type checks pass
- ✅ 226 tests pass
- ✅ Build succeeds
- ✅ `git diff --check` clean
- ✅ `npm pack` produces a clean tarball
- ✅ Tarball excludes source, tests, field-test artifacts, and proof harnesses
- ✅ Fresh-directory install smoke test passes on Node 22 and 24
- ✅ Full public task → handoff → stale-rejection workflow passes on Node 22 and 24
- ✅ Both better-sqlite3 and `node:sqlite` fallback paths pass
- ✅ No credentials or absolute paths committed
- ✅ `private: true` removed
- ✅ Documentation updated with task workflow

**Action required:** explicit approval before running the publish command.
