# Stage 7 Execution Plan

## Goal

Prepare Zentext for external Developer Preview testing and validate real agent handoffs against the isolated Zenith Framework repository.

## Phase 7 outcomes

1. A tester can install Zentext from a locally packed npm artifact.
2. A tester can initialize and inspect Zentext without repository-specific knowledge.
3. A fresh agent can load a structured handoff from another agent and continue exactly from the previous stopping point.
4. Zentext is validated against a bounded, investigation-first task inside the real Zenith Framework architecture.
5. The npm package is ready for prerelease publish, but **not published** during this phase.

## Selected Zenith task

**Task:** Verify the Zenith CSS determinism contract.

**Why this task is appropriate:**

- It requires understanding more than one repository surface: the canonical contract (`contracts/DETERMINISM.md`), the implementation (`packages/bundler/src/utils.rs`, `packages/bundler/src/bundler_html_emit.rs`), and the contract tests (`packages/bundler/tests/css_determinism.rs`).
- It is investigation-first. The primary work is tracing behavior and documenting whether the contract claims match the implementation, not making large code changes.
- It is reproducible. The tests are committed and deterministic.
- It makes architecture drift easy to detect. A key finding from the existing test file is that the bundle hash is computed from sorted per-block hashes, making the filename order-independent, while the CSS content order depends on the compiler's pre-sorted input. Any change that breaks this relationship would be visible immediately.
- It avoids destructive changes. We will not modify Zenith Framework master, push to the Zenith repository, or run the build pipeline against production assets.

**Bounded deliverable:**

- Document the exact code paths that implement each determinism invariant.
- Record whether each contract claim is satisfied, partially satisfied, or contradicted by the current code.
- Identify one precise stopping point before any proposed code change.
- Produce a structured handoff that captures the active task, accepted decisions, completed investigation, exact stopping point, and next action.

## Zenith files to read (no modifications)

- `contracts/DETERMINISM.md` — canonical determinism contract.
- `packages/bundler/src/utils.rs` — `process_css` implementation, hashing, anchor validation, and normalization helpers.
- `packages/bundler/src/bundler_html_emit.rs` — HTML anchor validation during emission.
- `packages/bundler/tests/css_determinism.rs` — existing contract tests for CSS determinism.
- `packages/bundler/src/bundle.rs` — high-level bundler pipeline that calls `process_css`.
- `packages/bundler/src/plugin/zenith_loader.rs` — newline normalization during transform.
- `AGENTS.md` — agent contract and governance rules.

## Zentext files expected to change

### New source files

- `src/handoff.ts` — structured handoff contract, serialization, deserialization, and acknowledgement generation.

### Modified source files

- `src/types/records.ts` — add a strongly typed `StructuredHandoff` shape and acknowledgement types if they do not fit inside `HandoffPayload`.
- `src/cli/commands.ts` — add `handoff` command handlers: `show`, `acknowledge`, `create`.
- `src/cli/cli.ts` — wire the `handoff` subcommand.
- `src/cli/format.ts` — add human-readable handoff formatting and acknowledgement rendering.

### New test files

- `tests/handoff.test.ts` — handoff serialization, required `stopping_point`, `next_action` rules, blocker representation, live revision validation, stale revision rejection, acknowledgement generation.
- `tests/npm-pack.test.ts` — `npm pack` contents, fresh-directory tarball installation, installed CLI help, init, status, and handoff smoke behavior.

### Modified test files

- `tests/cli.test.ts` — add CLI handoff inspection tests.

### New documentation files

- `docs/handoffs.md` — handoff contract and usage.
- `docs/switching-agents.md` — how to use startup acknowledgements when switching agents.
- `docs/tester-onboarding.md` — npm install, init, and first commands for external testers.

### New field-test artifacts

- `tests/field-tests/stage-7-developer-preview/`
  - `README.md`
  - `scenario.md`
  - `target-repository.md`
  - `execution-plan.md`
  - `package-validation.md`
  - `tester-script.md`
  - `prompts/agent-a.md`
  - `prompts/agent-b.md`
  - `prompts/agent-c.md`
  - `results/agent-a/`
  - `results/agent-b/`
  - `results/agent-c/`
  - `results/stale-mutation/`
  - `normalized-results.json`
  - `alignment-matrix.md`
  - `disagreements.md`
  - `findings.md`
  - `security-review.md`

## npm packaging risks found

- `package.json` is marked `private: true`. This must remain true for the Developer Preview phase. The tarball can be installed locally, but publishing to npm is blocked by the `private` flag.
- `bin` entries point to `dist/cli/cli.js` and `dist/mcp/bin.js`. These must exist after `npm run build`. The `files` array includes `dist`, `README.md`, and `docs/mcp.md`, with `!dist/proof` excluded. The proof harness is not shipped, which is correct for a Developer Preview package.
- `better-sqlite3` is a native dependency. A fresh install must compile the SQLite binding. We will validate that the tarball installs and builds correctly in a clean temporary directory.
- The `license` field is `UNLICENSED`. This is acceptable for a Developer Preview but should be noted as a known limitation.

