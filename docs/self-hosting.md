# Self-Hosting

## Principle

The local core is always free, open source, and fully functional standalone. This
is non-negotiable for adoption and trust. Paid features are about team scale,
governance, convenience, and support — never about restricting individual local
utility.

## Should open-source users be able to self-host?

**Yes.** The local core is self-hostable by definition (it runs on the developer's
machine) and is fully functional without any cloud or account.

## What belongs in free self-host

- The complete local core:
  - memory store
  - MCP server
  - thin CLI
  - context repacking
  - baseline schema
- Single-user usage with full functionality.
- Unlimited local projects.
- Unlimited local history (subject to machine storage only).
- A community sync server (later, Stage 2) with basic features: single workspace,
  basic sync, no SSO, no audit export, no RBAC, no support guarantees.
- Community support (GitHub issues, discussions).

## What belongs in paid enterprise self-host

- Multi-workspace support.
- SSO/SAML/OIDC integration.
- Role-based access control (RBAC).
- Audit log export and retention policies.
- Governance policy enforcement (agent behavior rules, memory access policies).
- Priority support and SLA.
- Commercial license for enterprise features.

## How to balance trust, adoption, and revenue

| Layer | Model | Why |
|-------|-------|-----|
| Local core | Open source, free, fully functional | Maximizes adoption. No trust barrier. Works offline. This is the funnel. |
| Cloud sync (teams) | Paid SaaS | Convenience + team features. Users who don't want to self-host pay for managed sync. |
| Community sync server | Open source, basic | Lets self-hosters try team sync. Creates trust. Caps at basic features. |
| Enterprise self-host | Commercial license + support | Companies that need governance, SSO, audit, and support pay for it. |

## Rule: do not cripple local

The free tier must be genuinely useful forever. Paid features add team scale,
governance, convenience, and support — they do not remove capability from the
individual local user. Specifically:

- Local history is unlimited. Cloud retention limits apply to cloud only.
- Local has no artificial project count limits.
- Local has no artificial feature gates on the core memory/MCP/CLI/repack
  functionality.

This mirrors models like Git (free local; GitHub/GitLab for teams), Obsidian (free
local; paid sync/publish), and Docker (free engine; paid enterprise features).
Local-first products that do not cripple local win trust and convert teams.
