# Zentext context — zentext-continuation-proof-proj-wy8x4J
Generated: 2026-07-20T19:50:50.004Z | focus: none | from: 26 records | budget: 500 chars

> Point-in-time snapshot. Live memory is at ~/.zentext/projects/393cd1fa3aa3ce69/store.sqlite

## Active task
- Implement memory.read MCP tool (active)
- Goal: Expose a read-only MCP tool that returns a single Zentext record by id to agents.
- Next: Define the tool schema and add a thin stdio server wrapper around the existing Store interface.
- Refs: files: src/mcp/server.ts | branches: feature/stage-1-readonly-mcp

## Blockers (1)
- [high] MCP SDK server API is unstable — no summary
  - Workaround: Pin SDK to the exact version used during this Stage 1 work and avoid newer server helpers.

