#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, platform, arch, tmpdir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const fieldRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(fieldRoot, "../../..");
const cli = join(repoRoot, "dist/cli/cli.js");
const scenario = JSON.parse(readFileSync(join(fieldRoot, "scenario.json"), "utf8"));
const participantConfig = JSON.parse(
  readFileSync(join(fieldRoot, "participants.json"), "utf8"),
);
const responseSchema = join(fieldRoot, "receiver-response.schema.json");
const operatorHome = homedir();

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const dryRun = process.argv.includes("--dry-run");
const outputPath = option("--output", join(fieldRoot, "results.json"));
const evidenceDir = option("--evidence-dir", join(fieldRoot, "evidence"));

if (!existsSync(cli)) {
  throw new Error("dist/cli/cli.js is missing. Run `npm run build` before the field test.");
}

function commandVersion(command, args = ["--version"]) {
  try {
    return execFileSync(command, args, { encoding: "utf8", timeout: 15_000 }).trim();
  } catch {
    return "unavailable";
  }
}

function participantVersion(participant) {
  if (participant.kind === "codex") return commandVersion("codex");
  if (participant.kind === "antigravity") {
    return `${commandVersion("agy")} / ${participant.model}`;
  }
  if (participant.kind === "ollama") {
    return `${commandVersion("ollama")} / ${participant.model}`;
  }
  return participant.model ?? "unknown";
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    if (options.input !== undefined) {
      child.stdin.end(options.input);
    }
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, options.timeoutMs ?? 120_000);
    child.on("error", (error) => {
      clearTimeout(timeout);
      resolve({ exitCode: null, stdout, stderr, error: error.message, timedOut });
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ exitCode: code, stdout, stderr, timedOut });
    });
  });
}

async function runCli(project, home, args, expectedExit = 0) {
  const result = await runCommand(process.execPath, [cli, ...args], {
    cwd: project,
    env: { ...process.env, HOME: home },
    timeoutMs: 30_000,
  });
  if (result.exitCode !== expectedExit) {
    throw new Error(
      `zentext ${args.join(" ")} exited ${result.exitCode}; expected ${expectedExit}: ${result.stderr.trim()}`,
    );
  }
  return result.stdout.trim();
}

function parseJsonResponse(raw) {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    if (fenced) return JSON.parse(fenced.trim());
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("receiver did not return a JSON object");
  }
}

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} mismatch`);
  }
}

function validateReceiver(raw, response, view) {
  assertEqual(response.sequence, ["state_explained", "continuation_performed"], "sequence");
  if (raw.indexOf('"state_summary"') > raw.indexOf('"continuation_result"')) {
    throw new Error("receiver continued before explaining state");
  }
  assertEqual(response.project_id, view.project.id, "project id");
  assertEqual(response.task_id, view.task.id, "task id");
  assertEqual(response.task_revision, view.task.revision, "task revision");
  assertEqual(response.state_summary.task, view.task.title, "task title");
  assertEqual(response.state_summary.completed, view.handoff.completed, "completed work");
  assertEqual(response.state_summary.changed_files, view.handoff.files_changed, "changed files");
  assertEqual(response.state_summary.blockers, view.handoff.blockers, "blockers");
  assertEqual(response.state_summary.verification, view.handoff.verification, "verification");
  assertEqual(response.state_summary.stopping_point, view.handoff.stopping_point, "stopping point");
  assertEqual(response.state_summary.next_action, view.handoff.next_action, "next action");

  const expected = scenario.tool_b_expected;
  assertEqual(response.continuation_result.inspected_file, "fixture/source-b.txt", "inspected file");
  assertEqual(response.continuation_result.east, expected.source_b.east, "east value");
  assertEqual(response.continuation_result.west, expected.source_b.west, "west value");
  assertEqual(
    response.continuation_result.source_b_subtotal,
    expected.source_b.subtotal,
    "source-b subtotal",
  );
  assertEqual(response.continuation_result.grand_total, expected.grand_total, "grand total");
  assertEqual(response.continuation_result.repeated_completed_work, false, "repeated work flag");
  if (!Array.isArray(response.progress_update.notes) || response.progress_update.notes.length < 2) {
    throw new Error("receiver did not return two progress notes");
  }
}

function receiverPrompt(surfaceName, surface, sourceB) {
  return `You are the receiving Tool B in an isolated Zentext continuation field test.

