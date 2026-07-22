# Zentext

A local-first shared context and memory layer for AI coding agents.

Zentext preserves external project memory — task state, architecture decisions,
blockers, handoffs, validation results, and policies — and repacks that memory
into useful context so that when you switch from one AI coding agent to another,
the next agent picks up where the last one left off without you re-explaining the
project from scratch.

## Developer Preview install

Requires Node.js 22.13+, 24.x, or 26.x (26.x is experimental).

If better-sqlite3 install scripts are blocked, Node 22+ falls back to the built-in `node:sqlite` module. Node 20 requires a working better-sqlite3 binding.

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

# Create a handoff when switching agents
zentext handoff create \
  --from "codex" \
  --stopping-point "Implemented login route; need password hashing next." \
  --next-action "Add bcrypt password hashing to /api/login."

# A fresh agent can load the handoff
zentext handoff acknowledge

# Validate it is still current
zentext handoff validate
```

## What Zentext is

- A local SQLite memory store tied to a project.
- A deterministic repack engine that turns memory into agent context.
- A thin read-only MCP adapter (`memory.read`, `memory.list`, `memory.query`, `memory.repack`).
- A CLI for humans and fallback use.
- Structured handoffs with revision-safe stale detection.

## What Zentext is not

- A chat UI or app.
- A model provider or agent runner.
- Cloud-first or dependent on network sync.
- A way to transfer hidden model state between agents.
- Part of the Zenith Framework.

## Developer Preview limitations

- General-purpose write tools (`zentext add`, `zentext edit`) and MCP write tools are not in this preview; only structured handoff creation is exposed via `zentext handoff create`. The full transactional write domain exists internally and will surface in a later release.
- Multi-agent handoffs are validated against local Ollama models; provider flakiness may affect some models.
- Enterprise features (cloud, sync, auth, vector search) are out of scope for this release.

## Documentation

- [docs/handoffs.md](./docs/handoffs.md) — structured agent handoffs
- [docs/switching-agents.md](./docs/switching-agents.md) — how to hand off between agents
- [docs/tester-onboarding.md](./docs/tester-onboarding.md) — full tester workflow
- [docs/mcp.md](./docs/mcp.md) — MCP adapter usage

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
