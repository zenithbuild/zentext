# Stage 7 Package Validation

## npm pack

Run during release preparation:

```bash
npm run build
npm pack --dry-run
npm pack
```

## Tarball contents

Top-level paths should include:

- `package.json`
- `README.md`
- `LICENSE`
- `docs/mcp.md`
- `docs/handoffs.md`
- `docs/switching-agents.md`
- `docs/tester-onboarding.md`
- `dist/` (built JavaScript and declaration files)

Excluded:

- `tests/`
- `src/` (source TypeScript)
- `tests/field-tests/`
- `dist/proof/` (proof harnesses not required at runtime)
- `node_modules/`
- Local databases or credentials

## Fresh-directory smoke test

Install the produced tarball into a clean temporary directory and verify:

```bash
npm install -g ./zentext-0.1.0-dev.0.tgz
zentext --help
zentext init
zentext status
zentext handoff create --from tester --stopping-point "stopped" --next-action "continue"
zentext handoff show
zentext handoff acknowledge
zentext handoff validate
```

The installed CLI must work without resolving files from the repository checkout.

## Latest validation result

- `npm pack --dry-run` showed no field-test artifacts or source files.
- Fresh-directory installation succeeded.
- Installed CLI passed all smoke commands including `handoff acknowledge`.