You have no Tool A conversation, hidden state, provider continuation, or prior answer. Treat the supplied Zentext text as external project memory. Do not modify files or run Zentext yourself. Read the allowed repository file below, explain the received state first, continue only from its exact next action, and return the progress that the harness should record.

ALLOWED READ-ONLY REPOSITORY FILE: fixture/source-b.txt
---
${sourceB.trim()}
---

INPUT SURFACE: ${surfaceName}
--- BEGIN PORTABLE ZENTEXT INPUT ---
${surface}
--- END PORTABLE ZENTEXT INPUT ---

Return JSON only, with keys in this exact order:
{
  "sequence": ["state_explained", "continuation_performed"],
  "project_id": "copy from Zentext",
  "task_id": "copy from Zentext",
  "task_revision": 0,
  "state_summary": {
    "task": "exact title",
    "completed": ["copy every item in order"],
    "changed_files": ["copy every item in order"],
    "blockers": ["copy every item in order"],
    "verification": ["copy every item in order"],
    "stopping_point": "copy exactly",
    "next_action": "copy exactly"
  },
  "continuation_result": {
    "inspected_file": "fixture/source-b.txt",
    "east": 0,
    "west": 0,
    "source_b_subtotal": 0,
    "grand_total": 0,
    "repeated_completed_work": false
  },
  "progress_update": {
    "summary": "what you verified",
    "notes": ["first concrete note", "second concrete note"],
    "next_action": "the next honest action after this investigation"
  }
}

Do not add Markdown fences or prose outside the JSON.`;
}

async function codexResponse(participant, prompt, project, tempRoot) {
  const responseFile = join(tempRoot, "codex-response.json");
  const result = await runCommand(
    "codex",
    [
      "exec",
      "--ephemeral",
      "--ignore-user-config",
      "--ignore-rules",
      "--sandbox",
      "read-only",
      "--cd",
      project,
      "--output-schema",
      responseSchema,
      "--output-last-message",
      responseFile,
      "-",
    ],
    {
      cwd: project,
      env: { ...process.env, HOME: tempRoot, CODEX_HOME: join(operatorHome, ".codex") },
      input: prompt,
      timeoutMs: 10 * 60_000,
    },
  );
  if (result.exitCode !== 0 || !existsSync(responseFile)) {
    throw new Error(
      `${participant.tool} exited ${result.exitCode}${result.timedOut ? " after timeout" : ""}: ${result.stderr.slice(-600)}`,
    );
  }
  return readFileSync(responseFile, "utf8");
}

async function antigravityResponse(participant, prompt, project) {
  const result = await runCommand(
    "agy",
    [
      "--new-project",
      "--model",
      participant.model,
      "--effort",
      "high",
      "--mode",
      "plan",
      "--sandbox",
      "--print-timeout",
      "10m",
      "--print",
      prompt,
    ],
    {
      cwd: project,
      env: { ...process.env, HOME: operatorHome },
      timeoutMs: 10 * 60_000,
    },
  );
  if (result.exitCode !== 0) {
    throw new Error(
      `${participant.tool} exited ${result.exitCode}${result.timedOut ? " after timeout" : ""}: ${result.stderr.slice(-600)}`,
    );
  }
  return result.stdout;
}

async function ollamaResponse(participant, prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10 * 60_000);
  try {
    const response = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: participant.model,
        stream: false,
        messages: [
          {
            role: "system",
            content:
              "Follow the field-test isolation contract. Return the requested JSON only and preserve Zentext arrays exactly.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(`Ollama HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
    }
    const body = await response.json();
    if (typeof body.message?.content !== "string") {
      throw new Error("Ollama returned no message content");
    }
    return body.message.content;
  } finally {
    clearTimeout(timeout);
  }
}

function dryResponse(view) {
  return JSON.stringify({
    sequence: ["state_explained", "continuation_performed"],
    project_id: view.project.id,
    task_id: view.task.id,
    task_revision: view.task.revision,
    state_summary: {
      task: view.task.title,
      completed: view.handoff.completed,
      changed_files: view.handoff.files_changed,
      blockers: view.handoff.blockers,
      verification: view.handoff.verification,
      stopping_point: view.handoff.stopping_point,
      next_action: view.handoff.next_action,
    },
    continuation_result: {
      inspected_file: "fixture/source-b.txt",
      east: scenario.tool_b_expected.source_b.east,
      west: scenario.tool_b_expected.source_b.west,
      source_b_subtotal: scenario.tool_b_expected.source_b.subtotal,
      grand_total: scenario.tool_b_expected.grand_total,
      repeated_completed_work: false,
    },
    progress_update: {
      summary: "Verified source-b and the grand total.",
      notes: ["Verified 13 + 9 = 22.", "Verified 28 + 22 = 50."],
      next_action: "Record the completed field-test evidence.",
    },
  });
}

