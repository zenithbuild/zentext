# Target Repository: Zenith Framework

## Read-only guarantee

No files in the Zenith Framework repository are modified during Stage 7.

- The repository is treated as read-only.
- No commits are made.
- No pushes are performed.
- No changes are written to `master` or any other branch.
- The local clone or checkout is disposable.

## Files read

| File | Purpose |
|---|---|
| `contracts/DETERMINISM.md` | Canonical determinism contract |
| `packages/bundler/src/utils.rs` | `process_css`, hashing, anchor validation |
| `packages/bundler/src/bundler_html_emit.rs` | HTML anchor validation during emission |
| `packages/bundler/tests/css_determinism.rs` | Existing contract tests |
| `packages/bundler/src/plugin/zenith_loader.rs` | Newline normalization during transform |
| `packages/bundler/src/bundle.rs` | High-level bundler pipeline |
| `AGENTS.md` | Agent contract and governance rules |

## Files modified

None.

## Boundaries

The investigation stops at documentation and verification. Any proposed change to Zenith source code becomes a separate future issue or PR, not part of this proof.
