# Alignment Matrix

Primary comparison uses the **clean isolated rerun** artifacts in `antigravity-results-clean/`. The original ordered sequential artifacts in `antigravity-results-ordered/` are listed as historical reference.

| Model | Goal | Accepted decision | Active task | Task id | Revision used | Implementation direction | Components affected | Continuation mutation | Handoff mutated | Next step | Stale conflict | Hallucinations | Overall alignment |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| GLM (Ollama) | exact | exact | exact | exact | live (rev 2) | material | material | applied | no | material | yes | none | fully aligned |
| Kimi (Ollama) | exact | exact | exact | exact | live (rev 1) | material | material | applied | no | material | yes | none | fully aligned |
| MiniMax (Ollama) | material | exact | exact | exact | live (rev 3) | material | material | applied | no | material | yes | none | fully aligned |
| **Ollama consensus** | exact | exact | exact | exact | live revision | material | material | applied | no | material | conflict | none | — |
| Gemini Flash (Antigravity, clean) | exact | exact | exact | exact | live (rev 1) | material | material | applied | no | material | yes | none | fully aligned |
| Gemini Pro (Antigravity, clean) | exact | exact | exact | exact | live (rev 1) | material | material | applied | no | material | yes | none | fully aligned |
| Gemini Flash (Antigravity, ordered) | exact | exact | exact | exact | live (rev 1) | material | material | applied | no | material | yes | none | fully aligned |
| Gemini Pro (Antigravity, ordered) | exact | exact | exact | exact | live (rev 2) | material | material | applied | no | material | yes | none | fully aligned |
| Claude Sonnet (Antigravity) | — | — | — | — | — | — | — | — | — | — | — | — | unavailable |
| Claude Opus (Antigravity) | — | — | — | — | — | — | — | — | — | — | — | — | unavailable |

## Classification notes

- **Exact alignment:** same canonical fact recovered (goal, decision, task, task id, revision behavior).
- **Material alignment:** wording or granularity differs, but architecture, direction, and next action are preserved.
- **Partial alignment:** main direction recovered but an important non-fatal detail omitted or changed.
- **Material disagreement:** contradicts accepted decision, changes architecture, targets wrong record, invents completed work, or redirects project.
- **Unavailable:** model could not be executed due to provider quota limits.

## Evidence links

- Ollama raw artifacts: `../stage-3-multi-agent-proof/after/proof-results/{glm,kimi,minimax}/agent-{B,C,D}/`
- Antigravity clean raw artifacts: `./antigravity-results-clean/{gemini-flash,gemini-pro}/agent-{B,C,D}/`
- Antigravity ordered raw artifacts: `./antigravity-results-ordered/{gemini-flash,gemini-pro}/agent-{B,C,D}/`
- Antigravity quota failures documented in `model-availability.md`

## Cross-group summary

| Group | Overall alignment | Notes |
|---|---|---|
| Ollama baseline | Fully aligned internally | GLM, Kimi, MiniMax converge on goal, decision, task, and implementation sequence |
| Antigravity Gemini (clean) | Fully aligned with Ollama consensus | Both Gemini models preserve canonical truth and produce materially equivalent continuations from identical starting conditions |
| Antigravity Gemini (ordered) | Fully aligned historically | Same models on a shared store; order effects are expected and handled by the live-revision rule |
| Antigravity Claude | Unavailable | Quota prevented execution; no alignment data |

## Pairwise comparisons (clean rerun)

| Pair | Goal | Decision | Task | Direction | Next step | Stale handling | Overall |
|---|---|---|---|---|---|---|---|
| Gemini Flash (clean) vs GLM | exact | exact | exact | material | material | exact | materially aligned |
| Gemini Flash (clean) vs Kimi | exact | exact | exact | exact | exact | exact | fully aligned |
| Gemini Pro (clean) vs GLM | exact | exact | exact | material | material | exact | materially aligned |
| Gemini Pro (clean) vs Kimi | exact | exact | exact | material | material | exact | materially aligned |
| Gemini Flash (clean) vs MiniMax | exact | exact | exact | material | material | exact | materially aligned |
| Gemini Pro (clean) vs MiniMax | exact | exact | exact | material | material | exact | materially aligned |
| Gemini Flash (clean) vs Gemini Pro (clean) | exact | exact | exact | material | material | exact | materially aligned |
| Antigravity Gemini (clean) vs Ollama consensus | exact | exact | exact | material | material | exact | materially aligned |
