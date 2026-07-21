# Antigravity Results

## Primary evidence: clean isolated rerun

Raw artifacts: `./antigravity-results-clean/`

This rerun executes each Antigravity model in its own isolated temporary `HOME` with a freshly seeded project, so every model observes the same starting revision.

### gemini-flash (clean)

- **CLI selector:** `gemini-3.5-flash-medium`
- **Command used:** `agy --model gemini-3.5-flash-medium --dangerously-skip-permissions --print "<PROMPT>"`
- **Status:** Success
- **Agent B mutation:** `attempted=true`, `applied=true`, `conflict=false`
- **Agent C stale attempt:** `attempted=true`, `applied=false`, `conflict=true`

**Agent B understanding:**
- current_goal: Add secure OAuth-based login and session management for the dashboard.
- latest_decision: Adopt OAuth 2.0 authorization code flow with PKCE for dashboard login.
- active_task: Implement SaaS dashboard authentication
- next_action: Wire OAuth callback handler and session store.

**Agent B update:**
- record_id: correct live task id for its isolated store
- expected_revision: 1
- patch.next: "Implement OAuth 2.0 callback handler with PKCE verification and session middleware."
- reason: Refine next step to specifically focus on implementing the OAuth 2.0 callback handler with PKCE verification and session middleware.

**Agent C stale update:**
- expected_revision: 1
- patch.next: "Implement OAuth callback handler and session middleware."
- outcome: rejected with `conflict: true`

**Agent D summary:**
- current_state: SaaS dashboard authentication feature in initial setup phase with OAuth 2.0 + PKCE chosen, no implementation code written yet.
- completed_work: Documented and accepted the decision to use OAuth 2.0 with PKCE, created the active task, and completed the initial handoff.
- rejected_stale_work: None
- next_implementation_step: Implement the OAuth 2.0 callback handler with PKCE verification and session middleware.

### gemini-pro (clean)

- **CLI selector:** `gemini-3.1-pro-high`
- **Command used:** `agy --model gemini-3.1-pro-high --dangerously-skip-permissions --print "<PROMPT>"`
- **Status:** Success
- **Agent B mutation:** `attempted=true`, `applied=true`, `conflict=false`
- **Agent C stale attempt:** `attempted=true`, `applied=false`, `conflict=true`

**Agent B understanding:**
- current_goal: Add secure OAuth-based login and session management for the dashboard.
- latest_decision: Adopt OAuth 2.0 authorization code flow with PKCE for dashboard login.
- active_task: Implement SaaS dashboard authentication
- next_action: Wire OAuth callback handler and session store.

**Agent B update:**
- record_id: correct live task id for its isolated store
- expected_revision: 1
- patch.next: "Implement PKCE auth URL generator and OAuth callback handler."
- reason: Refine next step to focus on implementing PKCE flow generation and callback validation.

**Agent C stale update:**
- expected_revision: 1
- patch.next: "Implement PKCE code verifier and challenge generator functions."
- outcome: rejected with `conflict: true`

**Agent D summary:**
- current_state: SaaS dashboard authentication feature in initial task setup phase with approved OAuth 2.0 + PKCE decision, no code written yet.
- completed_work: Created authentication task, documented authentication scope and architectural decisions, accepted OAuth 2.0 with PKCE.
- rejected_stale_work: None; no code has been written or attempted yet.
- next_implementation_step: Implement the PKCE auth URL generator, OAuth callback handler, and session middleware.

## Historical evidence: ordered sequential run

Raw artifacts: `./antigravity-results-ordered/`

This run used one shared store, so each model observed the live revision at its position in the chain. It is preserved for transparency but is not the basis of the cross-provider alignment claim.

### gemini-flash (ordered)

- **Status:** Success
- **Agent B mutation:** applied at expected_revision 1
- **Agent C stale attempt:** rejected

### gemini-pro (ordered)

- **Status:** Success
- **Agent B mutation:** applied at expected_revision 2 (after gemini-flash advanced the shared task)
- **Agent C stale attempt:** rejected

## Models not executed

### Claude Sonnet

- **CLI selector:** `claude-sonnet-4-6`
- **Status:** Quota exceeded
- **Error:** `Error: Individual quota reached. Please upgrade your subscription to increase your limits. Resets in 65h19m...`

### Claude Opus

- **CLI selector:** `claude-opus-4-6-thinking`
- **Status:** Quota exceeded
- **Error:** Same quota error as Claude Sonnet

## Observations from the clean rerun

- Both available Antigravity models used the correct live task id from the repack output.
- Both selected the live revision they observed (revision 1 in the isolated rerun).
- Both applied a valid update.
- Both preserved the OAuth 2.0 + PKCE decision.
- Both stale attempts were rejected by optimistic concurrency.
- Both identified PKCE/callback/session as the implementation direction.
- gemini-pro chose a narrower first step (PKCE auth URL generator and callback handler) than gemini-flash (callback handler + session middleware). This is a tactical sequencing difference, not an architectural disagreement.
