# Codex app result

Status: **pending manual UI execution**

The repository-side packed workflow passed on 2026-07-23. A Codex desktop pass
is intentionally not claimed: the available task API could not open the
generated temporary fixture as a saved Codex project.

To complete this result:

1. run `setup.mjs` against the packed package;
2. open the generated fixture folder in Codex desktop;
3. start a fresh task with no Tool A history;
4. send the exact prompt from `scenario.json`;
5. record Codex app version, model, recovered-state explanation, and sanitized
   tool calls;
6. run `validate.mjs`;
7. replace this pending document with the normalized result.

Do not paste private conversation history, credentials, personal paths, or the
SQLite database into this evidence.
