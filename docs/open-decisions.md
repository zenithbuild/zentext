# Open Decisions

This is the decision registry for strategic and product decisions. It includes
accepted Stage 1 decisions, unresolved later-stage gates, why each decision
matters, what evidence would change it, and when it must be revisited. This is a
living document for ongoing discussion.

> **Stage 1 status (2026-07-06):** Decisions #1, #2, #3, #4, #6, #7, and the Stage 1
> subset of #10 are **accepted for Stage 1** (see
> [`decision-records/0002`](./decision-records/0002-memory-storage-location.md),
> [`0004`](./decision-records/0004-mcp-tool-naming.md),
> [`0005`](./decision-records/0005-schema-rigidity.md), and
> [`implementation/tech-stack-decision.md`](./implementation/tech-stack-decision.md)
> for ADR 0006). They are accepted for Stage 1, not necessarily forever, and remain
> revisitable as Stage 1 usage evidence accumulates. The entries below are kept for
> context and to record what would change them in later stages.

## 1. Memory storage location: in-repo vs out-of-repo

**Question:** Should the memory store live inside the repo (e.g., `.zentext/`) or
outside it (e.g., `~/.zentext/`)?

**Options:**
- In-repo (`.zentext/`): versioned with git, shareable via repo clone, visible to
  all tools. Pollutes repo, potential commit noise, conflict-prone.
- Out-of-repo (`~/.zentext/`): cleaner repos, no git conflicts. Not shared via git
  clone (cloud sync needed for sharing).

**Status:** Accepted for Stage 1 (2026-07-06). See ADR 0002.

**Stage 1 contract:** Out-of-repo for the store, with an option to export a portable
bundle into the repo (e.g., `.zentext/context.md`) for git-based sharing. Bridges
both. For Stage 1 the export path is `zentext repack --out .zentext/context.md`
(no separate `zentext export` command).

**Why it matters:** Affects sharing model, git hygiene, and whether cloud sync is
the only sharing path.

**What would settle it:** Real-world usage — do users want memory in git, or do
they find it noisy?

**When it must be decided:** Before MVP implementation begins. (Decided for Stage 1.)

---

## 2. Fixed vs flexible schema

**Question:** How rigid should the baseline schema be?

**Options:**
- Fixed types with required fields.
- Fully schemaless key-value.
- Opinionated baseline types + a `custom` escape hatch.

**Status:** Accepted for Stage 1 (2026-07-06). See ADR 0005. No move to fully
schemaless memory and no pluggable templates in Stage 1.

**Stage 1 contract:** Opinionated baseline types (task, decision, blocker, handoff,
log, validation, policy, custom) with a `custom` escape hatch. See
[`memory-schema.md`](./memory-schema.md).

**Why it matters:** Repacking needs enough structure to prioritize and format
records. A blank-canvas store is no better than a markdown file.

**What would settle it:** Repacking tests against real projects — does the
baseline cover the common cases without forcing every project into a rigid shape?

**When it must be decided:** Before MVP implementation begins (schema is core).
(Decided for Stage 1.)

---

## 3. Context repacking format

**Question:** What should the repack output look like?

**Options:**
- Structured markdown (default).
- JSON.
- Per-agent custom formats.

**Status:** Accepted for Stage 1 (2026-07-06). Structured markdown is the Stage 1
default; JSON export/snapshot remains optional and later. Per-agent custom formats
are deferred.

**Stage 1 default:** Structured markdown as the default, with templates and per-agent
customization later. See [`context-repacking.md`](./context-repacking.md).

**Why it matters:** If the format is not useful to the receiving agent, the value
prop fails.

**What would settle it:** Testing repack output with multiple agents — do they
consume markdown well, or does JSON work better for some?

**When it must be decided:** During MVP implementation; revisitable. (Default
decided for Stage 1.)

---

## 4. Exact MCP tool names

**Question:** What should the MCP tools be named?

**Options:**
- `memory.*` namespace (accepted for Stage 1).
- `zentext.*` namespace.
- `project.*` namespace.