const toolAScript = `
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const project = process.argv[1];
const values = Object.fromEntries(
  readFileSync(join(project, "fixture/source-a.txt"), "utf8")
    .trim().split("\\n").map((line) => {
      const [key, value] = line.split("=");
      return [key, Number(value)];
    }),
);
const subtotal = values.north + values.south;
mkdirSync(join(project, "work"), { recursive: true });
writeFileSync(join(project, "work/continuation-report.md"),
  "# Partial regional report\\n\\n- north: " + values.north + "\\n- south: " + values.south + "\\n- source-a subtotal: " + subtotal + "\\n");
writeFileSync(join(project, "work/verification.log"),
  "source-a labels: verified\\n" + values.north + " + " + values.south + " = " + subtotal + ": verified\\n");
console.log(JSON.stringify({ north: values.north, south: values.south, subtotal }));
`;

async function seedProject(tempRoot) {
  const project = join(tempRoot, "project");
  const home = join(tempRoot, "home");
  mkdirSync(project, { recursive: true });
  mkdirSync(home, { recursive: true });
  cpSync(join(fieldRoot, "fixture"), join(project, "fixture"), { recursive: true });
  await runCommand("git", ["init", "--quiet"], { cwd: project });
  await runCommand(
    "git",
    ["remote", "add", "origin", "https://example.invalid/zentext-m1-field-test.git"],
    { cwd: project },
  );

  await runCli(project, home, ["init"]);
  await runCli(project, home, [
    "task",
    "create",
    "--title",
    scenario.task.title,
    "--goal",
    scenario.task.goal,
  ]);
  await runCli(project, home, [
    "task",
    "update",
    "--summary",
    "Tool A is intentionally completing only source-a.",
    "--note",
    scenario.task.notes[0],
    "--note",
    scenario.task.notes[1],
    "--next-action",
    scenario.task.next_action,
  ]);

  const toolA = await runCommand(process.execPath, ["-e", toolAScript, project], {
    cwd: project,
    env: { ...process.env, HOME: home },
    timeoutMs: 30_000,
  });
  if (toolA.exitCode !== 0) throw new Error(`Tool A failed: ${toolA.stderr}`);
  assertEqual(JSON.parse(toolA.stdout), { north: 17, south: 11, subtotal: 28 }, "Tool A result");

  const handoffArgs = [
    "handoff",
    "create",
    "--from",
    "m1-deterministic-tool-a",
    "--stopping-point",
    scenario.tool_a.stopping_point,
    "--next-action",
    scenario.tool_a.next_action,
  ];
  for (const value of scenario.tool_a.completed) handoffArgs.push("--completed", value);
  for (const value of scenario.tool_a.files_changed) handoffArgs.push("--files-changed", value);
  for (const value of scenario.tool_a.blockers) handoffArgs.push("--blockers", value);
  for (const value of scenario.tool_a.verification) handoffArgs.push("--verification", value);
  await runCli(project, home, handoffArgs);

  const surfaces = {
    continue_human: await runCli(project, home, ["continue"]),
    continue_json: await runCli(project, home, ["continue", "--json"]),
    continue_markdown: await runCli(project, home, ["continue", "--markdown"]),
    continue_prompt: await runCli(project, home, ["continue", "--prompt"]),
    export_json: await runCli(project, home, ["handoff", "export", "--format", "json"]),
    export_markdown: await runCli(project, home, ["handoff", "export", "--format", "markdown"]),
    export_prompt: await runCli(project, home, ["handoff", "export", "--format", "prompt"]),
  };
  const view = JSON.parse(surfaces.continue_json);
  assertEqual(view.handoff.completed, scenario.tool_a.completed, "persisted completed");
  assertEqual(view.handoff.files_changed, scenario.tool_a.files_changed, "persisted files_changed");
  assertEqual(view.handoff.blockers, scenario.tool_a.blockers, "persisted blockers");
  assertEqual(view.handoff.verification, scenario.tool_a.verification, "persisted verification");
  assertEqual(view.task.notes, scenario.task.notes, "persisted notes");
  if (!surfaces.continue_human.includes("Exact next action:")) throw new Error("human continuation missing next action");
  if (!surfaces.continue_markdown.includes("# Zentext continuation")) throw new Error("Markdown continuation missing heading");
  if (!surfaces.continue_prompt.includes("Tool-neutral Zentext continuation instruction")) throw new Error("prompt template missing");
  assertEqual(JSON.parse(surfaces.export_json), view, "JSON export");
  if (surfaces.export_markdown !== surfaces.continue_markdown) throw new Error("Markdown export drifted");
  if (surfaces.export_prompt !== surfaces.continue_prompt) throw new Error("prompt export drifted");

  return { project, home, surfaces, view };
}

