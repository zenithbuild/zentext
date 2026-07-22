# Stage 7 Scenario

## Target repository

zenithbuild/framework, cloned to a disposable local directory.

## Bounded task

Verify the Zenith CSS determinism contract.

### Why this task

- Requires understanding multiple repository surfaces: contract, implementation, tests.
- Investigation-first, not implementation-heavy.
- Reproducible via committed tests.
- Makes architecture drift easy to detect.
- Does not require modifying Zenith Framework.

### Deliverable

Document the exact code paths implementing each determinism invariant and whether each contract claim is satisfied, partially satisfied, or contradicted. Stop at a precise boundary before any proposed code change.

## Canonical project state

- **Project goal:** Verify the Zenith CSS determinism contract.
- **Accepted decision:** CSS blocks are ordered by dependency depth via compiler pre-sort before `process_css` is called.
- **Active task:** Trace Zenith CSS determinism contract to implementation.
- **Task status:** active
- **Files to read (read-only):**
  - `contracts/DETERMINISM.md`
  - `packages/bundler/src/utils.rs`
  - `packages/bundler/src/bundler_html_emit.rs`
  - `packages/bundler/tests/css_determinism.rs`
  - `packages/bundler/src/plugin/zenith_loader.rs`
  - `AGENTS.md`
- **Blockers:** none initially.

## Agent A prompt

See `prompts/agent-a.md`.

## Agent B prompt

See `prompts/agent-b.md`.

## Agent C prompt

See `prompts/agent-c.md`.

## Mutation contract

- Target record: active task only.
- Valid mutation: advance the task with a non-overlapping `next` step or add a finding to `completed`.
- Invalid mutation: change the accepted decision, modify Zenith source files, or use a stale revision.

## Stale context

Agent C uses the repack snapshot captured before Agent B's update and attempts an outdated task update. The expected outcome is a conflict with `applied: false`.
