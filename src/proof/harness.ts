/**
 * Stage 3 multi-agent collaboration proof harness.
 *
 * Execution-only: orchestrates model interactions, captures prompts,
 * responses, and Zentext state, then produces a report.
 * Evaluation and scoring are performed by a separate reviewer.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SqliteStore } from "../store/sqlite-store.js";
import { createMemoryWriter, MemoryWriterConflictError } from "../domain/memory-writer.js";
import { repack } from "../repack/engine.js";
import type { AnyRecord, CreateRecordInput } from "../types/records.js";

import type { ModelAdapter } from "./model-adapter.js";
import {
  sharedSystem,
  agentACreatePrompt,
  agentBContinuePrompt,
  agentCStalePrompt,
  agentDSummarizePrompt,
  extractJson,
} from "./prompts.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentRun {
  role: "A" | "B" | "C" | "D";
  system: string;
  prompt: string;
  response: string;
  parsed: unknown;
  stateBefore?: string;
  stateAfter?: unknown;
  mutation?: {
    attempted: boolean;
    applied: boolean;
    conflict: boolean;
    error?: string;
  };
  error?: string;
}

export interface ModelRun {
  name: string;
  provider: string;
  model: string;
  runs: AgentRun[];
}

export interface ProofReport {
  projectId: string;
  projectName: string;
  seededAt: string;
  models: ModelRun[];
}

export interface RunProofOptions {
  adapters: ModelAdapter[];
  /** If provided, use this directory as the project root. Otherwise a temp dir is created. */
  projectPath?: string;
  /** If provided, use this directory as HOME. Otherwise a temp dir is created. */
  homePath?: string;
  /** If provided, write the markdown report here. */
  reportPath?: string;
}

