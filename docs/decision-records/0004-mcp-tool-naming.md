# ADR 0004 — MCP Tool Naming and Positioning

**Status:** proposed (not final)
**Date:** 2026-07-05
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

### Option A — `memory.*` namespace (current lean)

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

## Current recommendation

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

## Decision status

**Proposed.** Not final. Must be validated empirically with at least two real agents
before the MVP demo. The namespace can stay stable while descriptions are tuned
iteratively. Revisitable at any time based on call-reliability evidence.
