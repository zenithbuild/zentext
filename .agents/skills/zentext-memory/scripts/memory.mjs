#!/usr/bin/env node

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const PROTOCOL_VERSION = "1.0";
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../../..");
const cwd = process.cwd();

function commandForRpc() {
  if (process.env.ZENTEXT_BIN) {
    return { command: process.env.ZENTEXT_BIN, args: ["rpc"] };
  }
  const localBinary = resolve(cwd, "node_modules/.bin/zentext");
  if (existsSync(localBinary)) {
    return { command: localBinary, args: ["rpc"] };
  }
  const repositoryCli = resolve(repositoryRoot, "dist/cli/cli.js");
  if (existsSync(repositoryCli)) {
    return { command: process.execPath, args: [repositoryCli, "rpc"] };
  }
  return { command: "zentext", args: ["rpc"] };
}

function invoke(method, params, id) {
  return new Promise((resolvePromise, rejectPromise) => {
    const selected = commandForRpc();
    const child = spawn(selected.command, selected.args, {
      cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      const lines = stdout.trim().split("\n").filter(Boolean);
      if (code !== 0 || lines.length !== 1) {
        rejectPromise(
          new Error(
            `zentext rpc failed (exit ${String(code)}): ${stderr.trim() || "invalid response framing"}`,
          ),
        );
        return;
      }
      try {
        resolvePromise(JSON.parse(lines[0]));
      } catch {
        rejectPromise(new Error("zentext rpc returned malformed JSON."));
      }
    });
    child.stdin.end(
      `${JSON.stringify({
        protocol_version: PROTOCOL_VERSION,
        id,
        method,
        params,
      })}\n`,
    );
  });
}

function parseJsonArgument(raw, label) {
  if (!raw) throw new Error(`${label} requires one JSON object argument.`);
  const parsed = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${label} input must be a JSON object.`);
  }
  return parsed;
}

async function discoverProject() {
  const response = await invoke("project.open", { cwd }, "project-open");
  if (!response.ok) return response;
  return {
    project_id: response.result.project_id,
    cwd,
  };
}

async function main() {
  const operation = process.argv[2] ?? "";
  if (operation === "capabilities") {
    return invoke("capabilities.get", {}, "capabilities");
  }
  const project = await discoverProject();
  if (project.ok === false) return project;

  switch (operation) {
    case "read":
      return invoke("continuation.get", project, "continuation");
    case "active":
      return invoke("task.active", project, "active-task");
    case "validate":
      return invoke(
        "handoff.validate",
        {
          ...project,
          ...(process.argv[3] ? { handoff_id: process.argv[3] } : {}),
        },
        "handoff-validation",
      );
    case "query":
      return invoke(
        "memory.query",
        { ...project, input: parseJsonArgument(process.argv[3], "query") },
        "memory-query",
      );
    case "record-progress":
      return invoke(
        "progress.record",
        {
          ...project,
          input: parseJsonArgument(process.argv[3], "record-progress"),
        },
        "progress-record",
      );
    case "update-task":
      return invoke(
        "task.update",
        { ...project, input: parseJsonArgument(process.argv[3], "update-task") },
        "task-update",
      );
    default:
      throw new Error(
        "Usage: memory.mjs {read|active|validate|query|record-progress|update-task|capabilities}",
      );
  }
}

try {
  const response = await main();
  process.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
  process.exitCode = response.ok === false ? 1 : 0;
} catch (error) {
  process.stderr.write(
    `zentext-memory: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
