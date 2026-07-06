# Safety and Secrets

**Status:** planning only — no code, no heuristic implementation.

## Purpose

Define the cross-cutting safety safeguards for Stage 1: secret rejection, log
sanitization, size caps, and conservative output defaults. The tool docs say
"reject secrets" but give no concrete rule; this doc gives the heuristics and
states plainly that they are **not a guarantee**. No implementation.

## Foundation docs this derives from

- [`mcp-tools.md`](../mcp-tools.md) — per-tool safety concerns
- [`memory-schema.md`](../memory-schema.md) — `log` sanitization, "never secrets"
- [`context-repacking.md`](../context-repacking.md) — exclude secrets/raw output
- [`cli-design.md`](./cli-design.md) — `add`/`edit` re-run rejection
- [`staleness-and-audit-spec.md`](./staleness-and-audit-spec.md) — audit flags secret-suspect records

## Stage 1 scope

- Heuristic secret rejection on write (`memory.write`, `zentext add`, `zentext
  edit` save).
- Heuristic redaction of likely tokens in logs/excerpts.
- No full unsanitized command logs stored.
- Stored log size cap.
- Prefer summaries over raw logs.
- Defensive exclusion of secrets from all reads/repacks (none are stored, but
  excluded defensively).

## Non-goals

- No cryptographic secret storage. Zentext never stores secrets.
- No guarantee that heuristics catch every secret. They are best-effort.
- No DLP/enterprise-grade scanning.
- No redaction of data the user explicitly marks non-secret.

## Heuristic safeguards (best-effort, not a guarantee)

### Secret rejection on write
- Reject records whose fields match high-signal secret patterns: common API-key
  prefixes (e.g., `sk-`, `ghp_`, `gho_`, `github_pat_`, `AKIA...`, private key
  headers `-----BEGIN ... PRIVATE KEY-----`), long high-entropy strings labeled
  as secret/token/password/key, and `.env`-style `SECRET`/`TOKEN`/`PASSWORD`
  assignments.
- Reject records that appear to paste `.env` file contents.
- Rejection is a validation error with a clear message; the record is not written.

### Likely-token redaction in logs
- Sanitize command output excerpts before storing as `log.safe_excerpt`: redact
  lines matching secret patterns; keep `sanitized: true`.
- Never store raw unsanitized command output as a log.

### Size caps
- Cap stored log/excerpt size (default finalized in implementation).
- Cap single-record payload size on write (mitigates noise/flood, per ADR 0004
  risk).

### Conservative output defaults
- Reads/repacks return summaries and refs, not full bodies where possible.
- Repack excludes raw logs beyond a recent safe excerpt (per
  [`repacking-spec.md`](./repacking-spec.md)).
- No CLI/MCP output prints secrets.

### Audit surfacing
- `audit` flags records that look like they may contain secrets (heuristic), for
  human review (per [`staleness-and-audit-spec.md`](./staleness-and-audit-spec.md)).

## Explicit non-guarantee

These safeguards are **heuristic and best-effort**. They reduce the chance of
secrets entering the store but cannot guarantee it. The product's hard rule is:
**never store secrets in Zentext memory.** Agents and humans are instructed not
to write secrets; the heuristics are a safety net, not a substitute for that
discipline. This must be stated in user-facing docs.

## Decisions and assumptions

- Conservative defaults are the product behavior (reject obvious secrets, redact
  likely tokens, avoid full unsanitized logs, cap log size, prefer summaries).
- Heuristics are revisitable based on audit findings and demo data.
- No secret storage feature exists or is planned for Stage 1.

## Acceptance criteria

- Writes matching high-signal secret patterns are rejected with a clear error.
- Logs store only sanitized excerpts (`sanitized: true`).
- Stored log/excerpt size is capped.
- No CLI/MCP output prints secrets.
- `audit` flags secret-suspect records for review.
- User-facing docs state plainly that heuristics are not a guarantee.

## Risks

- **False negatives** let a secret through. Mitigation: explicit non-guarantee;
  instruct agents/humans not to write secrets; audit flags suspects.
- **False positives** reject legitimate content (e.g., a long base64 asset).
  Mitigation: allow explicit override for a field the user marks non-secret
  (keep this minimal in Stage 1).
- **Heuristic drift** as secret formats evolve. Mitigation: revisitable patterns;
  revisit from audit findings.
