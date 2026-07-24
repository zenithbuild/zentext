#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const projectDirectory = resolve(
  process.argv[2] ??
    "tests/field-tests/trusted-memory-cross-tool/runtime/project",
);
const model = process.env.OLLAMA_MODEL ?? "glm-5.2:cloud";
const exactPrompt =
  "Read the current Zentext project memory, explain where the work stopped, then continue from the recorded next action. Do not repeat completed work.";
const helper = resolve(
  projectDirectory,
  ".agents/skills/zentext-memory/scripts/memory.mjs",
);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectDirectory,
    encoding: "utf8",
    env: process.env,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} failed with exit ${String(result.status)}: ${result.stderr || result.stdout}`,
    );
  }
  return result.stdout.trim();
}

function invokeMemory(operation, input) {
  const args = [helper, operation];
  if (input !== undefined) args.push(typeof input === "string" ? input : JSON.stringify(input));
  const response = JSON.parse(run(process.execPath, args));
  if (response.ok !== true) {
    throw new Error(`Zentext ${operation} failed: ${JSON.stringify(response)}`);
  }
  return response.result;
}

async function askOllama(messages) {
  const response = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      format: "json",
      options: { temperature: 0 },
    }),
  });
  if (!response.ok) {
    throw new Error(`Ollama returned HTTP ${response.status}: ${await response.text()}`);
  }
  const body = await response.json();
  return body.message.content;
}

function requireEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} mismatch: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const starting = invokeMemory("read");
requireEqual(starting.validation.status, "current", "continuation status");
requireEqual(starting.task.revision, 5, "starting revision");
const priorHandoffId = invokeMemory("validate").handoff_id;
const sourceText = readFileSync(
  resolve(projectDirectory, "fixture/source-delta.txt"),
  "utf8",
);
const reportPath = resolve(projectDirectory, "work/report.md");
const logPath = resolve(projectDirectory, "work/verification.log");
const reportBefore = readFileSync(reportPath, "utf8");

const messages = [
  {
    role: "system",
    content:
      "You are the model participant in a controlled local host harness. Zentext's validated continuation is canonical. Explain the recovered state before proposing one exact continuation action. Do not repeat completed work. Return JSON only. Use repository-relative paths and never include credentials, hidden reasoning, session history, or personal paths.",
  },
  {
    role: "user",
    content: JSON.stringify({
      instruction: exactPrompt,
      continuation: starting,
      allowed_source_file: {
        path: "fixture/source-delta.txt",
        content: sourceText,
      },
      current_report: reportBefore,
      required_shape: {
        recovered_state: {
          task: "string",
          revision: "number",
          accepted_decisions: ["string"],
          completed: ["string"],
          changed_files: ["string"],
          blockers: ["string"],
          verification: ["string"],
          stopping_point: "string",
          next_action: "string",
        },
        continuation: {
          region: "Delta",
          value: 37,
          prior_total: 88,
          new_total: 125,
          report_line: "Delta: 37",
          verification_line: "string",
        },
      },
    }),
  },
];
const attempts = [];
let rawModelResult = await askOllama(messages);
let modelResult;
try {
  modelResult = JSON.parse(rawModelResult);
  attempts.push({ outcome: "accepted", failure_class: null });
} catch {
  attempts.push({
    outcome: "rejected",
    failure_class: "formatting",
    reason: "The model wrapped its response instead of returning one raw JSON object.",
  });
  rawModelResult = await askOllama([
    ...messages,
    { role: "assistant", content: rawModelResult },
    {
      role: "user",
      content:
        "The host rejected that response before applying any change because it was not one raw JSON object. Return the same answer again as raw JSON only: no Markdown fence, commentary, or surrounding text.",
    },
  ]);
  try {
    modelResult = JSON.parse(rawModelResult);
    attempts.push({ outcome: "accepted", failure_class: null });
  } catch {
    attempts.push({
      outcome: "rejected",
      failure_class: "formatting",
      reason: "The corrected response was still not one raw JSON object.",
    });
    throw new Error("Ollama failed the controlled host JSON contract twice.");
  }
}

requireEqual(modelResult.recovered_state.revision, 5, "model recovered revision");
requireEqual(modelResult.recovered_state.task, starting.task.title, "model recovered task");
requireEqual(
  modelResult.recovered_state.stopping_point,
  starting.handoff.stopping_point,
  "model recovered stopping point",
);
requireEqual(
  modelResult.recovered_state.next_action,
  starting.handoff.next_action,
  "model recovered next action",
);
requireEqual(modelResult.continuation.region, "Delta", "continued region");
requireEqual(modelResult.continuation.value, 37, "Delta value");
requireEqual(modelResult.continuation.prior_total, 88, "prior total");
requireEqual(modelResult.continuation.new_total, 125, "new total");
requireEqual(modelResult.continuation.report_line, "Delta: 37", "report line");
if (
  !/upper\s*=?\s*21/iu.test(modelResult.continuation.verification_line) ||
  !/lower\s*=?\s*16/iu.test(modelResult.continuation.verification_line)
) {
  throw new Error(
    `The model's Delta verification did not match the supplied source: ${JSON.stringify(modelResult.continuation.verification_line)}`,
  );
}

