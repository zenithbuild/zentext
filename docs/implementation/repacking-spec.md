# Repacking Spec

**Status:** planning only — no code, no engine implementation.

## Purpose

Define the concrete repack algorithm and output template: selection rules,
priority-order application, size-budget enforcement, `--focus` filtering, stale
handling, and the exact structured markdown shape. [`context-repacking.md`](../context-repacking.md)
gives the priorities and include/exclude lists; this gives the algorithm and the
output contract that the **single shared repack engine** (used by both
`zentext repack` and `memory.repack`) implements. No implementation.

## Foundation docs this derives from

- [`context-repacking.md`](../context-repacking.md) — priority order, include/exclude, staleness, size budget
- [`memory-schema.md`](../memory-schema.md) — record types
- [`cli-reference.md`](../cli-reference.md) — `repack --out` non-MCP fallback
- [`staleness-and-audit-spec.md`](./staleness-and-audit-spec.md) — stale handling
- [`stage-1-plan.md`](./stage-1-plan.md) — shared-engine mandate

## Stage 1 scope

- One shared repack engine.
- Structured markdown as the default output.
- `--focus` filtering, `--max-size` character budget, `--out` file target.
- MVP stale handling (age/status/completed/manual) integrated into selection.

## Non-goals

- No per-agent custom output formats (later stage).
- No JSON as the default (markdown is default; JSON is optional).
- No vector/semantic relevance scoring.
- No hidden model state repacking (impossible; never attempted).
- No full file contents in output (refs only).

## Selection rules

1. Start from the project's current records.
2. Apply status filtering: exclude completed/inactive statuses by default
   (`done`, `canceled`, `resolved`, `archived`, `inactive`, `superseded`,
   `rejected`) unless the focus explicitly matches them. Destructive delete is not
   part of Stage 1.
3. Apply `--focus` filtering: include records whose `tags`, `type`, title, or
   refs match the focus topic using case-insensitive substring matching. Keep one
   selected active task and the latest handoff regardless of focus.
4. Apply staleness handling (see below): stale records are omitted or included
   with a clear `stale` marker, per the policy in
   [`staleness-and-audit-spec.md`](./staleness-and-audit-spec.md).
5. Apply the priority order (below) to group what remains.
6. Sort deterministically inside each priority group by status relevance, then
   `updated_at` descending, then `id` ascending.
7. Apply the size budget: drop or summarize lower-priority records first until
   the payload fits `--max-size`.

## Priority order

Inherited from [`context-repacking.md`](../context-repacking.md):

1. Active task (+ its `next` step).
2. Blockers (`open`, affecting the task; by severity high to low).
3. Decisions (`accepted` first, then `proposed`, relevant to the task/focus).
4. Current handoff (latest).
5. Validation state (recent passed/failed/inconclusive results).
6. Relevant repo references (file paths, commits, branches — refs only).
7. Recent safe logs (sanitized, recent only).
8. Older history (only if needed and space allows; summarized).

`custom` records are low priority by default unless tagged or referenced by the
active task (per ADR 0005).

## Active task selection

Multiple active tasks are allowed in the store. Repack selects the primary active
task in this order:

1. Focused active task: an active/blocked task whose title, tags, refs, goal, or
   summary matches `--focus`.
2. Latest updated active/blocked task.
3. If there is still a tie, id ascending.

Other active/blocked tasks are summarized under older history or omitted if the
size budget is tight. They are not treated as equal primary tasks in the payload.

## Stale handling in repack

- Records flagged stale (MVP signals from
  [`staleness-and-audit-spec.md`](./staleness-and-audit-spec.md)) are omitted by
  default.
- Default Stage 1 exception: stale blockers and the latest handoff are included
  with a visible `stale` marker when they relate to the selected active task, so
  the next agent sees the risk rather than silently missing it.
- This policy is revisitable based on demo results.

## Output template (structured markdown, default)

```
# Zentext context — <project name>
# Generated: <ISO-8601>  |  focus: <focus or none>  |  from: <N> records

## Active task
- <title> (<status>)
- Goal: <goal>
- Next: <next>
- Refs: <files>  |  branch <branch>  |  commit <sha>

## Blockers (<count>)
- [<severity>] <title> — <summary>
  Workaround: <workaround or none>

## Decisions (<count>)
- <title>
  Rationale: <rationale>
  Rejected alternative: <alternatives or none>

## Latest handoff (from <from>, <time>)
- Context: <context>
- State: <state>
- Next: <next>
- Open questions: <open_questions or none>
- Completed this session: <completed_this_session or none>

## Validation state
- <check>: <result> — <summary>  (run <run_at>)

## Refs
- <files / commits / branches>

## Recent logs
- <command> (exit <exit_code>): <summary>

## Older history
- (summarized, only if space allows)

## Stale records flagged
- [<type>] <title> — flagged stale: <reason>
```

The exact phrasing can be tuned in implementation, but the section structure and
ordering are fixed for Stage 1. The header always states generation time, focus,
record count, and the character budget.

## Shared engine constraint

`zentext repack` (CLI) and `memory.repack` (MCP) **must** call the same
underlying repacking logic. For identical store state and identical
`focus`/`max_size`, their output is identical. This is mandated in
[`stage-1-plan.md`](./stage-1-plan.md) and [`mcp-server-design.md`](./mcp-server-design.md).

## Exclude rules

- Secrets (never stored; excluded defensively).
- Full repository file contents.
- Raw unsanitized command output.
- Resolved/superseded records unless focus/history explicitly asks.
- Stale records per policy above.
- Bloated logs beyond a recent, safe excerpt.

## Decisions and assumptions

- Default output: structured markdown. JSON snapshot/export output is optional
  later, not required for Stage 1 (per [`tech-stack-decision.md`](./tech-stack-decision.md)).
- `--out` is the in-repo export path; no separate `export` command.
- `max_size` is an approximate character budget, not a token budget. Default:
  12000 characters. The rule is "drop/summarize lowest priority first."

## Acceptance criteria

- `zentext repack` and `memory.repack` produce identical output for identical
  store state and parameters.
- Output follows the priority order and the template above.
- `--focus` scopes the payload; the active task and latest handoff are always
  present.
- Multiple active tasks produce one primary selected task plus summarized
  remaining active tasks.
- Stale records are omitted or marked, never silently served as current.
- Size budget is respected; lower-priority records are summarized/dropped first.
- No secrets or file contents appear in output.

## Doc-level acceptance tests

- Given identical records and identical `focus`/`max_size`, repeated CLI and MCP
  repacks produce byte-identical markdown except for the generated timestamp if
  the timestamp is not pinned in the test.
- Given two active tasks and `--focus auth`, the auth-matching task is primary and
  the other active task is summarized or omitted.
- Given no focus and two active tasks, the most recently updated active/blocked
  task is primary.
- Given a 12000-character budget, logs and older history are summarized/dropped
  before blockers, decisions, the latest handoff, or the selected active task.
- Given a stale low-priority record, it is omitted; given a stale task-related
  blocker or latest handoff, it is included with a visible stale marker.

## Risks

- **Output too long or poorly ordered** → Agent B ignores it. Mitigation: strict
  priority order; size budget; test with two agents in Phase 9.
- **Focus too aggressive** drops needed context. Mitigation: always keep active
  task + latest handoff.
- **Stale marker noise** if too many records are flagged. Mitigation: omit
  low-priority stale records by default.
- **JSON/markdown drift** if two renderers are maintained. Mitigated by the shared
  engine; JSON is a thin serializer over the same selected record set.
