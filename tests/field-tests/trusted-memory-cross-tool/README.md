# Trusted-memory cross-tool release-readiness test

This is the persistent, GUI-openable field-test fixture for PR #64. It proves
that Codex, OpenClaw, Gemini, and an Ollama-hosted model can consume and advance
the same canonical SQLite project memory without prior conversation history.

The fixture is installed from `npm pack`. It never imports unbuilt repository
source. Generated packages, dependencies, SQLite stores, raw transcripts, and
runtime homes remain under ignored `runtime/` or the normal external Zentext
store; only normalized, sanitized evidence is committed.

## Prepare

On Node 22 or Node 24:

```sh
npm run build
npm run field-test:trusted-memory:prepare
```

The command creates the stable local project:

```text
tests/field-tests/trusted-memory-cross-tool/runtime/project
```

It refuses to replace that path unless the prior directory contains the
field-test marker. The Git origin contains a unique non-routable run ID so a
new setup cannot accidentally reuse an older Zentext store.

Tool A creates the task and revision-2 handoff with multiple completed items,
changed files, blockers, verification entries, an accepted decision, a
stopping point, and the exact Alpha next action.

## Participant sequence

Each participant starts without an earlier provider conversation and receives
only the project, its canonical Zentext store, project-local instructions, and
this exact prompt:

> Read the current Zentext project memory, explain where the work stopped, then
> continue from the recorded next action. Do not repeat completed work.

| Participant | Assigned step | Expected revision |
|---|---|---:|
| Codex | Alpha | 2 → 3 |
| OpenClaw | Beta | 3 → 4 |
| Gemini through Antigravity CLI | Gamma | 4 → 5 |
| Ollama through an explicit host harness | Delta | 5 → 6 |

Before editing, every participant must explain the current state. After
editing, it must run `npm run verify`, record progress through the
`zentext-memory` RPC helper, re-read revision state, and prove the prior
handoff stale. A provider failure is preserved and classified; a same-provider
substitute is never counted.

Codex desktop can open the persistent fixture directly:

```sh
codex app tests/field-tests/trusted-memory-cross-tool/runtime/project
```

The final release-readiness run opened the stable fixture as a saved local
project and created a fresh native Codex task through the desktop task API.
No manual project-open step was required.

OpenClaw uses an isolated agent/session whose workspace is the fixture. Its
built-in file and command tools call the same project-local RPC helper. Gemini
uses the installed `agy` CLI only when authenticated local tool execution is
available. Ollama is identified as a model runtime; the evidence must name the
host harness that performs reads, writes, and RPC calls.

## Validate and render

After all four participants:

```sh
npm run field-test:trusted-memory:validate
node tests/field-tests/trusted-memory-cross-tool/render-report.mjs
```

Validation checks the final report, revision 6, every earlier handoff's stale
status, and exact semantic equality across CLI JSON, SDK, NDJSON RPC, and MCP.
The HTML file under `evidence/report.html` is a test-evidence viewer, not a
product GUI.

## Final result

The 2026-07-23 packed-package run passed:

| Participant | Action | Revision | Prior handoff |
|---|---|---:|---|
| Codex Desktop | Alpha `28` | `2 → 3` | stale |
| OpenClaw | Beta `29` | `3 → 4` | stale |
| Antigravity / Gemini | Gamma `31` | `4 → 5` | stale |
| Ollama / GLM controlled host | Delta `37` | `5 → 6` | stale |

The final report total is `125`. CLI JSON, TypeScript SDK, NDJSON RPC, and MCP
returned semantically identical revision-6 continuation state. All four prior
handoffs were stale, and 16 simultaneous packed RPC opens succeeded.

Normalized evidence:

- [`codex-desktop.md`](evidence/codex-desktop.md)
- [`openclaw.md`](evidence/openclaw.md)
- [`gemini.md`](evidence/gemini.md)
- [`ollama-glm.md`](evidence/ollama-glm.md)
- [`failures-observed.md`](evidence/failures-observed.md)
- [`security-matrix.md`](evidence/security-matrix.md)
- [`report.html`](evidence/report.html)

Browser-captured evidence:

- [`01-pr-63-merged.jpg`](evidence/screenshots/01-pr-63-merged.jpg)
- `02-pr-64-retargeted-and-validated.jpg` — captured after the final PR update
- [`03-proof-overview.jpg`](evidence/screenshots/03-proof-overview.jpg)
- [`04-cross-tool-matrix.jpg`](evidence/screenshots/04-cross-tool-matrix.jpg)
- [`05-revision-stale-proof.jpg`](evidence/screenshots/05-revision-stale-proof.jpg)
- [`06-interface-security-proof.jpg`](evidence/screenshots/06-interface-security-proof.jpg)
- [`07-final-canonical-continuation.jpg`](evidence/screenshots/07-final-canonical-continuation.jpg)
- [`08-supported-runtime-matrix.jpg`](evidence/screenshots/08-supported-runtime-matrix.jpg)

All report images were captured from the rendered, sanitized `report.html`.
The PR images were captured from the public GitHub pages. No terminal
screenshot, private path, credential, raw provider transcript, or fabricated
output is used.

## Evidence and safety

Commit only normalized evidence under `evidence/`. Do not commit:

- SQLite databases, WAL/SHM files, packages, caches, `node_modules`, or runtime
  homes;
- credentials, tokens, provider configuration, private transcripts, hidden
  reasoning, personal absolute paths, or raw browser state;
- edited or fabricated provider output.

Record exact tool versions, integration surfaces, start/end revisions, stale
results, failures, unavailable environments, and screenshot locations.
