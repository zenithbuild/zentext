# Portable continuation recording plan

Record one 45–60 second vertical demo from the real packed-package workflow.
Do not retype, shorten, or reconstruct command output. Use the live demo or the
exact generated checkpoints as the capture source.

## Capture setup

- Canvas: 1080 × 1350 (4:5).
- Terminal: Ghostty, Warp, iTerm2, or Hyper.
- Typeface: a readable monospace face at 30–36 pixels in the final video.
- Theme: high-contrast dark background with one restrained accent color.
- Window: no tabs, sidebars, hostname, username, home path, notifications, or
  unrelated shell history.
- Prompt: minimal and generic.
- Pace: use cuts between real checkpoints rather than accelerating text until
  it becomes unreadable.
- Audio: optional; captions must carry the complete product story without it.

Run from a clean checkout on supported Node 22 or Node 24:

```sh
npm ci
npm run build
node docs/demo/portable-continuation/run-demo.mjs
```

The runner installs the packed npm package, sanitizes its retained evidence, and
plays the six real presentation checkpoints in order.

## 55-second cut

| Time | Real checkpoint | On-screen message |
| --- | --- | --- |
| 0–4s | Title card | AI sessions end. Your project memory shouldn't. |
| 4–9s | `01-initialization.txt` | Project memory starts locally. |
| 9–18s | `02-task-and-handoff.txt` | Tool A records structured work, blockers, verification, and the exact next action. |
| 18–27s | `03-validated-continuation.txt` | A fresh tool recovers validated project state. |
| 27–34s | `04-portable-prompt-export.txt` | The same canonical state is portable as prompt text. |
| 34–47s | `05-fresh-tool-continuation.txt` | Tool B explains the state first, then continues without repeating completed work. |
| 47–53s | `06-stale-handoff-rejection.txt` | The task advances. The old handoff is rejected with exit code 4. |
| 53–55s | End card | Zentext — persistent project memory between AI coding tools. |

The title, short explanations, and end card are editorial overlays. Every
terminal command and result must remain an unmodified capture of real execution.

## Screenshot selection

Export one 1080 × 1350 still for each checkpoint:

1. initialization;
2. task and handoff creation;
3. validated continuation;
4. portable prompt export;
5. fresh-tool continuation;
6. stale-handoff rejection.

The full prompt checkpoint is longer than one frame. Capture its beginning
through the revision-validation rule, then use a second frame only if the full
canonical state is needed. Link the transcript wherever the screenshots are
published.

## Final review

Before publishing:

- compare every visible command and result with its checkpoint;
- confirm no credential, username, hostname, personal path, token, database, or
  provider session identifier is visible;
- verify the command and the relevant result are readable on a phone;
- keep the external-memory boundary explicit;
- do not imply conversation migration or hidden model-state transfer.
