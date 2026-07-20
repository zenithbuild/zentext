#!/usr/bin/env node
/**
 * Stage 1 continuation proof — seed script.
 *
 * Creates an isolated temporary Zentext store with realistic project state,
 * then generates repack payloads for the dogfood continuation experiments.
 */

import { mkdtempSync, writeFileSync, realpathSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

import { SqliteStore } from "../../../dist/store/sqlite-store.js";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const tempHome = mkdtempSync(join(tmpdir(), "zentext-continuation-proof-home-"));
let tempProject = mkdtempSync(join(tmpdir(), "zentext-continuation-proof-proj-"));
const outputDir = join(import.meta.dirname, "outputs");
const originalCwd = process.cwd();

// Resolve symlinks (e.g., macOS /var -> /private/var) so seed and CLI agree on project id.
tempProject = realpathSync(tempProject);

process.env.HOME = tempHome;
process.chdir(tempProject);

const store = new SqliteStore();
await store.initProjectStore(tempProject);

// Helper to keep records realistic
async function seed() {
  store.createRecord({
    type: "task",
    title: "Implement memory.read MCP tool",
    goal: "Expose a read-only MCP tool that returns a single Zentext record by id to agents.",
    next: "Define the tool schema and add a thin stdio server wrapper around the existing Store interface.",
    tags: ["mcp", "memory.read", "readonly"],
    refs: { files: ["src/mcp/server.ts"], branches: ["feature/stage-1-readonly-mcp"] },
    author: "agent:codex",
  });

  store.createRecord({
    type: "task",
    title: "Design MCP server lifecycle",
    goal: "Decide how the MCP server starts, discovers the project store, and shuts down cleanly.",
    status: "blocked",
    next: "Wait for the stdio transport decision before wiring lifecycle hooks.",
    tags: ["mcp", "lifecycle", "design"],
    refs: { files: ["docs/implementation/mcp-server-design.md"] },
    author: "agent:codex",
  });

  store.createRecord({
    type: "blocker",
    title: "MCP SDK server API is unstable",
    blocker: "The MCP TypeScript SDK server constructor signature changed between 1.0.0 and 1.1.0, breaking the spike.",
    severity: "high",
    workaround: "Pin SDK to the exact version used during this Stage 1 work and avoid newer server helpers.",
    status: "open",
    tags: ["mcp", "dependency", "risk"],
    author: "agent:codex",
  });

  store.createRecord({
    type: "blocker",
    title: "Project ID hash collision in tests",
    blocker: "Two temporary project directories generated the same project-id in CI when no git remote existed.",
    severity: "medium",
    workaround: "Use explicit temp HOME and unique project paths in tests; revisit collision handling in Stage 2.",
    status: "resolved",
    tags: ["infra", "tests"],
    author: "agent:codex",
  });

  store.createRecord({
    type: "decision",
    title: "Use stdio MCP transport for Stage 1",
    decision: "The read-only MCP server in Stage 1 will use stdio transport only.",
    rationale: "Stdio requires no network stack, matches the local-first constraint, and is supported by both Codex and Claude Code.",
    alternatives_considered: ["HTTP/SSE transport (rejected: requires network layer out of Stage 1 scope)"],
    status: "accepted",
    tags: ["mcp", "transport", "architecture"],
    refs: { files: ["docs/decision-records/0004-mcp-tool-naming.md"] },
    author: "agent:codex",
  });

  store.createRecord({
    type: "decision",
    title: "Expose store over HTTP",
    decision: "Later stages may expose the store over a local HTTP endpoint for editor integrations.",
    rationale: "Not needed for Stage 1; the MCP layer should be proven over stdio first.",
    status: "rejected",
    tags: ["mcp", "transport", "future"],
    author: "agent:codex",
  });

  store.createRecord({
    type: "policy",
    title: "No cloud or network calls in Stage 1",
    rule: "Stage 1 Zentext code must not make network requests, cloud API calls, or sync operations.",
    scope: "project",
    enforcement: "required",
    status: "active",
    tags: ["boundary", "stage-1"],
    author: "user:judah",
  });

  store.createRecord({
    type: "policy",
    title: "Support pluggable transports later",
    rule: "Keep the MCP server transport swappable so HTTP/SSE can be added in a later stage without redesign.",
    scope: "project",
    enforcement: "advisory",
    status: "inactive",
    tags: ["boundary", "future"],
    author: "user:judah",
  });

  store.createRecord({
    type: "validation",
    title: "Early MCP spike failed",
    check: "node scripts/mcp-spike.js",
    result: "failed",
    summary: "The spike connected but could not resolve the project store from the MCP server cwd reliably.",
    run_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    tags: ["mcp", "spike"],
    author: "agent:codex",
  });

  await delay(50);

  store.createRecord({
    type: "validation",
    title: "Typecheck passes after repack fixes",
    check: "npm run typecheck && npm run typecheck:test",
    result: "passed",
    summary: "No type errors after fixing blocked-task priority and timestamp determinism.",
    run_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    tags: ["quality", "repack"],
    author: "ci:local",
  });

  store.createRecord({
    type: "handoff",
    title: "Session handoff — repack engine complete",
    from: "agent:codex",
    to: "agent:continuation",
    context: "The Stage 1 repack engine is implemented, reviewed, and merged. The next system proof is whether a fresh agent can continue from its output alone.",
    state: "Repack engine passes all tests; default budget is 12000 chars; focus and --out work correctly.",
    next: "Run the continuation proof. If it passes, begin feature/stage-1-readonly-mcp.",
    open_questions: ["Should memory.read return full records or a focused summary?"],
    completed_this_session: ["Implemented shared repack engine", "Added zentext repack CLI", "Resolved review findings"],
    status: "latest",
    tags: ["handoff", "stage-1"],
    author: "agent:codex",
  });

  store.createRecord({
    type: "handoff",
    title: "Initial MCP exploration notes",
    from: "agent:codex",
    to: "agent:continuation",
    context: "Early notes from spiking the MCP server before the repack engine existed.",
    state: "Outdated: the stdio transport decision superseded the HTTP exploration.",
    next: "Ignore this handoff; refer to the latest handoff and accepted transport decision.",
    status: "archived",
    tags: ["handoff", "mcp", "archive"],
    author: "agent:codex",
  });

  const logSummaries = [
    "Built shared repack engine with deterministic priority order and size budget.",
    "Added CLI repack command with --focus, --max-size, and --out options.",
    "Fixed blocked-task priority and ISO timestamp determinism from review feedback.",
    "Verified 115 tests pass and git diff --check is clean.",
    "Spiked a minimal stdio MCP server wrapper; blocked on SDK version stability.",
    "Documented Stage 1 plan update: prove continuation before building MCP read tools.",
  ];

  for (let i = 0; i < logSummaries.length; i++) {
    store.createRecord({
      type: "log",
      title: `Log entry ${i + 1}`,
      summary: logSummaries[i],
      command: i === logSummaries.length - 1 ? "zentext status" : "npm test",
      exit_code: 0,
      tags: ["log", "stage-1"],
      author: "agent:codex",
    });
  }

  for (let i = 0; i < 8; i++) {
    store.createRecord({
      type: "custom",
      title: `Research note ${i + 1}`,
      kind: "mcp-research",
      body: { topic: `mcp-topic-${i + 1}`, notes: `Additional context item ${i + 1} that should be low priority in repack unless focused.` },
      status: "active",
      tags: ["research", "low-priority"],
      author: "agent:codex",
    });
  }
}

await seed();
store.close();

function runRepack(args = []) {
  return execFileSync(
    "node",
    [join(originalCwd, "dist/cli/cli.js"), "repack", ...args],
    { cwd: tempProject, env: process.env, encoding: "utf8" },
  );
}

const defaultRepack = runRepack([]);
const focusedRepack = runRepack(["--focus", "MCP"]);
const focusedLifecycleRepack = runRepack(["--focus", "lifecycle"]);
const budget4000 = runRepack(["--max-size", "4000"]);
const budget1500 = runRepack(["--max-size", "1500"]);
const budget500 = runRepack(["--max-size", "500"]);
const budgetTiny = runRepack(["--max-size", "100"]);

mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, "default.md"), defaultRepack, "utf8");
writeFileSync(join(outputDir, "focused-mcp.md"), focusedRepack, "utf8");
writeFileSync(join(outputDir, "focused-lifecycle.md"), focusedLifecycleRepack, "utf8");
writeFileSync(join(outputDir, "budget-4000.md"), budget4000, "utf8");
writeFileSync(join(outputDir, "budget-1500.md"), budget1500, "utf8");
writeFileSync(join(outputDir, "budget-500.md"), budget500, "utf8");
writeFileSync(join(outputDir, "budget-tiny.md"), budgetTiny, "utf8");

console.log("Stage 1 continuation proof seeded.");
console.log(`Temp HOME:      ${tempHome}`);
console.log(`Temp project:   ${tempProject}`);
console.log(`Output dir:     ${outputDir}`);
