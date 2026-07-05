# Product Overview

## What Zentext is

Zentext is a local-first shared context and memory layer for AI coding agents. It
preserves external project memory — task state, architecture decisions, blockers,
handoff summaries, repo references, command summaries, validation results, and
policies — and repacks that memory into useful context so that the next agent can
continue a task without the developer re-explaining the project from scratch.

Zentext is not an application, a model provider, or an agent runner. It is a memory
layer that agents write to and read from, plus a thin CLI that humans use to
inspect, manage, and repack that memory.

## What problem it solves

Developers and teams now use multiple AI coding agents on the same project: Codex,
Claude Code, Cursor, Ollama, Kimi, GLM, and local models. Each tool keeps its own
isolated context. When you switch tools, editors, agents, or teammates, project
memory is lost and must be manually re-established.

This is not a minor inconvenience. On any non-trivial task, re-establishing context
can consume a meaningful fraction of a session: decisions get re-litigated,
blockers get re-discovered, and prior validation gets repeated. Over a day of
switching agents, the cost compounds.

Zentext preserves a single, structured, agent-writable record of project memory that
any participating agent can read.

## Critical limitation (permanent)

Zentext **cannot transfer hidden model state** from one AI system to another. It
cannot move internal attention state, KV caches, fine-tuning, or anything inside a
model that the user cannot see.

Zentext can only preserve **external project memory** — things that can be written
down — and repack that memory into useful context for another agent. This must be
stated honestly in all documentation and messaging. Any implication that Zentext
"transfers model state" is false and must be removed.

## What it is not

- Not a generic AI chat UI.
- Not a model provider or inference layer.
- Not an agent runner or agent harness.
- Not an editor or editor plugin (initially).
- Not a universal agent UI.
- Not cloud-first.
- Not a vector database product. Semantic search may be a feature inside the
  store, but it is not the product.
- Not a way to transfer hidden model state.

## Primary user segment

**AI-forward solo developers and small teams (2–10) who actively use multiple
coding agents on the same project.**

These users already switch between Codex, Claude Code, Cursor, and local models.
They feel the context-loss pain daily. They are technical enough to install an MCP
server and run a CLI, and they do not need a GUI to get value.

Sub-segments, in order of pain intensity:

1. Architecture-heavy solo builders — complex projects, long-running tasks,
   frequent agent switches. Highest pain, smallest market, earliest adopters.
2. Small AI-forward engineering teams — shared projects, multiple devs each using
   different agents, need shared memory. High pain, real willingness to pay.
3. Open-source maintainers using AI contributors — multiple agents and contributors
   touching the same repo. Medium pain, high visibility.
4. AI-forward product teams (10–50) — want shared context and some audit trail.
5. Enterprise agent governance/audit — largest revenue, slowest sales, highest
   requirements. A later segment.

## First paid customer segment

**Small engineering teams (2–10 developers) using multiple AI coding agents on
shared projects.**

They adopt the free local core individually. They hit the wall when one teammate's
agent writes decisions that another teammate's agent cannot see. That is when they
pay for cloud sync and shared workspaces.

Solo developers will use the free local core. A subset will pay for Solo Pro (cloud
backup, multi-device, longer retention). Enterprise governance is a later,
larger-but-slower segment.

## Product thesis

When a developer switches from one AI coding agent to another, the next agent
should be able to read structured project memory that the previous agent wrote, so
that the developer does not need to re-explain the project from scratch.

The MVP must prove this end-to-end: Agent A writes useful structured memory; Agent B
reads the same memory; Zentext repacks it into useful context; Agent B continues
without the developer restating the full project.

## The real competitor is a markdown file

The real competitor is not Cursor or Codex. It is the manually maintained context
file that developers already use:

- `CLAUDE.md`
- `AGENTS.md`
- `.cursorrules`
- `CONTEXT.md`
- ad-hoc project notes in a README or scratch file.

Zentext must be clearly better than a markdown file because it is:

- **Structured** — typed records (task, decision, blocker, handoff, validation),
  not a wall of prose.
- **Queryable** — ask "what are the current blockers?" rather than re-reading the
  whole file.
- **Agent-writable** — agents update memory automatically via MCP, not by a human
  hand-editing a file.
- **Versioned** — track how memory evolves, not just its current state.
- **Repackable** — generate a focused, agent-ready context payload from current
  memory state, optimized for the receiving agent.

If Zentext is not meaningfully better than a developer's existing `CLAUDE.md`
within the first session of use, the value prop has failed. The demo flow in
[`mvp-specification.md`](./mvp-specification.md) exists to prove this.

## Why Zentext should start local-first

1. **Prove value before infrastructure.** Cloud adds auth, billing, multi-tenancy,
   and trust barriers. None of that proves the core thesis (agent-to-agent handoff).
2. **Trust.** Developers are protective of project data. A local-first product has
   no trust barrier for the core value.
3. **Offline.** Local works without network. Cloud-first products break on a train.
4. **Adoption funnel.** A free, fully-functional local core is the top of the
   funnel. Cloud and team features monetize the users who already proved local
   value.
5. **Scope discipline.** Starting cloud-first invites building infrastructure
   before the memory schema and repacking logic are validated.

Cloud is a delivery mechanism for team sync, not the product itself. See
[`cloud-boundary.md`](./cloud-boundary.md) and
[`staged-roadmap.md`](./staged-roadmap.md).