const reportAfter = reportBefore.replace(
  /\n+Total: 88\s*$/,
  "\nDelta: 37\n\nTotal: 125\n",
);
if (reportAfter === reportBefore) {
  throw new Error("The controlled host could not locate the expected Total: 88 line.");
}
writeFileSync(reportPath, reportAfter, "utf8");
writeFileSync(
  logPath,
  `${readFileSync(logPath, "utf8").trimEnd()}\nOllama/GLM controlled host: Delta upper 21 + lower 16 = expected 37; report Delta is 37 and Total is 125 (passed)\n`,
  "utf8",
);

const verificationOutput = run("npm", ["run", "verify"]);
const progress = invokeMemory("record-progress", {
  task_id: starting.task.id,
  expected_revision: starting.task.revision,
  source_environment: `ollama/${model}-controlled-host`,
  completed: [
    "Read the Delta source fixture through the controlled host",
    "Appended Delta with value 37 to work/report.md after Gamma",
    "Updated the final Total line from 88 to 125",
    "Appended Delta arithmetic evidence to work/verification.log",
  ],
  changed_files: ["work/report.md", "work/verification.log"],
  blockers: [],
  verification: [
    {
      check: "Delta arithmetic",
      result: "passed",
      summary: "upper 21 + lower 16 equals expected 37",
    },
    {
      check: "npm run verify",
      result: "passed",
      summary: "Verified 4 regions; total 125.",
    },
  ],
  notes: [
    "The model proposed the Delta-only change; the controlled host validated every field before applying it.",
  ],
  stopping_point: "All four regions are complete and verified.",
  next_action: "Run the final cross-interface consistency and stale-handoff validation.",
  files_inspected: [
    "fixture/source-delta.txt",
    "work/report.md",
    "work/verification.log",
  ],
  commands_executed: ["npm run verify"],
  parent_handoff_id: priorHandoffId,
});
const ending = invokeMemory("read");
const stale = invokeMemory("validate", priorHandoffId);

requireEqual(progress.task.revision, 6, "progress revision");
requireEqual(ending.task.revision, 6, "ending revision");
requireEqual(stale.current, false, "prior handoff current state");
requireEqual(stale.reason, "active_task revision changed", "stale reason");

process.stdout.write(
  `${JSON.stringify(
    {
      participant: "ollama-controlled-host",
      model,
      exact_prompt: exactPrompt,
      model_attempts: attempts,
      recovered_state: modelResult.recovered_state,
      proposed_continuation: modelResult.continuation,
      host_actions: {
        files_changed: ["work/report.md", "work/verification.log"],
        verification: verificationOutput.split("\n").at(-1),
      },
      revisions: { before: 5, after: 6 },
      stale_validation: stale,
      final_next_action: ending.task.next_action,
    },
    null,
    2,
  )}\n`,
);
