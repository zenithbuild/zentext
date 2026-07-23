# M1 cross-platform continuation results

Execution completed at `2026-07-23T02:17:22Z` on macOS arm64 with supported
Node `v24.18.0`. The strict validator passed with three isolated real-tool
executions.

## Result summary

| Receiving tool | Version or model | Portable input | Result |
| --- | --- | --- | --- |
| Codex CLI | `codex-cli 0.144.5` | canonical prompt export | pass |
| Antigravity CLI | `1.1.5`, `gemini-3.6-flash-high` | canonical JSON export | pass |
| Ollama | `0.32.1`, `kimi-k2.7-code:cloud` | canonical Markdown export | pass |

Each receiver had no Tool A conversation or provider resume state. It first
returned the task, both completed items, both changed files, both blockers,
both verification entries, the stopping point, and the exact next action. It
then inspected the explicitly allowed source-b fixture, calculated `13 + 9 =
22`, verified `28 + 22 = 50`, and stated that completed source-a work was not
repeated.

The harness applied each receiver's two progress notes through the public CLI.
That advanced the task from revision 2 to revision 3. The original revision-2
handoff then failed both `zentext handoff validate --json` and `zentext continue
--json` with exit code 4.

## Evidence categories

- Automated regressions: the Vitest suites cover repeatable parsing and
  persistence, the canonical view, all renderers, export parity, stale
  rejection, help, and packed-package behavior.
- Deterministic harness: a no-provider dry run completed before the real matrix.
- Real executions: all three configured unrelated tool/model families passed.
- Unavailable environments: standalone Claude CLI and standalone Kimi CLI were
  not installed. Neither was substituted with a same-platform session or
  reported as tested. Kimi was tested only through a fresh Ollama API request.

## Isolation

Every participant used a fresh temporary Git project and isolated Zentext
`HOME`. Tool A was a separate deterministic process that read only source-a,
wrote the partial report and verification log, recorded the ordered handoff,
and exited before the receiver started. The receiver got only the temporary
project, one exported continuation surface, the scenario instruction, and the
allowed source-b file content. No conversation id, resume flag, hidden
scratchpad, provider history, or answer-bearing prompt variable was shared.

Codex used an ephemeral, read-only execution. Antigravity used a new project in
plan/sandbox mode. Ollama received a fresh chat request containing no previous
messages.

## Surfaces exercised

All passed:

- default `zentext continue`;
- `continue --json`, `--markdown`, and `--prompt`;
- `handoff export --format json|markdown|prompt`;
- canonical tool-neutral prompt rules;
- repeated completed work, changed files, blockers, verification, and task
  notes in invocation order;
- stale validation and stale continuation rejection.

## Failures and limitations

There were no failures among the three configured participants. This proof is
serial continuation, not orchestration or concurrent coordination. Text-only
model APIs receive the explicitly allowed fixture content in their isolated
prompt. The result proves portable consumption of explicit external project
memory; it does not and cannot prove transfer of hidden model state, private
reasoning, session history, or a provider's internal context window.

Normalized safe evidence is in `evidence/`. Temporary stores, raw provider
output, credentials, session data, and local absolute paths were not retained.

