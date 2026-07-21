/**
 * Stage 3/4 multi-agent collaboration proof harness.
 *
 * Execution-only: orchestrates model interactions, captures prompts,
 * responses, and Zentext state, then produces a report.
 * Evaluation and scoring are performed by a separate reviewer.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
  available: boolean;
  skipReason?: string;
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
  /** Models that were skipped due to unavailability, included in artifacts for transparency. */
  skippedModels?: Array<{ name: string; provider: string; model: string; reason: string }>;
  /** If provided, use this directory as the project root. Otherwise a temp dir is created. */
  projectPath?: string;
  /** If provided, use this directory as HOME. Otherwise a temp dir is created. */
  homePath?: string;
  /** If provided, write the artifact package here. */
  outputDir?: string;
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

  const skipped = (options.skippedModels ?? []).map((m) => ({
    name: m.name,
    provider: m.provider,
    model: m.model,
    available: false,
    skipReason: m.reason,
    runs: [],
  }));

  const report: ProofReport = {
    projectId: meta.projectId,
    projectName: meta.projectName,
    seededAt: new Date().toISOString(),
    models: [...modelRuns, ...skipped],
  };

  if (options.outputDir) {
    writeArtifactPackage(options.outputDir, report);
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
    available: true,
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
// Artifact package
// ---------------------------------------------------------------------------

export function writeArtifactPackage(outputDir: string, report: ProofReport): void {
  mkdirSync(outputDir, { recursive: true });

  writeFileSync(
    join(outputDir, "README.md"),
    renderReadme(report),
    "utf8",
  );

  writeFileSync(
    join(outputDir, "comparison.md"),
    renderComparison(report),
    "utf8",
  );

  for (const model of report.models) {
    const modelDir = join(outputDir, model.name);
    mkdirSync(modelDir, { recursive: true });

    if (!model.available) {
      writeFileSync(
        join(modelDir, "UNAVAILABLE.md"),
        `# ${model.name}\n\nUnavailable: ${model.skipReason ?? "model not found in Ollama"}\n`,
        "utf8",
      );
      continue;
    }

    for (const run of model.runs) {
      const roleDir = join(modelDir, `agent-${run.role}`);
      mkdirSync(roleDir, { recursive: true });

      writeFileSync(join(roleDir, "system.txt"), run.system, "utf8");
      writeFileSync(join(roleDir, "prompt.txt"), run.prompt, "utf8");
      writeFileSync(join(roleDir, "response.txt"), run.response, "utf8");
      writeFileSync(join(roleDir, "parsed.json"), JSON.stringify(run.parsed, null, 2), "utf8");

      if (run.stateBefore) {
        writeFileSync(join(roleDir, "repack-before.md"), run.stateBefore, "utf8");
      }
      if (run.stateAfter) {
        writeFileSync(join(roleDir, "state-after.json"), JSON.stringify(run.stateAfter, null, 2), "utf8");
      }
      if (run.mutation) {
        writeFileSync(join(roleDir, "mutation.json"), JSON.stringify(run.mutation, null, 2), "utf8");
      }
      if (run.error) {
        writeFileSync(join(roleDir, "error.txt"), run.error, "utf8");
      }
    }
  }
}

function renderReadme(report: ProofReport): string {
  const lines: string[] = [
    "# Stage 4 Multi-Model System Proof",
    "",
    `Project: ${report.projectName}`,
    `Project ID: ${report.projectId}`,
    `Seeded at: ${report.seededAt}`,
    "",
    "This package contains raw execution artifacts for a multi-model collaboration proof using Zentext.",
    "",
    "Each model has its own directory containing Agent A/B/C/D prompts, raw responses, parsed responses,",
    "repack outputs, and mutation outcomes.",
    "",
    "`comparison.md` organizes the evidence for human review but does not assign scores.",
    "",
    "## Models evaluated",
    "",
  ];
  for (const model of report.models) {
    lines.push(`- **${model.name}** (${model.provider}/${model.model}) — ${model.available ? "available" : "unavailable: " + (model.skipReason ?? "not found")}`);
  }
  return lines.join("\n");
}

function renderComparison(report: ProofReport): string {
  const lines: string[] = [
    "# Stage 4 Evidence Comparison",
    "",
    "This document collects the evidence required to answer the six manual review questions.",
    "Do not treat it as a scorecard. It is an organized view of the raw artifacts.",
    "",
    "## Models",
    "",
  ];

  for (const model of report.models) {
    lines.push(`### ${model.name}`, "");
    if (!model.available) {
      lines.push(`Skipped: ${model.skipReason ?? "model not found in Ollama"}`);
      lines.push("");
      continue;
    }
    lines.push(`- Provider/model: ${model.provider}/${model.model}`);
    for (const run of model.runs) {
      const hasMutation = run.mutation && (run.mutation.attempted || run.mutation.applied || run.mutation.conflict);
      lines.push(`- **Agent ${run.role}**: ${run.error ? "error — " + run.error : hasMutation ? `mutation attempted=${run.mutation!.attempted} applied=${run.mutation!.applied} conflict=${run.mutation!.conflict}` : "completed"}`);
    }
    lines.push("");
  }

  lines.push(
    "## Manual review questions",
    "",
    "Answer these questions by inspecting the per-model artifact directories.",
    "",
    "1. Did Zentext preserve enough context?",
    "   - Review each Agent B `parsed.json`. Does it correctly identify the current goal, latest decision, active task, and next action?",
    "",
    "2. Could a completely fresh model continue work?",
    "   - Review each Agent B `mutation.json`. Was a valid update attempted and applied?",
    "",
    "3. Did stale information remain rejected?",
    "   - Review each Agent C `mutation.json`. Was the stale update rejected with `applied: false` and `conflict: true`?",
    "",
    "4. Did the models generally reach the same understanding?",
    "   - Compare the Agent B `parsed.json` files across models. Look for agreement on goal, decision, task, and next action.",
    "",
    "5. What information was consistently missing?",
    "   - Identify fields or concepts that most models omitted or misunderstood.",
    "",
    "6. What is the smallest improvement that would increase continuation quality?",
    "   - Identify one change to prompts, repack output, or schema documentation that would reduce disagreement or omission.",
    "",
  );

  return lines.join("\n");
}
