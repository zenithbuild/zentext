# Zentext replacement-machine and release recovery runbook

Last verified: 2026-07-22

Use this runbook when the original development laptop is unavailable or when a
clean machine must reproduce the Developer Preview. It contains no credentials,
recovery codes, private keys, tokens, or local database contents.

## Current access and release baseline

- GitHub account `judahbsullivan` is an administrator of the `zenithbuild`
  organization and has administrator access to `zenithbuild/zentext`.
- npm lists `judahsullivan` as an owner of the public `zentext` package.
- This machine is not currently authenticated to npm: `npm whoami` returns an
  authentication error. Do not infer publish access from package ownership.
- Published versions are `0.1.0-dev.0`, `0.1.0-dev.1`, and
  `0.1.0-dev.2`; both `latest` and `next` currently resolve to
  `0.1.0-dev.2`.
- There are currently no Git tags and no GitHub releases for this repository.

Access state changes independently of the repository. Recheck it from the
replacement machine before relying on this baseline.

## Responsibility for credentials and account recovery

The package owner must maintain GitHub and npm two-factor authentication and
store recovery codes in a secure system that is independent of the laptop.
Confirm access to that system before retiring the machine. Never put recovery
codes, passwords, access tokens, private keys, npm configuration containing a
token, or a private Zentext database in the repository or an issue/PR.

Use the operating system credential store, a reputable password manager, or an
equivalent encrypted secret manager. Rotate any credential that might have been
left on a lost or transferred machine. Review and revoke old GitHub sessions,
SSH keys, personal access tokens, npm tokens, and automation credentials as
appropriate.

## Replacement-machine setup

1. Install Git and a supported Node.js release: Node `>=22.13 <25`.
2. Authenticate GitHub through a secure browser/device flow or a new SSH key.
3. Confirm access without exposing credentials:

   ```bash
   gh auth status
   gh api repos/zenithbuild/zentext --jq '.permissions'
   ```

4. Clone the canonical repository and validate it:

   ```bash
   git clone https://github.com/zenithbuild/zentext.git
   cd zentext
   npm ci
   npm run typecheck
   npm run typecheck:test
   npm test
   npm run build
   ```

5. If release work is required, restore npm authentication through npm's
   official sign-in flow and account recovery process. Then confirm the account
   and ownership without publishing:

   ```bash
   npm whoami
   npm owner ls zentext
   ```

If either account cannot be recovered, stop release work and use the provider's
documented account recovery or organization-administration process. Do not
create a replacement package or transfer ownership as an improvised workaround.

## Branch, PR, tag, and release convention

- Start work from the latest `main` and use a focused branch.
- Preserve review history; do not force-push a reviewed branch unless the team
  has explicitly agreed to rewrite it.
- Merge changes through a reviewed pull request after required validation.
- Do not manually close issues that the PR body will close on merge.
- Never publish from an unreviewed or dirty checkout.

For each future package release:

1. Merge the reviewed release PR.
2. Identify the exact merged commit on `main` and confirm its package version.
3. Tag that exact commit as `v<package-version>` (for example,
   `v0.1.0-dev.3`) and push the tag.
4. Create the GitHub release from the same tag.
5. Publish the package only with explicit release authorization and verified
   npm authentication/2FA.
6. Inspect the published package and dist-tags after publication.

The M0 batch establishes this convention but does not create a tag, GitHub
release, npm publication, or dist-tag change.

## Rebuild and inspect the package

Use a clean clone at the intended release commit:

```bash
npm ci
npm run typecheck
npm run typecheck:test
npm test
npm run build
npm pack --dry-run
npm pack
```

Inspect the generated tarball before installing or publishing it:

```bash
npm pack --dry-run
tar -tzf zentext-<version>.tgz
```

Install it into a separate temporary consumer and verify both executables:

```bash
npm install /absolute/path/to/zentext-<version>.tgz
npx zentext --help
./node_modules/.bin/zentext-mcp
```

For the MCP executable, use an MCP client/protocol smoke test that completes
`initialize` and `tools/list`; it is a stdio server and normally waits for
protocol input rather than printing an interactive help screen.

Confirm registry state without changing it:

