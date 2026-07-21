# Stage 4 Multi-Model System Proof

This directory contains a reproducible field test that evaluates whether
Zentext enables multiple independent models to collaborate on the same project
without shared conversation history.

The harness is execution-only: it runs Agent A, B, C, and D for each configured
model, captures every prompt, raw response, parsed response, and Zentext state
snapshot, and writes a complete artifact package. Evaluation and scoring are
performed separately by a human reviewer.

## Scope

- No new Zentext features.
- No new CLI or MCP tools.
- Uses only the existing write domain, read paths, and repack engine.
- A thin model-adapter harness provides the evaluation plumbing.

## Provider

Ollama is the default provider. The harness also supports any OpenAI-compatible
endpoint via the `openai` provider.

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

   You only need the models you want to test to be available locally. Missing
   models are skipped and recorded as unavailable.

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

## Output

The harness prints the number of models evaluated and writes an artifact package
to `proof-results/` in the working directory (or the path passed with `--output`).
The package contains:

- `README.md` — summary of the run
- `comparison.md` — organized evidence for the six manual review questions
- One directory per model, each containing Agent A/B/C/D subdirectories with:
  - `system.txt`
  - `prompt.txt`
  - `response.txt`
  - `parsed.json`
  - `repack-before.md` (for B, C, D)
  - `mutation.json` (for B, C when an update is attempted)
  - `state-after.json` (when a mutation applies)
  - `error.txt` (when a step fails)

## Committed evidence

The `proof-results/` subdirectory committed here contains the artifacts from the
first real multi-model run using locally available Ollama models. See
`findings.md` for the reviewer interpretation of that evidence.

## Extending to new models

No code changes are required. Add an entry to `proof.config.json` with the
provider, model name, and optional `baseURL`.
