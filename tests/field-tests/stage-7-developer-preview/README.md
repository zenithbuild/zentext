# Stage 7 — Developer Preview Readiness and Real-Repository Handoff Validation

This field test validates that:

1. Zentext can be installed from a packed npm tarball.
2. A fresh agent can load a structured handoff from another agent.
3. The fresh agent can acknowledge the handoff and continue real repository investigation using the same read-only repository evidence as the previous agent.
4. Zentext works against a bounded task in the real Zenith Framework repository.

## Selected task

Verify the Zenith CSS determinism contract by tracing claims from `contracts/DETERMINISM.md` to the Rust implementation in `packages/bundler/src/utils.rs` and `packages/bundler/src/bundler_html_emit.rs`, and comparing them with the existing contract tests in `packages/bundler/tests/css_determinism.rs`.

## Models exercised

- `kimi-k2.7-code:cloud` — completed all agents, continuation succeeded, stale write rejected.
- `glm-5.2:cloud` — completed all agents, continuation succeeded, stale write rejected.
- `minimax-m3:cloud` — available but failed to return consistently parseable JSON during Agent A execution. Recorded as a provider-side reliability issue, not a Zentext defect.

## Structure

- `scenario.md` — exact canonical project state and prompts.
- `target-repository.md` — Zenith Framework files used and read-only guarantee.
- `execution-plan.md` — implementation and test plan.
- `package-validation.md` — npm tarball validation results.
- `tester-script.md` — script for external testers.
- `prompts/` — shared repository context and agent-specific instructions used by the proof runner.
- `results/` — raw execution artifacts per model.
- `normalized-results.json` — extracted scoring fields.
- `alignment-matrix.md` — per-agent scoring.
- `findings.md` — final readiness classification.
- `security-review.md` — credential and secret scan results.

## Safety rules

- No modifications to Zenith Framework master.
- No push to the Zenith repository.
- No npm publish.
- No core Zentext architecture changes unless a failing real-world test proves they are required.
- No credentials or local authenticated state committed.
