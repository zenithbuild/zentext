# ADR 0003 — The "Better Than Markdown" Demo

**Status:** proposed (not final)
**Date:** 2026-07-05
**Related:** [open-decisions.md](../open-decisions.md) #5, [mvp-specification.md](../mvp-specification.md), [context-repacking.md](../context-repacking.md)

## Problem

The real competitor to Zentext is not Cursor or Codex. It is the hand-maintained
context file developers already use: `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, or a
`CONTEXT.md`. That file is free, simple, and already works. If we cannot show, in a
single concrete session, that Zentext is meaningfully better than that file, the
product has no wedge.

This ADR designs the concrete scripted demo that proves the value. It is the
make-or-break proof for the MVP and should be runnable (or demonstrable) before the
MVP is declared successful.

The demo must satisfy six explicit requirements:

1. Agent A writes structured project memory.
2. Zentext stores typed records.
3. Developer switches to Agent B.
4. Agent B reads or receives repacked context.
5. Agent B continues without the user re-explaining the project.
6. The same flow would be weaker or more manual with a markdown file.

## Demo scenario

**Project:** A Node.js API (`acme-api`) that currently has no authentication. The
task is to add OAuth login (GitHub provider) to a `/login` route and protect
`/api/profile` behind it.

**Agent A:** Codex (with MCP support).
**Agent B:** Claude Code (with MCP support), on the same machine, same repo.

The demo runs entirely locally. No cloud. The two agents are the same developer
switching tools mid-task.

## Step-by-step script

### Setup

```
$ cd ~/projects/acme-api
$ zentext init
Initialized Zentext store at ~/.zentext/projects/acme-api/
Next: point your MCP-compatible agent at the Zentext MCP server.
$ zentext status
Project: acme-api
Store: ~/.zentext/projects/acme-api/
Records: 0
Active task: none
Open blockers: none
Latest handoff: none
```

### Step 1 — Agent A writes structured memory (with the developer)

The developer opens Codex in the `acme-api` repo and gives it the task:

> "Add GitHub OAuth login. Create a `/login` route that starts the OAuth flow, a
> `/login/callback` route that exchanges the code, and protect `/api/profile` behind
> a session. Use the existing `express` setup."

Codex is connected to the Zentext MCP server. As it works, it calls MCP tools. The
following records are what *should* appear in the store after Agent A's session. They
are the proof that structured, agent-writable memory exists.

**Agent A calls `memory.write` (task):**

```pseudo-json
{
  "id": "rec_task_01",
  "type": "task",
  "project": "acme-api",
  "title": "Add GitHub OAuth login",
  "goal": "/login starts OAuth; /login/callback exchanges code; /api/profile requires session",
  "steps": [
    "add passport + passport-github deps",
    "create /login route",
    "create /login/callback route",
    "add session middleware",
    "protect /api/profile",
    "write smoke test"
  ],
  "progress": "in-progress",
  "next": "create /login/callback route and exchange code for token",
  "refs": {
    "files": ["src/server.js", "src/routes/login.js", "package.json"],
    "branches": ["feat/oauth"],
    "commits": ["a1b2c3d"]
  },
  "status": "active",
  "created_at": "2026-07-05T14:00:00Z",
  "updated_at": "2026-07-05T14:18:00Z",
  "author": "agent:codex",
  "tags": ["auth", "oauth"]
}
```

**Agent A calls `memory.write` (decision):**

```pseudo-json
{
  "id": "rec_decision_01",
  "type": "decision",
  "project": "acme-api",
  "title": "Use passport-github, not hand-rolled OAuth",
  "decision": "use passport + passport-github for the OAuth flow",
  "rationale": "passport handles state param and session serialization; hand-rolling is error-prone",
  "alternatives_considered": [
    "hand-rolled fetch to github.com/login/oauth/access_token (rejected: state/csrf handling)"
  ],
  "status": "active",
  "refs": { "files": ["src/routes/login.js"] },
  "created_at": "2026-07-05T14:05:00Z",
  "author": "agent:codex",
  "tags": ["auth", "decision"]
}
```

**Agent A calls `memory.write` (blocker):**

```pseudo-json
{
  "id": "rec_blocker_01",
  "type": "blocker",
  "project": "acme-api",
  "title": "GITHUB_CLIENT_SECRET not in env",
  "blocker": "callback route needs GITHUB_CLIENT_SECRET; it is not set in .env yet",
  "severity": "high",
  "workaround": "none; user must add the secret to .env (do NOT commit it)",
  "status": "active",
  "related": ["rec_task_01"],
  "created_at": "2026-07-05T14:16:00Z",
  "author": "agent:codex",
  "tags": ["auth", "env", "secret"]
}
```

Note: the blocker records that a secret is *needed* but never stores the secret
itself. This respects the cloud/local boundary.

**Agent A calls `memory.handoff`:**

```pseudo-json
{
  "id": "rec_handoff_01",
  "type": "handoff",
  "project": "acme-api",
  "from": "agent:codex",
  "to": "any",
  "context": "Adding GitHub OAuth to acme-api. /login route done and starts the flow.",
  "state": "/login exists and redirects to GitHub. /login/callback exists but cannot exchange the code because GITHUB_CLIENT_SECRET is missing from .env. /api/profile is not yet protected.",
  "next": "User adds GITHUB_CLIENT_SECRET to .env, then finish /login/callback token exchange, then add session middleware, then protect /api/profile.",
  "open_questions": ["should we store sessions in redis or in-memory for now?"],
  "completed_this_session": [
    "added passport + passport-github",
    "created /login route",
    "created /login/callback skeleton",
    "decided to use passport-github over hand-rolled"
  ],
  "created_at": "2026-07-05T14:20:00Z",
  "author": "agent:codex"
}
```

At this point the developer stops Agent A. The store now contains a task, a
decision, a blocker, and a handoff — all typed, queryable, and written by the agent
without the developer hand-editing a file.

### Step 2 — Zentext stores typed records (verification)

The developer confirms memory exists without launching an agent:

```
$ zentext status
Project: acme-api
Store: ~/.zentext/projects/acme-api/
Records: 4
Active task: Add GitHub OAuth login (in-progress)
Open blockers: 1 (GITHUB_CLIENT_SECRET not in env — high)
Latest handoff: 2026-07-05T14:20:00Z from agent:codex
Decisions: 1 (use passport-github)

