# Failures observed and corrected before the final run

These were real discarded fixture runs. None was relabeled as a pass.

1. The skill's progress example did not show every structured field, causing
   rejected writes. Canonical state remained unchanged. The skill now shows
   exact blocker, verification, provenance, and tool-identity fields.
2. Two participants resubmitted an existing accepted decision. The fixture now
   states that `accepted_decisions` is only for decisions newly made in the
   current turn.
3. Concurrent helper processes could race while negotiating WAL mode before a
   busy timeout was installed. One OpenClaw stale check returned
   `INTERNAL_ERROR`; the same calls passed sequentially. The timeout now
   precedes WAL negotiation. Stress results: 32 source-built and 16 packed RPC
   opens with zero failures.
4. OpenClaw once continued Beta, Gamma, and Delta in a single session, reaching
   revision 7. That fixture was discarded. The reusable skill and fixture now
   enforce one prompt, one recorded next action, one revision, then stop.
5. Continuation output did not expose the current handoff record ID, so a
   participant stale-checked an older handoff. The canonical continuation now
   carries `handoff.record_id` across CLI, SDK, RPC, and MCP.
6. Antigravity rendered personal absolute file links in its raw UI response.
   No absolute path entered canonical records; committed evidence is normalized.
7. Ollama/GLM returned fenced JSON despite JSON mode. The controlled host
   rejected it before mutation and required a raw-JSON correction.
8. Removing the temporary OpenClaw agent also removed the workspace path
   configured for that agent. The canonical external SQLite store and
   normalized evidence were unaffected. The ignored workspace was restored
   from the repository fixture template, original non-routable Git origin, and
   recorded final report; Node 24 then revalidated revision 6, all four stale
   handoffs, and CLI/SDK/RPC/MCP parity. Future runs should detach or repoint an
   OpenClaw agent before deleting it when its workspace is a shared fixture.

The final evidence run was regenerated from a new packed package and a new
revision-2 fixture after corrections 1–7. Item 8 happened after the successful
run; its recovery was checked against the unchanged revision-6 canonical store
instead of being presented as a new provider execution.
