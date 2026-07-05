# Zentext

A local-first shared context and memory layer for AI coding agents.

Zentext preserves external project memory — task state, architecture decisions,
blockers, handoffs, validation results, and policies — and repacks that memory
into useful context so that when you switch from one AI coding agent to another,
the next agent picks up where the last one left off without you re-explaining the
project from scratch.

## Repo state

This repository is **planning/docs only.**

- No implementation exists yet.
- No MCP server is built.
- No CLI is built.
- No UI exists.
- No cloud service exists.

The documents in [`docs/`](./docs) are the source of truth for product direction,
MVP scope, monetization, cloud boundary, self-hosting model, risks, and open
decisions. Future implementation work should be driven from these docs, and any
drift from them should be a conscious, recorded decision.

## MVP target

The MVP is a **local MCP memory layer + thin CLI.**

- The MCP server is the agent interface (agents read and write project memory).
- The CLI is the human/fallback interface (inspect, edit, hand off, repack context).
- The local memory store is the product core.

The MVP is **not** an app, a dashboard, a cloud service, an editor plugin, an
agent runner, or a universal chat UI.

## Important: Zentext is separate from Zenith Framework

Zentext is a **standalone product repo** and is not part of the Zenith Framework
repository (`zenithbuild/framework`). Do not modify Zenith Framework files for
Zentext work.

The Zenith Framework may eventually be used to build a future UI for Zentext, but
UI is explicitly out of scope for the current phase. See
[`docs/staged-roadmap.md`](./docs/staged-roadmap.md).

## Critical constraint

Zentext **cannot** transfer hidden model state from one AI system to another. It
can only preserve *external* project memory and repack that memory into useful
context for another agent. This limitation is permanent and must be stated honestly
in all documentation and messaging.

## Docs index

| Document | Purpose |
|----------|---------|
| [docs/product-overview.md](./docs/product-overview.md) | What Zentext is, the problem, what it is not, target users |
| [docs/mvp-specification.md](./docs/mvp-specification.md) | MVP definition, scope, success/failure criteria, demo flow |
| [docs/memory-schema.md](./docs/memory-schema.md) | Baseline structured memory record types |
| [docs/mcp-tools.md](./docs/mcp-tools.md) | Proposed MCP tool surface |
| [docs/cli-reference.md](./docs/cli-reference.md) | Thin CLI commands and non-MCP fallback |
| [docs/context-repacking.md](./docs/context-repacking.md) | How memory becomes agent-ready context |
| [docs/cloud-boundary.md](./docs/cloud-boundary.md) | What cloud may and may not host |
| [docs/monetization.md](./docs/monetization.md) | Pricing model and pricing units |
| [docs/self-hosting.md](./docs/self-hosting.md) | Open-source and enterprise self-hosting |
| [docs/staged-roadmap.md](./docs/staged-roadmap.md) | Four-stage plan and triggers |
| [docs/risks-and-antipatterns.md](./docs/risks-and-antipatterns.md) | Risks and anti-patterns to avoid |
| [docs/open-decisions.md](./docs/open-decisions.md) | Unresolved strategic decisions |

## Status

Planning. Docs only. See [`docs/staged-roadmap.md`](./docs/staged-roadmap.md) for
the path from here to implementation.
