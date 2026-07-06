# Staleness and Audit Spec

**Status:** planning only — no code, no audit implementation.

## Purpose

Define the Stage 1 staleness signals and the `zentext audit` report. The MVP
keeps staleness deliberately simple; file/reference-based staleness is a
**Stretch**, not MVP-required, so staleness logic does not overcomplicate the
MVP. No implementation.

## Foundation docs this derives from

- [`open-decisions.md`](../open-decisions.md) #10 — stale detection strategy
- [`context-repacking.md`](../context-repacking.md) — stale records in repack
- [`cli-reference.md`](../cli-reference.md) — `audit` command
- [`memory-schema.md`](../memory-schema.md) — record status fields
- [`repacking-spec.md`](./repacking-spec.md) — stale handling in repack

## Stage 1 scope (MVP staleness signals)

- **Age-based staleness:** a record older than a configurable threshold while the
  task is still active.
- **Status-based staleness:** records whose `status` is `stale` or `superseded`,
  or whose task `progress` is `done`/`abandoned` but the record is not marked
  resolved.
- **Completed-task staleness:** records related to a task that is `done` or
  `abandoned` are stale relative to a new active task.
- **Manually-marked stale:** a human or agent explicitly marks a record stale via
  `edit`/`memory.update`.

## Stage 1 Stretch (not MVP-required)

- **File/reference-based staleness:** records whose `refs` point to code that has
  since changed, using repo state (git diff / file mtimes). Do **not** build this
  in the MVP; it adds real complexity and is not needed to prove the value prop.
  This is the post-MVP Stretch goal referenced by
  [`context-repacking.md`](../context-repacking.md),
  [`cli-reference.md`](../cli-reference.md), and open-decision #10, which are
  aligned to defer it (see PR #2 review).

## Non-goals

- No auto-deletion of stale records. Stale records are flagged for review, never
  silently removed (per open-decision #10 lean).
- No ref-based staleness in the MVP.
- No predictive/ML staleness scoring.
- No cloud audit export (enterprise, Stage 3).

## Staleness detection rules (MVP)

- Thresholds are configurable with sensible defaults (finalized in
  implementation); e.g., an active task with no record updates beyond N days.
- A record is flagged stale when any MVP signal fires.
- Stale flags are surfaced to:
  - `zentext audit` (report).
  - `zentext status` (count of stale records).
  - the repack engine (omit or mark per [`repacking-spec.md`](./repacking-spec.md)).

## `zentext audit` report

The audit report flags:

- Stale records (MVP signals above), with reason and last-updated time.
- Unresolved blockers older than a threshold.
- Records missing recommended (non-required) fields.
- Records flagged as possibly containing secrets (heuristic, see
  [`safety-and-secrets.md`](./safety-and-secrets.md)).
- Overuse of `custom` (a high fraction of `custom` records suggests the baseline
  types may be insufficient — ADR 0005 monitoring).

For each flag, audit suggests a cleanup action (resolve, supersede, edit, mark
stale, review). It does **not** perform the action automatically.

Output: human-readable by default; `--json` for scripting.

## Decisions and assumptions

- Ref-based staleness is Stretch; do not let it block the MVP.
- No auto-delete; flag-for-review only.
- Audit also surfaces missing recommended fields (ties to ADR 0005's "recommended,
  not enforced" stance) and secret-suspect records (ties to safety).
- Thresholds are configurable; defaults finalized in implementation.

## Acceptance criteria

- `zentext audit` reports all four MVP staleness signals with reasons and
  suggested actions.
- Stale flags flow into repack (omit or mark per [`repacking-spec.md`](./repacking-spec.md)).
- Audit reports unresolved-old blockers, missing recommended fields, and
  secret-suspect records.
- No stale record is auto-deleted.
- Ref-based staleness is absent from the MVP (Stretch only).

## Risks

- **False positives** flag useful records as stale and erode trust. Mitigation:
  conservative thresholds; human review via `audit`; no auto-action.
- **False negatives** leave stale context that misleads the next agent. Mitigation:
  age + status + completed-task cover the common cases; ref-based Stretch closes
  the gap later.
- **Threshold tuning** is project-dependent. Mitigation: configurable; revisit
  from demo data.
