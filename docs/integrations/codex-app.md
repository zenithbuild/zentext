# Codex app integration

The first Codex-facing integration is a repository-local skill over
`zentext rpc`. This is the smallest current Codex desktop surface that provides
natural-language discovery while keeping Zentext provider-neutral.

Canonical state remains in SQLite. The skill contains instructions and a thin
RPC helper only; it stores no Codex state.

## Setup

1. Install the packed or published Zentext package in the project, or build this
   repository so `dist/cli/cli.js` exists.
2. Keep the repository skill at:

   ```text
   .agents/skills/zentext-memory/SKILL.md
   ```

3. Initialize Zentext and create a current task/handoff.
4. Open the project folder in the Codex desktop app.
5. Start a fresh task with no prior Tool A conversation.
6. Ask:

   > Read the current Zentext project memory, explain where the work stopped,
   > then continue from the recorded next action. Do not repeat completed work.

Codex should discover the `zentext-memory` skill, invoke its helper, and consume
the versioned RPC response. The user does not need to copy terminal output.

## Required behavior

Before editing, Codex must explain the task, revision, decisions, completed
work, changed files, blockers, verification, stopping point, and exact next
action. It should inspect the repository rather than blindly trust memory.

After work, Codex records progress using the starting revision. A successful
write advances the task and creates a new handoff; validation of the original
handoff returns `current: false`.

## Manual field test

The reproducible fixture and evidence contract live in
`tests/field-tests/codex-app-memory/`. The unavoidable UI steps are:

1. open the generated isolated fixture folder in Codex;
2. create a fresh task;
3. submit the exact prompt above;
4. preserve the sanitized tool calls and recovered-state explanation;
5. verify the fixture change, ending revision, and stale result.

The repository records the packed deterministic helper run and pending Codex
UI result under `tests/field-tests/codex-app-memory/results/`. Passing the
helper run is not presented as a native Codex pass.

Do not provide the new task with Tool A's conversation or private transcript.
The repository, Zentext store, project-local skill, and prompt are the only
allowed context.

## Unsupported claims

This proves a local Codex workflow, not native hosted integration. It does not
claim access to hidden reasoning or provider memory. It does not add a Codex
memory store, cloud service, plugin marketplace package, authentication, or
provider-specific canonical records.

Future Claude Desktop, OpenClaw, editor, and app adapters should call the same
SDK or RPC methods and preserve the same validation and provenance rules.
