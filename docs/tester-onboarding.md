# Zentext Developer Preview — Tester Onboarding

## Install

Officially supported on Node.js `>=22.13 <25` (Node 22.13+ and Node 24.x).
Node 26 is experimental and Node 20 and earlier are unsupported for this
Developer Preview.

Node 22+ can fall back to the built-in `node:sqlite` module if better-sqlite3 install scripts are blocked. Node 22.13+ is the minimum supported version because node:sqlite is required for the install-script fallback.

```bash
# Try once without installing
npx zentext@next init

# Or install globally
npm install -g zentext@next
zentext init
```

## Verify the install

```bash
zentext --help
zentext init
zentext status
```

## Basic workflow

### 0. Start a task

Every handoff depends on a current task. Create one first:

```bash
zentext task create --title "Describe the current engineering task" --goal "What this task should achieve"
```

Use `zentext task show` to inspect the current task and `zentext task update` to record progress:

```bash
zentext task update \
  --summary "Where the work stopped" \
  --next-action "What to do next" \
  --note "First progress note" \
  --note "Second progress note"
```

`--note` is repeatable. Notes are stored as an ordered array, so commas inside
a note remain part of that note.

### 1. Initialize a project

In the root of any project you want agents to share:

```bash
zentext init
```

This creates a local SQLite store under `~/.zentext/projects/`.

### 2. Inspect context

```bash
zentext status
zentext repack
zentext repack --focus "authentication"
```

### 3. Create a handoff before switching agents

When you are done with one agent session, record the stopping point. A task must exist first:

```bash
zentext task create --title "Implement login route" --goal "Add password-based authentication"

zentext handoff create \
  --from "codex" \
  --stopping-point "Implemented login route; need password hashing next." \
  --next-action "Add bcrypt password hashing to /api/login." \
  --completed "Scaffolded auth routes" \
  --completed "Added /api/login POST handler"
```

### 4. Fresh agent loads the validated continuation

In a new agent session, run:

```bash
zentext continue

# For a text-only receiving interface
zentext handoff export --format prompt
```

If the handoff is current, you will see the active task, completed work,
stopping point, and exact next action. JSON, Markdown, and prompt output are also
available with `zentext continue --json|--markdown|--prompt`. If the task has
been updated in the meantime, continuation exits nonzero and refuses the stale
state.

### 5. Validate before trusting a handoff

```bash
zentext handoff validate
zentext handoff show --json
```

### 6. Use project memory inside a local tool

Tools should use the typed SDK, `zentext rpc`, or a thin adapter instead of
scraping terminal text. This repository includes a project-local Codex skill.
Open the project in a fresh Codex desktop task and ask:

> Read the current Zentext project memory, explain where the work stopped, then
> continue from the recorded next action. Do not repeat completed work.

See [`integrations/codex-app.md`](./integrations/codex-app.md) for setup and the
isolated acceptance procedure.

### 7. Stale handoff behavior

If another agent updated the task after the handoff was created, `handoff acknowledge` rejects it:

```
Handoff rejected: the recorded handoff is stale and must be regenerated.
Reason: active_task revision changed
Task ID: rec_task_...
Handoff revision: 1
Live revision: 2
```

Regenerate with `zentext handoff create` before continuing.

## Uninstall

```bash
npm uninstall -g zentext
```

The local project store remains under `~/.zentext/projects/` if you want to keep it.

## Troubleshooting install errors

### better-sqlite3 binding errors

If you see an error such as `Could not locate the bindings file` or a message about `NODE_MODULE_VERSION`, better-sqlite3 did not install its native binding.

Try one of the following:

1. Allow better-sqlite3 scripts and reinstall:

   ```bash
   npm install-scripts approve better-sqlite3
   npm install -g zentext@next
   ```

2. Override the restriction for one npx invocation (Node 22+ only):

   ```bash
   npm_config_allow_scripts=better-sqlite3 npx zentext@next init
   ```

3. Force the `node:sqlite` fallback on Node 22+ by skipping lifecycle scripts:

   ```bash
   npm_config_ignore_scripts=true npx zentext@next init
   ```

## Limitations

- This is a Developer Preview. Breaking changes are likely before 1.0.
- `npx zentext@next` installs a prerelease tagged `next`, not the stable `latest`.
- General write commands (`zentext add`, `zentext edit`) are not in this preview.
- MCP write tools are not in this preview.
- The repository contains a normalized native Codex desktop result plus
  OpenClaw, Gemini, and Ollama participants under
  `tests/field-tests/trusted-memory-cross-tool/`. Provider availability and
  behavior remain external dependencies; deterministic package tests must not
  be presented as substitutes for those real executions.
- Cloud, sync, auth, UI, and vector search are not in this preview.

## Reporting problems

Open an issue at https://github.com/zenithbuild/zentext/issues with:

- `zentext --version`
- `node --version`
- The exact command
- Expected vs actual behavior
