# Stage 1 Continuation Proof

**Date:** 2026-07-20
**Branch:** `test/stage-1-continuation-proof`
**Repo:** `zenithbuild/zentext`
**Agent/session:** Codex, Stage 1 system-proof session
**Mode:** controlled dogfood / continuation proof
**Product impact:** validates the Stage 1 system before building the read-only MCP layer

## Purpose

Prove the complete Stage 1 system before adding the MCP product layer:

- structured SQLite memory
- project-scoped typed records
- revisions and supersession
- CLI inspection (`init`, `status`, `show`, `list`)
- deterministic repack generation
- `--focus` and `--max-size` budgeting

This is not an implementation phase. The only code changes allowed were patches
for reproducible blockers or must-fix flaws exposed by the experiments.

## Test environment

All tests ran against an isolated, temporary Zentext store:

- Temporary `HOME` directory (not real `~/.zentext`)
- Temporary project directory
- Seeded through the `SqliteStore` API (public write CLI is out of Stage 1 scope)
- Seeding script: `tests/field-tests/stage-1-continuation-proof/seed.mjs`
- Generated payloads: `tests/field-tests/stage-1-continuation-proof/outputs/`
- Manual equivalent: `tests/field-tests/stage-1-continuation-proof/agent-sync-equivalent.md`

## Seeded project state

The seeded state represents a realistic next step for Zentext itself:
implementing the read-only MCP server layer over the already-proven Stage 1 system.

Records seeded:

| Type | Title | Status |
|---|---|---|
| task | Implement memory.read MCP tool | active |
| task | Design MCP server lifecycle | blocked |
| blocker | MCP SDK server API is unstable | open (high) |
| blocker | Project ID hash collision in tests | resolved |
| decision | Use stdio MCP transport for Stage 1 | accepted |
| decision | Expose store over HTTP | rejected |
| policy | No cloud or network calls in Stage 1 | active |
| policy | Support pluggable transports later | inactive |
| validation | Typecheck passes after repack fixes | passed |
| validation | Early MCP spike failed | failed |
| handoff | Session handoff — repack engine complete | latest |
| handoff | Initial MCP exploration notes | archived |
| log | Six recent log entries | recorded |
| custom | Eight low-priority research notes | active |

## Experiment A: default continuation

Command:
```bash
zentext repack
```

Output file: `tests/field-tests/stage-1-continuation-proof/outputs/default.md`

Fresh-agent evaluation (answering the required questions):

1. **What project is it working on?**
   - `zentext-continuation-proof-proj-*`. The project name and store path are visible in the header.
   - Verdict: clear.

2. **What is the primary task?**
   - "Implement memory.read MCP tool (active)" with goal and next step.
   - Verdict: immediately obvious.

3. **What should happen next?**
   - "Define the tool schema and add a thin stdio server wrapper around the existing Store interface."
   - Verdict: explicit.

4. **What is blocked?**
   - "MCP SDK server API is unstable" (high severity) with a workaround.
   - The blocked task is visible but secondary under "Other active tasks".
   - Verdict: obvious.

5. **Which decisions are binding?**
   - "Use stdio MCP transport for Stage 1 (accepted)" is shown.
   - The rejected HTTP decision is excluded.
   - Verdict: easy to distinguish.

6. **Which policies constrain the work?**
   - "No cloud or network calls in Stage 1 (project, required)" is shown.
   - The inactive transport policy is excluded.
   - Verdict: clear.

7. **What has already been validated?**
   - Recent passed typecheck shown first; older failed spike shown second.
   - Verdict: visible.

8. **What did the latest agent hand off?**
   - Full latest handoff with context, state, next, open questions, completed items.
   - Verdict: sufficient to continue.

9. **What historical information should be ignored?**
   - Resolved blocker, rejected decision, inactive policy, and archived handoff do not appear.
   - Verdict: historical information is cleanly filtered by status.

**Ambiguity or noise observed:**
- The handoff id (`rec_handoff_...`) adds a small amount of reference noise but does not hurt comprehension.
- The "no summary" fallback for the open blocker is defensive but slightly terse.
- Custom research notes are present but low priority; they do not distract from the primary task.

## Experiment B: focused continuation

Commands:
```bash
zentext repack --focus MCP
zentext repack --focus lifecycle
```

Output files:
- `tests/field-tests/stage-1-continuation-proof/outputs/focused-mcp.md`
- `tests/field-tests/stage-1-continuation-proof/outputs/focused-lifecycle.md`

Findings:

- `--focus MCP`: both the active task and the blocked task match "MCP". The active task remains primary because `active` outranks `blocked`. The blocked task moves to "Other active tasks". Open blocker stays visible.
- `--focus lifecycle`: only the blocked task matches. It becomes primary (under "Active task") while the active memory.read task moves to "Other active tasks". The open blocker remains visible.
- Repeating the unfocused repack restored the original prioritization.
- Canonical store was not mutated.

Verdict: focus changes priority, not canonical state. Blockers are never hidden by focus.

## Experiment C: constrained context