**Status:** Accepted for Stage 1 (2026-07-06). See ADR 0004. The `memory.*`
namespace and the initial seven-tool surface are accepted; tool **description
wording** stays testable/tunable during demo validation (see #12).

**Stage 1 contract:** `memory.*` — clear, agent-readable, describes the domain.

**Why it matters:** Tool names affect how reliably agents decide to call them.

**What would settle it:** Testing tool naming with real agents and measuring call
reliability.

**When it must be decided:** During MVP implementation; revisitable. (Namespace
decided for Stage 1; descriptions remain tunable.)

---

## 5. How to prove Zentext is better than a markdown file

**Question:** What is the concrete demo that makes superiority obvious within one
session?

**Options:**
- A scripted end-to-end handoff between two real agents on a real project.
- A side-by-side comparison of resuming work with vs without Zentext.
- A time-saved metric across a multi-agent session.

**Current lean:** Scripted end-to-end handoff (Agent A writes, Agent B reads and
continues) on a real project, demonstrating that the developer does not re-explain.

**Why it matters:** This is the core proof of value. If it is not obvious, the
product has no wedge.

**What would settle it:** Running the demo with real developers and observing
whether they immediately get it.

**When it must be decided:** Before declaring the MVP successful.

---

## 6. Versioning model

**Question:** Should memory be versioned via git or internally?

**Options:**
- Git-based (memory as files, versioned via git).
- Internal versioning (memory in a store, versioned internally).
- Hybrid (internal versioning + optional git export).

**Status:** Accepted for Stage 1 (2026-07-06). Internal versioning of the store
with optional git export via the read-only `repack --out` snapshot; the live store is
not coupled to git.

**Stage 1 contract:** Internal versioning for the store, with optional git export.
Don't couple the store to git.

**Why it matters:** Coupling to git limits storage location choices and adds merge
complexity.

**What would settle it:** Whether users expect memory history in git or are happy
with internal versioning plus export.

**When it must be decided:** During MVP implementation. (Decided for Stage 1.)

---

## 7. Non-MCP fallback strategy

**Question:** How should Zentext support agents without MCP?

**Options:**
- `zentext repack` emits a markdown payload to paste.
- Clipboard copy.
- File output referenced by the agent.

**Status:** Accepted for Stage 1 (2026-07-06). `zentext repack` (stdout or
`--out <file>`) is the Stage 1 non-MCP fallback.

**Stage 1 contract:** `zentext repack` emits markdown to stdout or a file, which the
developer pastes or references. See [`cli-reference.md`](./cli-reference.md).

**Why it matters:** Widens compatibility without per-agent integrations.

**What would settle it:** Testing with non-MCP agents — is paste/file convenient
enough?

**When it must be decided:** During MVP implementation. (Decided for Stage 1.)

---

## 8. Team ownership and permissions

**Question:** Who can write to shared memory, who can delete, and how are conflicts
handled?

**Options:**
- Open (any team member can write/delete).
- Role-based (admin/author tiers).
- Conservative (no deletes; supersede only).

**Status:** Unresolved for Stage 2. Not a Stage 1 gate (single-user local).

**Current lean:** Stage 2 decision. For MVP, single-user, so moot.

**Why it matters:** Affects trust and data integrity in team settings.

**What would settle it:** Team usage patterns — what conflicts arise in practice?

**When it must be decided:** Stage 2 (cloud sync and teams).

---

## 9. Non-agent sources (humans, CI)

**Question:** Should memory records come from non-agent sources?

**Options:**
- CLI-only human authoring.
- CI/CD ingest of validation results.
- HTTP/webhook ingest.

**Current lean:** Yes to CLI-written records (humans). Yes to a simple
CLI/ingest path for CI validation results. Broadens value without much complexity.

**Why it matters:** Validation results from CI are high-value, low-effort memory
that agents should not have to re-derive.

**What would settle it:** Whether CI ingest is low-friction and useful in practice.

**When it must be decided:** During or shortly after MVP.

---

## 10. Stale detection strategy

**Question:** How should Zentext detect and handle stale memory?

**Options:**
- Age-based (records older than threshold while task active).
- Reference-based (records referencing code that has changed).
- Manual audit only.

**Status:** Accepted for Stage 1 (2026-07-06). The MVP staleness subset
(age-based, status-based, completed-task, manually-marked) is accepted; reference-
based staleness is deferred to a post-MVP Stretch goal. Stale-detection thresholds
remain tunable during implementation.

**Stage 1 contract:** MVP combines age-based, status-based, completed-task, and
manually-marked staleness, surfaced via `zentext audit`. Reference-based
staleness (records referencing code that has changed) is deferred to a post-MVP
Stretch goal. Do not auto-delete; flag for review. See
[`implementation/staleness-and-audit-spec.md`](./implementation/staleness-and-audit-spec.md).

**Why it matters:** Stale memory misleads the next agent. Detection is needed
before it becomes a trust problem.

**What would settle it:** Running `audit` on real projects and seeing whether the
flags are accurate.

**When it must be decided:** During MVP implementation (audit command is MVP).

---

## 11. Open-source license choice

**Question:** Which license should the local core use?

**Options:**
- Apache 2.0 (permissive, adoption-friendly, but lets competitors host the sync
  server).
- AGPL (protects cloud commercialization, may reduce adoption).
- BSL (source-available, delays competing cloud, non-OSI).

**Status:** Unresolved release gate. Does not block Stage 1 implementation
planning or coding.

**Current lean:** Undecided. Tension between adoption (Apache 2.0) and protecting
cloud monetization (AGPL/BSL).

**Why it matters:** If cloud sync is the monetization path, a permissive license
lets competitors fork and host it. A copyleft/source-available license may reduce
adoption.

**What would settle it:** The monetization model's reliance on cloud (if local is
enough of a funnel and cloud is incremental, Apache 2.0 may be fine), and legal
review.

