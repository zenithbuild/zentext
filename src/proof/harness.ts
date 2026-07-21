/**
 * Stage 3 multi-agent collaboration proof harness.
 *
 * Uses the existing Zentext write domain and repack engine. No new Zentext
 * behavior is added here; this file only orchestrates model interactions and
 * evaluates their outputs.
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
  agentBContinuePrompt,
  agentCStalePrompt,
  agentDSummarizePrompt,
  extractJson,
} from "./prompts.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentAOutput {
  task: CreateRecordInput;
  decision: CreateRecordInput;
  handoff: CreateRecordInput;
}

export interface Understanding {
  current_goal?: string;
  latest_decision?: string;
  active_task?: string;
  next_action?: string;
}

export interface ProposedUpdate {
  record_id?: string;
  expected_revision?: number;
  patch?: Record<string, unknown>;
  reason?: string;
}

export interface AgentBOutput {
  understanding: Understanding;
  update: ProposedUpdate;
}

export interface AgentCOutput {
  update: ProposedUpdate;
}

export interface AgentDOutput {
  current_state?: string;
  completed_work?: string;
  rejected_stale_work?: string;
  next_implementation_step?: string;
}

export interface PerModelResult {
  name: string;
  agentA: { success: boolean; error?: string; records?: AgentASeed };
  agentB: {
    success: boolean;
    error?: string;
    understanding?: Understanding;
    update?: ProposedUpdate;
    applied: boolean;
    conflict?: boolean;
  };
  agentC: {
    success: boolean;
    error?: string;
    update?: ProposedUpdate;
    conflict: boolean;
    mutationOccurred: boolean;
  };
  agentD: { success: boolean; error?: string; summary?: AgentDOutput };
}

export interface ProofReport {
  projectId: string;
  models: PerModelResult[];
  agreement: {
    currentGoal: string[];
    latestDecision: string[];
    activeTask: string[];
  };
  verdict: {
    preservedEnoughContext: boolean;
    freshAgentsCouldContinue: boolean;
    staleInformationIsolated: boolean;
    modelsAgreed: boolean;
  };
}

interface AgentASeed {
  task: AnyRecord;
  decision: AnyRecord;
  handoff: AnyRecord;
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export interface RunProofOptions {
  adapters: ModelAdapter[];
  /** If provided, use this directory as the project root. Otherwise a temp dir is created. */
  projectPath?: string;
  /** If provided, use this directory as HOME. Otherwise a temp dir is created. */
  homePath?: string;
  /** If provided, write the markdown report here. */
  reportPath?: string;
}