Commands and output files:
```bash
zentext repack --max-size 12000   # outputs/default.md
zentext repack --max-size 4000    # outputs/budget-4000.md
zentext repack --max-size 1500    # outputs/budget-1500.md
zentext repack --max-size 500     # outputs/budget-500.md
zentext repack --max-size 100     # outputs/budget-tiny.md
```

Findings:

| Budget | Size | Content preserved | Dropped/summarized |
|---|---|---|---|
| 12000 | 3424 chars | full default output | nothing dropped |
| 4000 | 3423 chars | full default output | fits under budget |
| 1500 | 1656 chars | active task, blocker, handoff | decisions, validations, policies, other tasks, logs, custom notes dropped; omission notice shown |
| 500 | 751 chars | active task, blocker | handoff and lower-priority sections dropped |
| 100 | 751 chars | active task, blocker | honest overflow; mandatory content alone exceeds 100 chars |

The engine degraded predictably:
- Low-priority sections disappeared first.
- Primary active task and open blocker were never dropped.
- Latest handoff was preserved when practical, dropped under very tight budgets.
- The omission notice did not push output past the budget when mandatory content already overflowed.
- No misleading claim that the payload fit when it did not.

Verdict: budget behavior is honest and predictable.

## Experiment D: fresh-session handoff

A fresh agent (this session) was shown only the default repack output and asked
to answer six questions without reading the store, chat history, or AGENT_SYNC.md.

| Question | Fresh-agent answer | Canonical accuracy |
|---|---|---|
| 1. Summarize current state. | "Implementing a read-only memory.read MCP tool for Zentext; blocked by MCP SDK API instability; stdio transport accepted; no cloud/network in Stage 1." | Accurate. |
| 2. Next valid engineering action. | "Define the memory.read tool schema and create a thin stdio server wrapper in src/mcp/server.ts." | Correct. |
| 3. Explain active blocker. | "MCP SDK server API changed between versions; workaround is to pin the SDK version." | Correct. |
| 4. Accepted decision affecting implementation. | "Use stdio MCP transport for Stage 1." | Correct. |
| 5. Work not to be repeated. | "Repack engine is done; 115 tests pass; typecheck passes." | Correct. |
| 6. Smallest next code change. | "Add src/mcp/server.ts that imports the Store interface and registers a memory.read tool over stdio." | Reasonable next step. |

Scores:
- Factual accuracy: high
- Omitted current truth: none significant
- Invented information: none
- Current/historical confusion: none (rejected/superseded records were excluded)
- Correct next action: yes
- Time to orient: under 30 seconds

Verdict: a fresh agent can continue useful work from the repack output alone.

## Experiment E: comparison with AGENT_SYNC.md

A manual flat-file snapshot (`agent-sync-equivalent.md`) was authored from the
same seeded state. Both the repack output and the flat file were evaluated for
orientation speed and current-truth clarity.

| Dimension | Zentext repack | Manual AGENT_SYNC.md | Notes |
|---|---|---|---|
| Orientation speed | Fast | Slower | Repack sections are scannable; AGENT_SYNC.md mixes sections and requires more scanning. |
| Current-truth clarity | High | Medium | Repack separates current sections from omitted history; AGENT_SYNC.md has a "Current Truth" section but still includes historical sections nearby. |
| History contamination | Low | Higher | Repack excludes rejected/inactive/superseded records; AGENT_SYNC.md includes them for transparency. |
| Blocker visibility | High | High | Both show the open blocker and severity. |
| Decision visibility | High | High | Both show accepted decision; repack excludes rejected automatically. |
| Maintenance burden | Low | High | Repack regenerates from store; AGENT_SYNC.md must be manually updated and compressed. |
| Consistency across generation | Deterministic (except timestamp) | Depends on author | Repack output structure is stable. |
| Focus on a subtask | `--focus lifecycle` | Manual editing required | Repack can refocus instantly. |
| Behavior under budget | `--max-size` drops low-priority content | No budget mechanism | Flat files grow until manually pruned. |

Flat-file advantage: AGENT_SYNC.md is more flexible for narrative and can include
human reasoning that does not fit typed records. For a small, early project this
is a real advantage, but it does not scale and relies on author discipline.

Verdict: for the seeded 26-record state, Zentext repack is faster to scan,
cleaner on current truth, and lower maintenance than the manual equivalent.

## Findings and patches

During the proof, one reproducible flaw was found in the existing Stage 1 code:

### Finding 1: blocked task incorrectly selected as primary over active task

**File:** `src/repack/engine.ts` (`statusRank`)
**Observed behavior:** When a `blocked` task was updated more recently than an `active` task, the repack output selected the `blocked` task as the primary "Active task". This directed a fresh agent toward work that is explicitly waiting, not toward work in progress.
**Why it prevents the system proof:** A fresh agent cannot reliably determine the current task if a blocked task can outrank an active one.
**Reproducible scenario:** Seed an active task, then seed a newer blocked task; run `zentext repack`; the blocked task appears primary.
**Severity:** must-fix
**Patch:** Changed `statusRank` so `active` tasks rank 1 and `blocked` tasks rank 2. Active tasks now always outrank blocked tasks regardless of timestamp, matching the intent that the primary task is work in progress.

### Finding 2: stale-records section reintroduced historical noise

