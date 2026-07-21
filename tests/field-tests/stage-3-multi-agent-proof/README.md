# Stage 3 Multi-Agent Collaboration Proof

This directory contains a reproducible field test that evaluates whether
Zentext enables multiple independent models to collaborate on the same project
without shared conversation history.

## Design

This proof is **execution-only**. The harness:

1. Seeds a realistic project state (Agent A).
2. Runs each configured model through Agent B, C, and D in fresh sessions.
3. Captures every prompt, raw response, parsed response, and Zentext state snapshot.
4. Writes a Markdown report with all artifacts.

**Evaluation and scoring are intentionally separate.** A reviewer (human or model)
reads the report and answers the six verdict questions. The harness itself does
not judge model outputs.

## Scope

- No new Zentext features.
- No new CLI or MCP tools.
- Uses only the existing write domain, read paths, and repack engine.
- A thin model-adapter harness provides the evaluation plumbing.

## Providers

Ollama is the default provider. The harness also supports any OpenAI-compatible
endpoint via the `openai` provider, but no API-key-specific branching is built
in.

## How to run

1. Build the project:
   ```bash
   npm run build
   ```

2. Start Ollama:
   ```bash
   ollama serve
   ```

3. Run with the default model list:
   ```bash
   node /absolute/path/to/dist/proof/run.js
   ```

   The default list is:
   - `qwen3:latest`
   - `kimi-k2`
   - `glm4`
   - `minimax-m1`

   You only need the models you want to test to be available locally.

4. Run with a custom JSON config:
   ```bash
   node /absolute/path/to/dist/proof/run.js --config proof.config.json
   ```

   Example `proof.config.json`:
   ```json
   {
     "models": [
       { "name": "qwen3", "provider": "ollama", "model": "qwen3:latest" },
       { "name": "kimi", "provider": "ollama", "model": "kimi-k2" },
       { "name": "glm", "provider": "ollama", "model": "glm4" },
       { "name": "minimax", "provider": "ollama", "model": "minimax-m1" }
     ]
   }
   ```

5. Run a single model quickly:
   ```bash
   node /absolute/path/to/dist/proof/run.js --provider ollama --model qwen3:latest
   ```

6. Run the stub dry-run when no models are available:
   ```bash
   node /absolute/path/to/dist/proof/run.js --stub
   ```
   This verifies the harness and artifact collection but does not call external APIs.

## What it measures

For each configured model:

- **Agent A:** deterministic seed of an active task, accepted decision, and latest handoff.
- **Agent B:** can it recover the current goal, latest decision, active task, and propose a valid continuation?
- **Agent C:** does an outdated update get rejected by optimistic concurrency with zero mutation?
- **Agent D:** can it summarize current state, completed work, rejected stale work, and the next step?

## Output

The harness prints the number of models evaluated and writes
`stage-3-proof-report.md` in the working directory. The report contains the raw
artifacts only; a reviewer produces the final verdict.

## Adding models

No code changes are required. Add an entry to `proof.config.json` (or the
default config in `src/proof/run.ts`) with the provider, model name, and
optional `baseURL`.
