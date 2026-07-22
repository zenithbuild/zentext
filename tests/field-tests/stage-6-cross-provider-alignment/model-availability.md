# Model Availability

## Antigravity CLI inspection

```bash
$ agy --version
1.1.5

$ agy --help
Usage of agy:
  --add-dir                       Add a directory to the workspace (repeatable) (default [])
  --agent                         Agent for the current CLI session
  -c                              Short alias for --continue
  --continue                      Continue the most recent conversation
  --conversation                  Resume a previous conversation by ID
  --dangerously-skip-permissions  Auto-approve all tool permission requests without prompting
  --effort                        Reasoning effort for the current CLI session (low|medium|high)
  -i                              Short alias for --prompt-interactive
  --log-file                      Override CLI log file path
  --mode                          Set the agent execution mode for this session (accept-edits, plan)
  --model                         Model for the current CLI session
  --new-project                   Create a new project for this session
  -p                              Short alias for --print
  --print                         Run a single prompt non-interactively and print the response
  --print-timeout                 Timeout for print mode wait (default 5m0s)
  --project                       Project ID for the current CLI session
  --prompt                        Alias for --print
  --prompt-interactive            Run an initial prompt interactively and continue the session
  --sandbox                       Run in a sandbox with terminal restrictions enabled

Available subcommands:
  agent           List available agents
  agents          List available agents
  changelog       Show changelog and release notes
  help            Show help for subcommands
  install         Configure environment paths and shell settings
  models          List available models
  plugin          Manage plugins (install, uninstall, list, enable, disable)
  plugins         Alias for plugin
  update          Update CLI

$ agy models
gemini-3.5-flash-medium
gemini-3.5-flash-high
gemini-3.5-flash-low
gemini-3.1-pro-low
gemini-3.1-pro-high
claude-sonnet-4-6
claude-opus-4-6-thinking
gpt-oss-120b-medium
```

## Authentication

The local `agy` CLI session was already authenticated. No API key, cookie, credential file, or token was read or requested.

## Selected models

| Requested model | Antigravity CLI selector | Status | Reason |
|---|---|---|---|
| Gemini Flash | `gemini-3.5-flash-medium` | Available and executed | Medium effort is the default representative Flash variant |
| Gemini Pro | `gemini-3.1-pro-high` | Available and executed | Highest effort Pro variant available |
| Claude Sonnet | `claude-sonnet-4-6` | Quota exceeded | `Error: Individual quota reached. Please upgrade your subscription to increase your limits.` |
| Claude Opus | `claude-opus-4-6-thinking` | Quota exceeded | Same quota error |

## Execution command

```bash
agy --model <SELECTOR> --dangerously-skip-permissions --print "<PROMPT>"
```

The `--dangerously-skip-permissions` flag is required because headless `--print` mode cannot prompt for tool permissions and auto-denies them without it.

## Clean isolated rerun

The original Stage 6 run used a single shared Zentext store, which caused order-dependent revision numbers. To obtain a valid cross-provider comparison, the available Antigravity models were re-run individually, each with its own isolated temporary `HOME` and freshly seeded project.

For each clean run:

- A new temporary directory was used as `process.env.HOME` for Zentext store creation.
- The project was seeded with the canonical scenario (goal, decision, task, handoff).
- The `agy` child process still received the user's real `HOME` so the CLI could find its authenticated session.
- Each model executed the full A→B→C→D workflow against its own store.
- Both clean runs observed task revision 1.

Command shape used by the proof harness for the clean rerun:

```bash
HOME=<real-user-home> agy --model <SELECTOR> --dangerously-skip-permissions --print "<PROMPT>"
```

The Zentext store itself was located under a per-run temporary `HOME`, not under the user's real home directory.

## Important note on harness isolation

The Stage 6 proof harness isolates the Zentext store by setting `process.env.HOME` to a temporary directory. The `agy` CLI needs the user's real home directory to find its authenticated session, so the `AntigravityCliAdapter` captures `process.env.HOME` at module-load time and passes it as the child process `HOME` environment variable while the Zentext operations use a separate temporary `HOME`.
