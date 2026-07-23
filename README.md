# Zentext

> **AI sessions are temporary. Project memory should not be.**

Zentext is a local-first persistent project memory layer for AI coding agents.
It stores tasks, handoffs, decisions, blockers, validations, revisions, and
policies outside any individual AI session, so project state survives when you
close one tool and continue in another.

SQLite structured records are canonical. CLI output, JSON, Markdown, portable
prompts, and the optional read-only MCP server are views over the same validated
state. Zentext does not transfer hidden model state or depend on conversation
history.

## Why Structured Project Memory

An exported summary captures one moment. As work continues, that text can become
stale without knowing it.

Zentext maintains canonical, evolving project state instead. Tasks have
revisions. Handoffs identify the exact revision they continue. Completed work,
changed files, blockers, verification, stopping points, and next actions remain
separate structured values. When the task advances, Zentext rejects the old
handoff rather than presenting an outdated summary as current.

That distinction makes the project memory portable without making a specific AI
tool, prompt format, or provider the source of truth.

## Developer Preview install

Officially supported on Node.js `>=22.13 <25` (Node 22.13+ and Node 24.x).
Node 26 is experimentally tolerated but emits `EBADENGINE`; Node 20 and earlier
are unsupported for this Developer Preview.

If better-sqlite3 install scripts are blocked, supported Node releases fall back
to the built-in `node:sqlite` module.

```bash
# Try without installing
npx zentext@next init

# Or install globally
npm install -g zentext@next
zentext init
```

## Quick start

```bash
# In a project directory
zentext init
zentext status

# Start a task before recording a handoff
zentext task create --title "Implement login route" --goal "Add password-based authentication"

# Create a handoff when switching agents
zentext handoff create \
  --from "codex" \
  --stopping-point "Implemented login route; need password hashing next." \
  --next-action "Add bcrypt password hashing to /api/login." \
  --completed "Scaffolded auth routes" \
  --completed "Added /api/login POST handler" \
  --files-changed "src/routes/login.ts" \
  --files-changed "tests/routes/login.test.ts" \
  --verification "npm test -- login"

# A fresh agent loads one validated continuation view
zentext continue

# The same canonical state is available as JSON, Markdown, or prompt text
zentext continue --json
zentext continue --markdown
zentext continue --prompt

# Or export the same validated handoff state for another interface
zentext handoff export --format markdown
zentext handoff export --format json
zentext handoff export --format prompt

# Update the task as work progresses
zentext task update --summary "Password hashing implemented" --next-action "Wire login into UI"

# Validate it is still current
zentext handoff validate
```

## Portable continuation demo

**Sessions are temporary. Project memory is not.** This demo installs the packed
npm package, lets Tool A record structured work and exit, then starts a fresh
Tool B with only a portable Zentext continuation and the project files. Tool B
recovers the state, continues from the exact next action, and advances the
canonical task revision. Zentext then rejects the original handoff as stale.

See the [complete executable demo](./docs/demo/portable-continuation/README.md),
the [exact validated-continuation checkpoint](./docs/demo/portable-continuation/checkpoints/03-validated-continuation.txt),
the [fresh-tool checkpoint](./docs/demo/portable-continuation/checkpoints/05-fresh-tool-continuation.txt),
the [stale-rejection checkpoint](./docs/demo/portable-continuation/checkpoints/06-stale-handoff-rejection.txt),
and the [full automatically sanitized transcript](./docs/demo/portable-continuation/transcript.txt).

This is external project-memory continuation—not hidden model-state transfer and
not conversation migration.

## What Zentext is

- A local SQLite memory store tied to a project.
- A deterministic repack engine that turns memory into agent context.
- A thin read-only MCP adapter (`memory.read`, `memory.list`, `memory.query`, `memory.repack`).
- A CLI for humans and fallback use.
- Structured handoffs with revision-safe stale detection.
- A read-only `zentext continue` entry point with human, JSON, Markdown, and
  tool-neutral prompt output over one validated continuation model.

## What Zentext is not

- A chat UI or app.
- A model provider or agent runner.
- Cloud-first or dependent on network sync.
- A way to transfer hidden model state between agents.
- Part of the Zenith Framework.

## Developer Preview limitations

- General-purpose write tools (`zentext add`, `zentext edit`) and MCP write tools are not in this preview. The Developer Preview exposes `zentext task create`, `zentext task show`, `zentext task update`, and `zentext handoff create` so a normal user can record and continue work without importing the store module directly.
- The official M1 field test validates serial continuation across Codex CLI,
  Gemini through Antigravity CLI, and Kimi through Ollama. Provider availability
  remains external to Zentext and can still fail independently.
- Enterprise features (cloud, sync, auth, vector search) are out of scope for this release.

## Documentation

- [docs/handoffs.md](./docs/handoffs.md) — structured agent handoffs
- [docs/switching-agents.md](./docs/switching-agents.md) — how to hand off between agents
- [docs/tester-onboarding.md](./docs/tester-onboarding.md) — full tester workflow
- [docs/mcp.md](./docs/mcp.md) — MCP adapter usage
- [docs/continuation.md](./docs/continuation.md) — current architecture, release
  state, limitations, and continuation commands
- [docs/continuation-prompt.md](./docs/continuation-prompt.md) — canonical
  provider-neutral prompt and manual use

## Troubleshooting

### "Could not locate the bindings file" or native binding errors

better-sqlite3 needs its install script to download or compile a native binding.
Some npm configurations (such as LavaMoat `allow-scripts`) block lifecycle scripts by default.

Options:

1. Allow better-sqlite3 scripts and reinstall:

   ```bash
   npm install-scripts approve better-sqlite3
   npm install -g zentext@next
   ```

2. Override the restriction for a single npx run (Node 22+ only):

   ```bash
   npm_config_allow_scripts=better-sqlite3 npx zentext@next init
   ```

3. Use Node 22, 24, or 26 and allow the built-in `node:sqlite` fallback to activate by blocking scripts:

   ```bash
   npm_config_ignore_scripts=true npx zentext@next init
   ```

## Report problems

Open an issue at https://github.com/zenithbuild/zentext/issues and include:

- `zentext --version` output
- Node version (`node --version`)
- The command you ran
- What you expected and what happened

## License

MIT — see [LICENSE](./LICENSE).
