# Stage 6 Cross-Provider Alignment — Findings

Date: 2026-07-20
Provider groups compared: Ollama (GLM, Kimi, MiniMax) vs Antigravity CLI (Gemini Flash, Gemini Pro; Claude Sonnet/Opus unavailable due to quota)

## Executive summary

The available Antigravity Gemini models materially aligned with the Ollama baseline on every important field: canonical truth, task selection, revision handling, implementation direction, decision preservation, stale-update rejection, and absence of hallucinations.

The primary evidence is a **clean isolated rerun** in which each Antigravity model ran in its own temporary `HOME` with a freshly seeded project. Both models observed task revision 1, eliminating the order effects that complicated the original sequential run.

## Metrics

| Metric | Result |
|---|---|
| Antigravity models executed (clean) | 2 / 4 |
| Antigravity models unavailable | 2 / 4 (quota) |
| Clean Antigravity models fully/materially aligned with Ollama consensus | 2 / 2 |
| Material disagreements (clean rerun) | 0 |
| Hallucinated records or decisions (clean rerun) | 0 |
| Correct task id selected by clean Antigravity | 2 / 2 |
| Live revision used by clean Antigravity | 2 / 2 |
| Valid continuation mutation applied (clean) | 2 / 2 |
| Stale updates rejected (clean) | 2 / 2 |

## Answers to the ten review questions

1. **Did the Antigravity models recover the same canonical truth as the Ollama models?**
   Yes. Both Gemini models in the clean rerun recovered the same project goal, accepted decision, and active task.

2. **Did both provider groups select the same task id and revision?**
   Both selected the correct live task id. In the clean rerun both observed revision 1, matching the live revision they actually saw (and matching Kimi in the Ollama baseline). GLM and MiniMax observed revisions 2 and 3 only because they ran later in the Ollama chain.

3. **Did both groups continue the same work?**
   Yes. Both groups advanced the active task toward OAuth callback handler, session middleware, and related tests.

4. **Did both groups produce materially equivalent implementation approaches?**
   Yes. All models identified PKCE/callback/session/tests as the implementation direction. Differences were tactical granularity only.

5. **Did both groups preserve the accepted decision?**
   Yes. No model proposed an alternative to OAuth 2.0 + PKCE.

6. **Did stale-write protection behave identically across providers?**
   Yes. All available Antigravity and Ollama models had their stale updates rejected with `conflict: true`.

7. **Which models deviated, and how?**
   No model materially deviated. Gemini Pro chose a narrower first step than some Ollama models, which is a tactical sequencing preference, not a deviation.

8. **Were deviations caused by missing Zentext context or model behavior?**
   No material deviations occurred. Minor granularity differences are attributable to model behavior, not missing context.

9. **Is the solution convergence strong enough to proceed to Developer Preview?**
   Yes, for the available models. The caveat is that Claude Sonnet and Claude Opus could not be tested due to quota limits, so the cross-provider claim is currently limited to the Gemini family. The Ollama group already included three distinct local models with strong convergence.

10. **Is any evidence-backed Zentext change required first?**
    No. The current repack output and prompts successfully enabled cross-provider alignment in the clean rerun. No core change is justified by this evidence.

## Limitations

- Claude Sonnet and Claude Opus were unavailable for this run due to Antigravity quota limits. They should be retested once quota resets.
- The clean rerun uses isolated stores, so each model advanced its own task record. This is the correct comparison for context recovery and continuation correctness, but it does not test multi-model mutation ordering on a single shared store. The ordered artifacts in `antigravity-results-ordered/` cover that case.
- The original sequential run is preserved as `antigravity-results-ordered/` but is no longer the basis of the cross-provider alignment claim.

## Recommendation

Proceed to Developer Preview. The clean cross-provider evidence shows strong alignment on canonical truth, safe continuation, and stale-update rejection across the available Ollama and Antigravity models. Re-run the Antigravity Claude models after quota reset to complete the provider matrix, but do not block Developer Preview on that coverage gap.
