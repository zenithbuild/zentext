# ADR 0005 — Schema Rigidity

**Status:** accepted for Stage 1 (promoted from proposed on 2026-07-06)
**Date:** 2026-07-05 (proposed); 2026-07-06 (accepted for Stage 1)
**Related:** [open-decisions.md](../open-decisions.md) #2, [memory-schema.md](../memory-schema.md), [context-repacking.md](../context-repacking.md)

## Problem

The memory schema determines what Zentext can repack into useful context. Too
rigid, and projects that don't fit the baseline types are forced into a shape that
loses information. Too flexible (fully schemaless), and repacking cannot reliably
prioritize or format records — the product collapses into "a key-value store with
weak product value," which is explicitly something we do not want to be.

The schema is core: it is what makes Zentext better than a markdown file (typed,
queryable, repackable) rather than just another unstructured notes store. Getting
this balance right is foundational and hard to change once records exist.

## Options

### Option A — Fixed types with required fields

Strictly typed: task, decision, blocker, handoff, log, validation, policy. Each has
required fields enforced on write. No escape hatch.

### Option B — Fully schemaless key-value

Any record is a freeform JSON blob with only `id`, `type` (free string), and `body`.
Maximum flexibility; repacking must infer structure.

### Option C — Opinionated baseline types + `custom` escape hatch (current lean)

A small set of well-defined baseline types (task, decision, blocker, handoff, log,
validation, policy), each with recommended fields, plus a `custom` type with a
freeform `body` and a `kind` discriminator for anything that does not fit. Baseline
types are not strictly required on every field — recommended, with a small set of
truly required fields per type.

### Option D — Pluggable schema (user-defined types via templates)

Users or projects define their own record types via schema templates (e.g., a
`design-note` type with custom fields). The store validates against the project's
registered templates. Maximum extensibility, highest complexity.

## Tradeoffs

| Aspect | A (fixed) | B (schemaless) | C (baseline + custom) | D (pluggable) |
|--------|-----------|----------------|------------------------|----------------|
| Repacking quality | Highest (predictable structure) | Lowest (must infer) | High (baseline predictable; custom explicit) | High if templates are good |
| Flexibility for odd projects | Low | Highest | High (via custom) | Highest |
| Queryability | High (typed queries) | Low (free-text only) | High (typed for baseline; kind for custom) | High (per template) |
| Implementation complexity | Low | Low | Low-medium | High |
| User friction (forced into shape) | High | None | Low (custom escapes) | Medium (must define templates) |
| Risk of becoming a weak KV store | Low | High | Low | Low |
| Risk of being too rigid | High | None | Low | Low-medium |
| Stale detection quality | High (typed refs/status) | Low | High for baseline; medium for custom | Depends on templates |
| MVP speed | Fast | Fast | Fast | Slow |

## Current recommendation

**Option C — Opinionated baseline types + `custom` escape hatch.**

Rationale:
- The baseline types (task, decision, blocker, handoff, log, validation, policy)
  cover the common cases that make agent-to-agent handoff valuable. They are
  predictable enough that repacking can prioritize and format them reliably (e.g.,
  "active task first, then blockers, then decisions").
- The `custom` type with a `kind` discriminator and freeform `body` provides an
  explicit, honest escape hatch for project-specific memory that does not fit a
  baseline type — without forcing every project into a rigid shape.
- This avoids both failure modes: not so rigid that odd projects break (Option A), and
  not so flexible that repacking degrades to guessing (Option B).
- Required fields per baseline type should be minimal (e.g., `id`, `type`, `title`,
  `status`, timestamps) so writes are not rejected for missing optional context.
- Repacking treats `custom` records as low priority by default unless tagged or
  referenced by the active task, which prevents custom noise from drowning out
  baseline signal.

**Why not Option D (pluggable) now:** Pluggable templates add real complexity (template
registration, validation, versioning, repacking logic per template) for a benefit
that the `custom` type already covers at MVP. Pluggable templates are a credible
Stage 2+ evolution if real projects consistently need first-class custom types with
structured fields and repacking support. Defer until there is evidence.

## Risks

- **Baseline types do not cover a real, common case.** Some projects may have a
  recurring memory shape (e.g., "design note," "test plan," "incident") that does not
  fit any baseline type and gets shoved into `custom`, losing repacking priority.
  Mitigation: monitor what users put in `custom`; if a pattern recurs across projects,
  promote it to a baseline type or to a pluggable template (Stage 2+).
- **`custom` becomes a dumping ground and dilutes the store.** If agents write
  everything as `custom`, the typed-query advantage erodes. Mitigation: descriptions
  guide agents to prefer baseline types; `audit` flags overuse of `custom`; repack
  de-prioritizes `custom` unless referenced.
- **Optional fields lead to inconsistent records.** If too many fields are optional,
  repacking cannot rely on them being present. Mitigation: define a small set of
  truly required fields per type; make the rest recommended, not enforced, but
  surface missing recommended fields in `audit`.
- **Schema evolves and old records become invalid.** If baseline types change after
  records exist, old records may not match new expectations. Mitigation: schema
  versioning on records; repacking handles missing/legacy fields gracefully rather
  than rejecting them.

## What evidence would change the decision

- If a substantial fraction of records in real usage are `custom` (say >30%), the
  baseline types are insufficient and either need expansion or a move toward
  Option D (pluggable templates).
- If repacking produces poor output because baseline optional fields are frequently
  missing, tighten required fields for those types.
- If users request first-class structured custom types (with their own fields and
  repack rules), that is the trigger to move from Option C to Option D in a later
  stage.
- If the baseline types cover >90% of records in real usage and `custom` stays rare,
  Option C is validated and Option D may never be needed.

## Accepted decision (Stage 1)

**Option C — Opinionated baseline types + `custom` escape hatch.** Stage 1 record
types: `task`, `decision`, `blocker`, `handoff`, `log`, `validation`, `policy`,
`custom`. Zentext does **not** move to fully schemaless memory (Option B) and does
**not** add pluggable templates (Option D) in Stage 1. Pluggable templates remain a
credible Stage 2+ evolution if real projects consistently need first-class custom
types. Required fields per type are minimal; the rest are recommended and surfaced
by `audit`, not rejected (see [`implementation/data-model-and-store.md`](../implementation/data-model-and-store.md)).

## Decision status

Accepted for Stage 1 on 2026-07-06, after the strategic foundation and the Stage 1 implementation plan were reviewed and merged into `main`. This is the working decision for Stage 1; it is not necessarily forever and remains revisitable as Stage 1 usage evidence accumulates. See [`open-decisions.md`](../open-decisions.md) #2.

The baseline types and required/recommended fields are accepted for Stage 1; the
demo scenario and real projects will inform any Stage 2+ evolution toward
pluggable templates, not a Stage 1 reopen.