## Stage 7 agent sequence

### Agent A

1. Start with the isolated Zenith Framework repository.
2. Read `contracts/DETERMINISM.md`, `packages/bundler/tests/css_determinism.rs`, `packages/bundler/src/utils.rs`, and `packages/bundler/src/bundler_html_emit.rs`.
3. Trace each contract claim to its implementation:
   - topological ordering
   - byte-stability (LF normalization)
   - strict anchor enforcement
   - no hidden mutation / duplicate detection
   - canonical module IDs
   - runtime parity (dev vs. build)
4. Record accepted decisions (for example: "The bundler relies on the compiler to pre-sort style blocks before `process_css` is called").
5. Record completed investigation.
6. Stop at a precise boundary before the next legitimate action (for example: "Next action is to verify the observed hash-order independence behavior against a fresh build artifact or to document it as a contract clarification").
7. Produce a structured handoff in Zentext.

### Agent B

1. Start without Agent A's conversation.
2. Run `zentext status` and `zentext handoff show` in the Zentext project tied to the isolated Zenith checkout.
3. Acknowledge the structured handoff:
   - active task
   - task id and live revision
   - previous agent
   - completed work
   - exact stopping point
   - next action
   - blockers
4. Continue exactly one legitimate step (for example: inspect the actual `process_css` source lines that implement anchor validation and confirm the finding).
5. Update the active task using the live revision.
6. Produce the next structured handoff.

### Agent C

1. Start fresh without prior conversations.
2. Load the updated Zentext context.
3. Confirm the new stopping point.
4. Review Agent B's work for architecture or scope drift.
5. Produce a final handoff or completion record.

### Stale mutation proof

1. Capture the live task revision after Agent B's update.
2. Attempt to apply a patch using the previous (stale) revision.
3. Prove that Zentext rejects the mutation with a conflict and preserves the live task state.

## Implementation order

1. Write this execution plan and have it reviewed.
2. Implement the structured handoff contract in `src/handoff.ts`.
3. Add acknowledgement generation.
4. Add CLI handoff commands.
5. Add automated tests for handoff behavior, stale rejection, and acknowledgements.
6. Add npm packaging and installed-tarball smoke tests.
7. Add documentation for handoffs, switching agents, and tester onboarding.
8. Run the Stage 7 Zenith handoff test using at least three fresh agent sessions and capture artifacts.
9. Run the full validation suite and produce the final report.

## Stopping condition

Stop if any real test exposes a required Zentext architecture change. Do not broaden scope to fix unrelated Zenith Framework issues. Document findings and let evidence drive the next phase.


## Completion status

| Step | Status |
|---|---|
| Structured handoff schema and validation | ✅ `src/handoff.ts` |
| Revision-safe persistence | ✅ Uses existing `SqliteStore` and `MemoryWriter` |
| Human and JSON startup acknowledgement | ✅ `renderAcknowledgement` |
| Minimal CLI commands | ✅ `handoff show/acknowledge/validate/create` |
| Unit and integration tests | ✅ `tests/handoff.test.ts`, `tests/cli.test.ts` handoff tests, `tests/npm-pack.test.ts` |
| Documentation | ✅ `docs/handoffs.md`, `docs/switching-agents.md`, `docs/tester-onboarding.md` |
| npm package metadata and tarball validation | ✅ `npm pack` + fresh install smoke test |
| Fresh-directory installation test | ✅ `tests/npm-pack.test.ts` |
| Agent A, B, and C Zenith proof | ✅ `src/proof/stage7-run.ts` + Kimi artifacts |
| Stale-revision replay | ✅ Rejected with conflict |
| Final readiness classification | ✅ `findings.md` |

## Validation results

- `npm run typecheck` ✅
- `npm run typecheck:test` ✅
- `npm test` — 209 tests passed ✅
- `npm run build` ✅
- `git diff --check` ✅
- `npm pack` ✅
- Fresh-directory tarball installation ✅
- Installed CLI smoke commands ✅

## Known issues addressed

- `npm install` in tests requires a clean environment without inherited `npm_config_*` variables that conflict with project-level `allowScripts`.
- Project ID derivation must use the same resolved path; `process.cwd()` in the seed script ensures it matches the CLI.

## Remaining work before broader testing

Improve Agent B and C prompts in `src/proof/stage7-run.ts` to include read-only repository file contents so continuing agents can perform real inspection instead of claiming file-access blockers.