$ zentext list --type blocker
rec_blocker_01  blocker  GITHUB_CLIENT_SECRET not in env  active  2026-07-05T14:16:00Z

$ zentext show rec_decision_01
type:     decision
title:    Use passport-github, not hand-rolled OAuth
decision: use passport + passport-github for the OAuth flow
rationale: passport handles state param and session serialization; hand-rolling is error-prone
alternatives: hand-rolled fetch (rejected: state/csrf handling)
status:   active
```

This is the typed-record proof: the developer can query "what are the blockers?" and
get a precise answer, not "go read the whole file and find the section."

### Step 3 — Developer switches to Agent B

The developer opens Claude Code in the same `acme-api` repo. Claude Code is
connected to the same Zentext MCP server. The developer does **not** re-explain the
project. They give a minimal instruction:

> "Continue the auth work."

### Step 4 — Agent B reads repacked context

Claude Code calls `memory.repack` (or `memory.read` for the active context). Zentext
returns a structured markdown payload following the priority order from
[context-repacking.md](../context-repacking.md). Example repack output:

```markdown
# Zentext context — acme-api
# Generated: 2026-07-05T14:21:00Z  |  focus: auth  |  from: 4 records

## Active task
- Add GitHub OAuth login (in-progress)
- Goal: /login starts OAuth; /login/callback exchanges code; /api/profile requires session
- Next: create /login/callback route and exchange code for token
- Refs: src/server.js, src/routes/login.js, package.json  |  branch feat/oauth  |  commit a1b2c3d

## Blockers (1)
- [high] GITHUB_CLIENT_SECRET not in env — callback cannot exchange code.
  Workaround: none; user must add the secret to .env (do NOT commit it).

## Decisions (1)
- Use passport-github, not hand-rolled OAuth.
  Rationale: passport handles state param and session serialization.
  Rejected alternative: hand-rolled fetch (state/csrf risk).

## Latest handoff (from agent:codex, 14:20)
- Context: Adding GitHub OAuth to acme-api. /login done and starts the flow.
- State: /login exists and redirects to GitHub. /login/callback skeleton exists
  but cannot exchange code (missing GITHUB_CLIENT_SECRET). /api/profile not yet
  protected.
- Next: user adds secret to .env; finish callback token exchange; add session
  middleware; protect /api/profile.
- Open question: redis or in-memory sessions for now?
- Completed this session: added passport+passport-github, /login route, /login/callback skeleton, decided passport-github.

