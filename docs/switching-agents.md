# Switching Agents with Zentext

When one agent session ends and another begins, the new agent should not restart work or guess what was completed. Use the handoff workflow to transfer context safely.

## Workflow

1. **Previous agent stops at a boundary**
   - Complete a logical unit of investigation, implementation, or validation.
   - Record accepted decisions and completed work in Zentext.
   - Run `zentext handoff create` with the exact stopping point and next action.

2. **New agent starts fresh**
   - Open the project directory.
   - Run `zentext continue` (or `--json`, `--markdown`, or `--prompt`).
   - Verify the output matches the live task and revision.
   - If the handoff is stale, continuation is refused. Run `zentext handoff
     validate` to inspect the revision mismatch, then create a current handoff
     from live state.

3. **Continue exactly one step**
   - Do not repeat completed work.
   - Do not invent completed work.
   - Update the active task using the live revision.
   - Create the next handoff before ending the session.

## What to do if a handoff is stale

```bash
$ zentext handoff validate
Handoff is stale: active_task revision changed. (handoff revision 3, live revision 4).

$ zentext continue
Zentext continuation refused
# Inspect live state and create a new handoff. Never continue from the stale one.
```

A stale handoff means someone else advanced the task. The new agent must load the current state, not the old handoff.

## Rules for the new agent

- Acknowledge the active task, id, and revision first.
- Prefer `zentext continue` as the single validated entry point; it does not
  mutate or acknowledge the handoff merely by displaying it.
- Confirm the stopping point and next action.
- Use the live revision for any mutation.
- Reject stale writes by checking `zentext handoff validate` before applying changes.
- Record a new handoff at the end of the session.
