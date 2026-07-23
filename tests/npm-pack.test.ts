import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const REPO_ROOT = process.cwd();

describe("npm package validation", () => {
  let packDir: string;
  let tarballPath: string;
  let installDir: string;

  beforeAll(() => {
    packDir = mkdtempSync(join(tmpdir(), "zentext-pack-"));
    execSync("npm run build", { cwd: REPO_ROOT, stdio: "pipe" });
    const result = execSync("npm pack --pack-destination " + packDir, {
      cwd: REPO_ROOT,
      stdio: "pipe",
      encoding: "utf8",
    });
    const lines = result.trim().split("\n");
    tarballPath = join(packDir, lines[lines.length - 1]);
    if (!existsSync(tarballPath)) {
      const possible = lines
        .map((l) => l.trim())
        .filter((l) => l.endsWith(".tgz"))
        .pop();
      if (possible) {
        tarballPath = join(packDir, possible);
      }
    }

    installDir = mkdtempSync(join(tmpdir(), "zentext-install-"));
    const pkgJson = {
      name: "zentext-consumer",
      version: "1.0.0",
      type: "module",
      private: true,
      allowScripts: {
        "better-sqlite3": true,
        esbuild: true,
        fsevents: true,
      },
    };
    writeFileSync(join(installDir, "package.json"), JSON.stringify(pkgJson, null, 2), "utf8");
    const cleanEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined && !key.toLowerCase().startsWith("npm_config_")) {
        cleanEnv[key] = value;
      }
    }
    cleanEnv.HOME = process.env.HOME ?? "";
    execSync(`npm install --save ${tarballPath}`, {
      cwd: installDir,
      env: cleanEnv,
      stdio: "pipe",
      timeout: 120_000,
    });
  }, 180_000);

  afterAll(() => {
    rmSync(packDir, { recursive: true, force: true });
    if (installDir) rmSync(installDir, { recursive: true, force: true });
  });

  function runInstalled(args: string[], options: { cwd?: string; home?: string } = {}) {
    const home = options.home ?? mkdtempSync(join(tmpdir(), "zentext-install-home-"));
    const bin = join(installDir, "node_modules", ".bin", "zentext");
    const quotedArgs = args.map((a) => (a.includes(" ") ? `"${a}"` : a));
    const command = `HOME=${home} node ${bin} ${quotedArgs.join(" ")}`;
    const runEnv: Record<string, string> = { PATH: process.env.PATH ?? "" };
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined && !key.toLowerCase().startsWith("npm_config_")) {
        runEnv[key] = value;
      }
    }
    runEnv.HOME = home;
    const result = execSync(command, {
      cwd: options.cwd ?? installDir,
      env: runEnv,
      encoding: "utf8",
      stdio: "pipe",
    });
    if (!options.home) {
      rmSync(home, { recursive: true, force: true });
    }
    return result;
  }

  it("produces a tarball from npm pack", () => {
    expect(existsSync(tarballPath)).toBe(true);
    expect(basename(tarballPath)).toMatch(/^zentext-\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?\.tgz$/);
  });

  it("tarball does not include dist/proof", () => {
    const listing = execSync(`tar -tzf ${tarballPath}`, { encoding: "utf8" });
    const entries = listing.split("\n");
    const proofEntries = entries.filter((e) => e.includes("dist/proof"));
    expect(proofEntries).toEqual([]);
  });

  it("tarball includes required binaries", () => {
    const listing = execSync(`tar -tzf ${tarballPath}`, { encoding: "utf8" });
    const entries = listing.split("\n");
    expect(entries.some((e) => e.endsWith("dist/cli/cli.js"))).toBe(true);
    expect(entries.some((e) => e.endsWith("dist/mcp/bin.js"))).toBe(true);
  });

  it("tarball includes public documentation and excludes private build inputs", () => {
    const listing = execSync(`tar -tzf ${tarballPath}`, { encoding: "utf8" });
    const entries = listing.split("\n");
    const required = [
      "package/README.md",
      "package/LICENSE",
      "package/docs/mcp.md",
      "package/docs/handoffs.md",
      "package/docs/cli-reference.md",
      "package/docs/switching-agents.md",
      "package/docs/tester-onboarding.md",
      "package/docs/continuation.md",
      "package/docs/continuation-prompt.md",
      "package/docs/portability-audit.md",
      "package/docs/recovery-runbook.md",
      "package/docs/demo/portable-continuation/README.md",
      "package/docs/demo/portable-continuation/run-demo.mjs",
      "package/docs/demo/portable-continuation/tool-a.mjs",
      "package/docs/demo/portable-continuation/fresh-tool.mjs",
      "package/docs/demo/portable-continuation/recording-plan.md",
      "package/docs/demo/portable-continuation/transcript.txt",
      "package/docs/demo/portable-continuation/checkpoints/01-initialization.txt",
      "package/docs/demo/portable-continuation/checkpoints/02-task-and-handoff.txt",
      "package/docs/demo/portable-continuation/checkpoints/03-validated-continuation.txt",
      "package/docs/demo/portable-continuation/checkpoints/04-portable-prompt-export.txt",
      "package/docs/demo/portable-continuation/checkpoints/05-fresh-tool-continuation.txt",
      "package/docs/demo/portable-continuation/checkpoints/06-stale-handoff-rejection.txt",
    ];

    for (const path of required) {
      expect(entries).toContain(path);
    }

    expect(entries.some((e) => e.startsWith("package/src/"))).toBe(false);
    expect(entries.some((e) => e.startsWith("package/tests/"))).toBe(false);
    expect(entries.some((e) => /\.(?:sqlite|sqlite-wal|sqlite-shm|tgz)$/.test(e))).toBe(false);
    expect(entries.some((e) => /(?:^|\/)\.env(?:\.|$)/.test(e))).toBe(false);
  });

  it("installed zentext --help works", () => {
    const out = runInstalled(["--help"]);
    expect(out).toContain("Zentext CLI");
    expect(out).toContain("handoff");
  });

  it("installed zentext-mcp completes initialize and tools/list", () => {
    const script = join(installDir, "mcp-smoke.mjs");
    const mcpBin = join(installDir, "node_modules", "zentext", "dist", "mcp", "bin.js");
    writeFileSync(
      script,
      `
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "zentext-package-smoke", version: "1.0.0" });
const transport = new StdioClientTransport({ command: process.execPath, args: [${JSON.stringify(mcpBin)}] });
await client.connect(transport);
const result = await client.listTools();
console.log(result.tools.map((tool) => tool.name).sort().join(","));
await client.close();
`,
      "utf8",
    );

    const out = execSync(`node ${script}`, {
      cwd: installDir,
      encoding: "utf8",
      stdio: "pipe",
      timeout: 30_000,
    });
    expect(out.trim()).toBe("memory.list,memory.query,memory.read,memory.repack");
  });

  it("installed zentext init works in a fresh project", () => {
    const project = mkdtempSync(join(tmpdir(), "zentext-consumer-proj-"));
    const out = runInstalled(["init"], { cwd: project });
    expect(out).toContain("State:   created");
    rmSync(project, { recursive: true, force: true });
  });

  it("installed zentext status works after init", () => {
    const project = mkdtempSync(join(tmpdir(), "zentext-consumer-proj-"));
    const home = mkdtempSync(join(tmpdir(), "zentext-install-home-"));
    runInstalled(["init"], { cwd: project, home });
    const out = runInstalled(["status"], { cwd: project, home });
    expect(out).toContain("Project:");
    expect(out).toContain("Record counts:");
    rmSync(project, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  });

  it("installed zentext handoff show reports no handoff before creation", () => {
    const project = mkdtempSync(join(tmpdir(), "zentext-consumer-proj-"));
    const home = mkdtempSync(join(tmpdir(), "zentext-install-home-"));
    runInstalled(["init"], { cwd: project, home });
    expect(() => runInstalled(["handoff", "show"], { cwd: project, home })).toThrow(/No latest handoff/);
    rmSync(project, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  });

  it("installed public task and handoff workflow rejects stale state", () => {
    const project = mkdtempSync(join(tmpdir(), "zentext-consumer-proj-"));
    const home = mkdtempSync(join(tmpdir(), "zentext-install-home-"));
    runInstalled(["init"], { cwd: project, home });

    const create = runInstalled(
      ["task", "create", "--title", "Verify CSS determinism", "--goal", "Trace contract"],
      { cwd: project, home },
    );
    expect(create).toContain("Created task");
    const task = runInstalled(["task", "show"], { cwd: project, home });
    expect(task).toContain("Verify CSS determinism");

    runInstalled(
      [
        "handoff",
        "create",
        "--from",
        "agent:A",
        "--stopping-point",
        "Read contract.",
        "--next-action",
        "Compare build outputs.",
        "--completed",
        "Read contract",
      ],
      { cwd: project, home },
    );

    const shown = runInstalled(["handoff", "show"], { cwd: project, home });
    expect(shown).toContain("Read contract.");
    const valid = runInstalled(["handoff", "validate"], { cwd: project, home });
    expect(valid).toContain("Handoff is current");
    const ack = runInstalled(["handoff", "acknowledge"], { cwd: project, home });
    expect(ack).toContain("Zentext context loaded.");
    expect(ack).toContain("Active task: Verify CSS determinism");
    const continuation = runInstalled(["continue"], { cwd: project, home });
    expect(continuation).toContain("Zentext continuation — validated current");
    expect(continuation).toContain("Exact next action:");
    const continuationJson = JSON.parse(
      runInstalled(["continue", "--json"], { cwd: project, home }),
    );
    expect(continuationJson.validation.status).toBe("current");
    expect(continuationJson.handoff.completed).toEqual(["Read contract"]);
    expect(runInstalled(["continue", "--markdown"], { cwd: project, home })).toContain(
      "# Zentext continuation",
    );
    expect(runInstalled(["continue", "--prompt"], { cwd: project, home })).toContain(
      "external project memory",
    );
    const exportJson = JSON.parse(
      runInstalled(["handoff", "export", "--format", "json"], { cwd: project, home }),
    );
    expect(exportJson.handoff.completed).toEqual(["Read contract"]);
    expect(
      runInstalled(["handoff", "export", "--format", "markdown"], { cwd: project, home }),
    ).toContain("# Zentext continuation");
    expect(
      runInstalled(["handoff", "export", "--format", "prompt"], { cwd: project, home }),
    ).toContain("external project memory");

    runInstalled(["task", "update", "--summary", "Contract reviewed", "--note", "Continue"], {
      cwd: project,
      home,
    });

    try {
      runInstalled(["handoff", "validate"], { cwd: project, home });
      throw new Error("Expected stale handoff validation to fail");
    } catch (error) {
      expect((error as { status?: number }).status).toBe(4);
    }
    try {
      runInstalled(["handoff", "acknowledge"], { cwd: project, home });
      throw new Error("Expected stale handoff acknowledgement to fail");
    } catch (error) {
      expect((error as { status?: number }).status).toBe(4);
      expect((error as { stdout?: string }).stdout).not.toContain("Zentext context loaded.");
    }
    try {
      runInstalled(["continue", "--json"], { cwd: project, home });
      throw new Error("Expected stale continuation to fail");
    } catch (error) {
      expect((error as { status?: number }).status).toBe(4);
      const parsed = JSON.parse((error as { stdout: string }).stdout);
      expect(parsed.continuation).toBeNull();
      expect(parsed.validation.status).toBe("stale");
    }
    rmSync(project, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  });

  it("installed zentext init works when better-sqlite3 scripts are blocked on Node 22+", () => {
    const project = mkdtempSync(join(tmpdir(), "zentext-blocked-scripts-proj-"));
    const home = mkdtempSync(join(tmpdir(), "zentext-blocked-scripts-home-"));
    const blockedInstallDir = mkdtempSync(join(tmpdir(), "zentext-blocked-scripts-install-"));

    // Determine whether node:sqlite fallback is available on this runtime.
    let nodeSqliteAvailable = false;
    try {
      const mod = require("node:sqlite") as typeof import("node:sqlite");
      nodeSqliteAvailable = !!mod.DatabaseSync;
    } catch {
      nodeSqliteAvailable = false;
    }

    if (!nodeSqliteAvailable) {
      // No fallback exists below Node 22; skip this regression test.
      rmSync(project, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
      rmSync(blockedInstallDir, { recursive: true, force: true });
      return;
    }

    writeFileSync(
      join(blockedInstallDir, "package.json"),
      JSON.stringify({ name: "blocked-consumer", version: "1.0.0", type: "module", private: true }, null, 2),
      "utf8",
    );

    const blockedEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined && !key.toLowerCase().startsWith("npm_config_")) {
        blockedEnv[key] = value;
      }
    }
    blockedEnv.HOME = home;
    blockedEnv.npm_config_ignore_scripts = "true";

    execSync(`npm install --save ${tarballPath}`, {
      cwd: blockedInstallDir,
      env: blockedEnv,
      stdio: "pipe",
      timeout: 120_000,
    });

    const bin = join(blockedInstallDir, "node_modules", ".bin", "zentext");
    const initOut = execSync(`HOME=${home} node ${bin} init`, {
      cwd: project,
      env: blockedEnv,
      encoding: "utf8",
      stdio: "pipe",
    });
    expect(initOut).toContain("State:   created");

    const statusOut = execSync(`HOME=${home} node ${bin} status`, {
      cwd: project,
      env: blockedEnv,
      encoding: "utf8",
      stdio: "pipe",
    });
    expect(statusOut).toContain("Project:");
    expect(statusOut).toContain("Record counts:");

    rmSync(project, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
    rmSync(blockedInstallDir, { recursive: true, force: true });
  }, 180_000);

  it("installed public task workflow works when better-sqlite3 scripts are blocked on Node 22+", () => {
    const project = mkdtempSync(join(tmpdir(), "zentext-public-workflow-proj-"));
    const home = mkdtempSync(join(tmpdir(), "zentext-public-workflow-home-"));
    const installDir = mkdtempSync(join(tmpdir(), "zentext-public-workflow-install-"));

    let nodeSqliteAvailable = false;
    try {
      const mod = require("node:sqlite") as typeof import("node:sqlite");
      nodeSqliteAvailable = !!mod.DatabaseSync;
    } catch {
      nodeSqliteAvailable = false;
    }

    if (!nodeSqliteAvailable) {
      rmSync(project, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
      rmSync(installDir, { recursive: true, force: true });
      return;
    }

    writeFileSync(
      join(installDir, "package.json"),
      JSON.stringify({ name: "public-workflow-consumer", version: "1.0.0", type: "module", private: true }, null, 2),
      "utf8",
    );

    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined && !key.toLowerCase().startsWith("npm_config_")) {
        env[key] = value;
      }
    }
    env.HOME = home;
    env.npm_config_ignore_scripts = "true";

    execSync(`npm install --save ${tarballPath}`, {
      cwd: installDir,
      env,
      stdio: "pipe",
      timeout: 120_000,
    });

    const bin = join(installDir, "node_modules", ".bin", "zentext");

    function runInstalled(args: string[]) {
      const quoted = args.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ");
      return execSync(`HOME=${home} node ${bin} ${quoted}`, {
        cwd: project,
        env,
        encoding: "utf8",
        stdio: "pipe",
      });
    }

    expect(runInstalled(["--help"])).toContain("zentext continue");
    runInstalled(["init"]);
    expect(runInstalled(["status"])).toContain("Record counts:");
    const taskOut = runInstalled(["task", "create", "--title", "Investigate CSS determinism", "--goal", "Confirm ordering"]);
    expect(taskOut).toContain("Created task");
    expect(taskOut).toContain("Status: active");
    expect(runInstalled(["task", "show"])).toContain("Investigate CSS determinism");

    const handoffOut = runInstalled([
      "handoff", "create",
      "--from", "kimi",
      "--stopping-point", "Read contract and implementation.",
      "--next-action", "Run css_determinism tests.",
      "--completed", "Read contract",
      "--files-changed", "None",
      "--verification", "contracts/DETERMINISM.md",
    ]);
    expect(handoffOut).toContain("Previous agent: kimi");
    expect(handoffOut).toContain("Stored handoff record:");
    expect(runInstalled(["handoff", "show"])).toContain("Read contract and implementation.");
    expect(runInstalled(["handoff", "validate"])).toContain("Handoff is current");

    const ackOut = runInstalled(["handoff", "acknowledge"]);
    expect(ackOut).toContain("Zentext context loaded.");
    expect(ackOut).toContain("Investigate CSS determinism");

    const continuationJson = JSON.parse(runInstalled(["continue", "--json"]));
    expect(continuationJson.validation.status).toBe("current");
    expect(continuationJson.handoff.completed).toEqual(["Read contract"]);
    expect(runInstalled(["continue"])).toContain("Exact next action:");
    expect(runInstalled(["continue", "--markdown"])).toContain("# Zentext continuation");
    expect(runInstalled(["continue", "--prompt"])).toContain(
      "Tool-neutral Zentext continuation instruction",
    );
    expect(
      JSON.parse(runInstalled(["handoff", "export", "--format", "json"])).validation.status,
    ).toBe("current");
    expect(runInstalled(["handoff", "export", "--format", "markdown"])).toContain(
      "# Zentext continuation",
    );
    expect(runInstalled(["handoff", "export", "--format", "prompt"])).toContain(
      "Tool-neutral Zentext continuation instruction",
    );

    const updateOut = runInstalled(["task", "update", "--summary", "Updated", "--note", "Progress"]);
    expect(updateOut).toContain("Updated task");
    expect(updateOut).toContain("revision:   2");

    let staleValidateExit = 0;
    try {
      runInstalled(["handoff", "validate"]);
    } catch (e) {
      staleValidateExit = (e as { status?: number }).status ?? 1;
    }
    expect(staleValidateExit).toBe(4);

    let staleAckExit = 0;
    let staleAckOut = "";
    try {
      staleAckOut = runInstalled(["handoff", "acknowledge"]);
    } catch (e) {
      staleAckExit = (e as { status?: number; stdout?: string }).status ?? 1;
      staleAckOut = (e as { stdout?: string }).stdout ?? "";
    }
    expect(staleAckExit).toBe(4);
    expect(staleAckOut).toContain("Handoff rejected");
    expect(staleAckOut).not.toContain("Zentext context loaded.");

    let staleContinueExit = 0;
    let staleContinueOut = "";
    try {
      staleContinueOut = runInstalled(["continue", "--json"]);
    } catch (e) {
      staleContinueExit = (e as { status?: number; stdout?: string }).status ?? 1;
      staleContinueOut = (e as { stdout?: string }).stdout ?? "";
    }
    expect(staleContinueExit).toBe(4);
    expect(JSON.parse(staleContinueOut).validation.status).toBe("stale");

    rmSync(project, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
    rmSync(installDir, { recursive: true, force: true });
  }, 180_000);
});
