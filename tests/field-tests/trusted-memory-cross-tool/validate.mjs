#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const runtime = join(directory, "runtime");
const projectDirectory = join(runtime, "project");
const manifest = JSON.parse(readFileSync(join(runtime, "manifest.json"), "utf8"));
const scenario = JSON.parse(readFileSync(join(directory, "scenario.json"), "utf8"));
const report = readFileSync(join(projectDirectory, "work/report.md"), "utf8");

let cursor = -1;
for (const line of scenario.expected_report) {
  const index = report.indexOf(line);
  if (index < 0) throw new Error(`Missing final report line: ${line}`);
  if (index <= cursor) throw new Error("Final report is not in canonical order.");
  if (report.indexOf(line, index + 1) >= 0) {
    throw new Error(`Final report repeats: ${line}`);
  }
  cursor = index;
}

const zentext = join(projectDirectory, "node_modules/.bin/zentext");
const moduleUrl = pathToFileURL(
  join(projectDirectory, "node_modules/zentext/dist/index.js"),
).href;
const { openProject } = await import(moduleUrl);
const opened = await openProject({ cwd: projectDirectory });
let sdk;
let handoffs;
try {
  sdk = await opened.getContinuation();
  handoffs = await opened.queryMemory({
    query: "",
    type: "handoff",
    limit: 20,
  });
} finally {
  opened.close();
}
if (sdk.task.revision !== scenario.required_final_state.task_revision) {
  throw new Error(`Expected task revision ${scenario.required_final_state.task_revision}.`);
}

const cliRun = spawnSync(zentext, ["continue", "--json"], {
  cwd: projectDirectory,
  encoding: "utf8",
});
if (cliRun.status !== 0) throw new Error(cliRun.stderr || "CLI continuation failed.");
const cli = JSON.parse(cliRun.stdout);

const rpcRun = spawnSync(zentext, ["rpc"], {
  cwd: projectDirectory,
  input:
    JSON.stringify({
      protocol_version: "1.0",
      id: "field-test-parity",
      method: "continuation.get",
      params: {
        cwd: projectDirectory,
        project_id: manifest.project_id,
      },
    }) + "\n",
  encoding: "utf8",
});
if (rpcRun.status !== 0) throw new Error(rpcRun.stderr || "RPC continuation failed.");
const rpcResponse = JSON.parse(rpcRun.stdout.trim());
if (!rpcResponse.ok) throw new Error(`RPC failed: ${rpcResponse.error.code}`);

const mcpBin = join(
  projectDirectory,
  "node_modules/zentext/dist/mcp/bin.js",
);
const mcpClientRoot = join(
  projectDirectory,
  "node_modules/@modelcontextprotocol/sdk/dist/esm/client",
);
const { Client } = await import(
  pathToFileURL(join(mcpClientRoot, "index.js")).href
);
const { StdioClientTransport } = await import(
  pathToFileURL(join(mcpClientRoot, "stdio.js")).href
);
const client = new Client({ name: "zentext-field-test", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [mcpBin],
});
await client.connect(transport);
let mcp;
try {
  const response = await client.callTool({
    name: "memory.continuation",
    arguments: { project_id: manifest.project_id },
  });
  const item = response.content[0];
  if (!item || item.type !== "text") throw new Error("MCP returned no text.");
  mcp = JSON.parse(item.text);
} finally {
  await client.close();
}

const canonical = JSON.stringify(sdk);
const parity = {
  cli: JSON.stringify(cli) === canonical,
  sdk: true,
  rpc: JSON.stringify(rpcResponse.result) === canonical,
  mcp: JSON.stringify(mcp) === canonical,
};
if (!Object.values(parity).every(Boolean)) {
  throw new Error(`Interface parity failed: ${JSON.stringify(parity)}`);
}

function openRpcProcess(index) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(zentext, ["rpc"], {
      cwd: projectDirectory,
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
      try {
        const response = JSON.parse(stdout.trim());
        if (code !== 0 || response.ok !== true) {
          rejectPromise(
            new Error(
              `Concurrent RPC open ${index} failed: ${stderr.trim() || stdout.trim()}`,
            ),
          );
          return;
        }
        resolvePromise();
      } catch (error) {
        rejectPromise(error);
      }
    });
    child.stdin.end(
      `${JSON.stringify({
        protocol_version: "1.0",
        id: `concurrent-open-${index}`,
        method: "project.open",
        params: { cwd: projectDirectory },
      })}\n`,
    );
  });
}

await Promise.all(Array.from({ length: 16 }, (_, index) => openRpcProcess(index)));

const stale = [];
const validator = await openProject({ cwd: projectDirectory });
let currentHandoffCount = 0;
try {
  for (const handoff of handoffs) {
    const result = await validator.validateHandoff(handoff.id);
    if (result.current) {
      currentHandoffCount += 1;
      continue;
    }
    stale.push({
      handoff_revision: result.handoff_revision,
      live_revision: result.live_revision,
      current: result.current,
    });
  }
} finally {
  validator.close();
}
if (currentHandoffCount !== 1) {
  throw new Error(
    `Expected exactly one current handoff, found ${currentHandoffCount}.`,
  );
}
if (stale.length !== scenario.participants.length) {
  throw new Error(
    `Expected ${scenario.participants.length} stale handoffs, found ${stale.length}.`,
  );
}

const result = {
  schema_version: 1,
  result: "passed",
  task_revision: sdk.task.revision,
  validation_status: sdk.validation.status,
  parity,
  concurrent_rpc_opens: 16,
  stale_handoffs: stale,
  report: scenario.expected_report,
};
writeFileSync(
  join(runtime, "final-validation.json"),
  `${JSON.stringify(result, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
