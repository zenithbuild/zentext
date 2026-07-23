# Zentext portability audit

Last verified: 2026-07-22

This audit proves that the Developer Preview can be installed, validated,
packed, and consumed without relying on the original checkout or its local
state. The canonical continuation summary is in
[continuation.md](./continuation.md); replacement-machine and store recovery
steps are in [recovery-runbook.md](./recovery-runbook.md).

## Audit environment

- Host: macOS on Apple silicon
- Supported runtime A: Node.js `22.23.1`, npm `10.9.8`
- Supported runtime B: Node.js `24.18.0`, npm `11.16.0`
- Experimental host runtime: Node.js 26; not used as acceptance evidence
- Source: remote clones of `release/developer-preview`
- Isolation: a new temporary clone, temporary `HOME`, npm cache, package
  destination, consumer directory, project directory, and SQLite store for
  each runtime

The supported runtimes were invoked through Homebrew's explicit keg paths:

```bash
PATH=/opt/homebrew/opt/node@22/bin:/usr/bin:/bin:/usr/sbin:/sbin
PATH=/opt/homebrew/opt/node@24/bin:/usr/bin:/bin:/usr/sbin:/sbin
```

Nothing was copied from the original checkout: no `node_modules`, `dist`,
database, environment file, ignored fixture, or local build output.

## Source validation

The following sequence passes in each supported-runtime clone:

```bash
npm ci
npm run typecheck
npm run typecheck:test
npm test
npm run build
npm pack --dry-run
npm pack
git diff --check
git status --short
```

The matrix result is:

| Runtime | Install | Typechecks | Tests | Build | Dry pack | Pack |
| --- | --- | --- | --- | --- | --- | --- |
| Node 22.23.1 / npm 10.9.8 | Pass | Pass | Pass | Pass | Pass | Pass |
| Node 24.18.0 / npm 11.16.0 | Pass | Pass | Pass | Pass | Pass | Pass |

`npm ci` reports two moderate-severity transitive audit findings. They do not
prevent installation or validation, were not introduced by this audit, and
were not changed with a potentially breaking automatic audit fix.

## Packed-package and consumer validation

The generated `zentext-0.1.0-dev.2.tgz` was installed into separate temporary
consumer directories. The tests exercised the executable from the installed
package rather than from the source checkout.

The following public workflow passes on both supported Node releases:

1. `zentext --help`
2. `zentext init`
3. `zentext status`
4. `zentext task create`
5. `zentext task show`
6. `zentext handoff create`
7. `zentext handoff show`
8. `zentext handoff validate`
9. `zentext handoff acknowledge`
10. `zentext task update`
11. stale `handoff validate` rejection with exit code 4
12. stale `handoff acknowledge` rejection with exit code 4 and no success
    acknowledgement

The `zentext-mcp` stdio executable also completes MCP `initialize` and
`tools/list`. Its installed tool list is:

```text
memory.list,memory.query,memory.read,memory.repack
```

Both supported storage paths pass:

- Preferred: an ordinary install loads `better-sqlite3`.
- Fallback: a consumer installed with `npm_config_ignore_scripts=true` runs
  the same public task/handoff workflow through `node:sqlite`.

The consumer project remains unchanged after the workflow; all live data is in
the isolated `HOME` under `.zentext/projects/<project-id>/store.sqlite`.

## Package-content audit

The package includes the compiled CLI, compiled MCP server, declarations,
license, README, public workflow documentation, continuation guide,
portability audit, and recovery runbook.

Automated package tests assert that the tarball excludes:

- `src/` and `tests/`
- proof runners and `dist/proof`
- credentials and `.env` files
- SQLite databases, WAL files, and shared-memory files
- generated tarballs

`dist`, installed dependencies, and tarballs are regenerated. They are not
canonical repository inputs.

## Portability findings and fixes

### Fixed

- The root entry in `package-lock.json` still described version `0.1.0`, an
  unlicensed package, and only the CLI binary. It now agrees with
  `package.json`: version `0.1.0-dev.2`, MIT, both binaries, and the supported
  Node engine range.
- The npm allowlist did not contain the M0 continuation, portability, and
  recovery documents. They are now included and asserted by packaging tests.
- Package validation did not exercise the installed MCP protocol surface. It
  now verifies `initialize` and `tools/list` over stdio.
- The runnable Stage 2 proof imported compiled modules through an absolute path
  on the original laptop. Its imports are now relative to the repository, and
  the proof passes on both supported Node releases.
- Environment files were not explicitly ignored. `.env` and `.env.*` are now
  ignored while a deliberately sanitized `.env.example` remains eligible for
  source control.

### No defect found

- Runtime paths are derived from the working project and the user's home; no
  laptop-specific absolute path is a runtime input.
- No ignored source file, unpublished fixture, private environment file, local
  binary, or original-checkout artifact is required by build or tests.
- Shell commands in package scripts are portable Node/npm/TypeScript/Vitest
  entry points; the installed executables use Node shebangs.
- The only native dependency is `better-sqlite3`; supported Node releases have
  a verified `node:sqlite` fallback when its install script or binding is
  unavailable.
- No credential, SQLite store, tarball, or required out-of-repository file is
  tracked or packed.

Historical proof snapshots contain examples of absolute paths from the machine
that captured the experiment. Those paths are non-secret historical output,
are not runtime inputs, and are excluded from the npm package. Rewriting those
snapshots would damage their value as point-in-time evidence.

## Unsupported and residual cases

- Node 20 and earlier are unsupported for this Developer Preview.
- Node 26 is experimental, emits `EBADENGINE`, and is not release-acceptance
  evidence.
- A project without a Git origin has an absolute-path-derived project ID.
  Moving that project to a different path will not automatically find its old
  store through the current CLI.
- A consumer that blocks `better-sqlite3` install scripts requires a supported
  Node runtime with `node:sqlite`.
- Zentext has no cloud replication. Local stores that matter must be backed up
  explicitly.
- Repeated CLI option collection remains tracked in issue #26 and was not
  folded into this audit.

## Reproduction rules

Run acceptance from a remote clone and install the generated tarball into a
separate consumer. Use an isolated `HOME`; do not point the test at a real
Zentext store. Confirm `git status --short` is empty after the consumer flow.
Never publish a package or alter a dist-tag as part of a portability audit.
