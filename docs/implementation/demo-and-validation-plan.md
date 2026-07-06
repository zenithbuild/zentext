# Demo and Validation Plan

**Status:** planning only — no code, no demo harness implementation.

## Purpose

Operationalize ADR 0003 into a runnable Stage 1 validation plan: the exact demo
runbook, the agents to use, how MCP tool call reliability is measured, the
markdown contrast run, and the success/failure checklist. This is the gate that
declares the MVP successful. No implementation.

## Foundation docs this derives from

- [`decision-records/0003-better-than-markdown-demo.md`](../decision-records/0003-better-than-markdown-demo.md) — the scripted demo
- [`mvp-specification.md`](../mvp-specification.md) — success/failure criteria, first demo flow
- [`staged-roadmap.md`](../staged-roadmap.md) — Stage 1 acceptance criteria
- [`mcp-server-design.md`](./mcp-server-design.md) — tool descriptions to tune
- [`repacking-spec.md`](./repacking-spec.md) — repack output to validate

## Stage 1 scope

- Run the ADR 0003 demo for real with two MCP-compatible agents.
- Measure agent MCP tool call reliability.
- Run the markdown (`CLAUDE.md`) contrast.
- Iterate on tool descriptions and repack output until the success criteria pass.
- Run the non-MCP fallback path as a secondary demo.

## Non-goals

- No benchmark harness, no automated agent farm.
- No multi-team or cloud validation (Stage 2).
- No UI demo (Stage 4).
- No claim of hidden model state transfer.

## Demo runbook

### Agents
- **Agent A:** Codex (MCP-capable).
- **Agent B:** Claude Code (MCP-capable).
- Same machine, same repo, local only.

### Scenario
The ADR 0003 `acme-api` OAuth scenario: add GitHub OAuth `/login` +
`/login/callback`, protect `/api/profile`. Agent A writes task/decision/blocker/
handoff via MCP; the developer switches to Agent B with a minimal instruction;
Agent B reads repacked context and continues without re-explanation.

### Steps
1. `zentext init` in the real project; `zentext status` confirms an empty store.
2. Agent A works and writes (via `memory.write`/`memory.handoff`): the active
   task, the passport-github decision, the missing-secret blocker, and a handoff.
3. `zentext status` / `list --type blocker` / `show <id>` confirm typed records
   exist with no hand-editing.
4. Switch to Agent B; give only "continue the auth work."
5. Agent B calls `memory.repack` (or `memory.read`); receives the prioritized
   markdown payload.
6. Agent B's first response correctly references the prior decision and the
   blocker, and continues without re-explanation.
7. Run the same scenario with a hand-maintained `CLAUDE.md` and record the
   contrast (manual edits, full-file reads, no query, no audit).

### Non-MCP fallback path (secondary)
Agent A writes via MCP; the developer runs `zentext repack --out` and pastes the
payload into a non-MCP agent; that agent continues from the same memory. This
proves broad compatibility.

## Measurement: MCP tool call reliability

Track per session:
- Tool call rate (calls per session).
- Correct-tool selection rate (right tool for the moment).
- Write-at-right-moment rate (decision/blocker/handoff written when they occur).
- Wrong/missed writes (moments that should have produced a record but did not).

Method: keep a session log and post-session inspect the store + the agent's
tool-call transcript. No automated harness in Stage 1.

If reliability is too low to populate the store, fall back to CLI-seeded memory
(`zentext add`) so the read/repack half of the demo still proves value while
write reliability is tuned.

## Iteration targets

- **Tool descriptions** (ADR 0004): tune action-oriented descriptions and
  re-measure call reliability. Descriptions are a first-class, testable artifact.
- **Repack output** ([`repacking-spec.md`](./repacking-spec.md)): if Agent B
  ignores the payload or re-asks basics, tighten priority/size/focus.

## Success criteria

Inherited from ADR 0003 + `mvp-specification.md`:

1. Agent A wrote ≥ task + decision + blocker + handoff via MCP, no hand-editing.
2. `status`/`list`/`show` display those typed records.
3. After switching, the developer gave only a minimal instruction and did not
   re-explain.
4. Agent B received repacked context and correctly referenced the prior decision
   and blocker in its first response.
5. The `CLAUDE.md` contrast required manual edits, full-file reads, and was
   visibly more friction.

## Failure criteria

- Agent A does not call MCP tools reliably and the store is empty (and CLI seed
  cannot recover the demo).
- Agent B ignores the repack payload and re-asks basics.
- The developer had to re-explain anyway.
- The markdown flow feels "about the same" with no clear advantage.

## Decisions and assumptions

- The demo uses real agents, not a simulated harness.
- CLI-seeded memory is an acceptable fallback for the read/repack half while
  write reliability is tuned.
- ADR 0003's scenario/record contents may be refined based on what agents
  actually write.

## Acceptance criteria

- The demo runbook executes end-to-end locally with two real agents.
- All five success criteria pass in a single real session.
- Call-reliability measurements are recorded for at least two agents.
- The non-MCP fallback path is demonstrated.

## Risks

- **Agent reliability is the single biggest dependency.** Mitigation: tune
  descriptions; CLI `add` fallback; seed the store if needed.
- **Repack payload ignored.** Mitigation: iterate on priority/size/focus.
- **Markdown contrast feels like a strawman.** Mitigation: frame honestly —
  markdown is manual/static; Zentext is agent-written, structured, queryable.
- **Only one MCP agent available.** Mitigation: run the non-MCP fallback path;
  the proof still holds.
