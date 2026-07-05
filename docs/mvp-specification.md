# MVP Specification

## MVP definition

The Zentext MVP is a **local MCP memory layer + thin CLI.**

- **Local memory store** — the product core. Holds structured project memory
  records per project on the developer's machine.
- **MCP server** — the agent interface. Exposes memory read/write/query/handoff
  tools to any MCP-compatible agent.
- **Thin CLI** — the human and fallback interface. Inspect, edit, hand off, and
  repack memory without an agent in the loop. Also serves as the non-MCP fallback
  for agents without MCP support.

No cloud. No UI. No editor plugin. No agent runner.

## MVP goal

Prove that a developer can switch between AI coding agents while preserving the
same external project memory — task state, decisions, blockers, logs, handoffs,
and validation context — and that the next agent can continue without the
developer re-explaining the project.

## MVP user flow

1. Developer runs `zentext init` in a project. A local memory store is created.
2. Agent A connects to the Zentext MCP server. As it works, it writes task state,
   decisions, blockers, and a handoff summary to the store via MCP tools.
3. Developer switches to Agent B (a different agent).
4. Agent B connects to the same MCP server, reads the memory, and receives a
   repacked context payload containing the active task, blockers, decisions, and
   handoff.
5. Agent B continues the work without the developer restating the project.

For agents without MCP support, the developer runs `zentext repack` to emit a
structured markdown payload and pastes it into the agent's prompt. This is the
non-MCP fallback.

## What the MVP includes

- `zentext init` — initialize per-project local memory.
- MCP tools (see [`mcp-tools.md`](./mcp-tools.md)):
  - `memory.read`
  - `memory.write`
  - `memory.query`
  - `memory.handoff`
  - `memory.repack`
  - `memory.update`
  - `memory.list`
- Baseline memory schema (see [`memory-schema.md`](./memory-schema.md)):
  - task, decision, blocker, handoff, log, validation, policy, custom
- CLI commands (see [`cli-reference.md`](./cli-reference.md)):
  - `init`, `status`, `show`, `list`, `handoff`, `repack`, `edit`, `audit`
- Context repacking (see [`context-repacking.md`](./context-repacking.md)):
  - generate a structured markdown payload from current memory state, optimized
    for agent consumption.
- Non-MCP fallback: `zentext repack` emits a pasteable payload.

## What the MVP excludes

The following are explicitly **out of scope** for the MVP:

- Cloud, sync, accounts, authentication, billing
- Dashboard, GUI, or any visual app
- Editor plugins (VS Code, JetBrains, etc.)
- Vector search / semantic search
- Team workspaces, shared memory, multi-user
- Enterprise controls (RBAC, SSO, audit export, governance)
- Custom agent runtime / agent orchestration
- Hidden model state transfer (impossible; never in scope)

## Success criteria

The MVP succeeds when all of the following are true:

1. A developer can initialize Zentext in a real project in under one minute.
2. At least two different MCP-compatible agents can read and write memory through
   the MCP tools without custom integration work.
3. After switching agents, the second agent receives a repacked context payload
   that lets it continue the task without the developer restating the project.
4. The developer can inspect and edit memory via the CLI without an agent.
5. The experience is clearly better than maintaining a `CLAUDE.md` by hand, as
   judged by the developer in a real session.

## Failure criteria

The MVP fails if any of the following are true:

1. Agents do not call the MCP tools reliably, so memory is never written or read.
2. The repacked context is not useful to the receiving agent (too long, too
   unstructured, or irrelevant).
3. The experience is not meaningfully better than a hand-maintained markdown file.
4. Setup or usage friction exceeds the value gained.
5. The product drifts into building a UI, cloud, or agent runner instead of
   proving the memory handoff.

## First demo flow

The first demo must prove the core thesis concretely:

1. **Initialize.** Developer runs `zentext init` in a real project.
2. **Agent A writes.** Agent A (e.g., Codex or Claude Code) connects via MCP and,
   while working on a task, writes:
   - the active task state
   - one or more architecture decisions
   - a current blocker
   - a handoff summary
3. **Switch.** Developer switches to Agent B (a different agent).
4. **Agent B reads.** Agent B connects via MCP and reads/receives repacked context
   from Zentext containing the task, decisions, blockers, and handoff.
5. **Continue.** Agent B continues the work without the developer restating the
   project, and correctly references the prior decisions and blocker.

The demo is successful only if step 5 happens and the developer would otherwise
have needed to re-explain the project. If the developer must re-explain, the MVP
has not proven its value.

A secondary demo path uses the non-MCP fallback: `zentext repack` produces a
markdown payload that the developer pastes into an agent without MCP support, and
that agent continues from the same memory.