```bash
npm view zentext versions --json
npm view zentext dist-tags --json
npm view zentext@latest version
npm view zentext@next version
npm owner ls zentext
```

Do not run `npm publish`, `npm dist-tag`, or a GitHub release mutation as a
diagnostic step.

## Locate a local Zentext store

For a project with a normalized Git `origin`, the project ID is stable across
machines and clones. The live project directory is:

```text
~/.zentext/projects/<project-id>/
├── store.sqlite
└── exports/
```

Run `zentext status` inside the project to print the project ID, store path, and
schema version. The current Developer Preview uses SQLite migration/schema
version 1.

Projects without a Git origin use an ID derived from their absolute path. That
ID is not portable when the absolute path changes. The current CLI does not
offer an override or automatic relocation lookup; retain the old directory
path or recover the store with deliberate project-ID handling outside the CLI.
Do not rename store directories speculatively.

## Back up a store

1. Finish and stop every Zentext CLI, MCP, or SDK process using the store.
2. Run `zentext status` and record the non-sensitive project ID and schema
   version with the backup inventory.
3. Copy the entire project-store directory, not only `store.sqlite`, to an
   encrypted backup location. Copying the directory preserves any SQLite WAL or
   shared-memory files left by an abnormal shutdown and the `exports` directory.
4. Preserve file permissions and verify the backup can be read from an isolated
   recovery location.
5. Never commit the backup or attach it to GitHub. A store may contain source
   context, paths, decisions, or other private project information.

When a database cannot be cleanly closed, use a SQLite-aware backup method
instead of copying an actively written database. Do not delete WAL/SHM files to
make a backup look tidy.

## Restore and validate a store

1. Install the same Zentext version that last opened the store, or a newer
   explicitly compatible version.
2. Clone the project and configure the same normalized Git `origin`. HTTPS and
   SSH forms normalize to the same identity; a different repository remote does
   not.
3. Use a new isolated `HOME` for the first validation so an existing live store
   cannot be overwritten.
4. With Zentext stopped, restore the entire project-store directory to
   `~/.zentext/projects/<project-id>/`.
5. Start with read-only inspection from the project clone:

   ```bash
   zentext status
   zentext task show
   zentext handoff show
   ```

6. Confirm the expected project ID, schema version, active task, handoff, and
   record counts before using write commands.

Opening a store runs append-only migrations up to the version supported by the
installed package. Keep an untouched backup before opening an older store with
a newer package. Do not open a store whose schema version is newer than the
installed code; obtain a compatible Zentext version first.

## Safe recovery dry-run evidence

On 2026-07-22, recovery was tested without using a real user store:

1. A temporary Git project with a synthetic remote was initialized under an
   isolated home.
2. A task and handoff were created through the installed public CLI.
3. All Zentext processes exited, and the complete test project-store directory
   was copied to a second isolated home.
4. A separate clone configured with the same normalized remote derived the same
   project ID.
5. `zentext status`, `zentext task show`, `zentext handoff show`, and
   `zentext handoff validate` reopened and verified the restored records at
   schema version 1.

Only exit results and non-sensitive structural facts were recorded. The test
database and temporary homes were not committed or retained as release
artifacts.

## Files that must never be committed

- `.env` files or npm configuration containing tokens
- access tokens, passwords, recovery codes, private keys, or credential exports
- `store.sqlite`, `*.sqlite-wal`, `*.sqlite-shm`, or copied store directories
- private proof inputs or user memory exports
- `node_modules`, generated `dist`, or generated `*.tgz` artifacts

The repository ignore rules provide defense in depth, but they do not replace
reviewing `git status`, the staged diff, and the tarball contents.

## Emergency sequence when the original laptop is gone

1. Secure GitHub, npm, email, password-manager, and 2FA access; revoke the old
   machine's sessions and credentials.
2. Recover organization/repository administration and npm package ownership
   before attempting a release.
3. Clone the repository, read [continuation.md](./continuation.md), and run the
   clean-clone validation matrix.
4. Restore only required Zentext stores from the verified encrypted backup into
   an isolated home and validate them before normal use.
5. Review open issues and PRs; continue from the one canonical branch rather
   than recreating work from local remnants.
6. Re-establish publishing only after source, tarball, ownership, 2FA, tag, and
   release evidence all agree.
