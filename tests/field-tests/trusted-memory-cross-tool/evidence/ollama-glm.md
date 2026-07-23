# Ollama / GLM controlled-host participant

- Runtime: Ollama `0.32.1`
- Model: `glm-5.2:cloud`
- Host: `run-ollama.mjs`
- Surface: packed NDJSON RPC plus a deterministic file host
- Isolation: the model received the exact user prompt, validated revision-5
  continuation, the permitted Delta source, and current report only
- Starting revision: `5`
- Ending revision: `6`
- Consumed handoff: revision `5`
- Assigned action: Delta only
- Result: pass

Reproduction command:

```sh
node tests/field-tests/trusted-memory-cross-tool/run-ollama.mjs \
  tests/field-tests/trusted-memory-cross-tool/runtime/project
```

The host kept model output, host execution, and canonical state separate:

1. RPC returned a current revision-5 continuation.
2. GLM explained the recovered state and proposed `Delta: 37`.
3. The host checked task identity, revision, stopping point, next action,
   `upper=21`, `lower=16`, prior total `88`, and proposed total `125`.
4. Only after every check passed did the host edit the two permitted files,
   run verification, and record progress through RPC.
5. Revision advanced `5 → 6`; the consumed handoff became stale.

GLM's first response used a Markdown JSON fence and was rejected without a
write. A corrective model turn returned raw JSON and passed. This formatting
failure is preserved as part of the result; it was not silently repaired or
counted as a pass.
