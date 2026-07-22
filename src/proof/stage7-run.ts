/**
 * Stage 7 real-repository handoff proof runner.
 *
 * Uses the isolated Zenith Framework repository and the Ollama models
 * available locally. Captures raw responses, mutations, and handoffs.
 */

import { mkdirSync, writeFileSync, rmSync, mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { SqliteStore } from "../store/sqlite-store.js";
import { repack } from "../repack/engine.js";
import { createMemoryWriter } from "../domain/memory-writer.js";
import {
  buildHandoff,
  handoffToCreateInput,
  isHandoffCurrent,
  renderAcknowledgement,
  recordToHandoff,
} from "../handoff.js";
import { OllamaAdapter } from "./model-adapter.js";
import { extractJson } from "./prompts.js";

const SHARED_SYSTEM = `You are an AI coding agent using Zentext to continue work across sessions.
You are investigating the Zenith Framework repository.
You must not modify any source file unless explicitly asked to continue implementation.
When you need to update Zentext state, respond with JSON matching the requested schema.
Do not invent completed work.
Use the exact task id and revision shown in the Zentext repack output.
`;

function readZenithFiles(repo: string): string {
  const files = [
    "contracts/DETERMINISM.md",
    "packages/bundler/src/utils.rs",
    "packages/bundler/src/bundler_html_emit.rs",
    "packages/bundler/tests/css_determinism.rs",
    "packages/bundler/src/plugin/zenith_loader.rs",
    "packages/bundler/src/bundle.rs",
    "AGENTS.md",
  ];
  const parts: string[] = [];
  for (const file of files) {
    try {
      const content = readFileSync(join(repo, file), "utf8");
      parts.push(`--- ${file} ---\n${content}`);
    } catch {
      parts.push(`--- ${file} ---\n(unable to read)`);
    }
  }
  return parts.join("\n\n");
}

const AGENT_A_USER = `Agent A: Verify the Zenith CSS determinism contract.

Read only the files listed under "Repository files" below. Trace each claim in contracts/DETERMINISM.md to the code that implements it. For each claim, record:
- the claim text
- the implementation file and function
- whether the claim is satisfied, partially satisfied, or contradicted
- any open questions

Stop at a clear boundary before the next verification step. Do not propose code changes.

Repository files:
{FILES}

Return JSON with this shape:
{
  "understanding": {
    "current_goal": "...",
    "latest_decision": "...",
    "active_task": "...",
    "next_action": "..."
  },
  "findings": [
    { "claim": "...", "location": "...", "assessment": "satisfied|partial|contradicted", "notes": "..." }
  ],
  "update": {
    "record_id": "<task id from repack>",
    "expected_revision": <task revision from repack>,
    "patch": {
      "next": "<one concrete next verification step>"
    },
    "reason": "..."
  },
  "stopping_point": "exact boundary where you stopped",
  "completed": ["completed item 1", "completed item 2"]
}
`;

const AGENT_B_USER = `Agent B: Continue the Zenith CSS determinism verification.

Respond first with exactly:

Zentext context loaded.

Active task: <title>
Task ID: <id>
Task revision: <revision>
Previous agent: <agent>
Completed: <verified summary>
Stopping point: <exact previous boundary>
Next action: <first unfinished action>
Blockers: <none or list>

I will continue from this stopping point without restarting completed work.

Then perform exactly one next step: inspect the specific implementation detail identified by the previous agent and add one new finding.

Return JSON with this shape:
{
  "understanding": {
    "current_goal": "...",
    "latest_decision": "...",
    "active_task": "...",
    "next_action": "..."
  },
  "findings": [
    { "claim": "...", "location": "...", "assessment": "satisfied|partial|contradicted", "notes": "..." }
  ],
  "update": {
    "record_id": "<task id from repack>",
    "expected_revision": <task revision from repack>,
    "patch": {
      "next": "<one concrete next verification step>"
    },
    "reason": "..."
  },
  "stopping_point": "exact boundary where you stopped",
  "completed": ["new completed item"]
}
`;

const AGENT_C_USER = `Agent C: Review the Zenith CSS determinism verification.

Confirm the updated stopping point, review the previous agent's work for scope and architecture drift, and check that no Zenith source files were modified.

Return JSON with this shape:
{
  "understanding": {
    "current_goal": "...",
    "latest_decision": "...",
    "active_task": "...",
    "next_action": "..."
  },
  "review": {
    "repeated_work": false,
    "invented_work": false,
    "zenith_files_modified": false,
    "scope_drift": false,
    "notes": "..."
  },
  "stale_attempt": {
    "record_id": "<task id from repack>",
    "expected_revision": <an earlier revision>,
    "patch": { "next": "outdated step" }
  }
}
`;

export interface Stage7Config {
  zenithRepo: string;
  model: string;
  outputDir: string;
  tempHome: string;
}

export async function runStage7(config: Stage7Config): Promise<void> {
  process.env.HOME = config.tempHome;
  mkdirSync(config.outputDir, { recursive: true });

  const store = new SqliteStore();
  const meta = await store.initProjectStore(config.zenithRepo);
  const writer = createMemoryWriter(store);

  const task = writer.createRecord({
    type: "task",
    title: "Verify Zenith CSS determinism contract",
    goal: "Trace Zenith CSS determinism contract claims to implementation",
    status: "active",
    author: "agent:A",
  });

  writer.createRecord({
    type: "decision",
    title: "Compiler pre-sorts CSS blocks",
    decision: "CSS blocks are ordered by dependency depth via compiler pre-sort before process_css is called",
    status: "accepted",
    author: "agent:A",
  });

  const adapter = new OllamaAdapter({ name: config.model, model: config.model });
  const filesContent = readZenithFiles(config.zenithRepo);

  // Agent A
  const repackA = repack(store, meta, { focus: "CSS determinism" });
  const promptA = `${repackA.markdown}\n\nRepository files:\n${filesContent}\n\n${AGENT_A_USER}`;
  const responseA = await adapter.send(SHARED_SYSTEM, promptA);
  const parsedA = extractJson(responseA) as Record<string, unknown>;

  writeArtifact(config.outputDir, "agent-a", "prompt.txt", promptA);
  writeArtifact(config.outputDir, "agent-a", "response.txt", responseA);
  writeArtifact(config.outputDir, "agent-a", "parsed.json", JSON.stringify(parsedA, null, 2));

  const updateA = parsedA.update as Record<string, unknown>;
  writer.updateRecord(
    String(updateA.record_id),
    { next: String((updateA.patch as Record<string, unknown>).next) },
    { expectedRevision: Number(updateA.expected_revision), author: "agent:A" },
  );

  const handoffA = buildHandoff(store, meta, {
    previous_agent: "agent:A",
    stopping_point: String(parsedA.stopping_point),
    next_action: String((updateA.patch as Record<string, unknown>).next),
    completed: (parsedA.completed as string[]) ?? [],
  });
  writer.createHandoff(handoffToCreateInput(handoffA, "agent:A"));

  // Agent B
  const repackB = repack(store, meta, { focus: "CSS determinism" });
  const promptB = `${repackB.markdown}\n\n${AGENT_B_USER}`;
  const responseB = await adapter.send(SHARED_SYSTEM, promptB);
  const parsedB = extractJson(responseB) as Record<string, unknown>;

  writeArtifact(config.outputDir, "agent-b", "prompt.txt", promptB);
  writeArtifact(config.outputDir, "agent-b", "response.txt", responseB);
  writeArtifact(config.outputDir, "agent-b", "parsed.json", JSON.stringify(parsedB, null, 2));

  const updateB = parsedB.update as Record<string, unknown>;
  writer.updateRecord(
    String(updateB.record_id),
    { next: String((updateB.patch as Record<string, unknown>).next) },
    { expectedRevision: Number(updateB.expected_revision), author: "agent:B" },
  );

  const handoffB = buildHandoff(store, meta, {
    previous_agent: "agent:B",
    stopping_point: String(parsedB.stopping_point),
    next_action: String((updateB.patch as Record<string, unknown>).next),
    completed: (parsedB.completed as string[]) ?? [],
  });
  writer.createHandoff(handoffToCreateInput(handoffB, "agent:B"));

  // Agent C + stale attempt
  const repackC = repack(store, meta, { focus: "CSS determinism" });
  const promptC = `${repackC.markdown}\n\n${AGENT_C_USER}`;
  const responseC = await adapter.send(SHARED_SYSTEM, promptC);
  const parsedC = extractJson(responseC) as Record<string, unknown>;

  writeArtifact(config.outputDir, "agent-c", "prompt.txt", promptC);
  writeArtifact(config.outputDir, "agent-c", "response.txt", responseC);
  writeArtifact(config.outputDir, "agent-c", "parsed.json", JSON.stringify(parsedC, null, 2));

  const staleAttempt = parsedC.stale_attempt as Record<string, unknown>;
  let staleOutcome: { attempted: boolean; applied: boolean; conflict: boolean; error?: string } = {
    attempted: false,
    applied: false,
    conflict: false,
  };
  try {
    writer.updateRecord(
      String(staleAttempt.record_id),
      { next: String((staleAttempt.patch as Record<string, unknown>).next) },
      { expectedRevision: Number(staleAttempt.expected_revision), author: "agent:C" },
    );
    staleOutcome = { attempted: true, applied: true, conflict: false };
  } catch (err) {
    staleOutcome = {
      attempted: true,
      applied: false,
      conflict: true,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  writeArtifact(
    config.outputDir,
    "stale-mutation",
    "outcome.json",
    JSON.stringify(staleOutcome, null, 2),
  );

  // Final state snapshot
  const latestHandoffRecord = store.listRecords({ type: "handoff", status: "latest" })[0];
  const finalState = {
    task: store.getRecord(task.id),
    handoffs: store.listRecords({ type: "handoff", status: "latest" }),
    current: latestHandoffRecord ? isHandoffCurrent(recordToHandoff(latestHandoffRecord), store) : null,
  };
  writeArtifact(config.outputDir, "", "final-state.json", JSON.stringify(finalState, null, 2));

  // Acknowledgement output
  if (latestHandoffRecord) {
    const latestHandoff = recordToHandoff(latestHandoffRecord);
    const ack = renderAcknowledgement(latestHandoff, "human") as string;
    writeArtifact(config.outputDir, "", "acknowledgement.txt", ack);
  }

  store.close();
}

function writeArtifact(
  outputDir: string,
  subdir: string,
  filename: string,
  content: string,
): void {
  const dir = subdir ? join(outputDir, subdir) : outputDir;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), content, "utf8");
}

async function main(): Promise<void> {
  const model = process.argv[2] ?? "kimi-k2.7-code:cloud";
  const zenithRepo = process.argv[3] ?? "./zenith-framework";
  const outputDir = process.argv[4] ?? join(process.cwd(), "stage7-results", model.replace(/[:/]/g, "-"));
  const tempHome = mkdtempSync(join(tmpdir(), "zentext-stage7-"));

  try {
    await runStage7({ zenithRepo, model, outputDir, tempHome });
    console.log(`Stage 7 proof complete: ${outputDir}`);
  } finally {
    rmSync(tempHome, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
