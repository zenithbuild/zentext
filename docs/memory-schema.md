# Memory Schema

This document defines the baseline structured memory records for Zentext. It is
conceptual: it describes record types, their purpose, key fields, and when agents
should read or write them. It is **not** a database implementation spec.

## Design principles

- **Opinionated baseline, extensible by custom types.** A small set of well-defined
  record types covers the common cases. A `custom` type covers anything else
  without forcing every project into a rigid schema.
- **Structured, not freeform.** Records are typed and fielded so they can be
  queried and repacked into focused context. A schemaless key-value store would be
  no better than a markdown file.
- **Not a vector database.** Semantic search may be a feature inside the store
  later, but the product value is structured, queryable, repackable memory, not
  embeddings.
- **Keep it simple.** Do not over-design. Fields should be obvious to a developer
  reading the record in the CLI.

## Common fields (all record types)

Every record shares a common envelope:

```pseudo-json
{
  "id": "rec_01HZ...",            // stable unique id
  "type": "task | decision | ...", // record type
  "project": "my-app",            // project this record belongs to
  "title": "short human title",
  "summary": "1-3 sentence summary",
  "status": "active | resolved | stale | superseded",
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601",
  "author": "agent:codex | agent:claude | user:judah | ci:github-actions",
  "tags": ["auth", "backend"],
  "refs": {                       // repo references, not file contents
    "files": ["src/auth/login.ts"],
    "commits": ["a1b2c3d"],
    "branches": ["feat/auth"]
  }
}
```

`refs` stores references (paths, SHAs, branch names), **never** file contents or
secrets.

## Record types

### task

**Purpose:** Track an active or completed unit of work the agent is performing.

**Key fields:**

```pseudo-json
{
  "type": "task",
  "goal": "what success looks like",
  "steps": ["step 1 done", "step 2 in progress"],
  "progress": "in-progress | blocked | done | abandoned",
  "next": "the immediate next action",
  "related": ["rec_decision_...", "rec_blocker_..."]
}
```

**When an agent should write this:** When starting a task, when making progress,
when changing status, and when handing off.

**When an agent should read this:** At the start of a session to understand what
is in progress and what to do next.

---

### decision

**Purpose:** Record an architecture or implementation decision and its rationale so
it is not re-litigated by the next agent.

**Key fields:**

```pseudo-json
{
  "type": "decision",
  "decision": "use Postgres for the audit store",
  "rationale": "transactional integrity needed for audit records",
  "alternatives_considered": ["SQLite (rejected: no concurrent writers)"],
  "status": "active | superseded | reverted",
  "supersedes": ["rec_decision_..."]
}
```

**When an agent should write this:** When a non-obvious decision is made that
future agents should respect.

**When an agent should read this:** At the start of a session and before proposing
a change that might conflict with a prior decision.

---

### blocker

**Purpose:** Record something that is currently preventing progress.

**Key fields:**

```pseudo-json
{
  "type": "blocker",
  "blocker": "OAuth callback fails in staging",
  "severity": "high | medium | low",
  "workaround": "none known",
  "status": "active | resolved",
  "related": ["rec_task_..."]
}
```

**When an agent should write this:** When progress is blocked and the blocker
should survive an agent switch.

**When an agent should read this:** At the start of a session to avoid repeating
work that is currently blocked.

---

### handoff

**Purpose:** Summarize the state of work for the next agent or teammate, the
explicit bridge between sessions.

**Key fields:**

```pseudo-json
{
  "type": "handoff",
  "from": "agent:codex",
  "to": "agent:claude | user:judah | any",
  "context": "what was being done and why",
  "state": "where things stand right now",
  "next": "what the next agent should do",
  "open_questions": ["should we cache tokens?"],
  "completed_this_session": ["wrote login.ts", "added tests"]
}
```

**When an agent should write this:** At the end of a session, before a switch, or
when explicitly asked to hand off.

**When an agent should read this:** At the start of a session as the primary entry
point for continuing work.

---

### log

**Purpose:** Record a safe, summarized command or action log. **Never** raw secrets
or unsanitized output.

**Key fields:**

```pseudo-json
{
  "type": "log",
  "command": "npm test",
  "exit_code": 1,
  "summary": "3 tests failed in auth suite",
  "safe_excerpt": "...safe lines only...",
  "sanitized": true
}
```

**When an agent should write this:** After running a meaningful command or action
whose outcome is useful to the next agent.

**When an agent should read this:** To understand recent actions and their
outcomes. Logs are low priority in repacking unless recent and relevant.

---

### validation

**Purpose:** Record the result of a validation step (tests, lints, builds, type
checks, proofs) so the next agent does not redo it or re-litigate a passed check.

**Key fields:**

```pseudo-json
{
  "type": "validation",
  "check": "npm test | tsc --noEmit | build | lint",
  "result": "pass | fail | unknown",
  "summary": "all tests pass except auth callback",
  "run_at": "ISO-8601",
  "details_ref": "rec_log_..."
}
```

**When an agent should write this:** After running a validation step.

**When an agent should read this:** At the start of a session to know what has
already been validated and what still needs checking.

---

### policy

**Purpose:** Record a rule the agent or team should follow (coding standards,
forbidden actions, required checks). Optional proof/verification history may attach
here later.

**Key fields:**

```pseudo-json
{
  "type": "policy",
  "rule": "never commit directly to main",
  "scope": "project | team | workspace",
  "enforcement": "advisory | required",
  "status": "active"
}
```

**When an agent should write this:** Rarely; policies are usually human-authored
via CLI. Agents may propose policies but should not silently create them.

**When an agent should read this:** At the start of a session and before taking an
action that might violate a policy.

---

### custom

**Purpose:** Escape hatch for project-specific memory that does not fit a baseline
type, without forcing the schema to grow unboundedly.

**Key fields:**

```pseudo-json
{
  "type": "custom",
  "kind": "a user/agent-defined sub-type string",
  "body": { /* freeform structured fields */ }
}
```

**When an agent should write this:** When no baseline type fits and the record is
still useful to a future agent.

**When an agent should read this:** When relevant; custom records are low priority
in default repacking unless tagged or referenced.

## Non-goals

- No database implementation details here (no SQL, no ORM models).
- No vector embeddings as a required field.
- No over-designed type system with deep inheritance.
- No full repository content storage in any record.
- No secret storage in any record.
