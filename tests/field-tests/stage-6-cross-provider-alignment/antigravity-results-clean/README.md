# Stage 6 — Antigravity Clean Rerun Artifacts

This directory contains raw execution artifacts for the **clean isolated rerun** of the Stage 6 cross-provider alignment proof.

Each Antigravity model ran in its own isolated temporary `HOME` with a freshly seeded project. Both models therefore observed task revision 1.

## Models evaluated

- **gemini-flash** (antigravity-cli/gemini-3.5-flash-medium) — available
- **gemini-pro** (antigravity-cli/gemini-3.1-pro-high) — available

## Per-model contents

Each model directory contains Agent A/B/C/D prompts, raw responses, parsed responses, repack outputs, and mutation outcomes.

The top-level `comparison.md` organizes the evidence for human review but does not assign scores.
