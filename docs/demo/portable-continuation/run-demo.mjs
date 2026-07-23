#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const demoDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(demoDir, "../../..");
const workspace = join(tmpdir(), "zentext-public-demo");
const packDir = join(workspace, "package");
const consumer = join(workspace, "consumer");
const project = join(workspace, "project");
const home = join(workspace, "home");
const npmCache = join(workspace, "npm-cache");
const checkpointsDir = join(demoDir, "checkpoints");
const transcriptPath = join(demoDir, "transcript.txt");

const checkpointFiles = {
  init: "01-initialization.txt",
  handoff: "02-task-and-handoff.txt",
  continue: "03-validated-continuation.txt",
  prompt: "04-portable-prompt-export.txt",
  fresh: "05-fresh-tool-continuation.txt",
  stale: "06-stale-handoff-rejection.txt",
};

const transcript = [];
const checkpoints = Object.fromEntries(
  Object.keys(checkpointFiles).map((key) => [key, []]),
);

function sanitize(value) {
  return value
    .replaceAll(repoRoot, "<repository>")
    .replaceAll(workspace, "<demo-workspace>")
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/\r/g, "");
}

function shellQuote(value) {
  return /^[A-Za-z0-9_./:=@+-]+$/.test(value)
    ? value
    : `'${value.replaceAll("'", "'\\''")}'`;
}

function record(lines, checkpoint) {
  const normalized = sanitize(lines.join("\n")).trimEnd();
  transcript.push(normalized, "");
  if (checkpoint) {
    checkpoints[checkpoint].push(normalized, "");
  }
}

function heading(title, checkpoint) {
  record([`=== ${title} ===`], checkpoint);
}

function run(command, args, options = {}) {
  const display = [command, ...args].map(shellQuote).join(" ");
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
  });
  const expectedExit = options.expectedExit ?? 0;
  const lines = [`$ ${display}`];
  if (result.stdout) lines.push(result.stdout.trimEnd());
  if (result.stderr) lines.push(result.stderr.trimEnd());
  lines.push(`[exit ${result.status}]`);
  record(lines, options.checkpoint);
  if (result.status !== expectedExit) {
    throw new Error(
      `${display} exited ${result.status}; expected ${expectedExit}`,
    );
  }
  return result.stdout;
}

function runZentext(args, options = {}) {
  return run("zentext", args, {
    ...options,
    cwd: project,
    env: demoEnvironment,
  });
}

rmSync(workspace, { recursive: true, force: true });
rmSync(checkpointsDir, { recursive: true, force: true });
for (const directory of [
  packDir,
  consumer,
  project,
  home,
  npmCache,
  checkpointsDir,
  join(project, "requirements"),
]) {
  mkdirSync(directory, { recursive: true });
}

writeFileSync(
  join(consumer, "package.json"),
  `${JSON.stringify(
    {
      name: "zentext-portable-continuation-demo",
      version: "1.0.0",
      private: true,
      type: "module",
    },
    null,
    2,
  )}\n`,
);
writeFileSync(join(project, "requirements/health-response.txt"), "body=ok\n");

const baseEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key, value]) =>
      value !== undefined && !key.toLowerCase().startsWith("npm_config_"),
  ),
);
const installEnvironment = {
  ...baseEnvironment,
  HOME: home,
  npm_config_cache: npmCache,
};

heading("PACKED PACKAGE INSTALL");
const packedName = run(
  "npm",
  ["pack", "--silent", "--pack-destination", packDir],
  { cwd: repoRoot, env: installEnvironment },
).trim();
const packedSource = join(packDir, packedName);
const packedLocal = join(consumer, packedName);
if (!existsSync(packedSource)) {
  throw new Error(`npm pack did not create ${packedName}`);
}
copyFileSync(packedSource, packedLocal);
run("npm", ["install", "--no-audit", "--no-fund", `./${packedName}`], {
  cwd: consumer,
  env: installEnvironment,
});

copyFileSync(join(demoDir, "tool-a.mjs"), join(consumer, "tool-a.mjs"));
copyFileSync(join(demoDir, "fresh-tool.mjs"), join(consumer, "fresh-tool.mjs"));

run("git", ["init", "--quiet"], { cwd: project, env: installEnvironment });
run(
  "git",
  [
    "remote",
    "add",
    "origin",
    "https://example.invalid/zentext-portable-demo.git",
  ],
  { cwd: project, env: installEnvironment },
);

