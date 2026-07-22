# Zentext Developer Preview Release Report

## 1. Package name

`zentext`

## 2. Prerelease version

`0.1.0-dev.0`

## 3. npm account or scope

Unscoped public package. Registry availability verified: `npm view zentext` returns 404 (not published), so the name is available.

## 4. Tarball filename

`zentext-0.1.0-dev.0.tgz`

## 5. Tarball unpacked size

~264 kB

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

211 tests passed across 10 test files.

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
npm publish ./zentext-0.1.0-dev.0.tgz --tag next
```

For a scoped package, the command would include `--access public`. `zentext` is unscoped, so `--access public` is not required.

## 13. Exact rollback or deprecation command

Deprecate the prerelease:

```bash
npm deprecate zentext@0.1.0-dev.0 "Developer Preview deprecated; install a newer prerelease or wait for the stable release."
```

Unpublish is possible within 24 hours:

```bash
npm unpublish zentext@0.1.0-dev.0
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
