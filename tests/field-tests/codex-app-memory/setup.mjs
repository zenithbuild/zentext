#!/usr/bin/env node

import {
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const fieldTestDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(fieldTestDirectory, "../../..");
const target = resolve(process.argv[2] ?? "");
if (!process.argv[2] || target === "/") {
  throw new Error("Usage: setup.mjs <isolated-fixture-directory>");
}

const zentextBin = process.env.ZENTEXT_BIN ?? "zentext";
const moduleSpecifier = process.env.ZENTEXT_MODULE
  ? pathToFileURL(resolve(process.env.ZENTEXT_MODULE)).href
  : "zentext";
const { openProject } = await import(moduleSpecifier);

rmSync(target, { recursive: true, force: true });
mkdirSync(resolve(target, "fixture"), { recursive: true });
mkdirSync(resolve(target, "work"), { recursive: true });
cpSync(
  resolve(fieldTestDirectory, "fixture"),
  resolve(target, "fixture"),
  { recursive: true },
);
cpSync(
  resolve(repositoryRoot, ".agents/skills/zentext-memory"),
  resolve(target, ".agents/skills/zentext-memory"),
  { recursive: true },
);
writeFileSync(resolve(target, "work/report.md"), "# Regional report\n\nAlpha: 28\n", "utf8");
writeFileSync(
  resolve(target, "work/verification.log"),
  "source-a: 17 + 11 = 28 (passed)\n",
  "utf8",
);

execFileSync("git", ["init", "-q"], { cwd: target });
execFileSync(
  "git",
  ["remote", "add", "origin", "https://example.invalid/zentext-codex-memory-fixture.git"],
  { cwd: target },
);
execFileSync(zentextBin, ["init"], { cwd: target, stdio: "pipe" });
execFileSync(
  zentextBin,
  [
    "task",
    "create",
    "--title",
    "Complete the regional report",
    "--goal",
    "Record Alpha and Beta in source order and verify the total.",
  ],
  { cwd: target, stdio: "pipe" },
);

const project = await openProject({ cwd: target });
try {
  const task = await project.getActiveTask();
  if (!task) throw new Error("setup did not create an active task");
  const result = await project.recordProgress({
    task_id: task.id,
    expected_revision: task.revision,
    source_environment: "tool-a-fixture",
    completed: ["Read the Alpha source", "Recorded Alpha in the report"],
    changed_files: ["work/report.md", "work/verification.log"],
    blockers: [
      {
        title: "Beta remains",
        blocker: "The Beta source has not been read.",
        severity: "medium",
      },
    ],
    verification: [
      {
        check: "Alpha arithmetic",
        result: "passed",
        summary: "17 + 11 = 28",
      },
      {
        check: "Report Alpha value",
        result: "passed",
        summary: "work/report.md contains Alpha: 28",
      },
    ],
    stopping_point: "Alpha is recorded and verified; Beta is intentionally untouched.",
    next_action:
      "Read fixture/source-b.txt, append Beta and the total to work/report.md, then verify both values.",
    accepted_decisions: [
      {
        title: "Preserve source order",
        decision: "Preserve source order in the final report.",
        rationale: "The report must remain directly auditable.",
      },
    ],
    files_inspected: ["fixture/source-a.txt"],
    commands_executed: ["Read fixture/source-a.txt", "Verified 17 + 11 = 28"],
  });
  const evidence = {
    schema_version: 1,
    project_id: project.meta.projectId,
    task_id: result.task.id,
    starting_revision: result.task.revision,
    original_handoff_id: result.handoff.record_id,
    exact_prompt: JSON.parse(
      readFileSync(resolve(fieldTestDirectory, "scenario.json"), "utf8"),
    ).exact_prompt,
  };
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
} finally {
  project.close();
}
