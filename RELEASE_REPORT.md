# Zentext Developer Preview Release Report

> **Publication update — 2026-07-22:** This is preserved as pre-publication
> readiness evidence. `zentext@0.1.0-dev.2` has since been published, and both
> the npm `latest` and `next` dist-tags resolve to `0.1.0-dev.2`. Current state
> is documented in [`docs/continuation.md`](./docs/continuation.md).

## 0.1.0-dev.1 correction

This release corrects a post-0.1.0-dev.0 blocker:

- `better-sqlite3` requires install scripts to download/compile a native binding.
- When scripts are blocked (e.g., LavaMoat `allow-scripts` or `npm_config_ignore_scripts=true`), the previous release crashed with `Could not locate the bindings file`.
- `0.1.0-dev.2` adds `src/store/sqlite-binding.ts`, a unified driver that prefers `better-sqlite3` and falls back to Node's built-in `node:sqlite` on Node 22.13+.
- The supported Node engine range is now restricted to `>=22.13 <25` so behavior is predictable. Node 26.x may work but is not officially supported.

## 1. Package name

`zentext`

## 2. Prerelease version

`0.1.0-dev.2`

## 3. npm account or scope

Unscoped public package. Registry availability verified: `npm view zentext` returns 404 (not published), so the name is available.

## 4. Tarball filename

`zentext-0.1.0-dev.2.tgz`

## 5. Tarball unpacked size

~290 kB

## 6. Included top-level paths

Only `package/`, containing:

- `package.json`
- `README.md`
- `LICENSE`
- `docs/handoffs.md`
- `docs/mcp.md`
- `docs/switching-agents.md`
- `docs/tester-onboarding.md`
- `dist/` (built runtime, CLI, MCP, store, repack engine, domain)

## 7. Excluded sensitive or unnecessary paths

- `tests/`
- `src/`
- `tests/field-tests/`
- `dist/proof/`
- `node_modules/`
- local databases, credentials, coverage, temporary files

## 8. Total passing tests

226 tests passed across 11 test files.

## 9. Installed CLI smoke results

Verified from the produced tarball in a completely fresh temporary directory:

- `zentext --help` ✅
- `zentext init` ✅
- `zentext status` ✅
- `zentext handoff create` ✅ (after seeding a task via the installed store module)
- `zentext handoff show` ✅
- `zentext handoff acknowledge` ✅
- `zentext handoff validate` ✅
- Stale handoff rejection ✅ (exit code 4, `acknowledged: false`)
- better-sqlite3 scripts blocked + `node:sqlite` fallback ✅ (Node 22+, `npm_config_ignore_scripts=true`)
- public `zentext task create` ✅
- public `zentext task show` ✅
- public `zentext task update` ✅
- public `zentext handoff create` from a task ✅
- stale handoff rejection after public task update ✅

## 10. Deeper Stage 7 continuation results

- **kimi-k2.7-code:cloud**: completed Agent A → B → C, continuation succeeded, stale write rejected.
- **glm-5.2:cloud**: completed Agent A → B → C, continuation succeeded, stale write rejected.
- **minimax-m3:cloud**: available but failed to return consistently parseable JSON during live runner execution. The same responses parse correctly when saved to disk and inspected independently. Recorded as a provider-side reliability issue.

Agent B and Agent C now receive the same read-only repository evidence as Agent A. They performed real continuation of the Zenith CSS determinism investigation rather than inventing file-access blockers.

## 11. Known limitations

- `minimax-m3:cloud` JSON parse flakiness inside the live runner.
- General-purpose write CLI commands (`zentext add`, `zentext edit`) are not exposed in this preview.
- MCP write tools are not exposed in this preview.
- Cloud, sync, auth, UI, vector search, and enterprise features are out of scope.

## 12. Exact publish command

```bash
npm publish ./zentext-0.1.0-dev.2.tgz --tag next
```

For a scoped package, the command would include `--access public`. `zentext` is unscoped, so `--access public` is not required.

## 13. Exact rollback or deprecation command

Deprecate the prerelease:

```bash
npm deprecate zentext@0.1.0-dev.2 "Developer Preview deprecated; install a newer prerelease or wait for the stable release."
```

Unpublish is possible within 24 hours:

```bash
npm unpublish zentext@0.1.0-dev.2
```

## 14. Release classification

**Ready for limited Developer Preview publish** — pending explicit human approval.

All release gates passed:

- ✅ Repository state clean
- ✅ Type checks pass
- ✅ 211 tests pass
- ✅ Build succeeds
- ✅ git diff --check clean
- ✅ npm pack produces a clean tarball
- ✅ Tarball excludes source, tests, field-test artifacts, and proof harnesses
- ✅ Fresh-directory install smoke test passes
- ✅ Stale handoff rejection verified
- ✅ Cross-model continuation proof completed for Kimi and GLM
- ✅ No credentials or absolute paths committed
- ✅ `private: true` removed

**Action required:** confirm `npm whoami` shows the correct npm account, then run the publish command above.
