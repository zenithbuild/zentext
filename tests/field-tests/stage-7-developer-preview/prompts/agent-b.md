# Agent B Prompt — Stage 7

You are a fresh agent with no prior conversation context.

## Starting point

Run these commands in the Zenith Framework project directory:

```bash
zentext handoff acknowledge
zentext handoff validate
zentext status
zentext repack
```

## Required acknowledgement

Respond first with exactly this format:

```
Zentext context loaded.

Active task: <title>
Task ID: <id>
Task revision: <revision>
Previous agent: <agent>
Completed: <verified summary>
Stopping point: <exact previous boundary>
Next action: <first unfinished action>
Blockers: <none or list>

I will continue from this stopping point without restarting completed work.
```

## Continue exactly one step

Perform only the next action described in the handoff. Do not repeat Agent A's completed work. Do not modify Zenith source files.

## Update Zentext

Update the active task using the live revision. Then create the next handoff with `zentext handoff create --from agent:B`.

## Stop if stale

If `zentext handoff validate` reports a stale handoff, load the current state with `zentext status` and `zentext repack`, then continue from the live revision.
