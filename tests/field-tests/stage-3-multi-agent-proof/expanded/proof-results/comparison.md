# Stage 5 Expanded Evidence Comparison

This document collects the evidence required to evaluate multi-round continuation.
Do not treat it as a scorecard.

## Models

### kimi

- **Round 0 / Agent A**: completed
- **Round 1 / Agent B**: mutation attempted=true applied=true conflict=false
- **Round 2 / Agent B**: mutation attempted=true applied=true conflict=false
- **Round 3 / Agent B**: mutation attempted=true applied=true conflict=false
- **Round 4 / Agent C**: mutation attempted=true applied=false conflict=true
- **Round 5 / Agent D**: completed

### glm

- **Round 0 / Agent A**: completed
- **Round 1 / Agent B**: mutation attempted=true applied=true conflict=false
- **Round 2 / Agent B**: mutation attempted=true applied=true conflict=false
- **Round 3 / Agent B**: mutation attempted=true applied=true conflict=false
- **Round 4 / Agent C**: mutation attempted=true applied=false conflict=true
- **Round 5 / Agent D**: completed

### minimax

- **Round 0 / Agent A**: completed
- **Round 1 / Agent B**: mutation attempted=true applied=true conflict=false
- **Round 2 / Agent B**: mutation attempted=true applied=true conflict=false
- **Round 3 / Agent B**: mutation attempted=true applied=true conflict=false
- **Round 4 / Agent C**: mutation attempted=true applied=false conflict=true
- **Round 5 / Agent D**: completed

### qwen3

Skipped: Model qwen3:latest not found in Ollama

## Manual review questions

1. Can a fresh model continue the task across multiple independent rounds without overwriting prior work?
   - Review each round's `mutation.json`. Expected: `applied: true` and revision increments sequentially.

2. Do revisions stay contiguous and free of gaps or regressions?
   - Inspect `final-state.json` and compare task revisions across rounds.

3. Are updates meaningfully advancing the task rather than restating it?
   - Compare each round's `parsed.json` patch to the previous round's task state.

4. Do stale-attempt rounds fail consistently?
   - Review the Agent C round `mutation.json`. Expected: `applied: false` and `conflict: true`.

5. Does the final summary accurately describe the completed chain of work?
   - Compare the final Agent D `parsed.json` to `final-state.json`.

6. What is the smallest improvement required before Developer Preview?
   - Identify one change to prompts, repack output, or schema documentation that would reduce round failures.
