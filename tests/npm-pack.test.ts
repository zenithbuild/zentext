import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";

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

  it("installed zentext --help works", () => {
    const out = runInstalled(["--help"]);
    expect(out).toContain("Zentext CLI");
    expect(out).toContain("handoff");
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

  it("installed zentext handoff acknowledge works after creation", () => {
    const project = mkdtempSync(join(tmpdir(), "zentext-consumer-proj-"));
    const home = mkdtempSync(join(tmpdir(), "zentext-install-home-"));
    runInstalled(["init"], { cwd: project, home });

    const seedHome = home;
    const scriptPath = join(project, "seed.mjs");
    writeFileSync(
      scriptPath,
      `
import { SqliteStore } from "${installDir}/node_modules/zentext/dist/index.js";
const project = process.cwd();
const store = new SqliteStore();
const meta = await store.initProjectStore(project);
console.log("seed project_id", meta.projectId);
const task = store.createRecord({ type: "task", title: "Verify CSS determinism", goal: "Trace contract", status: "active", author: "agent:A" });
console.log("seed task_id", task.id);
console.log("seed list", store.listRecords({ type: "task" }).length);
store.close();
`,
      "utf8",
    );
    const seedEnv: Record<string, string> = { PATH: process.env.PATH ?? "" };
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined && !key.toLowerCase().startsWith("npm_config_")) {
        seedEnv[key] = value;
      }
    }
    seedEnv.HOME = seedHome;
    const seedOut = execSync(`node ${scriptPath}`, { cwd: project, env: seedEnv, encoding: "utf8" });
    // Verify seed worked by listing tasks through the installed CLI.
    const statusOut = runInstalled(["status"], { cwd: project, home });
    const listOut = runInstalled(["list", "--type", "task"], { cwd: project, home });
    if (!listOut.includes("Verify CSS determinism")) {
      throw new Error(`Seed did not create task. Seed output: ${seedOut}. List output: ${listOut}`);
    }

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

    const ack = runInstalled(["handoff", "acknowledge"], { cwd: project, home });
    expect(ack).toContain("Zentext context loaded.");
    expect(ack).toContain("Active task: Verify CSS determinism");
    rmSync(project, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  });
});
