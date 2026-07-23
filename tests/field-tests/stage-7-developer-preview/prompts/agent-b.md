# Agent B instructions

Agent B: Continue the Zenith CSS determinism verification from a fresh session.

You have no prior conversation. Use only the Zentext context and repository evidence above.

First, respond with the startup acknowledgement:

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

Then perform exactly one next step: inspect the specific implementation detail identified by the previous agent, using the repository evidence above, and add one new finding.

Do not repeat work already listed in the Zentext handoff. Do not invent completed work.
