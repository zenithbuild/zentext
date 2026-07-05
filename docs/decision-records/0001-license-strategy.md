# ADR 0001 — License Strategy

**Status:** proposed (not final)
**Date:** 2026-07-05
**Related:** [open-decisions.md](../open-decisions.md) #11, [monetization.md](../monetization.md), [self-hosting.md](../self-hosting.md)

## Problem

Zentext's local core must be open source for adoption and trust, but the primary
monetization path is cloud sync and enterprise self-host. The license choice
determines whether a competitor can fork the open-source code, host the sync server
themselves, and undercut Zentext's paid tiers. This is a one-way decision: changing
a license after public release is disruptive and erodes trust.

## Options

### Option A — Apache 2.0

Permissive OSI license. Anyone can use, fork, modify, and host, including
commercially, without contributing back.

### Option B — AGPL-3.0

Strong copyleft. Anyone who runs a modified version as a network service must
publish their modifications under the same license. This effectively prevents a
competitor from hosting a proprietary fork of the sync server without open-sourcing
their changes.

### Option C — BSL (Business Source License)

Source-available, non-OSI. Converts to an open license (often Apache 2.0) after a
delay period (e.g., 4 years). Allows Zentext to keep the latest version
commercially controlled while older versions become open over time. Used by
HashiCorp, Sentry, CockroachDB.

### Option D — Apache 2.0 local core + proprietary cloud/enterprise

Split-licensed approach. The local core (store, MCP server, CLI, repacking) is
Apache 2.0. The sync server and enterprise features are a separate, proprietary
codebase not released as open source.

## Tradeoffs

| Aspect | Apache 2.0 | AGPL | BSL | Split (Apache core + proprietary cloud) |
|--------|-----------|------|-----|------------------------------------------|
| Adoption friendliness | Highest | Medium (some companies avoid AGPL) | Low-medium (non-OSI, scares some) | High (core is Apache) |
| Protects cloud monetization | No | Yes | Yes | Yes (cloud is closed source) |
| Protects self-host sync server | No | Yes | Yes | Yes |
| Enterprise legal review friction | Low | High (AGPL reviewed case-by-case) | Medium | Low |
| Community contribution willingness | High | Medium | Lower | High for core |
| Reversibility | Hard to re-license later | Hard | Defined conversion date | Hard |
| "Is it open source?" perception | Yes | Yes | No (source-available) | Partially |

## Current recommendation

**Option D — Apache 2.0 local core + proprietary cloud/enterprise.**

Rationale:
- The local core is the adoption funnel and the trust anchor. Apache 2.0 maximizes
  adoption and removes legal friction for enterprise users evaluating the core.
- The sync server and enterprise features are the monetization surface and do not
  need to be open source. Keeping them proprietary protects cloud and self-host
  revenue without crippling the local core.
- A community sync server (basic, open source) can still exist under Apache 2.0 as
  a trust-building, adoption-driving artifact — but the full enterprise sync server
  with SSO/RBAC/audit is proprietary.
- This avoids AGPL's adoption friction (many enterprises ban AGPL by policy) and
  BSL's "not really open source" perception.

This keeps the open-source trust clean: the local core is genuinely free and
genuinely open source under a permissive license, while the value-add cloud/enterprise
code is a separate commercial product.

## Risks

- **Competitor forks the local core and builds their own cloud.** With Apache 2.0,
  this is legal. Mitigation: the proprietary enterprise features (SSO, RBAC, audit,
  governance) and the managed cloud convenience are the moat, not the license. The
  local core alone is not a business.
- **"Is the cloud open source?" confusion.** Users may expect the whole product to
  be open source. Mitigation: clear messaging that the local core is Apache 2.0 and
  the cloud/enterprise server is a separate commercial product.
- **Community feels the cloud is a closed extension of an open core.** This is the
  standard open-core model and is widely understood, but some communities resent it.
  Mitigation: never cripple the local core; keep the community sync server genuinely
  useful.
- **AGPL would have been more protective.** True, but AGPL's adoption cost (legal
  review, enterprise bans) is likely higher than the fork risk for an early product.

## What evidence would change the decision

- If a real competitor forks the Apache core and launches a hosted sync product
  within 6 months of release, the calculus shifts toward AGPL or BSL for the sync
  server.
- If enterprise prospects cite AGPL-avoidance as a reason they would adopt, that
  validates the Apache choice.
- If the local core alone proves to be enough product that most users never need
  cloud, monetization strategy itself may need rethinking, independent of license.
- Legal review of the split-license approach may surface complications (e.g., shared
  library code between core and cloud) that make a clean split harder than expected.

## Decision status

**Proposed.** Not final. Requires legal review of the split-license approach and a
go/no-go before public release of the local core. Must be decided before the first
public release.