export async function runProof(options: RunProofOptions): Promise<ProofReport> {
  const home = options.homePath ?? mkdtempSync(join(tmpdir(), "zentext-stage3-"));
  const project = options.projectPath ?? mkdtempSync(join(tmpdir(), "zentext-stage3-proj-"));

  const originalHome = process.env.HOME ?? "";
  process.env.HOME = home;

  const store = new SqliteStore();
  const meta = await store.initProjectStore(project);
  const writer = createMemoryWriter(store);

  const modelResults: PerModelResult[] = [];
  const understandings: Record<string, Understanding> = {};
  const summaries: Record<string, AgentDOutput> = {};

  try {
    // Agent A seed (same for all models to keep evaluation comparable)
    const seed = await seedProject(writer);

    for (const adapter of options.adapters) {
      const result = await runModel(adapter, store, writer, seed, meta);
      modelResults.push(result);
      if (result.agentB.understanding) {
        understandings[adapter.name] = result.agentB.understanding;
      }
      if (result.agentD.summary) {
        summaries[adapter.name] = result.agentD.summary;
      }
    }
  } finally {
    store.close();
    process.env.HOME = originalHome;
    if (!options.homePath) rmSync(home, { recursive: true, force: true });
    if (!options.projectPath) rmSync(project, { recursive: true, force: true });
  }

  const report: ProofReport = {
    projectId: meta.projectId,
    models: modelResults,
    agreement: computeAgreement(understandings),
    verdict: computeVerdict(modelResults, understandings),
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
): Promise<PerModelResult> {
  const result: PerModelResult = {
    name: adapter.name,
    agentA: { success: false, records: seed },
    agentB: { success: false, applied: false },
    agentC: { success: false, conflict: false, mutationOccurred: true },
    agentD: { success: false },
  };

  // Agent A is seeded deterministically so every model is evaluated against the same project state.
  result.agentA.success = true;

  let staleContext = "";
  let taskBeforeC = seed.task;

  // Agent B
  try {
    const contextB = repack(store, meta).markdown;
    const rawB = await adapter.send(sharedSystem, agentBContinuePrompt(contextB));
    const contextualizedB = rawB.replace(/rec_task_PLACEHOLDER/g, seed.task.id);
    const parsedB = extractJson(contextualizedB) as AgentBOutput;
    result.agentB.success = true;
    result.agentB.understanding = parsedB.understanding;
    result.agentB.update = parsedB.update;

    // Capture stale context BEFORE applying Agent B's update so Agent C sees truly outdated information.
    staleContext = repack(store, meta).markdown;
    taskBeforeC = store.getRecord(seed.task.id)!;

    if (
      parsedB.update?.record_id &&
      typeof parsedB.update.expected_revision === "number" &&
      parsedB.update.patch
    ) {
      try {
        writer.updateRecord(parsedB.update.record_id, parsedB.update.patch, {
          expectedRevision: parsedB.update.expected_revision,
          author: adapter.name,
        });
        result.agentB.applied = true;
      } catch (err) {
        if (err instanceof MemoryWriterConflictError) {
          result.agentB.conflict = true;
        } else {
          result.agentB.error = err instanceof Error ? err.message : String(err);
        }
      }
    }
  } catch (err) {
    result.agentB.error = err instanceof Error ? err.message : String(err);
  }

  // Agent C
  try {
    const rawC = await adapter.send(
      sharedSystem,
      agentCStalePrompt(staleContext, taskBeforeC.revision),
    );
    const contextualizedC = rawC.replace(/rec_task_PLACEHOLDER/g, seed.task.id);
    const parsedC = extractJson(contextualizedC) as AgentCOutput;
    result.agentC.success = true;
    result.agentC.update = parsedC.update;

    if (
      parsedC.update?.record_id &&
      typeof parsedC.update.expected_revision === "number" &&
      parsedC.update.patch
    ) {
      try {
        writer.updateRecord(parsedC.update.record_id, parsedC.update.patch, {
          expectedRevision: parsedC.update.expected_revision,
          author: `${adapter.name}:stale`,
        });
        result.agentC.mutationOccurred = true;
      } catch (err) {
        if (err instanceof MemoryWriterConflictError) {
          result.agentC.conflict = true;
          result.agentC.mutationOccurred = false;
        } else {
          result.agentC.error = err instanceof Error ? err.message : String(err);
        }
      }
    }
  } catch (err) {
    result.agentC.error = err instanceof Error ? err.message : String(err);
  }

  // Agent D
  try {
    const contextD = repack(store, meta).markdown;
    const rawD = await adapter.send(sharedSystem, agentDSummarizePrompt(contextD));
    const parsedD = extractJson(rawD) as AgentDOutput;
    result.agentD.success = true;
    result.agentD.summary = parsedD;
  } catch (err) {
    result.agentD.error = err instanceof Error ? err.message : String(err);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Evaluation helpers
// ---------------------------------------------------------------------------

function computeAgreement(understandings: Record<string, Understanding>): ProofReport["agreement"] {
  const goals = Object.values(understandings)
    .map((u) => u.current_goal?.toLowerCase().trim())
    .filter((g): g is string => Boolean(g));
  const decisions = Object.values(understandings)
    .map((u) => u.latest_decision?.toLowerCase().trim())
    .filter((d): d is string => Boolean(d));
  const tasks = Object.values(understandings)
    .map((u) => u.active_task?.toLowerCase().trim())
    .filter((t): t is string => Boolean(t));

  return {
    currentGoal: [...new Set(goals)],
    latestDecision: [...new Set(decisions)],
    activeTask: [...new Set(tasks)],
  };
}

function computeVerdict(
  models: PerModelResult[],
  understandings: Record<string, Understanding>,
): ProofReport["verdict"] {
  const understandingCount = Object.keys(understandings).length;
  const allUnderstood = understandingCount === models.length;

  const continuation = models.every(
    (m) => m.agentB.success && m.agentB.applied,
  );

  const staleIsolated = models.every(
    (m) => m.agentC.success && !m.agentC.mutationOccurred,
  );

  const agreement = computeAgreement(understandings);
  const modelsAgreed =
    agreement.currentGoal.length <= 2 &&
    agreement.latestDecision.length <= 2 &&
    agreement.activeTask.length <= 2;

  return {
    preservedEnoughContext: allUnderstood,
    freshAgentsCouldContinue: continuation,
    staleInformationIsolated: staleIsolated,
    modelsAgreed,
  };
}

// ---------------------------------------------------------------------------
// Report rendering
// ---------------------------------------------------------------------------

export function renderReport(report: ProofReport): string {
  const lines: string[] = [
    "# Stage 3 Multi-Agent Collaboration Proof",
    "",
    `Project ID: ${report.projectId}`,
    "",
    "## Verdict",
    "",
    `| Question | Answer |`,
    `|---|---|`,
    `| Did Zentext preserve enough context? | ${report.verdict.preservedEnoughContext ? "Yes" : "No"} |`,
    `| Could fresh agents continue work? | ${report.verdict.freshAgentsCouldContinue ? "Yes" : "No"} |`,
    `| Was stale information isolated? | ${report.verdict.staleInformationIsolated ? "Yes" : "No"} |`,
    `| Did models reach approximately the same understanding? | ${report.verdict.modelsAgreed ? "Yes" : "No"} |`,
    "",
    "## Agreement",
    "",
    `- Current goal variants: ${report.agreement.currentGoal.length}`,
    `- Latest decision variants: ${report.agreement.latestDecision.length}`,
    `- Active task variants: ${report.agreement.activeTask.length}`,
    "",
  ];

  for (const m of report.models) {
    lines.push(`## Model: ${m.name}`, "");
    lines.push("### Agent B — continuation");
    if (m.agentB.success) {
      lines.push(`- understanding: ${JSON.stringify(m.agentB.understanding)}`);
      lines.push(`- update applied: ${m.agentB.applied}`);
      lines.push(`- conflict: ${m.agentB.conflict ?? false}`);
    } else {
      lines.push(`- error: ${m.agentB.error}`);
    }
    lines.push("");
    lines.push("### Agent C — stale attempt");
    if (m.agentC.success) {
      lines.push(`- conflict detected: ${m.agentC.conflict}`);
      lines.push(`- mutation occurred: ${m.agentC.mutationOccurred}`);
    } else {
      lines.push(`- error: ${m.agentC.error}`);
    }
    lines.push("");
    lines.push("### Agent D — fresh summary");
    if (m.agentD.success) {
      lines.push(`- summary: ${JSON.stringify(m.agentD.summary)}`);
    } else {
      lines.push(`- error: ${m.agentD.error}`);
    }
    lines.push("");
  }

  lines.push(
    "## Manual review required",
    "",
    "The automated verdict answers questions 1-4. Questions 5 and 6 require human review of the per-model evidence above.",
    "",
    "5. What information was consistently missing?",
    "   - Compare each model's understanding and summary. Fields or concepts absent across most models indicate gaps in the repack output or in the models' ability to extract it.",
    "",
    "6. What is the minimum improvement required before the next phase?",
    "   - Identify the smallest change that would turn any failing or ambiguous verdict into a pass, or the smallest documentation/schema change that would reduce cross-model disagreement.",
    "",
  );

  return lines.join("\n");
}