interface AgentASeed {
  task: AnyRecord;
  decision: AnyRecord;
  handoff: AnyRecord;
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export async function runProof(options: RunProofOptions): Promise<ProofReport> {
  const home = options.homePath ?? mkdtempSync(join(tmpdir(), "zentext-stage3-"));
  const project = options.projectPath ?? mkdtempSync(join(tmpdir(), "zentext-stage3-proj-"));

  const originalHome = process.env.HOME ?? "";
  process.env.HOME = home;

  const store = new SqliteStore();
  const meta = await store.initProjectStore(project);
  const writer = createMemoryWriter(store);

  const modelRuns: ModelRun[] = [];

  try {
    // Agent A seed (same for all models to keep evaluation comparable)
    const seed = await seedProject(writer);

    for (const adapter of options.adapters) {
      const run = await runModel(adapter, store, writer, seed, meta);
      modelRuns.push(run);
    }
  } finally {
    store.close();
    process.env.HOME = originalHome;
    if (!options.homePath) rmSync(home, { recursive: true, force: true });
    if (!options.projectPath) rmSync(project, { recursive: true, force: true });
  }

  const report: ProofReport = {
    projectId: meta.projectId,
    projectName: meta.projectName,
    seededAt: new Date().toISOString(),
    models: modelRuns,
  };

  if (options.reportPath) {
    writeFileSync(options.reportPath, renderReport(report), "utf8");
  }

  return report;
}

async function seedProject(writer: ReturnType<typeof createMemoryWriter>): Promise<AgentASeed> {
  const task = writer.createRecord({
    type: "task",
    title: "Implement SaaS dashboard authentication",
    goal: "Add secure OAuth-based login and session management for the dashboard.",
    status: "active",
    next: "Wire OAuth callback handler and session store.",
    author: "agent:A",
  });

  const decision = writer.createRecord({
    type: "decision",
    title: "Use OAuth 2.0 with PKCE",
    decision: "Adopt OAuth 2.0 authorization code flow with PKCE for dashboard login.",
    rationale: "Balances security with implementation complexity; avoids password storage.",
    status: "accepted",
    author: "agent:A",
  });

  const handoff = writer.createHandoff({
    type: "handoff",
    title: "Initial auth handoff",
    from: "agent:A",
    to: "agent:B",
    context: "Authentication scope and decision are documented.",
    state: "Task created, decision accepted, no code written yet.",
    next: "Implement OAuth callback handler and session middleware.",
    author: "agent:A",
  } as CreateRecordInput);

  return { task, decision, handoff };
}

async function runModel(
  adapter: ModelAdapter,
  store: SqliteStore,
  writer: ReturnType<typeof createMemoryWriter>,
  seed: AgentASeed,
  meta: { projectName: string; projectId: string },
): Promise<ModelRun> {
  const run: ModelRun = {
    name: adapter.name,
    provider: adapter.provider,
    model: adapter.model,
    runs: [],
  };

  // Agent A — deterministic seed, captured as an artifact for traceability.
  const agentA: AgentRun = {
    role: "A",
    system: sharedSystem,
    prompt: agentACreatePrompt(),
    response: JSON.stringify({ task: seed.task, decision: seed.decision, handoff: seed.handoff }, null, 2),
    parsed: { task: seed.task, decision: seed.decision, handoff: seed.handoff },
    stateAfter: { task: seed.task, decision: seed.decision, handoff: seed.handoff },
  };
  run.runs.push(agentA);

  // Agent B
  const contextB = repack(store, meta).markdown;
  let staleContext = "";
  let taskBeforeC = seed.task;

  const agentB: AgentRun = {
    role: "B",
    system: sharedSystem,
    prompt: agentBContinuePrompt(contextB),
    stateBefore: contextB,
    response: "",
    parsed: {},
  };
  run.runs.push(agentB);

  try {
    const rawB = await adapter.send(sharedSystem, agentB.prompt);
    const contextualizedB = rawB.replace(/rec_task_PLACEHOLDER/g, seed.task.id);
    agentB.response = contextualizedB;
    agentB.parsed = extractJson(contextualizedB);

    // Capture stale context BEFORE applying Agent B's update so Agent C sees
    // genuinely outdated information.
    staleContext = repack(store, meta).markdown;
    taskBeforeC = store.getRecord(seed.task.id)!;

    const parsedB = agentB.parsed as {
      understanding?: unknown;
      update?: {
        record_id?: string;
        expected_revision?: number;
        patch?: Record<string, unknown>;
      };
    };

    agentB.mutation = { attempted: false, applied: false, conflict: false };

    if (
      parsedB.update?.record_id &&
      typeof parsedB.update.expected_revision === "number" &&
      parsedB.update.patch
    ) {
      agentB.mutation.attempted = true;
      try {
        writer.updateRecord(parsedB.update.record_id, parsedB.update.patch, {
          expectedRevision: parsedB.update.expected_revision,
          author: adapter.name,
        });
        agentB.mutation.applied = true;
        agentB.stateAfter = { task: store.getRecord(seed.task.id) };
      } catch (err) {
        if (err instanceof MemoryWriterConflictError) {
          agentB.mutation.conflict = true;
        } else {
          agentB.mutation.error = err instanceof Error ? err.message : String(err);
        }
      }
    }
  } catch (err) {
    agentB.error = err instanceof Error ? err.message : String(err);
  }

  // Agent C
  const agentC: AgentRun = {
    role: "C",
    system: sharedSystem,
    prompt: agentCStalePrompt(staleContext, taskBeforeC.revision),
    stateBefore: staleContext,
    response: "",
    parsed: {},
  };
  run.runs.push(agentC);

  try {
    const rawC = await adapter.send(sharedSystem, agentC.prompt);
    const contextualizedC = rawC.replace(/rec_task_PLACEHOLDER/g, seed.task.id);
    agentC.response = contextualizedC;
    agentC.parsed = extractJson(contextualizedC);

    const parsedC = agentC.parsed as {
      update?: {
        record_id?: string;
        expected_revision?: number;
        patch?: Record<string, unknown>;
      };
    };

    agentC.mutation = { attempted: false, applied: false, conflict: false };

    if (
      parsedC.update?.record_id &&
      typeof parsedC.update.expected_revision === "number" &&
      parsedC.update.patch
    ) {
      agentC.mutation.attempted = true;
      try {
        writer.updateRecord(parsedC.update.record_id, parsedC.update.patch, {
          expectedRevision: parsedC.update.expected_revision,
          author: `${adapter.name}:stale`,
        });
        agentC.mutation.applied = true;
      } catch (err) {
        if (err instanceof MemoryWriterConflictError) {
          agentC.mutation.conflict = true;
        } else {
          agentC.mutation.error = err instanceof Error ? err.message : String(err);
        }
      }
    }
  } catch (err) {
    agentC.error = err instanceof Error ? err.message : String(err);
  }

  // Agent D
  const contextD = repack(store, meta).markdown;
  const agentD: AgentRun = {
    role: "D",
    system: sharedSystem,
    prompt: agentDSummarizePrompt(contextD),
    stateBefore: contextD,
    response: "",
    parsed: {},
  };
  run.runs.push(agentD);

  try {
    const rawD = await adapter.send(sharedSystem, agentD.prompt);
    agentD.response = rawD;
    agentD.parsed = extractJson(rawD);
  } catch (err) {
    agentD.error = err instanceof Error ? err.message : String(err);
  }

  return run;
}

// ---------------------------------------------------------------------------
// Report rendering
// ---------------------------------------------------------------------------

export function renderReport(report: ProofReport): string {
  const lines: string[] = [
    "# Stage 3 Multi-Agent Collaboration Proof",
    "",
    `Project: ${report.projectName}`,
    `Project ID: ${report.projectId}`,
    `Seeded at: ${report.seededAt}`,
    "",
    "## Overview",
    "",
    "This report contains only raw execution artifacts: prompts sent to each model, raw responses, parsed responses, and Zentext state snapshots before and after each mutation attempt.",
    "",
    "Evaluation, scoring, and the final six-question verdict must be performed by a separate human or model reviewer.",
    "",
  ];

  for (const model of report.models) {
    lines.push(`## Model: ${model.name}`, "");
    lines.push(`- Provider: ${model.provider}`);
    lines.push(`- Model: ${model.model}`);
    lines.push("");

    for (const run of model.runs) {
      lines.push(`### Agent ${run.role}`, "");

      if (run.error) {
        lines.push(`**Error:** ${run.error}`);
        lines.push("");
        continue;
      }

      if (run.mutation) {
        lines.push(`- Mutation attempted: ${run.mutation.attempted}`);
        lines.push(`- Mutation applied: ${run.mutation.applied}`);
        lines.push(`- Conflict detected: ${run.mutation.conflict}`);
        if (run.mutation.error) {
          lines.push(`- Mutation error: ${run.mutation.error}`);
        }
        lines.push("");
      }

      if (run.stateBefore) {
        lines.push("<details>");
        lines.push("<summary>Zentext context before this agent</summary>");
        lines.push("");
        lines.push("```markdown");
        lines.push(run.stateBefore);
        lines.push("```");
        lines.push("</details>");
        lines.push("");
      }

      lines.push("<details>");
      lines.push("<summary>Prompt</summary>");
      lines.push("");
      lines.push("```text");
      lines.push(run.prompt);
      lines.push("```");
      lines.push("</details>");
      lines.push("");

      lines.push("<details>");
      lines.push("<summary>Raw response</summary>");
      lines.push("");
      lines.push("```text");
      lines.push(run.response);
      lines.push("```");
      lines.push("</details>");
      lines.push("");

      lines.push("<details>");
      lines.push("<summary>Parsed response</summary>");
      lines.push("");
      lines.push("```json");
      lines.push(JSON.stringify(run.parsed, null, 2));
      lines.push("```");
      lines.push("</details>");
      lines.push("");

      if (run.stateAfter) {
        lines.push("<details>");
        lines.push("<summary>Zentext state after this agent</summary>");
        lines.push("");
        lines.push("```json");
        lines.push(JSON.stringify(run.stateAfter, null, 2));
        lines.push("```");
        lines.push("</details>");
        lines.push("");
      }
    }
  }

  return lines.join("\n");
}
