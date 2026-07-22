# Stage 6 — Cross-Provider Alignment Proof

This directory contains a cross-provider comparison of how independent models recover and continue the same Zentext project state.

## Goal

Determine whether models from different providers (local Ollama models and Antigravity CLI models) converge on the same canonical truth, select the same task and revision, preserve the accepted decision, and produce materially equivalent continuations.

## Structure

- `scenario.md` — exact canonical project state and task used for every model.
- `model-availability.md` — which models were available and how they were invoked.
- `ollama-consensus.md` — baseline consensus from committed Ollama artifacts.
- `antigravity-results.md` — per-model results from the Antigravity CLI.
- `alignment-matrix.md` — pairwise classification of alignment across all comparison fields.
- `disagreements.md` — analysis of any partial or material disagreements.
- `findings.md` — final answers to the ten review questions.
- `normalized-results.json` — normalized extraction of key fields for programmatic comparison.
- `antigravity-results-clean/` — raw Antigravity response artifacts from the isolated per-model rerun (primary evidence).
- `antigravity-results-ordered/` — original sequential-run artifacts, preserved for transparency (secondary, historical).
- Ollama raw artifacts are referenced from `../stage-3-multi-agent-proof/after/proof-results/`.

## Method

Every model received the identical Zentext repack output, identical system prompt, and identical JSON schema request. No prompt was tuned per provider.

For the Antigravity CLI, both the system prompt and the user prompt are forwarded to `agy --print` inside a single argument separated by deterministic delimiters (`--- ZENTEXT_SYSTEM ---` and `--- ZENTEXT_USER ---`). This guarantees that each Antigravity model sees the same complete prompt as the Ollama models, even though `agy --print` accepts only one prompt string.

### Clean rerun (primary evidence)

To avoid order effects, each Antigravity model was re-run individually, each with its own isolated temporary `HOME` and freshly seeded project. Both models therefore observed task revision **1**. This is the valid cross-provider comparison.

### Original ordered run (historical)

The first Stage 6 run used a single shared store, so later models observed higher revisions:

- gemini-flash saw revision 1 and advanced it to revision 2.
- gemini-pro saw revision 2 and advanced it to revision 3.

Those artifacts are preserved in `antigravity-results-ordered/` for transparency, but they represent a continuation chain rather than a clean cross-provider comparison. The alignment matrix and findings are based on the clean rerun.

## Important note on revisions

Revision numbers depend on execution order when models mutate a shared store. The valid comparison is whether each model selected the correct **live** task id and the revision it actually observed. In the clean rerun both Antigravity models observed revision 1, matching Kimi in the Ollama baseline. GLM and MiniMax observed higher revisions only because they ran later in the Ollama chain.
