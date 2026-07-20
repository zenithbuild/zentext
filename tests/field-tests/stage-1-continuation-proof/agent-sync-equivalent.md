# Agent Sync — Stage 1 Continuation Proof (manual equivalent)

This file is a hand-maintained flat-file snapshot of the same project state
used to seed the Zentext store for the Stage 1 continuation proof. It exists
only for comparison against `zentext repack` output.

## Current Role

- Agent: fresh continuation agent
- Role: evaluate whether to begin `feature/stage-1-readonly-mcp`
- Session started: 2026-07-20

## Current Truth

- **Project:** zentext-continuation-proof-proj
- **Branch:** N/A (dogfood test project)
- **Active task:** Implement memory.read MCP tool — expose a read-only MCP tool that returns a single Zentext record by id to agents. Next: define tool schema and add a thin stdio server wrapper.
- **Blocked task:** Design MCP server lifecycle — waiting on the stdio transport decision before wiring lifecycle hooks.
- **Open blocker:** MCP SDK server API is unstable (high severity). Workaround: pin SDK to the exact version used in Stage 1.
- **Resolved blocker:** Project ID hash collision in tests — fixed by using explicit temp HOME and unique project paths.
- **Accepted decision:** Use stdio MCP transport for Stage 1 (local-first, no network).
- **Rejected decision:** Expose store over HTTP — deferred; stdio first.
- **Active policy:** No cloud or network calls in Stage 1.
- **Inactive policy:** Support pluggable transports later (advisory, future).
- **Latest validation:** Typecheck passes after repack fixes (passed).
- **Older validation:** Early MCP spike failed (could not resolve project store from MCP server cwd).
- **Latest handoff:** Session handoff — repack engine complete. Next: run continuation proof; if it passes, begin readonly MCP. Open question: should memory.read return full records or a focused summary?
- **Archived handoff:** Initial MCP exploration notes — outdated; superseded by stdio transport decision.
- **Recent logs:** Built repack engine, added CLI repack, fixed review findings, verified 115 tests pass, spiked stdio server wrapper, documented plan update.
- **Historical to ignore:** rejected HTTP decision, resolved project-id collision, archived handoff, inactive transport policy.

## Locked Decisions

- Decision: Use stdio MCP transport for Stage 1. Status: accepted.
- Decision: No cloud/network calls in Stage 1. Status: accepted.
- Decision: Prove continuation before building MCP read tools. Status: accepted.

## Mutable State

- State: primary task
  - value: Implement memory.read MCP tool
  - reason: active workstream for Stage 1 read-only MCP
- State: blocked task
  - value: Design MCP server lifecycle
  - reason: waiting on stdio transport decision

## Open Blockers

- Blocker: MCP SDK server API is unstable
  - status: open
  - severity: high
  - workaround: pin SDK version
  - blocks: MCP server implementation

## Last Validation

- 2026-07-20 - npm run typecheck
  - result: passed
  - scope: repack engine fixes
  - blocks next step: no

## Reconciliation Needed

- None.

## Handoff / Next step

- Next step: run Stage 1 continuation proof using Zentext repack output.
- If proven, begin `feature/stage-1-readonly-mcp`.
