# Portable continuation demo

This is the public Developer Preview workflow for Zentext:

```text
Tool A works
  ↓
records structured project memory
  ↓
exits
  ↓
Tool B receives only a portable Zentext continuation and the project
  ↓
explains recovered state before editing
  ↓
continues from the exact next action without repeating work
  ↓
canonical task revision advances
  ↓
the original handoff is rejected as stale
```

The demo uses the package produced by `npm pack`; it never imports Zentext from
the repository source tree. Tool A and Tool B are separate deterministic
processes so the demo can run without provider credentials. The real
three-tool/model validation is documented in
[`tests/field-tests/m1-cross-platform-continuation/results.md`](../../../tests/field-tests/m1-cross-platform-continuation/results.md).

## Run

From the repository root on supported Node 22 or Node 24:

```sh
npm ci
npm run build
node docs/demo/portable-continuation/run-demo.mjs
```

The script:

1. packs `zentext@0.1.0-dev.2` into a temporary directory;
2. installs that tarball into an isolated consumer with its own npm cache;
3. initializes an isolated demo project and Zentext home;
4. creates a task and runs the Tool A work boundary;
5. records completed work, changed files, blockers, verification, stopping
   point, and next action;
6. exercises `zentext continue`, `continue --prompt`, and handoff exports;
7. starts Tool B with only portable JSON and the project files;
8. records Tool B's progress through the installed CLI;
9. verifies the original handoff fails validation with exit code 4.

It deletes its package, databases, caches, temporary homes, and consumer
directories. Only the automatically captured, path-sanitized transcript and
screenshot checkpoints remain.

## Real execution evidence

- [Full transcript](./transcript.txt)
- [Screenshot checkpoints](./checkpoints/)

Command text is derived from the actual process invocation, and output is
captured directly from stdout/stderr. The automatic sanitizer replaces only the
temporary workspace and repository prefixes; it does not rewrite command
results.

## Screenshot checkpoints

1. [Initialization](./checkpoints/01-initialization.txt)
2. [Task and handoff creation](./checkpoints/02-task-and-handoff.txt)
3. [Validated continuation](./checkpoints/03-validated-continuation.txt)
4. [Portable prompt export](./checkpoints/04-portable-prompt-export.txt)
5. [Fresh-tool continuation](./checkpoints/05-fresh-tool-continuation.txt)
6. [Stale handoff rejection](./checkpoints/06-stale-handoff-rejection.txt)

The six files are exact, sanitized screenshot boundaries from the successful
run. This environment did not permit automated terminal capture, so no PNG was
fabricated or committed. To capture them later, display each checkpoint in a
terminal with a 1080-by-1350 viewport, include both the command and output, and
do not edit the checkpoint text.

## Boundaries

This demonstrates persistent external project memory. It does not transfer
hidden model state, migrate a conversation, resume a provider session, or
orchestrate concurrent agents. SQLite structured records remain canonical; the
CLI, JSON, Markdown, prompt, and optional MCP surfaces remain views.
