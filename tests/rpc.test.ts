import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PassThrough } from "node:stream";

import {
  continueProject,
  handoffCreate,
  init,
  taskCreate,
} from "../src/cli/commands.js";
import { memoryContinuation } from "../src/mcp/server.js";
import { openProject } from "../src/sdk.js";
import {
  handleRpcLine,
  runRpcServer,
} from "../src/rpc/server.js";
import { RPC_PROTOCOL_VERSION } from "../src/rpc/protocol.js";
import { MAX_RPC_LINE_BYTES } from "../src/safety.js";

describe("structured stdio RPC", () => {
  let tempHome: string;
  let tempProject: string;
  let originalHome: string;
  let projectId: string;

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "zentext-rpc-home-"));
    tempProject = mkdtempSync(join(tmpdir(), "zentext-rpc-project-"));
    originalHome = process.env.HOME ?? "";
    process.env.HOME = tempHome;
    await init(tempProject);
    await taskCreate(tempProject, {
      title: "RPC fixture task",
      goal: "Prove machine-readable continuation.",
      author: "tool-a",
    });
    await handoffCreate(tempProject, {
      from: "tool-a",
      completed: ["Created fixture", "Recorded baseline"],
      filesChanged: ["work/report.md", "work/log.txt"],
      blockers: ["Remaining section is pending"],
      verification: ["Baseline loaded", "Revision is one"],
      stoppingPoint: "The baseline exists and the remaining section is pending.",
      nextAction: "Add the remaining fixture section.",
    });
    const project = await openProject({ cwd: tempProject });
    projectId = project.meta.projectId;
    project.close();
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    rmSync(tempHome, { recursive: true, force: true });
    rmSync(tempProject, { recursive: true, force: true });
  });

  function request(
    id: string,
    method: string,
    params: Record<string, unknown>,
  ): string {
    return JSON.stringify({
      protocol_version: RPC_PROTOCOL_VERSION,
      id,
      method,
      params,
    });
  }

  it("discovers capabilities and opens a project without leaking its store path", async () => {
    const capabilities = await handleRpcLine(
      request("caps", "capabilities.get", {}),
    );
    expect(capabilities.ok).toBe(true);
    expect(JSON.stringify(capabilities)).toContain("continuation.get");
    const opened = await handleRpcLine(
      request("open", "project.open", { cwd: tempProject }),
    );
    expect(opened.ok).toBe(true);
    expect(JSON.stringify(opened)).toContain(projectId);
    expect(JSON.stringify(opened)).not.toContain(tempHome);
  });

  it("keeps CLI, SDK, RPC, and MCP continuation views semantically identical", async () => {
    const cli = await continueProject(tempProject, { format: "json" });
    const sdkProject = await openProject({ cwd: tempProject });
    const sdk = await sdkProject.getContinuation();
    sdkProject.close();
    const rpc = await handleRpcLine(
      request("continue", "continuation.get", {
        cwd: tempProject,
        project_id: projectId,
      }),
    );
    const mcp = await memoryContinuation({ project_id: projectId });
    const firstMcpContent = mcp.content[0];
    if (!firstMcpContent || firstMcpContent.type !== "text") {
      throw new Error("expected MCP text response");
    }
    const mcpPayload = JSON.parse(firstMcpContent.text);
    expect(cli.exitCode).toBe(0);
    expect(rpc.ok).toBe(true);
    expect(JSON.parse(cli.output)).toEqual(sdk);
    if (!rpc.ok) throw new Error("expected RPC success");
    expect(rpc.result).toEqual(sdk);
    expect(mcpPayload).toEqual(sdk);
  });

  it("records progress, advances revision, and returns stale validation for the prior handoff", async () => {
    const project = await openProject({ cwd: tempProject });
    const start = await project.getContinuation();
    const oldHandoff = await project.getCurrentHandoff();
    project.close();

    const progressed = await handleRpcLine(
      request("progress", "progress.record", {
        cwd: tempProject,
        project_id: projectId,
        input: {
          task_id: start.task.id,
          expected_revision: start.task.revision,
          source_environment: "codex-desktop",
          completed: ["Added the remaining section"],
          changed_files: ["work/report.md"],
          verification: [
            { check: "Fixture check", result: "passed", summary: "Complete" },
          ],
          stopping_point: "The fixture is complete and its verification passes.",
          next_action: "Review the completed fixture.",
          parent_handoff_id: oldHandoff!.record_id,
        },
      }),
    );
    expect(progressed.ok).toBe(true);
    if (!progressed.ok) throw new Error("expected RPC success");
    const result = progressed.result as {
      task: { revision: number };
      handoff: { handoff: { active_task: { revision: number } } };
    };
    expect(result.task.revision).toBe(2);
    expect(result.handoff.handoff.active_task.revision).toBe(2);

    const stale = await handleRpcLine(
      request("stale", "handoff.validate", {
        cwd: tempProject,
        project_id: projectId,
        handoff_id: oldHandoff!.record_id,
      }),
    );
    expect(stale.ok).toBe(true);
    if (!stale.ok) throw new Error("expected validation result");
    expect(stale.result).toMatchObject({
      current: false,
      handoff_revision: 1,
      live_revision: 2,
    });
  });

  it("returns typed errors for malformed, oversized, unsafe, secret-bearing, stale, and mismatched requests", async () => {
    expect(await handleRpcLine("{bad json")).toMatchObject({
      ok: false,
      error: { code: "INVALID_INPUT" },
    });
    expect(
      await handleRpcLine(request("unknown", "unknown.method", {})),
    ).toMatchObject({
      ok: false,
      error: { code: "METHOD_NOT_FOUND" },
    });
    expect(await handleRpcLine("x".repeat(MAX_RPC_LINE_BYTES + 1))).toMatchObject({
      ok: false,
      error: { code: "PAYLOAD_TOO_LARGE" },
    });
    expect(
      await handleRpcLine(
        request("mismatch", "continuation.get", {
          cwd: tempProject,
          project_id: "0000000000000000",
        }),
      ),
    ).toMatchObject({
      ok: false,
      error: { code: "PROJECT_IDENTITY_MISMATCH" },
    });
    const project = await openProject({ cwd: tempProject });
    const start = await project.getContinuation();
    project.close();
    expect(
      await handleRpcLine(
        request("unsafe", "task.update", {
          cwd: tempProject,
          project_id: projectId,
          input: {
            task_id: start.task.id,
            expected_revision: start.task.revision,
            source_environment: "codex\u001b[31m",
            next_action: "Continue",
          },
        }),
      ),
    ).toMatchObject({ ok: false, error: { code: "UNSAFE_INPUT" } });
    const secretResponse = await handleRpcLine(
      request("secret", "task.update", {
        cwd: tempProject,
        project_id: projectId,
        input: {
          task_id: start.task.id,
          expected_revision: start.task.revision,
          source_environment: "codex",
          notes: ["password=correct-horse-battery-staple"],
        },
      }),
    );
    expect(secretResponse).toMatchObject({
      ok: false,
      error: { code: "SECRET_DETECTED" },
    });
    expect(JSON.stringify(secretResponse)).not.toContain(
      "correct-horse-battery-staple",
    );

    const update = await handleRpcLine(
      request("advance", "task.update", {
        cwd: tempProject,
        project_id: projectId,
        input: {
          task_id: start.task.id,
          expected_revision: start.task.revision,
          source_environment: "codex",
          next_action: "The old handoff should now be stale.",
        },
      }),
    );
    expect(update.ok).toBe(true);
    expect(
      await handleRpcLine(
        request("stale-continuation", "continuation.get", {
          cwd: tempProject,
          project_id: projectId,
        }),
      ),
    ).toMatchObject({
      ok: false,
      error: { code: "STALE_STATE" },
    });
  });

  it("processes repeated NDJSON requests with machine-clean stdout and diagnostics on stderr", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const diagnostics = new PassThrough();
    let stdout = "";
    let stderr = "";
    output.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    diagnostics.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    const running = runRpcServer(input, output, diagnostics);
    input.end(
      [
        request("one", "capabilities.get", {}),
        "{bad json",
        request("two", "project.open", { cwd: tempProject }),
      ].join("\n"),
    );
    await running;
    const lines = stdout.trim().split("\n").map((line) => JSON.parse(line));
    expect(lines).toHaveLength(3);
    expect(lines.map((line) => line.id)).toEqual(["one", null, "two"]);
    expect(stderr).toContain("INVALID_INPUT");
    expect(stdout).not.toContain("zentext rpc:");
  });
});
