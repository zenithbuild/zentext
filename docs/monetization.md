# Monetization

## Recommended model

**Free open-source local core + paid team cloud + paid enterprise self-host.**

The local core is always free and fully functional standalone. Paid features are
about team scale, governance, convenience, and support — never about restricting
individual local utility.

## Tiers

### Local (free, open source)

- Full local core: memory store, MCP server, thin CLI, context repacking.
- Single-user usage.
- Unlimited local projects.
- Unlimited local history, subject only to the user's machine storage. Local is
  **not** artificially retention-limited.

**Target:** Solo developers; the adoption funnel.

### Solo Pro (paid)

- Cloud backup/sync for one user across devices.
- Multi-device sync.
- Longer cloud retention.
- Support.

**Target:** Power users who want backup and multi-device without a team.

### Teams (paid)

- Shared workspaces.
- Team memory sync.
- Shared policies.
- Admin controls.
- Audit history (cloud retention by plan).

**Target:** Small engineering teams (2–10) using multiple AI coding agents on shared
projects. This is the first reliable revenue segment.

### Enterprise self-host (paid)

- Self-hosted sync server.
- SSO/SAML/OIDC.
- RBAC.
- Audit export.
- Governance policies.
- Retention policies.
- Support/license.

**Target:** Mid-size to large organizations (50+) that need governance, on-prem
deployment, and support. A later, larger, slower segment.

### Enterprise cloud (paid, custom)

- Managed cloud with enterprise features.
- Custom contracts, DPA, SOC2 (eventually).

**Target:** Large organizations preferring managed over self-hosted.

## Pricing units

| Unit | Use it? | Reasoning |
|------|---------|-----------|
| Seats (per developer) | **Yes — primary** | Cleanest unit. Aligns with value (more devs = more value). Easy to understand. |
| Workspaces | **Yes — secondary (Teams+)** | Organizes team billing. One workspace per team/project-group. |
| Retention length | **Yes — tier differentiator** | Applies to cloud audit/history, not local. Free local is unlimited. Pro/Teams/Enterprise differ by cloud retention. |
| Audit history length | **Yes — enterprise differentiator** | Enterprise pays for longer audit retention. |
| Storage | Metered, secondary | Include a generous baseline (e.g., 1GB/seat). Charge for excess. Memory records are small, so this rarely triggers. |
| Cloud sync volume | Secondary meter | Included in plan. Charge for excessive volume. Rarely triggers for structured memory. |
| Repos/projects | **No** | Artificially restricts usage. Discourages adoption. |
| Monthly agent runs recorded | **No** | Perverse incentive — discourages usage, hard to meter reliably, does not align with value. |
| Tokens | **No** | Zentext does not pay for model inference. Token pricing is dishonest here. |

## Why this works

- **Free local is the funnel.** No barrier to adoption. Developers try it alone,
  prove it works, and bring it to their team.
- **Teams is the first reliable revenue.** The pain of shared memory across
  teammates is acute and the willingness to pay is real. Seat-based pricing fits team
  tool budgets.
- **Enterprise is the largest but slowest revenue.** Don't optimize for it early,
  but structure the architecture so it is reachable (self-hostable,
  governance-ready).
- **Solo Pro is nice-to-have revenue.** Low price, low volume, but captures power
  users who want cloud backup without a team.

## Pricing principles

- **Primary unit is seats** for teams.
- **Workspaces** are secondary.
- **Retention and audit history** are tier differentiators — but apply to **cloud**
  only. Local is never artificially limited.
- **Storage** is secondary, metered only for excess.
- **Do not price by tokens.** Zentext does not pay for model inference, so
  token-based pricing is the wrong model.
- **Do not price by agent runs.** Perverse incentive.
- **Do not price by repos/projects.** Restricts adoption.

## What NOT to do

- **Do not cripple local.** If the free local core is artificially limited, adoption
  dies and the funnel collapses. Local retention is unlimited; cloud retention is
  what differs by tier.
- **Do not price by tokens.** Dishonest and confusing.
- **Do not price by agent runs.** Perverse incentive.
- **Do not price by repos.** Restricts adoption.
- **Do not start with enterprise pricing.** SOC2, DPAs, security reviews, and long
  sales cycles consume runway before the product is proven. Build toward it.
