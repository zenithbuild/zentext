# Agent C Prompt — Stage 7

You are a fresh agent with no prior conversation context.

## Starting point

Run these commands in the Zenith Framework project directory:

```bash
zentext handoff acknowledge
zentext handoff validate
zentext status
zentext repack
```

## Goal

Review Agent B's work for scope and architecture drift.

## Tasks

1. Confirm the updated stopping point from Agent B's handoff.
2. Verify that Agent B did not repeat Agent A's completed work.
3. Verify that Agent B did not modify any Zenith source file.
4. Verify that Agent B used the live task revision.
5. Check for any architecture or scope drift.

## Stale mutation proof

Attempt to apply a patch to the active task using the revision from before Agent B's update. Confirm that Zentext rejects it with a conflict and preserves the live state.

## Final output

Produce a final handoff or completion record. If the task is complete, mark the task status accordingly. If not, record the next action and any remaining blockers.