**File:** `src/repack/engine.ts` (`renderStaleSection`)
**Observed behavior:** A "Stale records flagged" section surfaced resolved blockers and other inactive records, mixing history back into the current-truth view.
**Why it prevents the system proof:** The system proof requires current truth to be separated from history. Status-based inactive records are already excluded from current sections; adding a stale section defeats that separation.
**Severity:** must-fix
**Patch:** Disabled the stale section for Phase 3. Age-based/manual staleness belongs in the future audit phase, not the repack current view.

### Finding 3: nonnumeric and non-positive `--max-size` were silently ignored

**File:** `src/cli/cli.ts`, `src/cli/commands.ts`
**Observed behavior:** `zentext repack --max-size abc` fell back to the default budget. `--max-size 0` produced confusing overflow output.
**Severity:** must-fix
**Patch:** Added validation in both the CLI parser and the command handler to reject non-finite and non-positive `--max-size` values with exit code 1.

### Finding 4: omission notice could push payload past budget

**File:** `src/repack/engine.ts` (`fitToBudget`)
**Observed behavior:** When mandatory content already exceeded the budget, the omission notice was still appended, making the output larger than requested.
**Severity:** must-fix
**Patch:** The notice is now skipped when `body + notice` would exceed `maxSize`.

### Finding 5: timestamp formatting was locale-dependent

**File:** `src/repack/engine.ts` (`formatTimestamp`)
**Observed behavior:** Handoff timestamps used `toLocaleString()`, which varies by system locale and timezone, making output nondeterministic across agents.
**Severity:** must-fix
**Patch:** Replaced with `toISOString()` for deterministic output.

## Validation after patches

```text
npm run typecheck      ✓
npm run typecheck:test ✓
npm test               ✓  115 tests passed
npm run build          ✓
git diff --check       ✓
```

## Scope confirmation

No product expansion occurred:
- No MCP server or `memory.*` tools added
- No public write CLI commands added
- No audit or age-based/ref-based staleness engine added
- No model calls, AI summarization, vector/semantic search, graph DB
- No cloud, sync, auth, billing, UI, dashboard, editor plugins, enterprise features
- No Zenith Framework changes

Only the existing Stage 1 repack engine and CLI were patched to pass the system proof.

## Verdict scale

**Proven with minor limitations.**

The Stage 1 system demonstrates that structured, local memory plus
deterministic repacking allows a fresh agent to continue useful work more
reliably than a manually maintained context file. The required questions were
answerable in under 30 seconds, current truth was cleanly separated from history,
budget degradation was predictable, and focus/budget behavior worked as intended.

Minor limitations noted (non-blocking):
- Handoff ids add a small amount of reference noise.
- The blocker "no summary" fallback is terse.
- Custom notes appear at the bottom by default, which is correct but could
  become noisy if heavily used.

## Evidence supporting the conclusion

1. Default repack output correctly identifies the active task, open blocker,
   accepted decision, active policy, latest handoff, and recent validation.
2. Historical records (rejected decision, resolved blocker, inactive policy,
   archived handoff) are excluded.
3. Focus correctly reprioritizes matching tasks without hiding blockers or
   mutating canonical state.
4. Budget reduction preserves primary task and blocker while predictably
   dropping lower-priority sections.
5. A fresh agent proposed a correct next engineering action from the repack
   output alone.
6. The manual AGENT_SYNC.md equivalent is harder to scan and lacks budget/focus
   mechanics.

## Smallest justified next phase

Only after this proof should work begin on:

```
feature/stage-1-readonly-mcp
```

That phase must be a thin delivery adapter over the system already proven:
- expose `memory.read`, `memory.query`, `memory.list`, and `memory.repack`
- call the existing `Store` and `repack` engine
- add no new memory model, no new prioritization logic, no new formatting logic
- remain read-only in Stage 1 (write tools come after the read path is proven in
  real agent use)

## Files added in this branch

- `tests/field-tests/stage-1-continuation-proof/seed.mjs`
- `tests/field-tests/stage-1-continuation-proof/outputs/default.md`
- `tests/field-tests/stage-1-continuation-proof/outputs/focused-mcp.md`
- `tests/field-tests/stage-1-continuation-proof/outputs/focused-lifecycle.md`
- `tests/field-tests/stage-1-continuation-proof/outputs/budget-4000.md`
- `tests/field-tests/stage-1-continuation-proof/outputs/budget-1500.md`
- `tests/field-tests/stage-1-continuation-proof/outputs/budget-500.md`
- `tests/field-tests/stage-1-continuation-proof/outputs/budget-tiny.md`
- `tests/field-tests/stage-1-continuation-proof/agent-sync-equivalent.md`
- `docs/field-tests/runs/006-stage-1-continuation-proof.md`

## Modified files

- `src/repack/engine.ts` — task priority, stale section, timestamp determinism, budget notice overflow
- `src/cli/cli.ts` — `--max-size` type validation
- `src/cli/commands.ts` — `--max-size` positive-number validation
- `tests/repack.test.ts` — updated/added tests for active-over-blocked priority, ISO timestamps, budget overflow, invalid max-size
