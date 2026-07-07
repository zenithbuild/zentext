# ADR 0004 — MCP Tool Naming and Positioning

**Status:** accepted for Stage 1 (promoted from proposed on 2026-07-06)
**Date:** 2026-07-05 (proposed); 2026-07-06 (accepted for Stage 1)
**Related:** [open-decisions.md](../open-decisions.md) #4, #12, [mcp-tools.md](../mcp-tools.md)

## Problem

Agents decide whether and when to call MCP tools based on tool names and
descriptions. Vague or overlapping names reduce call reliability — the agent either
does not call the tool, calls the wrong one, or calls it at the wrong time. The
MVP's entire value depends on agents reliably writing and reading memory through
these tools, so the naming and description strategy is load-bearing, not cosmetic.

This must be settled (at least a working version) before the MVP demo in
[0003-better-than-markdown-demo.md](./0003-better-than-markdown-demo.md), because the
demo's success depends on agents calling the tools correctly.

## Options

### Option A — `memory.*` namespace (accepted for Stage 1)

Tools: `memory.read`, `memory.write`, `memory.query`, `memory.handoff`,
`memory.repack`, `memory.update`, `memory.list`.

### Option B — `zentext.*` namespace

Tools: `zentext.read`, `zentext.write`, etc. Brand-forward; the agent sees the
product name in every tool name.

### Option C — `project.*` / domain-oriented namespace

Tools: `project.read`, `project.write`, `project.handoff`, `project.repack`, etc.
Domain-oriented around "project memory."

### Option D — Action-verb names without a namespace

Tools: `read`, `write`, `query`, `handoff`, `repack`, `update`, `list`. Shortest,
but risks collision with other tools an agent has access to (a generic `read` is
ambiguous in a multi-tool environment).

## Tradeoffs

| Aspect | A (`memory.*`) | B (`zentext.*`) | C (`project.*`) | D (verb-only) |
|--------|---------------|-----------------|-----------------|----------------|
| Agent clarity of domain | High (memory is obvious) | Medium (brand, not function) | Medium (project is broad) | Low (ambiguous) |
| Collision risk with other tools | Low | Very low | Medium | High |
| Description burden | Low (name implies domain) | Medium (must explain zentext) | Medium | High (must disambiguate) |
| Brand reinforcement | None | High | None | None |
| Verb/action clarity | Medium (`memory.read`) | Medium | Medium | High but unsafe |
| Stability across product rename | High (memory is generic) | Low (tied to brand) | High | High |

## Accepted Stage 1 decision

**Option A — `memory.*` namespace, with action-oriented descriptions.**

Rationale:
- `memory.*` describes the domain unambiguously to an agent without tying the tool
  surface to the brand. If Zentext is ever renamed, the tools still make sense.
- Collision risk is low: an agent is unlikely to have another `memory.read` from a
  different provider in the same session.
- The namespace reads naturally: `memory.read`, `memory.write`, `memory.query`,
  `memory.handoff`, `memory.repack`, `memory.update`, `memory.list`.
- Brand reinforcement is a lower priority than call reliability. The brand lives in
  the product, not the tool names.

**Description strategy (the other half of this decision):**

Tool names alone are not enough. Descriptions must be **action-oriented and
explicit** — they should tell the agent *when* to call the tool, not just *what* it
does. Example pattern:

> `memory.write` — "Create a new project memory record. Call this when you make a
> non-obvious decision, hit a blocker, complete a task step, run a validation, or are
> about to hand off to another agent or the user. Do not write secrets. Record types:
> task, decision, blocker, handoff, log, validation, policy, custom."

This pattern (when-to-call + constraints + types) should be applied to every tool.
See [mcp-tools.md](../mcp-tools.md) for the full tool descriptions.

## Risks

- **Agents still do not call `memory.write` at the right moments.** Naming and
  descriptions reduce but do not guarantee reliability. Mitigation: test with real
  agents; tune descriptions; consider a "session start" hook that prompts the agent
  to read memory; provide CLI fallback.
- **`memory.*` may collide in environments with other memory-related MCP servers.**
  Unlikely in the MVP's target environment but possible. Mitigation: monitor; if it
  happens, the namespace can be namespaced further (e.g., `zentext.memory.read`)
  without changing the verb structure.
- **Over-relying on names instead of descriptions.** A good name with a vague
  description still fails. Mitigation: treat descriptions as a first-class,
  testable artifact, not an afterthought.
- **Agents call `memory.write` too eagerly and flood the store with noise.**
  Mitigation: description guidance ("do not write trivial noise"); CLI `audit` to
  clean up; consider a dedup heuristic.

## What evidence would change the decision

- A/B test tool names/descriptions with Codex and Claude Code: measure call rate,
  correct-tool selection rate, and write-at-right-moment rate. If `memory.*`
  underperforms another namespace, switch.
- If agents reliably call tools but write the wrong record types, the description
  for `memory.write` needs stronger type guidance, not a name change.
- If observers find `zentext.*` meaningfully clearer (unlikely), brand-forward
  naming could win — but reliability evidence should drive this, not aesthetics.
- If a future agent ecosystem standardizes on a memory-tool convention (e.g., a
  shared `context.*` schema), align with the convention rather than inventing one.

## Accepted decision (Stage 1)

**Option A — `memory.*` namespace with action-oriented descriptions.** The Stage 1
tool surface is: `memory.read`, `memory.write`, `memory.query`, `memory.handoff`,
`memory.repack`, `memory.update`, `memory.list`. The namespace and the initial tool
surface are accepted for Stage 1. **Tool descriptions remain a first-class, testable
artifact** and may be tuned during demo validation based on agent call reliability
(see open-decision #12 and [`implementation/demo-and-validation-plan.md`](../implementation/demo-and-validation-plan.md)).

## Decision status

Accepted for Stage 1 on 2026-07-06, after the strategic foundation and the Stage 1 implementation plan were reviewed and merged into `main`. This is the working decision for Stage 1; it is not necessarily forever and remains revisitable as Stage 1 usage evidence accumulates. See [`open-decisions.md`](../open-decisions.md) #4, #12.

The namespace and tool surface are stable for Stage 1; only description wording
remains tunable and is not a blocking gate.
