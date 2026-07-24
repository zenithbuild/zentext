# Zentext product and memory-ownership principles

> **Your memory. Your storage. Your choice.**

Zentext is a local-first project memory layer for AI tools. The records a user
creates locally must remain useful without an account, hosted service, active
subscription, or specific model provider.

These principles govern future product planning. They do not announce or
authorize a cloud implementation.

## Non-negotiable principles

1. Local use remains fully functional without an account.
2. The user owns their memory.
3. Cloud is optional.
4. Users can export at any time.
5. Users can leave without losing access to their records.
6. The portable format is documented.
7. Self-hosting remains a future supported direction.
8. Cloud monetizes convenience, synchronization, recovery, and collaboration,
   not access to locally created memory.
9. Zentext uses no dark-pattern lock-in.
10. Deletion and account exit are first-class workflows.

## Canonical local foundation

SQLite structured records are canonical today. Tasks, handoffs, decisions,
blockers, validations, revisions, policies, and provenance live outside any
individual AI session. JSON, Markdown, prompt text, CLI output, SDK, RPC, MCP,
and environment formatting are views over that state.

The local format must never depend on:

- hidden model state or private reasoning;
- provider conversation history;
- proprietary session memory;
- a hosted Zentext account;
- a network connection; or
- a provider-specific canonical database.

## User ownership

Ownership means more than a download button. A user must be able to:

- locate and back up local stores;
- inspect documented record and protocol versions;
- export complete portable state;
- verify export integrity;
- restore without the original device where project identity permits;
- move to another compatible tool;
- keep local records after downgrading or leaving a future service; and
- request deletion of hosted copies without deleting the user's local source.

An export that cannot be validated, restored, or used without Zentext Cloud is
not a meaningful exit path.

## Optional cloud boundary

A future cloud product may add convenience:

- encrypted synchronization;
- managed backups and recovery;
- multi-device continuity;
- team sharing and governance; and
- enterprise operations.

It must not make locally created memory inaccessible, unreadable, or
unexportable when payment, authentication, connectivity, or the service ends.
Entitlements may control hosted convenience, not ownership of the user's local
records.

## Deletion and exit

Future account deletion must define:

- complete export before exit;
- hosted data inventory;
- deletion state and evidence;
- backup-retention disclosures;
- team-owned versus user-owned records;
- billing termination;
- legal exceptions;
- local-device behavior; and
- service-unavailable recovery.

The safe default is clarity and user control, not retention by surprise.

## Security and privacy boundary

Cloud planning must assume project memory can be sensitive. It must explicitly
address encryption, metadata leakage, device identity, key recovery, revocation,
tenant isolation, insider access, rollback, replay, deletion failure, and
service compromise.

Zentext must not collect source code, private provider transcripts, hidden
reasoning, credentials, or unrelated local files merely because cloud features
exist.

## Roadmap placement

Current implementation remains ordered:

```text
trusted continuation
        ↓
environment presentation (#35)
        ↓
project-memory search (#36)
        ↓
relevance and freshness (#37)
        ↓
revision-aware caching (#38)
        ↓
measured graph/vector experiments
```

Future cloud planning is isolated under
[umbrella issue #67](https://github.com/zenithbuild/zentext/issues/67) and
[milestone 9](https://github.com/zenithbuild/zentext/milestone/9). Those
tickets do not automatically outrank or block the existing roadmap.

No cloud service, account system, authentication, billing, hosted database,
sync engine, or self-hosted distribution is implemented by this document.