const demoEnvironment = {
  ...installEnvironment,
  PATH: `${join(consumer, "node_modules/.bin")}:${baseEnvironment.PATH ?? ""}`,
};

heading("1. INITIALIZATION", "init");
runZentext(["init"], { checkpoint: "init" });

heading("2. TOOL A CREATES THE TASK AND WORKS", "handoff");
runZentext(
  [
    "task",
    "create",
    "--title",
    "Complete the portable health route",
    "--goal",
    "Return status 200 and the exact required response body.",
  ],
  { checkpoint: "handoff" },
);
run("node", ["tool-a.mjs", project], {
  cwd: consumer,
  env: demoEnvironment,
});
runZentext(
  [
    "task",
    "update",
    "--note",
    "Status behavior is complete; response body remains pending.",
    "--note",
    "Tool B must inspect the project requirement before editing.",
    "--next-action",
    "Implement and verify the exact required response body.",
  ],
);
runZentext(
  [
    "handoff",
    "create",
    "--from",
    "tool-a",
    "--completed",
    "Added the health-route skeleton.",
    "--completed",
    "Added and passed the status-code test.",
    "--files-changed",
    "src/health-route.mjs",
    "--files-changed",
    "test/health-route.test.mjs",
    "--blockers",
    "The exact response body is not implemented or tested.",
    "--verification",
    "node --check src/health-route.mjs passed.",
    "--verification",
    "node --test passed the status-code test.",
    "--stopping-point",
    "Status 200 is implemented and verified; body remains 'pending'.",
    "--next-action",
    "Read requirements/health-response.txt, implement the exact response body, and add its assertion.",
  ],
  { checkpoint: "handoff" },
);

heading("TOOL A EXITS");
record([
  "Tool A process has exited.",
  "No session, conversation, or hidden model state is passed to Tool B.",
]);

heading("3. VALIDATED CONTINUATION", "continue");
runZentext(["continue"], { checkpoint: "continue" });

heading("CONTINUE PROMPT VIEW");
runZentext(["continue", "--prompt"]);

heading("4. PORTABLE PROMPT EXPORT", "prompt");
runZentext(["handoff", "export", "--format", "prompt"], {
  checkpoint: "prompt",
});

heading("PORTABLE JSON FOR THE FRESH TOOL");
const portableJson = runZentext(["handoff", "export", "--format", "json"]);
const continuationPath = join(consumer, "continuation.json");
writeFileSync(continuationPath, portableJson);

heading("5. COMPLETELY FRESH TOOL B", "fresh");
const progressPath = join(consumer, "progress.json");
run(
  "node",
  ["fresh-tool.mjs", continuationPath, project, progressPath],
  {
    cwd: consumer,
    env: demoEnvironment,
    checkpoint: "fresh",
  },
);
const progress = JSON.parse(readFileSync(progressPath, "utf8"));
runZentext([
  "task",
  "update",
  "--summary",
  progress.summary,
  "--note",
  progress.notes[0],
  "--note",
  progress.notes[1],
  "--next-action",
  progress.next_action,
]);

heading("6. ORIGINAL HANDOFF IS NOW STALE", "stale");
runZentext(["handoff", "validate", "--json"], {
  expectedExit: 4,
  checkpoint: "stale",
});

heading("DEMO RESULT");
record([
  "PASS",
  "- packed npm package installed",
  "- Tool A recorded structured project memory and exited",
  "- Tool B received only portable Zentext state plus project files",
  "- Tool B explained recovered state before editing",
  "- Tool B continued from the exact next action without repeating work",
  "- task revision advanced",
  "- original handoff was rejected as stale with exit code 4",
]);

writeFileSync(transcriptPath, `${transcript.join("\n").trimEnd()}\n`);
for (const [key, filename] of Object.entries(checkpointFiles)) {
  writeFileSync(
    join(checkpointsDir, filename),
    `${checkpoints[key].join("\n").trimEnd()}\n`,
  );
}

rmSync(workspace, { recursive: true, force: true });
process.stdout.write(
  [
    "Portable continuation demo passed.",
    `Transcript: ${transcriptPath}`,
    `Screenshot checkpoints: ${checkpointsDir}`,
    "",
  ].join("\n"),
);