function surfaceFor(seed, name) {
  if (name === "json") return seed.surfaces.export_json;
  if (name === "markdown") return seed.surfaces.export_markdown;
  return seed.surfaces.export_prompt;
}

function safeSummary(error, tempRoot) {
  return String(error instanceof Error ? error.message : error)
    .replaceAll(tempRoot, "<isolated-temp>")
    .replaceAll(operatorHome, "<operator-home>")
    .slice(0, 1000);
}

async function runParticipant(participant, executedAt) {
  const tempRoot = mkdtempSync(join(tmpdir(), `zentext-m1-${participant.id}-`));
  try {
    const seed = await seedProject(tempRoot);
    const sourceB = readFileSync(join(seed.project, "fixture/source-b.txt"), "utf8");
    const prompt = receiverPrompt(
      participant.input_surface,
      surfaceFor(seed, participant.input_surface),
      sourceB,
    );

    let raw;
    if (dryRun) raw = dryResponse(seed.view);
    else if (participant.kind === "codex") {
      raw = await codexResponse(participant, prompt, seed.project, tempRoot);
    } else if (participant.kind === "antigravity") {
      raw = await antigravityResponse(participant, prompt, seed.project);
    } else if (participant.kind === "ollama") {
      raw = await ollamaResponse(participant, prompt);
    } else {
      throw new Error(`unknown participant kind: ${participant.kind}`);
    }

    const response = parseJsonResponse(raw);
    validateReceiver(raw, response, seed.view);

    await runCli(seed.project, seed.home, [
      "task",
      "update",
      "--summary",
      response.progress_update.summary,
      "--note",
      response.progress_update.notes[0],
      "--note",
      response.progress_update.notes[1],
      "--next-action",
      response.progress_update.next_action,
    ]);
    const staleValidation = JSON.parse(
      await runCli(seed.project, seed.home, ["handoff", "validate", "--json"], 4),
    );
    const staleContinuation = JSON.parse(
      await runCli(seed.project, seed.home, ["continue", "--json"], 4),
    );
    assertEqual(staleValidation.current, false, "stale validation result");
    assertEqual(staleContinuation.validation.status, "stale", "stale continuation result");
    if (staleContinuation.validation.live_revision <= seed.view.task.revision) {
      throw new Error("task revision did not advance");
    }

    const evidencePath = join(evidenceDir, `${participant.id}.json`);
    const evidence = {
      schema_version: 1,
      scenario_id: scenario.scenario_id,
      executed_at: executedAt,
      participant: {
        tool: participant.tool,
        tool_family: participant.tool_family,
        version_or_model: participantVersion(participant),
        input_surface: participant.input_surface,
        execution_kind: dryRun ? "deterministic_harness" : "real_tool",
      },
      isolation: {
        fresh_project: true,
        isolated_zentext_home: true,
        tool_a_process_exited: true,
        prior_conversation_available: false,
        provider_resume_used: false,
      },
      normalized_response: response,
      revision_evidence: {
        before: seed.view.task.revision,
        after: staleContinuation.validation.live_revision,
        handoff_revision: staleContinuation.validation.handoff_revision,
        validation_exit_code: 4,
        continuation_exit_code: 4,
      },
    };
    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

    return {
      participant: {
        tool: participant.tool,
        tool_family: participant.tool_family,
        version_or_model: participantVersion(participant),
        environment: `${platform()} ${arch()}; ${process.version}`,
        input_surface: participant.input_surface,
        execution_kind: dryRun ? "deterministic_harness" : "real_tool",
        prior_state_available: false,
        result: "pass",
        defects: [],
        explained_before_continuing: true,
        continued_from_exact_next_action: true,
        repeated_completed_work: false,
        evidence: relative(repoRoot, evidencePath),
      },
      revision: evidence.revision_evidence,
    };
  } catch (error) {
    return {
      participant: {
        tool: participant.tool,
        tool_family: participant.tool_family,
        version_or_model: participantVersion(participant),
        environment: `${platform()} ${arch()}; ${process.version}`,
        input_surface: participant.input_surface,
        execution_kind: dryRun ? "deterministic_harness" : "real_tool",
        prior_state_available: false,
        result: "fail",
        defects: [safeSummary(error, tempRoot)],
        explained_before_continuing: false,
        continued_from_exact_next_action: false,
        repeated_completed_work: null,
        evidence: "",
      },
      failure: {
        tool: participant.tool,
        classification: /exited|HTTP|timeout|no message|unavailable/i.test(String(error))
          ? "provider"
          : /JSON|receiver/i.test(String(error))
            ? "formatting"
            : "harness",
        summary: safeSummary(error, tempRoot),
      },
    };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function main() {
  const executedAt = new Date().toISOString();
  mkdirSync(dirname(outputPath), { recursive: true });
  rmSync(evidenceDir, { recursive: true, force: true });
  mkdirSync(evidenceDir, { recursive: true });

  const runs = [];
  for (const participant of participantConfig.participants) {
    process.stderr.write(`Running ${participant.tool}${dryRun ? " (dry run)" : ""}...\n`);
    runs.push(await runParticipant(participant, executedAt));
  }
  const passing = runs.filter((run) => run.participant.result === "pass");
  const representativeRevision = passing[0]?.revision ?? {
    before: null,
    after: null,
    handoff_revision: null,
    validation_exit_code: null,
    continuation_exit_code: null,
  };
  const realPasses = passing.filter(
    (run) => run.participant.execution_kind === "real_tool",
  ).length;
  const results = {
    schema_version: 1,
    scenario_id: scenario.scenario_id,
    executed_at: executedAt,
    execution_status: dryRun ? "dry-run" : realPasses >= 3 ? "pass" : "fail",
    evidence_categories: {
      automated_regression_tests: "covered by the repository Vitest suite",
      deterministic_harness: dryRun ? "pass" : "validated before real execution",
      real_tool_executions: `${realPasses} passed`,
      unsupported_or_unavailable:
        runs.filter((run) => run.participant.result !== "pass").length +
        participantConfig.unavailable_environments.length,
    },
    surfaces: {
      continue_human: passing.length > 0 ? "pass" : "fail",
      continue_json: passing.length > 0 ? "pass" : "fail",
      continue_markdown: passing.length > 0 ? "pass" : "fail",
      continue_prompt: passing.length > 0 ? "pass" : "fail",
      export_json: passing.length > 0 ? "pass" : "fail",
      export_markdown: passing.length > 0 ? "pass" : "fail",
      export_prompt: passing.length > 0 ? "pass" : "fail",
      prompt_template: passing.length > 0 ? "pass" : "fail",
    },
    repeated_values: {
      completed: scenario.tool_a.completed,
      files_changed: scenario.tool_a.files_changed,
      blockers: scenario.tool_a.blockers,
      verification: scenario.tool_a.verification,
      notes: scenario.task.notes,
    },
    isolation: {
      fresh_project_per_run: true,
      isolated_home_per_run: true,
      tool_a_exited_before_receiver: true,
      prior_conversation_available: false,
      shared_provider_session: false,
      answer_carried_in_memory: false,
    },
    revision_evidence: {
      ...representativeRevision,
      stale_rejected:
        representativeRevision.validation_exit_code === 4 &&
        representativeRevision.continuation_exit_code === 4,
    },
    participants: runs.map((run) => run.participant),
    failures: [
      ...runs.flatMap((run) => (run.failure ? [run.failure] : [])),
      ...participantConfig.unavailable_environments,
    ],
    limitations: [
      "This is serial continuation only; it does not test orchestration or concurrent workers.",
      "Text-only model APIs receive the explicitly allowed source-b fixture content in their isolated prompt.",
      "Provider execution proves portable consumption, not transfer of hidden model state or session history.",
    ],
  };
  writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`);
  process.stdout.write(`${basename(outputPath)}: ${results.execution_status}; ${passing.length} participant runs passed\n`);
  if (!dryRun && results.execution_status !== "pass") process.exitCode = 1;
}

await main();