## Validation state
- none recorded yet
```

This payload is what Agent B receives. It is focused, prioritized, and sized — not
the entire store, not a stale wall of text.

### Step 5 — Agent B continues without re-explanation

Claude Code now knows, without the developer re-explaining:
- what the task is and where it stands,
- that `passport-github` was chosen and why (so it does not re-litigate it),
- that there is a high-severity blocker (missing secret) it must respect before
  finishing the callback,
- what the prior agent already completed,
- the open question about session storage.

Agent B's correct continuation would be something like:

> "I see /login is done and passport-github was chosen. There's a blocker:
> GITHUB_CLIENT_SECRET is missing from .env. Before I finish the callback token
> exchange, you'll need to add it. Want me to finish the callback code assuming the
> secret will be present, and add session middleware + protect /api/profile in the
> meantime? Also, the prior agent left an open question: redis or in-memory sessions
> — for now I'll use in-memory unless you say otherwise."

The developer did not restate the project, the decision, or the blocker. Agent B
picked them up from memory. **That is the proof.**

If Agent B instead asks "what are we building?" or "how should auth work?", the demo
has failed.

### Step 6 — The same flow with a markdown file (the contrast)

To prove Zentext is better, run the same scenario with a hand-maintained
`CLAUDE.md` instead of Zentext and observe the differences.

**With `CLAUDE.md`:**

- The developer must **manually** edit `CLAUDE.md` after Agent A's session to record
  the decision, the blocker, the progress, and the handoff. The agent does not write
  it for them (a static file is not agent-writable through a standard interface).
- `CLAUDE.md` is **unstructured**. To find "what are the blockers?" the developer (or
  Agent B) must read the entire file and scan for it. There is no `zentext list
  --type blocker`.
- `CLAUDE.md` is **stale-prone**. If the developer forgets to update it after a
  change, Agent B reads outdated context. Zentext's typed records are updated by the
  agent as it works and surfaced by `zentext audit` when they go stale.
- `CLAUDE.md` is **not queryable**. There is no "give me the active task and open
  blockers, focused on auth." Zentext's `memory.repack --focus auth` does exactly
  that.
- `CLAUDE.md` is **one fixed file**. It cannot be scoped to a sub-task or sized to a
  budget. Zentext's repack produces a focused payload per request.
- `CLAUDE.md` has **no handoff concept**. The developer writes a freeform paragraph.
  Zentext's `handoff` record has explicit `state`, `next`, `open_questions`, and
  `completed_this_session` fields that the next agent reads predictably.

**Concrete contrast table:**

| Action | With CLAUDE.md | With Zentext |
|--------|----------------|--------------|
| Record the decision after Agent A | Developer hand-edits file | Agent calls `memory.write` via MCP |
| Record the blocker | Developer hand-edits file | Agent calls `memory.write` via MCP |
| Find the blocker before Agent B | Read the whole file | `zentext list --type blocker` |
| Give Agent B focused context | Paste the whole file | `memory.repack --focus auth` |
| Detect stale context | Developer notices | `zentext audit` flags it |
| Hand off with explicit next step | Write a freeform paragraph | `memory.handoff` with typed fields |
| Avoid re-litigating the passport decision | Hope Agent B reads that paragraph | Decision record is queryable and explicit |

The markdown flow is **more manual, less precise, and more stale-prone**. Zentext's
flow is **agent-written, structured, queryable, and repackable.**

## Demo success criteria

The demo is successful when all of these are true in a single real session:

1. Agent A wrote at least a task, a decision, a blocker, and a handoff via MCP —
   without the developer hand-editing any file.
2. `zentext status` / `list` / `show` display those typed records.
3. After switching to Agent B, the developer gave only a minimal instruction
   ("continue the auth work") and did not re-explain the project.
4. Agent B received repacked context and correctly referenced the prior decision and
   the blocker in its first response.
5. The same scenario done with `CLAUDE.md` required manual edits, full-file reads,
   and was visibly more friction.

## Demo failure criteria

The demo fails if:

- Agent A does not call the MCP tools reliably, so the store is empty or wrong.
- The repack payload is ignored or misunderstood by Agent B (it re-asks basic
  questions the handoff already answered).
- The developer had to re-explain the project to Agent B anyway.
- The markdown-file flow feels "about the same" to an observer (no clear advantage).

## Risks

- **Agent MCP tool reliability is the single biggest dependency.** If Codex or
  Claude Code does not call `memory.write` at the right moments, the store is empty
  and the demo collapses. Mitigation: test tool descriptions with both agents before
  the demo; tune descriptions; provide a CLI fallback where the developer writes
  records manually if the agent does not.
- **Repack output quality.** If the payload is too long or poorly ordered, Agent B
  ignores it. Mitigation: follow the priority order strictly; keep payloads under a
  size budget; test with both agents.
- **The markdown contrast may feel like a strawman.** A power user's `CLAUDE.md` can
  be well-organized. Mitigation: the contrast is not "markdown is bad" but "markdown
  is manual and static; Zentext is agent-written, structured, and queryable." Frame
  it honestly.
- **Demo depends on two MCP-capable agents on one machine.** If only one is
  available, fall back to the non-MCP path: Agent A writes via MCP, developer runs
  `zentext repack --out`, then pastes the payload into Agent B (or any agent). The
  proof still holds; the fallback demonstrates broad compatibility.

## What evidence would change the decision

- If observers of the demo do not perceive a clear advantage over a well-maintained
  `CLAUDE.md`, the value prop needs reframing (or the demo needs to be sharper).
- If Agent B reliably ignores the repack payload and asks the developer to
  re-explain anyway, repack format/priority needs rework before the MVP is credible.
- If the non-MCP fallback (`zentext repack` + paste) proves nearly as good as the MCP
  path, that changes the relative emphasis of MCP vs CLI in the MVP.
- If a single well-crafted `CLAUDE.md` template solves most of the pain for most
  users, Zentext's wedge narrows to teams and multi-agent power users — which is still
  a real segment but smaller than "every solo dev."

## Decision status

**Proposed.** Not final. This demo design is the proposed proof for the MVP. It
should be run for real (with Codex and Claude Code, on a real project like the
`acme-api` scenario) before the MVP is declared successful. The scenario and record
contents may be refined based on what agents actually write in practice.
