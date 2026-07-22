# Stage 4 Evidence Comparison

This document collects the evidence required to answer the six manual review questions.
Do not treat it as a scorecard. It is an organized view of the raw artifacts.

## Models

### gemini-pro

- Provider/model: antigravity-cli/gemini-3.1-pro-high
- **Agent A**: completed
- **Agent B**: mutation attempted=true applied=true conflict=false
- **Agent C**: mutation attempted=true applied=false conflict=true
- **Agent D**: completed

## Manual review questions

Answer these questions by inspecting the per-model artifact directories.

1. Did Zentext preserve enough context?
   - Review each Agent B `parsed.json`. Does it correctly identify the current goal, latest decision, active task, and next action?

2. Could a completely fresh model continue work?
   - Review each Agent B `mutation.json`. Was a valid update attempted and applied?

3. Did stale information remain rejected?
   - Review each Agent C `mutation.json`. Was the stale update rejected with `applied: false` and `conflict: true`?

4. Did the models generally reach the same understanding?
   - Compare the Agent B `parsed.json` files across models. Look for agreement on goal, decision, task, and next action.

5. What information was consistently missing?
   - Identify fields or concepts that most models omitted or misunderstood.

6. What is the smallest improvement that would increase continuation quality?
   - Identify one change to prompts, repack output, or schema documentation that would reduce disagreement or omission.
