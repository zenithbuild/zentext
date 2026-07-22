# Stage 7 Findings

## What succeeded

1. **Handoff infrastructure works.**
   - `zentext handoff create`, `show`, `acknowledge`, and `validate` all function correctly from the installed CLI.
   - The structured handoff round-trips through the SQLite store with the live task revision.
   - Startup acknowledgement is generated from canonical fields, not from optional `previous_response`.

2. **Fresh agent handoff acknowledgement is structurally proven.**
   - Agent A, B, and C ran in sequence against the same Zentext store tied to the Zenith Framework repository.
   - Each agent observed a different live revision (1, 2, 3) and used the revision it saw.
   - Handoffs passed the stopping point and next action from one agent to the next.
   - This proves safe handoff loading and acknowledgement; it does not yet prove full real-repository continuation because Agent B and C prompts did not include the same read-only repository file contents given to Agent A.

3. **Stale mutation rejection is proven.**
   - Agent C attempted an update using revision 1 when the live task was at revision 3.
   - Zentext rejected it with `conflict: true` and preserved the live state.

4. **Zenith Framework remained read-only.**
   - No Zenith files were modified.
   - No commits or pushes occurred.

5. **npm package is installable and functional.**
   - `npm pack` produced a clean tarball.
   - The tarball excludes `dist/proof`.
   - Fresh-directory installation succeeded.
   - Installed `zentext` CLI handled `init`, `status`, `handoff show`, and `handoff acknowledge`.

## Limitations

1. **Agent B and C prompts lacked full repository file contents.**
   - Agent A's prompt included the read-only file contents, so it produced a thorough contract trace.
   - Agent B's prompt only included the Zentext repack output, so it treated compiler-source access as a blocker and did not add new findings.
   - This is a prompt-content limitation, not a defect in the handoff mechanism.

2. **Only one model was exercised.**
   - The proof ran with `kimi-k2.7-code:cloud`.
   - A stronger cross-model claim would require repeating the run with additional Ollama models.

3. **No code changes were proposed or made.**
   - The task was investigation-only.
   - The next phase would need to add compiler-source inspection to complete the contract verification.

## Release-readiness classification

**Ready for limited external Developer Preview.**

The core product promise — local-first structured memory, deterministic repack, and safe multi-agent handoffs — is demonstrated. The packaging workflow is validated. The main remaining work before broader testing is improving the prompt content supplied to continuing agents so they can perform real repository inspection without hallucinating blockers.

## Exact next action

Update Agent B and C prompts in `src/proof/stage7-run.ts` to include the same read-only repository file contents given to Agent A, then rerun the Stage 7 proof to verify deeper continuation.
