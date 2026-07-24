# Continuous integration and manual release gates

GitHub Actions runs the deterministic release-critical subset on every pull
request, every push to `main`, and manual dispatch. The workflow uses
least-privilege read access and never receives npm publishing credentials.

## Enforced in GitHub Actions

The `CI` workflow runs on supported Node.js 22 and Node.js 24 with one
dependency installation per matrix job:

- exact dependency installation with `npm ci`;
- production and test TypeScript checks;
- the complete deterministic test suite;
- package build;
- `npm pack --dry-run`;
- committed-diff whitespace validation; and
- a clean source-checkout assertion.

The complete test suite includes `tests/npm-pack.test.ts`. That test builds and
packs Zentext in a temporary directory, inspects the package allowlist, installs
the tarball into fresh consumers, exercises the TypeScript SDK and NDJSON RPC,
starts MCP over stdio, verifies the public CLI and stale exit behavior, and
tests both the normal `better-sqlite3` installation and the install-script-
disabled `node:sqlite` fallback.

The package-content assertions reject source, tests, proof runners, credentials,
environment files, SQLite databases, and tarballs from the published package.

## Manual release gates

GitHub Actions does not run third-party coding tools or model providers. The
Codex Desktop, OpenClaw, Antigravity/Gemini, and Ollama-host field tests remain
explicit, sanitized release evidence rather than CI simulations.

Before publishing a Developer Preview, a maintainer must also:

1. review unresolved pull-request comments and the final diff;
2. reproduce the supported-runtime matrix from a clean clone;
3. validate the preserved cross-tool fixture and stale-handoff evidence;
4. build and checksum the exact tarball selected for publication;
5. verify npm ownership, authentication, 2FA policy, versions, and dist-tags;
6. install that exact artifact in fresh native and fallback consumers; and
7. smoke-test the registry-installed package after publication.

`npm audit` currently reports the documented moderate transitive advisory in
the MCP SDK dependency tree. The shipped MCP surface uses local stdio and does
not start the affected Hono HTTP static-file server. The non-zero audit result
is recorded as a release limitation, not hidden or converted into a passing
CI gate.
