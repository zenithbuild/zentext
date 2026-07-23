# Codex app project-memory acceptance test

This field test proves that a fresh Codex desktop task can recover and update
Zentext through the project-local skill and structured RPC without receiving
Tool A's conversation.

## Allowed context

The fresh Codex participant receives only:

- the isolated fixture project;
- its external Zentext store;
- `.agents/skills/zentext-memory/`;
- the exact prompt below.

It must not receive Tool A's conversation, hidden scratchpad, provider session
state, or a copied transcript.

## Exact prompt

> Read the current Zentext project memory, explain where the work stopped, then
> continue from the recorded next action. Do not repeat completed work.

## Setup from a packed consumer

Set `ZENTEXT_BIN` to the installed packed-package executable and
`ZENTEXT_MODULE` to the installed package's `dist/index.js` filesystem path:

```sh
node tests/field-tests/codex-app-memory/setup.mjs /tmp/zentext-codex-fixture
```

The setup creates a clean project, installs the project-local skill, initializes
Zentext, creates the task, and records Tool A's structured state through the
SDK. Its JSON output includes the starting revision and original handoff ID.

Open that exact fixture directory in the Codex app, start a fresh task, and send
the exact prompt.

## Required recovered explanation

Before editing, Codex must state:

- task: complete the regional report;
- current revision;
- completed Alpha work;
- the decision to preserve source order;
- the Beta-source blocker;
- Alpha verification evidence;
- the concrete stopping point;
- next action: read `fixture/source-b.txt` and append Beta to
  `work/report.md`.

## Required continuation

Codex must:

1. inspect the allowed files;
2. append `Beta: 29` and `Total: 57` to `work/report.md`;
3. add real verification evidence to `work/verification.log`;
4. record progress with the starting revision through the skill;
5. re-read current memory;
6. confirm the revision advanced;
7. validate the original handoff by ID and confirm `current: false`.

Run `validate.mjs` after the UI step. The validator checks the project change,
new continuation, provenance, and stale result. Evidence must be normalized and
must not contain personal paths, credentials, private transcripts, or local
databases.

## Failure classification

- **Zentext**: schema, RPC, SDK, stale, storage, or skill defect.
- **Codex integration**: skill not discovered or helper not invoked.
- **Model behavior**: state was returned correctly but the participant ignored
  it or repeated work.
- **Environment**: package, Node, filesystem, or Codex app unavailable.

Passing deterministic unit tests or the RPC helper alone is not a Codex app
pass. The result document must identify which UI steps were actually exercised.
