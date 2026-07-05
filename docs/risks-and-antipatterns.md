# Risks and Anti-Patterns

## Risks

### 1. "Just use a markdown file" is the real competitor

**Threat:** Developers already maintain `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, or
a `CONTEXT.md`. It is free, simple, and works. If Zentext is not meaningfully
better, it fails.

**Why Zentext can be better:** Structured (queryable, typed), agent-writable
(agents update automatically via MCP), versioned (track evolution), repackable
(generate focused context per agent), queryable (ask "what are the blockers?" not
"read the whole file").

**Mitigation:** The MVP must demonstrate a clear advantage over a markdown file
within the first session. If a developer cannot see why this is better than their
`CLAUDE.md` in one session, the value prop is not working.

---

### 2. MCP adoption and tool quality

**Threat:** MCP is emerging but not universal. Agents may not call tools reliably,
may call them at wrong times, may write garbage, or may not read memory when they
should. If agents do not use the tools well, the memory layer is inert.

**Mitigation:** Test with real agents (Codex, Claude Code, Cursor) early. Design
tools with clear, narrow purposes and good descriptions. Provide the CLI fallback
for non-MCP agents. Be honest about which agents work well.

---

### 3. Context repacking quality

**Threat:** The repacked payload may be too long, too unstructured, or not useful.
If the agent reads the memory and still does not understand the project state, the
value prop fails.

**Mitigation:** Invest in repacking logic early. Test with multiple agents. Support
per-agent output formats later. Keep payloads concise and structured. Let users
customize repack templates.

---

### 4. Scope creep into agent UI or harness territory

**Threat:** The temptation to add a chat interface, an agent runner, a dashboard, or
an editor plugin is constant. Each expands scope and dilutes focus.

**Mitigation:** Hard rule: Zentext is a memory layer. It stores, serves, and
repacks. It does not run agents, chat with models, render conversations, or compete
with editors. Every feature must pass the test: "Does this make agent-to-agent
memory handoff better?"

---

### 5. Cloud trust barrier

**Threat:** Developers are protective of project data. Even structured metadata may
be considered sensitive. If cloud is required for core value, adoption stalls.

**Mitigation:** Local core is fully functional without cloud. Cloud is opt-in and
only for sync/team features. Clear cloud boundary (no secrets, no repo contents).
Transparent about what is hosted.

---

### 6. Sync complexity (Stage 2)

**Threat:** When cloud sync is added, conflict resolution, offline edits, and merge
semantics are genuinely hard. Done poorly, sync corrupts memory or erodes trust.

**Mitigation:** Defer sync until local is proven. Start with conservative merge
(last-write-wins or simple merge). Do not build CRDTs or complex merge logic until
real-world patterns are understood.

---

### 7. Memory staleness

**Threat:** If agents do not write reliably, or memory is not updated as the project
evolves, it becomes stale and misleading. Stale memory is worse than no memory.

**Mitigation:** Stale detection (flag records referencing changed code or old
unresolved blockers). Encourage agents to validate memory against current repo
state. CLI `audit` command to find and clean stale records.

---

### 8. Unclear pricing

**Threat:** Confusing pricing slows adoption and erodes trust.

**Mitigation:** Keep pricing seat-based for teams, with retention/audit as tier
differentiators. Never token-based. Never per-agent-run. Never per-repo. See
[`monetization.md`](./monetization.md).

---

### 9. Storing sensitive data

**Threat:** Accidentally storing secrets or sensitive data in memory (and worse,
syncing them to cloud).

**Mitigation:** Heuristic secret detection on write. Never sync flagged records.
Conservative cloud boundary (see [`cloud-boundary.md`](./cloud-boundary.md)). Local
warnings when content looks like a secret.

---

### 10. Overbuilding enterprise too early

**Threat:** SOC2, DPAs, security reviews, and long sales cycles consume runway
before the product is proven.

**Mitigation:** Enterprise is Stage 3. Do not optimize for it early. Build toward it
architecturally (self-hostable, governance-ready) but do not start there.

---

## Anti-patterns

1. **Building a UI before the integration layer.** The MCP layer and CLI must work
   first. A dashboard without agent integration is a dead product.
2. **Cloud-first before local proof.** Building infrastructure for an unvalidated
   core value.
3. **Generic AI chat UI.** Out of scope. Competes with everything, differentiates
   from nothing.
4. **Vector DB as the product.** Semantic search is a feature, not the product.
5. **Token-based pricing.** Dishonest when Zentext does not pay for inference.
6. **Claiming hidden model state transfer.** Impossible and dishonest. State the
   limitation honestly.
7. **Competing with agent harnesses.** Do not run agents or orchestrate runs.
8. **Overbuilding sync too early.** Sync is Stage 2. Local is Stage 1.
9. **Hosting secrets or full repos.** Conservative cloud boundary only.
10. **Crippling the free local core.** Free local must be genuinely useful forever.
    Local retention is unlimited; cloud retention is what differs by tier.
11. **Building enterprise first.** Stage 3, not Stage 1.
12. **Making the schema so flexible it becomes meaningless.** Some structure is
    needed for repacking to work. An opinionated baseline schema with a `custom`
    escape hatch is the right balance — not a blank-canvas key-value store.
