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

## Verified field test

The release-readiness fixture and normalized evidence live in
`tests/field-tests/trusted-memory-cross-tool/`. The 2026-07-23 run used:

1. a packed `zentext@0.1.0-dev.2` artifact installed into an isolated fixture;
2. a fresh native Codex desktop task opened directly on that persistent fixture;
3. the exact prompt above with no Tool A conversation;
4. the project-local skill and packed NDJSON RPC helper;
5. a single Alpha project change followed by `npm run verify`;
6. one revision-safe progress write, a canonical re-read, and validation of the
   consumed handoff as stale.

Codex Desktop `26.721.30844` with `gpt-5.6-sol` at `xhigh` recovered revision
`2`, explained the complete recorded state before editing, completed only the
Alpha action, advanced the task to revision `3`, and stopped before Beta. The
exact revision-2 handoff then validated as `current: false`.

Do not provide the new task with Tool A's conversation or private transcript.
The repository, Zentext store, project-local skill, and prompt are the only
allowed context.

See the [cross-tool procedure](../../tests/field-tests/trusted-memory-cross-tool/README.md)
and [normalized Codex evidence](../../tests/field-tests/trusted-memory-cross-tool/evidence/codex-desktop.md).
The older `tests/field-tests/codex-app-memory/` helper proof remains useful
deterministic evidence, but it is no longer the latest native-app result.

## Unsupported claims

This proves a local Codex workflow, not native hosted integration. It does not
claim access to hidden reasoning or provider memory. It does not add a Codex
memory store, cloud service, plugin marketplace package, authentication, or
provider-specific canonical records.

Future Claude Desktop, OpenClaw, editor, and app adapters should call the same
SDK or RPC methods and preserve the same validation and provenance rules.
