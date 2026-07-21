# Stage 3 Multi-Agent Collaboration Proof

This directory contains a reproducible field test that evaluates whether
Zentext enables multiple independent models to collaborate on the same project
without shared conversation history.

## Scope

- No new Zentext features.
- No new CLI or MCP tools.
- Uses only the existing write domain, read paths, and repack engine.
- A thin model-adapter harness provides the evaluation plumbing.

## How to run

1. Build the project:
   ```bash
   npm run build
   ```

2. Run with real models by setting API keys:
   ```bash
   GLM_API_KEY=... KIMI_API_KEY=... MINIMAX_API_KEY=... QWEN_API_KEY=... \
     node /absolute/path/to/dist/proof/run.js
   ```

   Adapters use the OpenAI-compatible chat-completions endpoint for each
   provider. Model names and endpoints are configured in `src/proof/run.ts`.

3. Run the stub dry-run when no keys are available:
   ```bash
   node /absolute/path/to/dist/proof/run.js
   ```
   This verifies the harness and scoring logic but does not call external APIs.

## What it measures

For each configured model:

- Agent B: can it recover the current goal, latest decision, active task, and
  propose a valid continuation?
- Agent C: does an outdated update get rejected by optimistic concurrency with
  zero mutation?
- Agent D: can it summarize current state, completed work, rejected stale work,
  and the next step?

## Output

The harness prints a verdict object and writes `stage-3-proof-report.md` in the
working directory.

## Extending to new models

Add a new `OpenAICompatibleAdapter` in `src/proof/run.ts` with the provider's
base URL, model name, and environment variable key.
