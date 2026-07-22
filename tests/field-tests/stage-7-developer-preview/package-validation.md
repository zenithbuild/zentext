# Stage 7 Package Validation

## Tarball produced

```bash
npm run build
npm pack
```

Result: `zentext-0.1.0.tgz`

## Tarball contents

- Includes: `dist/`, `README.md`, `docs/mcp.md`
- Excludes: `dist/proof/`

## Fresh installation

Installed into a clean temporary project with `allowScripts` configured for native dependencies.

## Commands validated against installed CLI

- `zentext --help`
- `zentext init`
- `zentext status`
- `zentext handoff show`
- `zentext handoff acknowledge`

All commands succeeded.

## Validation results

- `npm run typecheck` ✅
- `npm run typecheck:test` ✅
- `npm test` — 209 tests passed ✅
- `npm run build` ✅
- `git diff --check` ✅
- `npm pack` ✅
- Fresh-directory tarball installation ✅
