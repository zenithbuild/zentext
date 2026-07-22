# Switching Agents with Zentext

When one agent session ends and another begins, the new agent should not restart work or guess what was completed. Use the handoff workflow to transfer context safely.

## Workflow

1. **Previous agent stops at a boundary**
   - Complete a logical unit of investigation, implementation, or validation.
   - Record accepted decisions and completed work in Zentext.
   - Run `zentext handoff create` with the exact stopping point and next action.

2. **New agent starts fresh**
   - Open the project directory.
   - Run `zentext handoff acknowledge`.
   - Verify the output matches the live task and revision.
   - If the handoff is stale, run `zentext handoff validate` to see the current revision and load the current state before continuing.

3. **Continue exactly one step**
   - Do not repeat completed work.
   - Do not invent completed work.
   - Update the active task using the live revision.
   - Create the next handoff before ending the session.

## What to do if a handoff is stale

```bash
$ zentext handoff validate
Handoff is stale: active_task revision changed. (handoff revision 3, live revision 4).

$ zentext status
# Inspect current state, then continue from the live revision.
```

A stale handoff means someone else advanced the task. The new agent must load the current state, not the old handoff.

## Rules for the new agent

- Acknowledge the active task, id, and revision first.
- Confirm the stopping point and next action.
- Use the live revision for any mutation.
- Reject stale writes by checking `zentext handoff validate` before applying changes.
- Record a new handoff at the end of the session.
