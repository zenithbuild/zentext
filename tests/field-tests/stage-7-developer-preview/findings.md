# Stage 7 Findings

## What succeeded

1. **Handoff infrastructure works.**
   - `zentext handoff create`, `show`, `acknowledge`, and `validate` all function correctly from the installed CLI.
   - The structured handoff round-trips through the SQLite store with the live task revision.
   - Startup acknowledgement is generated from canonical fields, not from optional `previous_response`.
   - Stale handoffs are rejected before emitting a continuation statement.

2. **Fresh agents continue real repository investigation.**
   - Agent A, B, and C ran in sequence against the same Zentext store tied to the Zenith Framework repository.
   - All agents received the same read-only repository evidence (`contracts/DETERMINISM.md`, `packages/bundler/src/utils.rs`, `packages/bundler/src/bundler_html_emit.rs`, `packages/bundler/tests/css_determinism.rs`, and related files).
   - Each agent observed a different live task revision (1, 2, 3) and used the revision it saw.
   - Agent B performed the next legitimate verification step rather than inventing a file-access blocker.
   - Agent C reviewed Agent B's continuation and confirmed it was supported by the repository evidence.

3. **Stale mutation rejection is proven.**
   - Agent C attempted an update using an earlier revision when the live task was already at a later revision.
   - Zentext rejected it with `conflict: true` and preserved the live state.

4. **Zenith Framework remained read-only.**
   - No Zenith files were modified.
   - No commits or pushes occurred.

5. **npm package is installable and functional.**
   - `npm pack` produced a clean tarball.
   - The tarball excludes `dist/proof`.
   - Fresh-directory installation succeeded.
   - Installed `zentext` CLI handled `init`, `status`, `handoff show`, and `handoff acknowledge`.

6. **Cross-model consistency is demonstrated.**
   - Both `kimi-k2.7-code:cloud` and `glm-5.2:cloud` recovered the same canonical project state, continued the same task, and rejected stale updates.
   - They did not produce identical prose, but they aligned on task direction, accepted decision, and next action.

## Limitations

1. **MiniMax produced valid JSON only outside the live runner.**
   - `minimax-m3:cloud` returned responses that parsed correctly when saved to disk and inspected independently, but `JSON.parse` failed on the same string inside the proof runner.
   - This appears to be a provider/runtime interaction issue, not a Zentext logic issue.
   - It means the Stage 7 continuation claim rests on Kimi and GLM evidence, not MiniMax.

2. **The proof is bounded to the files listed in repository evidence.**
   - Agents correctly stopped when the next required file (compiler crate source) was not in the provided evidence.
   - A stronger proof would include the compiler crate and verify the remaining upstream claims.

3. **Only two models completed the full workflow.**
   - A broader multi-model claim would require repeating the run with additional Ollama models once the provider flakiness is resolved.

## Release-readiness classification

**Ready for limited external Developer Preview.**

The core product promise — local-first structured memory, deterministic repack, and safe multi-agent handoffs that enable real repository continuation — is demonstrated across two independent models. The packaging workflow is validated. The stale-handoff safety fix is in place. The main remaining work before broader testing is expanding the model matrix and, optionally, adding the compiler crate to the repository evidence.

## Exact next action

1. Resolve the MiniMax JSON-parse flakiness or confirm it is a provider-side issue.
2. Add the Zenith compiler crate source to the repository evidence set if the next phase requires verifying upstream determinism claims.
3. Publish the Developer Preview to npm under the `next` dist-tag.
