# Cloud Boundary

Cloud is **future scope only.** The MVP is local-first and fully functional without
any cloud. This document defines what Zentext Cloud may eventually host and what it
must never host, so future work does not drift into storing the wrong things.

## Cloud is future scope

- Stage 1 (MVP): local only. No cloud, no accounts, no sync.
- Stage 2: optional cloud sync for teams. See [`staged-roadmap.md`](./staged-roadmap.md).
- Nothing in the MVP depends on cloud. The local core is the product.

## What Zentext Cloud may eventually host

- **Workspace metadata** — workspace name, member list, roles.
- **Structured project memory records** — decisions, task state, blockers,
  handoffs, validation results, policies. These are the core sync payload.
- **Task state** — active/resolved task records.
- **Decisions** — architecture/implementation decision records.
- **Blockers** — active/resolved blocker records.
- **Handoff records** — session handoff summaries.
- **Validation history** — results of validation steps.
- **Audit summaries** — who wrote what, when (for teams/enterprise).
- **Policies** — team-level rules (never secrets).
- **Backup/sync state** — version vectors, last-sync timestamps, conflict
  metadata.

## What Zentext Cloud should NOT host by default

- **Raw secrets** — API keys, tokens, passwords. Never.
- **Full repository contents** — Zentext is a memory index, not a repo mirror.
  Store references (paths, SHAs, branches), not file contents.
- **Private credentials** — none.
- **Provider auth tokens** — none.
- **Browser sessions** — none.
- **Hidden model state** — impossible to capture; never attempted.
- **Full unsanitized command logs** — store structured summaries and safe excerpts
  only. Scrub before storing. Full logs may exist locally only.

## Boundary principle

> Zentext hosts structured metadata **about** the project, not the project itself.

It is a memory index and sync layer — not a repository, not a secret store, not a
model state archive. If a piece of data would not be safe in a shared Notion page,
it should not be in Zentext cloud.

## Local vs cloud data rules

- **Local store** may be more permissive (it is on the user's machine), but the
  default schema still avoids capturing secrets, and the CLI warns if stored content
  looks like a secret (heuristic check).
- **Cloud store** follows the boundary above strictly. Nothing sensitive is synced
  without explicit, informed opt-in, and secrets are never eligible.
- **Retention:** Local history is unlimited and subject only to the user's machine
  storage. Cloud/Teams retention limits apply by plan (see
  [`monetization.md`](./monetization.md)). Local is **not** artificially limited to
  force cloud upgrades — crippling local adoption is an anti-pattern (see
  [`risks-and-antipatterns.md`](./risks-and-antipatterns.md)).

## Sync safety (future)

When cloud sync is added (Stage 2), it must:

- Sync only eligible structured records (per the boundary above).
- Never sync records flagged as containing potential secrets.
- Use conflict metadata to avoid silent data loss.
- Default to conservative merge semantics (last-write-wins or simple merge) until
  real-world patterns justify more complex resolution.
