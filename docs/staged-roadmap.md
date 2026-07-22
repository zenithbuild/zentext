# Staged Roadmap

> **Historical roadmap:** This document preserves the original staged product
> reasoning. Several Stage 1 surfaces are now implemented and a Developer
> Preview is published. Use [`continuation.md`](./continuation.md) and the active
> GitHub roadmap for current implementation and milestone status.

Zentext is built in four stages, with one manual field-test gate before Stage 1
coding. Each stage has a clear purpose, deliverables,
acceptance criteria, non-goals, and a trigger to move to the next stage. Do not
start a stage until its trigger is met. Over-building ahead of the trigger is an
anti-pattern (see [`risks-and-antipatterns.md`](./risks-and-antipatterns.md)).

## Stage 0.5: Manual agent sync field test

**Purpose:** Validate the agent handoff workflow manually before building the
local store, MCP server, CLI, or repack engine.

**Deliverables:**

- A temporary `AGENT_SYNC.md` field-test file in one real project.
- 3 to 5 real handoffs between different agents or agent roles.
- Notes on what agents used, ignored, overwrote, or treated as stale.
- A decision on whether the accepted Stage 1 store/repack plan still fits the
  observed workflow.

**Acceptance criteria:**

- At least two different agents continue from the manual sync file.
- Handoffs require materially less re-explanation by the developer.
- Locked decisions, blockers, and validation results remain visible across agent
  switches.
- Conflicts or stale claims are identifiable.
- The useful state maps cleanly to Zentext record types or creates a specific
  planning-doc change request.

**Non-goals:**

- No product code.
- No MCP server.
- No CLI.
- No package setup.
- No UI.
- No change to the accepted Stage 1 architecture unless field-test evidence shows
  a contract flaw.

**Trigger to move to Stage 1 coding:**

The field-test findings support the Stage 1 plan, or the planning docs have been
patched to address any workflow contract issues discovered during the test. See
[`field-tests/agent-sync-field-test.md`](./field-tests/agent-sync-field-test.md).

---

## Stage 1: Local MVP

**Purpose:** Prove that a developer can switch between AI coding agents while
preserving external project memory, and that the next agent continues without the
developer re-explaining the project.

**Deliverables:**

- Local memory store (per-project).
- MCP server exposing: `memory.read`, `memory.write`, `memory.query`,
  `memory.handoff`, `memory.repack`, `memory.update`, `memory.list`.
- Thin CLI: `init`, `status`, `show`, `list`, `add`, `handoff`, `repack`,
  `edit`, `audit`.
- Baseline memory schema: task, decision, blocker, handoff, log, validation,
  policy, custom.
- Context repacking (structured markdown output, default priority order).
- Non-MCP fallback via `zentext repack` output.

**Acceptance criteria:**

- A developer initializes Zentext in a real project in under one minute.
- At least two different MCP-compatible agents read and write memory without custom
  integration.
- After switching agents, the second agent continues from repacked context without
  the developer restating the project.
- The experience is clearly better than maintaining a `CLAUDE.md` by hand.

**Non-goals:**

- Cloud, sync, accounts, auth, billing.
- UI, dashboard, GUI.
- Editor plugins.
- Vector search.
- Team workspaces, multi-user.
- Enterprise controls.
- Agent runtime/orchestration.

**Trigger to move to Stage 2:**

Real developers (not just the author) are using the local MVP in real projects and
reporting that agent-to-agent handoff works, AND more than one team has asked for a
way to share memory across teammates.

---

## Stage 2: Cloud sync and teams

**Purpose:** Let small teams share project memory across teammates and devices,
without requiring each person to re-establish context.

**Deliverables:**

- Team workspaces with membership.
- Shared memory sync across teammates.
- Basic admin controls.
- Audit summaries (cloud retention by plan).
- Cloud sync of eligible structured records only (per
  [`cloud-boundary.md`](./cloud-boundary.md)).
- Conflict metadata and conservative merge semantics.

**Acceptance criteria:**

- A team of 2+ developers can share a workspace and each member's agent reads the
  same project memory.
- Sync does not silently lose data or corrupt memory.
- No secrets are ever synced.

**Non-goals:**

- Enterprise governance (SSO, RBAC, audit export) — that is Stage 3.
- UI/dashboard — that is Stage 4.
- Vector search.
- Editor plugins.

**Trigger to move to Stage 3:**

Teams are paying for sync AND organizations are asking for SSO, governance, audit
export, or self-hosted deployment.

---

## Stage 3: Enterprise and governance

**Purpose:** Serve organizations that need on-prem deployment, governance, and
audit.

**Deliverables:**

- Self-hosted sync server (commercial license).
- SSO/SAML/OIDC.
- RBAC.
- Audit export.
- Retention policies.
- Governance controls (agent behavior rules, memory access policies).
- Priority support and SLA.

**Acceptance criteria:**

- An organization can self-host Zentext sync with SSO and RBAC.
- Audit logs are exportable and retention is configurable.
- Governance policies are enforced.

**Non-goals:**

- UI/dashboard — still Stage 4.
- Vector search (still optional).

**Trigger to move to Stage 4:**

The local and team product is stable, AND users are asking for a visual way to
browse memory and handoffs (not just CLI).

---

## Stage 4: Optional UI

**Purpose:** Provide optional visual tooling on top of the proven memory layer. UI
is a convenience, never a dependency for core value.

**Deliverables:**

- Local dashboard / memory browser.
- Handoff timeline.
- Validation state viewer.
- Possible future UI built with Zenith Framework (separate repo; not part of this
  repo's scope).

**Acceptance criteria:**

- Users can browse and manage memory visually without the CLI.
- The UI is optional — all core functionality remains available without it.

**Non-goals:**

- The UI must not become a generic AI chat app.
- The UI must not become an agent runner.
- The UI must not be required for any core workflow.

**Trigger to move beyond Stage 4:**

Driven by user demand and product learnings, not by roadmap assumptions.
