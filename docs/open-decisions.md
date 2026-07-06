# Open Decisions

These are unresolved strategic and product decisions. Each lists the question,
options, current lean, why it matters, what evidence would settle it, and when it
must be decided. This is a living document for ongoing discussion.

## 1. Memory storage location: in-repo vs out-of-repo

**Question:** Should the memory store live inside the repo (e.g., `.zentext/`) or
outside it (e.g., `~/.zentext/`)?

**Options:**
- In-repo (`.zentext/`): versioned with git, shareable via repo clone, visible to
  all tools. Pollutes repo, potential commit noise, conflict-prone.
- Out-of-repo (`~/.zentext/`): cleaner repos, no git conflicts. Not shared via git
  clone (cloud sync needed for sharing).

**Current lean:** Out-of-repo for the store, with an option to export a portable
bundle into the repo (e.g., `.zentext/context.md`) for git-based sharing. Bridges
both.

**Why it matters:** Affects sharing model, git hygiene, and whether cloud sync is
the only sharing path.

**What would settle it:** Real-world usage — do users want memory in git, or do
they find it noisy?

**When it must be decided:** Before MVP implementation begins.

---

## 2. Fixed vs flexible schema

**Question:** How rigid should the baseline schema be?

**Options:**
- Fixed types with required fields.
- Fully schemaless key-value.
- Opinionated baseline types + a `custom` escape hatch.

**Current lean:** Opinionated baseline types (task, decision, blocker, handoff,
log, validation, policy, custom) with a `custom` escape hatch. See
[`memory-schema.md`](./memory-schema.md).

**Why it matters:** Repacking needs enough structure to prioritize and format
records. A blank-canvas store is no better than a markdown file.

**What would settle it:** Repacking tests against real projects — does the
baseline cover the common cases without forcing every project into a rigid shape?

**When it must be decided:** Before MVP implementation begins (schema is core).

---

## 3. Context repacking format

**Question:** What should the repack output look like?

**Options:**
- Structured markdown (default).
- JSON.
- Per-agent custom formats.

**Current lean:** Structured markdown as the default, with templates and per-agent
customization later. See [`context-repacking.md`](./context-repacking.md).

**Why it matters:** If the format is not useful to the receiving agent, the value
prop fails.

**What would settle it:** Testing repack output with multiple agents — do they
consume markdown well, or does JSON work better for some?

**When it must be decided:** During MVP implementation; revisitable.

---

## 4. Exact MCP tool names

**Question:** What should the MCP tools be named?

**Options:**
- `memory.*` namespace (current lean).
- `zentext.*` namespace.
- `project.*` namespace.

**Current lean:** `memory.*` — clear, agent-readable, describes the domain.

**Why it matters:** Tool names affect how reliably agents decide to call them.

**What would settle it:** Testing tool naming with real agents and measuring call
reliability.

**When it must be decided:** During MVP implementation; revisitable.

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

**Current lean:** Internal versioning for the store, with optional git export.
Don't couple the store to git.

**Why it matters:** Coupling to git limits storage location choices and adds merge
complexity.

**What would settle it:** Whether users expect memory history in git or are happy
with internal versioning plus export.

**When it must be decided:** During MVP implementation.

---

## 7. Non-MCP fallback strategy

**Question:** How should Zentext support agents without MCP?

**Options:**
- `zentext repack` emits a markdown payload to paste.
- Clipboard copy.
- File output referenced by the agent.

**Current lean:** `zentext repack` emits markdown to stdout or a file, which the
developer pastes or references. See [`cli-reference.md`](./cli-reference.md).

**Why it matters:** Widens compatibility without per-agent integrations.

**What would settle it:** Testing with non-MCP agents — is paste/file convenient
enough?

**When it must be decided:** During MVP implementation.

---

## 8. Team ownership and permissions

**Question:** Who can write to shared memory, who can delete, and how are conflicts
handled?

**Options:**
- Open (any team member can write/delete).
- Role-based (admin/author tiers).
- Conservative (no deletes; supersede only).

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

**Current lean:** MVP combines age-based, status-based, completed-task, and
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

**Current lean:** Action-oriented, explicit descriptions that tell the agent when to
call each tool.

**Why it matters:** Agents decide whether to call tools based on their names and
descriptions. Vague descriptions reduce call reliability.

**What would settle it:** A/B testing descriptions across agents and measuring call
rates and correctness.

**When it must be decided:** During MVP implementation; revisitable.
