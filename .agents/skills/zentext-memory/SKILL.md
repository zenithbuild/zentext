---
name: zentext-memory
description: Recover and update validated Zentext project memory when asked to read project memory, explain where work stopped, continue recorded work, or record progress. Use the bundled helper over zentext rpc; never infer state from a previous conversation.
---

# Zentext project memory

Use this skill when the user asks to read, recover, continue, validate, query, or
update the current project's Zentext memory.

Zentext is external project memory. It does not contain another model's hidden
state, private reasoning, or session history.

## Read and explain before editing

1. Run:

   ```sh
   node .agents/skills/zentext-memory/scripts/memory.mjs read
   ```

2. Require an `ok: true` response and `validation.status: "current"`.
   Capture `result.handoff.record_id`; that is the exact current handoff to
   link as `parent_handoff_id` and validate as stale after the write.
3. Before changing files, explain:
   - project and task identity;
   - current task revision;
   - accepted decisions;
   - completed work;
   - changed files;
   - blockers;
   - verification;
   - stopping point;
   - exact next action.
4. Inspect the repository to verify the recorded state. Preserve uncertainty;
   do not silently treat memory as proof.
5. Do not repeat completed work. Begin from the exact next action.
6. Complete only the next action recovered by this read and record exactly one
   revision advance. After the final re-read, report the newly recorded next
   action and stop. Do not execute that new action in the same turn unless the
   user explicitly asks for more than one continuation step.

If the response has `STALE_STATE`, `PROJECT_IDENTITY_MISMATCH`, or another
typed error, stop and report it. Never continue from stale text.

## Record progress through the validated domain

After completing work, call `record-progress` with the revision returned by
`read`. Pass JSON as the second argument:

```sh
node .agents/skills/zentext-memory/scripts/memory.mjs record-progress \
  '{"expected_revision":2,"source_environment":"<actual-tool-or-environment>","completed":["..."],"changed_files":["relative/path"],"blockers":[{"title":"Remaining work","blocker":"The next source has not been read.","severity":"medium"}],"verification":[{"check":"...","result":"passed","summary":"..."}],"stopping_point":"...","next_action":"...","files_inspected":["relative/source"],"commands_executed":["npm test"],"parent_handoff_id":"rec_handoff_..."}'
```

Use the field names exactly as shown: `changed_files`, `files_inspected`, and
`commands_executed`. `blockers` contains objects with `title` and `blocker`;
`verification` contains objects with `check`, `result`, and optional `summary`.
Each `result` is `passed`, `failed`, or `inconclusive`.
Set `source_environment` to the tool or harness actually performing the write;
never copy another participant's example identity.

Include concrete completed work, repository-relative changed files, blockers,
verification, stopping point, and one exact next action. `accepted_decisions`
contains structured `{title, decision, rationale}` objects only for decisions
newly made during this turn; do not resubmit decisions already present in the
continuation. Add inspected files, commands, and the parent handoff when known.
Never put credentials, tokens, private keys, passwords, connection strings,
`.env` contents, personal absolute paths, or raw private transcripts in
memory.

Then run `read` again and confirm that the canonical task revision advanced.
Validate the prior handoff as stale, report the newly recorded next action,
and stop. One continuation request must not silently become an unbounded work
loop.

## Other operations

```sh
node .agents/skills/zentext-memory/scripts/memory.mjs active
node .agents/skills/zentext-memory/scripts/memory.mjs validate [handoff-id]
node .agents/skills/zentext-memory/scripts/memory.mjs query '{"query":"term","limit":20}'
node .agents/skills/zentext-memory/scripts/memory.mjs capabilities
```

The helper is only a thin local adapter. It discovers project identity with
`project.open`, then invokes the versioned NDJSON RPC interface. Canonical
state remains in SQLite and all writes pass through the shared validated
memory domain.