**When it must be decided:** Before public release of the local core.

---

## 12. MCP tool naming and positioning

**Question:** Beyond the namespace, how should tools be described to maximize
reliable agent calls?

**Options:**
- Action-oriented descriptions ("Write a decision record when...").
- Query-oriented descriptions ("Find current blockers...").
- Minimal descriptions and let the agent infer.

**Status:** Open. The `memory.*` namespace and tool surface are accepted (ADR
0004); description **wording** stays testable/tunable during demo validation.

**Current lean:** Action-oriented, explicit descriptions that tell the agent when to
call each tool.

**Why it matters:** Agents decide whether to call tools based on their names and
descriptions. Vague descriptions reduce call reliability.

**What would settle it:** A/B testing descriptions across agents and measuring call
rates and correctness.

**When it must be decided:** During MVP implementation; revisitable.

---

## 13. Tech stack / runtime / store format

**Question:** What implementation runtime, local store format, MCP SDK, repack
output format, and project-id derivation should Stage 1 use?

**Status:** Accepted for Stage 1 (2026-07-06). See
[`implementation/tech-stack-decision.md`](./implementation/tech-stack-decision.md)
(ADR 0006).

**Accepted decision:**
- TypeScript/Node for Stage 1.
- SQLite for the local structured store.
- MCP TypeScript SDK for Stage 1, assuming it remains stable enough during
  implementation (the one open risk; revisited before Phase 4 if unstable).
- Structured markdown as the default repack output; JSON export/snapshot remains
  optional and later.
- Project ID: hash the normalized git remote `origin` URL if available, else hash
  the absolute project path; store the human-readable project name separately from
  the stable project id.
- Rust is not rejected permanently; it is deferred unless later evidence shows a
  need for hardened verification, performance-critical pieces, or a Rust kernel.

**Why it matters:** Locks the runtime/store/SDK before Phase 1 begins; store format
is the main lock-in risk (mitigated by an abstracted store API and schema
versioning).

**What would settle it / change it:** MCP TypeScript SDK instability, or clearly
trivial SQLite query needs favoring JSON-on-disk, would revisit this for Stage 1.

**When it must be decided:** Before Phase 1 begins. (Decided for Stage 1.)
