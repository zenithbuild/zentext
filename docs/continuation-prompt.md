# Tool-neutral continuation prompt

Zentext provides one provider-neutral continuation instruction for interfaces
that can accept text but cannot directly integrate with the local CLI.

Generate it from the current validated store:

```sh
zentext continue --prompt
```

Or use the equivalent handoff export:

```sh
zentext handoff export --format prompt
```

Both commands render the same canonical prompt from
`src/continuation-prompt.ts` and the same validated continuation view. The
prompt is written to standard output, so it can be pasted directly or
redirected to a file.

## Required receiving-tool behavior

The prompt tells any receiving tool to:

1. treat Zentext as external project memory, not another model's hidden state;
2. confirm project, task, and revision identity;
3. verify live revision state when possible and refuse stale continuation;
4. summarize completed work, changed files, blockers, verification, the
   stopping point, and exact next action before editing;
5. avoid repeating completed or unverified work;
6. inspect repository evidence rather than trusting text blindly;
7. start at the exact next action;
8. record new progress back into Zentext when it has an available write surface,
   or return the exact update for an operator to record;
9. preserve uncertainty and report missing evidence honestly.

## Manual use

1. Run one of the prompt commands in the source project.
2. Start a fresh tool session with no prior provider conversation.
3. Provide only the project, the generated prompt, and any explicitly allowed
   files.
4. Require the tool to explain the continuation state before it changes
   anything.
5. After progress is recorded, validate the old handoff again. A task revision
   change must make that handoff stale.

The generated prompt contains explicit project records. Review it before
sharing outside the machine. Do not include credentials, private databases, or
provider session data. The template contains no vendor syntax, hardcoded
repository path, or claim that a receiving tool can execute commands it cannot
actually run.

