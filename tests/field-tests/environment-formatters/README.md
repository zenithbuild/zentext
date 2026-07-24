# Environment formatter field smoke

This field smoke installs a real packed package from the issue #35 branch,
creates one isolated project and Zentext store, and renders the same current
continuation through every supported environment formatter.

The smoke is intentionally read-only. It tests whether a fresh consumer can
recover exact canonical identifiers and the next action from the presentation
wrapper. It does not claim a native hosted-provider integration or exercise a
provider-specific memory store.

## Isolation

- Package installed from `npm pack`, not repository imports.
- Temporary consumer, project, home, npm cache, and Zentext store.
- Example-only Git origin and no personal path in formatter output.
- Fresh ephemeral Codex invocation with a read-only sandbox and no prior task.
- Ollama local host request with no earlier model conversation.
- No credentials, databases, runtime directories, or raw private transcripts
  are committed.

## Result interpretation

- Deterministic formatter parity proves implementation behavior.
- A real environment smoke proves only that the named environment consumed the
  presentation.
- Model response-shape failures remain failures even when the extracted
  semantics are correct.
- Claude Code was not installed and is recorded as unavailable rather than
  replaced with another environment.

See [`results.json`](./results.json) for normalized evidence.
