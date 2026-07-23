# M1 cross-platform continuation field test

This is the canonical field-test contract for Zentext issue #22. It proves
serial continuation through external project memory. It does not test hidden
model state, shared provider history, orchestration, or concurrent work.

The contract was established before the M1 continuation surfaces were added,
with `results.json` in an honest `not-run` state. The completed M1 run now
contains evidence from three unrelated tool/model families and passes
`node validate.mjs` without `--allow-pending`.

## Exact task

Verify the four regional values in `fixture/source-a.txt` and
`fixture/source-b.txt`, preserve the partial findings in structured Zentext
state, and report the verified grand total.

The task is deliberately small, deterministic, safe, and provider-neutral. It
requires a real file investigation and a real serial handoff, but no network
access or repository source-code change.

Expected values:

- Tool A reads only `fixture/source-a.txt`: north 17 + south 11 = 28.
- Tool B starts from the handoff, reads `fixture/source-b.txt`: east 13 + west
  9 = 22.
- Tool B verifies the grand total: 28 + 22 = 50.

## Participant requirements

The final proof must use at least three genuinely distinct execution
environments or model/tool families. Three tabs, sessions, or prompts in one
provider conversation do not qualify. Each participant entry records its tool,
version or model, environment, input surface, and whether prior state was
available.

A failed or unavailable provider remains in the evidence with one of these
classifications: `zentext`, `harness`, `provider`, `formatting`, `environment`,
`isolation`, or `unavailable`. A malformed response is never rewritten into a
pass.

## Isolation requirements

Each run uses a fresh project directory and isolated `HOME`. Tool A exits before
the receiver starts. The receiver gets only:

- the test repository;
- the Zentext store or one portable continuation export;
- this scenario instruction;
- the allowed fixture files.

The receiver does not get Tool A's conversation, scratchpad, session
identifier, provider continuation token, or in-memory variables containing the
answer. A model adapter may use credentials from the operator's real home, but
those credentials and all provider session state are excluded from the
participant prompt and recorded artifacts.

## Procedure

1. Copy `fixture/` into a clean temporary Git repository.
2. Set an isolated `HOME` and initialize Zentext.
3. Create the task from `scenario.json`, including both task notes in order.
4. In a separate Tool A process, inspect only `source-a.txt`.
5. Tool A writes the partial report and verification log, updates the task, and
   creates the handoff with every repeated value from `scenario.json`.
6. Terminate Tool A. Preserve no process or provider conversation state.
7. Capture default, JSON, Markdown, and prompt continuation output plus JSON,
   Markdown, and prompt handoff exports.
8. Start Tool B in a separate execution environment with one portable surface.
9. Before continuing, Tool B states the task, completed work, changed files,
   blockers, verification, stopping point, and exact next action.
10. Tool B inspects `source-b.txt`, reports the subtotal and grand total, and
    explicitly confirms that it did not repeat Tool A's completed work.
11. Apply Tool B's progress to the task so its revision advances.
12. Validate the original handoff and continuation again. Both must reject the
    stale revision with the documented non-zero exit code.
13. Repeat from a fresh seed for each additional unrelated participant.

## Expected structured records

`scenario.json` is the machine-readable source of truth. The seeded handoff
must retain, in order:

- two completed items;
- two changed files;
- two blockers;
- two verification entries.

The active task must retain two notes. Commas, spaces, and Unicode remain
literal values rather than delimiters.

## Required outputs and normalization

The final `results.json` records:

- all eight required CLI/export surface checks;
- one normalized participant result per attempted tool;
- exact isolation assertions;
- pre-update and post-update task revisions;
- stale validation and continuation exit behavior;
- artifact paths for safe, normalized evidence.

Raw provider transcripts are optional and should not be committed when they are
large, contain irrelevant material, or risk exposing secrets. Normalized
responses must preserve defects and uncertainty.

## Validation

During baseline development:

```sh
node tests/field-tests/m1-cross-platform-continuation/validate.mjs --allow-pending
```

For the final proof:

```sh
npm run build
node tests/field-tests/m1-cross-platform-continuation/run.mjs
node tests/field-tests/m1-cross-platform-continuation/validate.mjs
```

The runner configuration is in `participants.json`; the normalized receiver
contract is `receiver-response.schema.json`. A safe deterministic harness smoke
can be run without provider calls by passing `--dry-run` and temporary
`--output`/`--evidence-dir` paths. Dry-run participants never count toward the
strict three-tool gate.

The strict command fails unless every required surface passes, at least three
unrelated participants pass, isolation is affirmed, repeated arrays remain
ordered, the receiver explains state before continuing, and stale state is
rejected after a revision advance.

## Security rules

Never place tokens, passwords, private keys, recovery codes, private databases,
provider session data, unredacted home paths, or environment secrets in this
directory. Record tool versions and safe failure summaries only. Temporary
stores and raw provider output are deleted after normalization.
