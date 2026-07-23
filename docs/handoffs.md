# Zentext Handoffs

A handoff is a structured snapshot that lets a fresh agent continue work from the exact boundary the previous agent reached. It is stored as a `handoff` record in the Zentext local store.

## Why handoffs matter

When an agent session ends, the next agent needs:

- the active task and its live revision
- accepted decisions
- completed work
- the precise stopping point
- the next action
- open blockers

A handoff answers those questions without requiring the new agent to read the prior conversation.

## Structured handoff contract

```typescript
interface StructuredHandoff {
  schema_version: number;
  project_id: string;
  project_name: string;
  previous_agent: string;
  active_task: {
    id: string;
    title: string;
    revision: number;
    status: string;
  };
  accepted_decisions: string[];
  completed: string[];
  stopping_point: string;          // required
  next_action: string;               // required when task is not complete
  blockers: string[];
  references: RecordRefs;
  files_changed: string[];
  verification: string[];
  previous_response?: string;        // optional supporting prose only
  created_at: string;
}
```

Rules:

- `stopping_point` is required.
- `next_action` is required when the active task is not complete.
- `previous_response` is optional context and never overrides canonical task state.
- A handoff must reference the live task revision.
- A stale handoff (revision mismatch) is detected by `zentext handoff validate` and `zentext handoff show`.

## Before creating a handoff

A handoff requires an active or blocked task in the store. If none exists, create one first:

```bash
zentext task create --title "Verify CSS determinism contract" --goal "Confirm ordering and hashing behavior"
```

Without a current task, `zentext handoff create` will explain how to create one.

## CLI commands

```bash
# Create a handoff from the current store state
zentext handoff create \
  --from agent:A \
  --stopping-point "Completed contract trace; need to verify hash-order behavior." \
  --next-action "Run fresh build and compare CSS bundle filename." \
  --completed "Read contracts/DETERMINISM.md" \
  --completed "Read packages/bundler/src/utils.rs" \
  --blockers "Need fresh build artifact" \
  --blockers "Compiler fixture is unavailable" \
  --files-changed "docs/findings.md" \
  --files-changed "tests/determinism.test.ts" \
  --verification "Contract trace complete" \
  --verification "Focused determinism test passed"

# Show the latest handoff (exits nonzero if stale)
zentext handoff show
zentext handoff show --json

# Render the startup acknowledgement
zentext handoff acknowledge
zentext handoff acknowledge --json

# Check whether the handoff is current against the live task revision
zentext handoff validate
zentext handoff validate --json

# Load the active task and handoff through one validated continuation view
zentext continue
zentext continue --json
zentext continue --markdown
zentext continue --prompt

# Export the same validated state to standard output
zentext handoff export --format json
zentext handoff export --format markdown
zentext handoff export --format prompt
```

`--completed`, `--blockers`, `--files-changed`, and `--verification` are
repeatable. Each occurrence is stored as a separate value in invocation order;
commas inside a value are not treated as separators.

`zentext continue` is read-only: displaying a handoff does not acknowledge or
mutate it. It selects the active or blocked task and the current `latest`
handoff, validates their project, task id, and revision, then renders one
canonical view. Completed or canceled tasks and archived or superseded handoffs
are not actionable continuation state. A stale handoff is refused with exit
code 4.

Handoff exports are stdout-only in this release, matching their primary use as
portable text. Redirect output with the shell when a file is needed. Exported
JSON, Markdown, and prompt text are rendered from the same validated view as
`zentext continue`; no format creates a separate handoff or memory system.
The prompt format uses the canonical rules in
[`continuation-prompt.md`](./continuation-prompt.md).

## Startup acknowledgement

When a fresh agent loads a handoff, the expected response is:

```
Zentext context loaded.

Active task: Verify CSS determinism contract
Task ID: rec_task_...
Task revision: 3
Previous agent: agent:A
Completed: Read contracts/DETERMINISM.md; Read packages/bundler/src/utils.rs
Stopping point: Completed contract trace; need to verify hash-order behavior.
Next action: Run fresh build and compare CSS bundle filename.
Blockers: Need fresh build artifact

I will continue from this stopping point without restarting completed work.
```

The acknowledgement is generated from the structured handoff fields, not from `previous_response`.
