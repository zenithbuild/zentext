# Environment-specific continuation formatters

Environment formatters are a presentation layer over the validated canonical
continuation. They do not read a different store, add provider-only fields, or
create a provider-specific write path.

```text
SQLite canonical records
        ↓
validated ContinuationView
        ↓
environment formatter
        ↓
text instructions + unchanged canonical state
```

Formatter contract version: `1.0`.

## CLI

```bash
zentext continue --for generic
zentext continue --for codex
zentext continue --for claude-code
zentext continue --for ollama-host
```

The original issue spellings remain aliases:

```bash
zentext continue --for claude  # resolves to claude-code
zentext continue --for ollama  # resolves to ollama-host
```

`--compact` removes the longer environment wrapper while preserving the entire
canonical state. `--include-instructions` adds the complete tool-neutral
continuation contract.

```bash
zentext continue --for codex --compact
zentext continue --for codex --include-instructions
```

Environment output is text. It cannot be combined with `--json`, `--markdown`,
or `--prompt`. Existing JSON output is unchanged:

```bash
zentext continue --json
```

An unknown name exits nonzero, identifies the unsupported value, lists every
supported canonical identifier, and documents the aliases.

## Supported identifiers

### `generic`

The semantic baseline for any local tool or harness that can consume structured
text.

### `codex`

Guidance for a Codex project environment using the project-local Zentext skill
or NDJSON RPC. This is formatting assistance; the real Codex field test uses
the same provider-neutral memory interface.

### `claude-code`

Guidance for a Claude Code project command, hook, or local adapter. The
formatter is deterministic and package-tested. It is not evidence of a native
Claude hosted integration, and this release does not claim one.

### `ollama-host`

Guidance for the host application that validates Zentext state before invoking
an Ollama model and mediates any subsequent write. Ollama itself is not treated
as a coding agent, project store, or trusted write boundary.

OpenClaw and Antigravity/Gemini are not included in issue #35. Their earlier
field-test participation proved provider-neutral consumption, not a need for
dedicated formatters.

## Semantic and safety guarantees

Every formatter embeds the same complete redacted `ContinuationView` between
explicit validated-state markers. The environment wrapper may change headings,
phrasing, compactness, and invocation guidance. It cannot change:

- project or task identity;
- task or handoff revision;
- handoff record ID;
- accepted decisions;
- completed work;
- changed files;
- blockers;
- verification;
- references and source environment;
- stopping point or exact next action;
- quality warnings; or
- validation status.

Stale state is rejected before formatter dispatch with the existing exit code
`4`. Likely secrets remain redacted, unsafe control input is rejected, and no
adapter bypasses the canonical continuation builder, `MemoryStore`, or
revision-safe write domain.

Formatter tests prove semantic parity and deterministic output. A formatter
test is not proof of a native provider integration; real-environment evidence
is reported separately and named by the actual consuming environment.

The current field smoke used a packed artifact. Fresh Codex CLI consumption
returned the exact requested canonical identifiers and next action. Claude Code
was unavailable because its executable was not installed. The Ollama host
recovered exact semantics, while tested cloud models varied in whether they
obeyed the requested response shape; those formatting failures are preserved
rather than rewritten into passes. See the
[normalized field results](../tests/field-tests/environment-formatters/results.json).
