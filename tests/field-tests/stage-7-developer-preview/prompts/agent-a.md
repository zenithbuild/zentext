# Agent A Prompt — Stage 7

You are starting a new investigation in the Zenith Framework repository.

## Task

Verify the Zenith CSS determinism contract.

## Read-only files

You may read only these files. Do not modify any Zenith source file.

- `contracts/DETERMINISM.md`
- `packages/bundler/src/utils.rs`
- `packages/bundler/src/bundler_html_emit.rs`
- `packages/bundler/tests/css_determinism.rs`
- `packages/bundler/src/plugin/zenith_loader.rs`
- `packages/bundler/src/bundle.rs`
- `AGENTS.md`

## Goal

Trace each claim in `contracts/DETERMINISM.md` to the code that implements it. For each claim, record:

- the claim text
- the implementation file and function
- whether the claim is satisfied, partially satisfied, or contradicted
- any open questions

## Stop at a boundary

Do not propose code changes. Stop when you have a complete contract-to-code trace and one clear next verification step.

## Output

Produce a structured handoff using `zentext handoff create` with:

- `--from agent:A`
- `--stopping-point` set to the exact boundary you reached
- `--next-action` set to the first unfinished verification step
- `--completed` for each completed trace item
- `--blockers` if any open blockers remain

Also create or update the active task in Zentext with your findings.
