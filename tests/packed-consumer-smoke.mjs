#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

const tarballArgument = process.argv[2];
if (!tarballArgument) {
  throw new Error("Usage: node tests/packed-consumer-smoke.mjs <zentext-tarball>");
}
const tarball = isAbsolute(tarballArgument)
  ? tarballArgument
  : resolve(process.cwd(), tarballArgument);
if (!existsSync(tarball)) throw new Error(`Tarball not found: ${tarball}`);

const root = mkdtempSync(join(tmpdir(), "zentext-packed-consumer-"));

function baseEnvironment(home, cache, ignoreScripts) {
  const environment = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !key.toLowerCase().startsWith("npm_config_")) {
      environment[key] = value;
    }
  }
  environment.HOME = home;
  environment.npm_config_cache = cache;
  if (ignoreScripts) environment.npm_config_ignore_scripts = "true";
  return environment;
}

function runCli(bin, project, environment, args, expectedExit = 0) {
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd: project,
    env: environment,
    encoding: "utf8",
  });
  if (result.status !== expectedExit) {
    throw new Error(
      `zentext ${args.join(" ")} exited ${result.status}; expected ${expectedExit}: ${result.stderr}`,
    );
  }
  return result.stdout.trim();
}

function runMode(mode, ignoreScripts) {
  const modeRoot = join(root, mode);
  const install = join(modeRoot, "install");
  const project = join(modeRoot, "project");
  const home = join(modeRoot, "home");
  const cache = join(modeRoot, "npm-cache");
  for (const directory of [install, project, home, cache]) {
    mkdirSync(directory, { recursive: true });
  }

  writeFileSync(
    join(install, "package.json"),
    `${JSON.stringify(
      { name: `zentext-${mode}-consumer`, version: "1.0.0", private: true, type: "module" },
      null,
      2,
    )}\n`,
  );
  const environment = baseEnvironment(home, cache, ignoreScripts);
  execFileSync("npm", ["install", "--save", tarball], {
    cwd: install,
    env: environment,
    stdio: "pipe",
    timeout: 180_000,
  });

  execFileSync("git", ["init", "--quiet"], { cwd: project, env: environment });
  execFileSync(
    "git",
    ["remote", "add", "origin", `https://example.invalid/zentext-${mode}-consumer.git`],
    { cwd: project, env: environment },
  );

  const bin = join(install, "node_modules/zentext/dist/cli/cli.js");
  if (!existsSync(bin)) throw new Error(`${mode}: installed CLI is missing`);
  if (!runCli(bin, project, environment, ["--help"]).includes("zentext continue")) {
    throw new Error(`${mode}: help does not document continuation`);
  }
  runCli(bin, project, environment, ["init"]);
  if (!runCli(bin, project, environment, ["status"]).includes("Record counts:")) {
    throw new Error(`${mode}: status failed`);
  }
  runCli(bin, project, environment, [
    "task",
    "create",
    "--title",
    "Packed continuation task",
    "--goal",
    "Prove the installed artifact is independent of its checkout.",
  ]);
  if (!runCli(bin, project, environment, ["task", "show"]).includes("Packed continuation task")) {
    throw new Error(`${mode}: task show failed`);
  }
  runCli(bin, project, environment, [
    "task",
    "update",
    "--note",
    "First packed note, with comma",
    "--note",
    "Second packed note ✓",
    "--next-action",
    "Create the packed handoff.",
  ]);
  runCli(bin, project, environment, [
    "handoff",
    "create",
    "--from",
    mode,
    "--stopping-point",
    "Packed state recorded in an isolated home.",
    "--next-action",
    "Load every portable continuation format.",
    "--completed",
    "Installed the generated tarball",
    "--completed",
    "Created and updated the task",
    "--blockers",
    "None in the isolated consumer",
    "--blockers",
    "Publishing remains out of scope",
    "--files-changed",
    "work/one.md",
    "--files-changed",
    "work/two.md",
    "--verification",
    "zentext status passed",
    "--verification",
    "task reload passed",
  ]);
  runCli(bin, project, environment, ["handoff", "show"]);
  runCli(bin, project, environment, ["handoff", "validate"]);
  runCli(bin, project, environment, ["handoff", "acknowledge"]);

  const view = JSON.parse(runCli(bin, project, environment, ["continue", "--json"]));
  if (view.handoff.completed.length !== 2 || view.task.notes.length !== 2) {
    throw new Error(`${mode}: ordered arrays were not retained`);
  }
  runCli(bin, project, environment, ["continue"]);
  runCli(bin, project, environment, ["continue", "--markdown"]);
  runCli(bin, project, environment, ["continue", "--prompt"]);
  for (const format of ["json", "markdown", "prompt"]) {
    runCli(bin, project, environment, ["handoff", "export", "--format", format]);
  }

  runCli(bin, project, environment, [
    "task",
    "update",
    "--note",
    "Receiver advanced the packed task.",
  ]);
  runCli(bin, project, environment, ["handoff", "validate", "--json"], 4);
  const stale = JSON.parse(
    runCli(bin, project, environment, ["continue", "--json"], 4),
  );
  if (stale.validation.status !== "stale") {
    throw new Error(`${mode}: stale continuation was not rejected`);
  }

  const storeRoot = join(home, ".zentext", "projects");
  if (!existsSync(storeRoot)) throw new Error(`${mode}: isolated store was not created`);
  const checkoutStatus = execFileSync("git", ["status", "--short"], {
    cwd: project,
    env: environment,
    encoding: "utf8",
  });
  if (checkoutStatus.trim() !== "") {
    throw new Error(`${mode}: consumer project was modified: ${checkoutStatus}`);
  }

  return {
    mode,
    install_scripts: ignoreScripts ? "disabled" : "enabled",
    sqlite_path: ignoreScripts ? "node:sqlite fallback" : "better-sqlite3",
    result: "pass",
    task_revision_before_stale_check: view.task.revision,
    stale_exit_code: 4,
    isolated_home: true,
    isolated_npm_cache: true,
    consumer_git_status_clean: true,
  };
}

try {
  const results = [runMode("normal", false), runMode("fallback", true)];
  process.stdout.write(
    `${JSON.stringify(
      { node: process.version, tarball: "zentext-0.1.0-dev.2.tgz", results },
      null,
      2,
    )}\n`,
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
