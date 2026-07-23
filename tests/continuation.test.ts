import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  CliError,
  continueProject,
  handoffCreate,
  handoffExport,
  init,
  parseContinuationFormat,
  parseHandoffExportFormat,
  taskCreate,
  taskUpdate,
} from "../src/cli/commands.js";
import { buildContinuationView } from "../src/continuation.js";
import {
  renderContinuation,
  renderContinuationMarkdown,
  renderContinuationPrompt,
} from "../src/continuation-format.js";
import { SqliteStore } from "../src/store/sqlite-store.js";

describe("validated continuation view", () => {
  let tempHome: string;
  let tempProject: string;
  let originalHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "zentext-continuation-home-"));
    tempProject = mkdtempSync(join(tmpdir(), "zentext-continuation-project-"));
    originalHome = process.env.HOME ?? "";
    process.env.HOME = tempHome;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    rmSync(tempHome, { recursive: true, force: true });
    rmSync(tempProject, { recursive: true, force: true });
  });

  async function seedCurrentContinuation(): Promise<void> {
    await init(tempProject);
    await taskCreate(tempProject, {
      title: "Verify regional totals",
      goal: "Verify all four values without repeating completed work.",
    });
    await taskUpdate(tempProject, {
      notes: ["Keep labels in order, including commas", "Use Unicode ✓ honestly"],
      nextAction: "Inspect source-a.txt",
    });
    await handoffCreate(tempProject, {
      from: "tool-a",
      completed: ["Inspected source-a.txt", "Verified 17 + 11 = 28"],
      filesChanged: ["work/report.md", "work/verification.log"],
      blockers: ["source-b remains", "grand total is unverified"],
      verification: ["source-a labels match", "subtotal equals 28"],
      stoppingPoint: "Source A is complete; source B is intentionally untouched.",
      nextAction: "Inspect source-b.txt and verify the grand total.",
    });
  }

  it("builds one deterministic view from live task and handoff records", async () => {
    await seedCurrentContinuation();
    const store = new SqliteStore();
    const meta = await store.openProjectStore(tempProject);

    const first = buildContinuationView(store, meta);
    const second = buildContinuationView(store, meta);

    expect(second).toEqual(first);
    expect(first.task.goal).toContain("Verify all four values");
    expect(first.task.notes).toEqual([
      "Keep labels in order, including commas",
      "Use Unicode ✓ honestly",
    ]);
    expect(first.handoff.completed).toEqual([
      "Inspected source-a.txt",
      "Verified 17 + 11 = 28",
    ]);
    expect(first.handoff.files_changed).toEqual([
      "work/report.md",
      "work/verification.log",
    ]);
    expect(first.validation).toEqual({
      status: "current",
      task_revision: 2,
      handoff_revision: 2,
    });
    store.close();
  });

  it("renders human, JSON, Markdown, and prompt output from the same view", async () => {
    await seedCurrentContinuation();
    const human = await continueProject(tempProject);
    const json = await continueProject(tempProject, { format: "json" });
    const markdown = await continueProject(tempProject, { format: "markdown" });
    const prompt = await continueProject(tempProject, { format: "prompt" });

    expect(human.exitCode).toBe(0);
    expect(human.output).toContain("Zentext continuation — validated current");
    expect(human.output).toContain("Exact next action:");
    expect(human.output).toContain("work/verification.log");

    const parsed = JSON.parse(json.output);
    expect(parsed.handoff.completed).toEqual([
      "Inspected source-a.txt",
      "Verified 17 + 11 = 28",
    ]);
    expect(parsed.task.notes).toHaveLength(2);
    expect(parsed.validation.status).toBe("current");

    expect(markdown.output).toContain("# Zentext continuation");
    expect(markdown.output).toContain("## Exact next action");
    expect(prompt.output).toContain("external project memory");
    expect(prompt.output).toContain("Do not repeat completed work");
  });

  it("exports JSON, Markdown, and prompt from the identical validated view", async () => {
    await seedCurrentContinuation();
    for (const format of ["json", "markdown", "prompt"] as const) {
      const continuation = await continueProject(tempProject, { format });
      const exported = await handoffExport(tempProject, { format });
      expect(exported).toEqual(continuation);
    }

    const json = JSON.parse((await handoffExport(tempProject, { format: "json" })).output);
    expect(json.project.id).toMatch(/^[0-9a-f]{16}$/);
    expect(json.task.id).toMatch(/^rec_task_/);
    expect(json.handoff.based_on_task_revision).toBe(json.task.revision);
    expect(json.handoff.completed).toEqual([
      "Inspected source-a.txt",
      "Verified 17 + 11 = 28",
    ]);
    expect(json.handoff.next_action).toBe(
      "Inspect source-b.txt and verify the grand total.",
    );
  });

  it("keeps renderers deterministic and preserves arrays as JSON arrays", async () => {
    await seedCurrentContinuation();
    const store = new SqliteStore();
    const meta = await store.openProjectStore(tempProject);
    const view = buildContinuationView(store, meta);

    expect(renderContinuation(view, "json")).toBe(renderContinuation(view, "json"));
    expect(renderContinuationMarkdown(view)).toContain(view.handoff.next_action);
    expect(renderContinuationPrompt(view)).toContain(view.handoff.stopping_point);
    expect(JSON.parse(renderContinuation(view, "json")).handoff.blockers).toEqual(
      view.handoff.blockers,
    );
    store.close();
  });

  it("rejects stale state in every mode without rendering a continuation", async () => {
    await seedCurrentContinuation();
    await taskUpdate(tempProject, { note: "Tool B advanced the task." });

    for (const format of ["human", "json", "markdown", "prompt"] as const) {
      const result = await continueProject(tempProject, { format });
      expect(result.exitCode).toBe(4);
      expect(result.output).toContain("stale");
      expect(result.output).not.toContain("Source A is complete");
      if (format === "json") {
        const parsed = JSON.parse(result.output);
        expect(parsed.continuation).toBeNull();
        expect(parsed.validation.status).toBe("stale");
        expect(parsed.validation.handoff_revision).toBe(2);
        expect(parsed.validation.live_revision).toBe(3);
      }
    }

    for (const format of ["json", "markdown", "prompt"] as const) {
      const result = await handoffExport(tempProject, { format });
      expect(result.exitCode).toBe(4);
      expect(result.output).toContain("stale");
      expect(result.output).not.toContain("Source A is complete");
    }
  });

  it("reports project, task, and handoff absence with stable exit codes", async () => {
    await expect(continueProject(tempProject)).rejects.toMatchObject({ exitCode: 2 });

    await init(tempProject);
    await expect(continueProject(tempProject)).rejects.toMatchObject({ exitCode: 3 });

    await taskCreate(tempProject, { title: "Task only", goal: "Need a handoff" });
    await expect(continueProject(tempProject)).rejects.toMatchObject({ exitCode: 3 });
  });

  it("does not continue done tasks or archived handoffs", async () => {
    await seedCurrentContinuation();
    await taskUpdate(tempProject, { status: "done" });
    await expect(continueProject(tempProject)).rejects.toMatchObject({ exitCode: 3 });

    rmSync(tempHome, { recursive: true, force: true });
    tempHome = mkdtempSync(join(tmpdir(), "zentext-continuation-home-"));
    process.env.HOME = tempHome;
    await seedCurrentContinuation();
    const store = new SqliteStore();
    await store.openProjectStore(tempProject);
    const handoff = store.listRecords({ type: "handoff", status: "latest" })[0];
    store.updateRecord({ id: handoff.id, status: "archived" });
    store.close();
    await expect(continueProject(tempProject)).rejects.toMatchObject({ exitCode: 3 });
  });

  it("rejects malformed canonical handoff state", async () => {
    await init(tempProject);
    await taskCreate(tempProject, { title: "Task", goal: "Validate state" });
    const store = new SqliteStore();
    await store.openProjectStore(tempProject);
    store.createRecord({
      type: "handoff",
      title: "Malformed handoff",
      status: "latest",
      author: "tool-a",
      from: "tool-a",
      to: "tool-b",
      context: "context",
      state: "state",
      next: "next",
      structured_handoff: { schema_version: 1 },
    });
    store.close();

    await expect(continueProject(tempProject)).rejects.toMatchObject({ exitCode: 5 });
  });
});

describe("continue output option parsing", () => {
  it("selects one supported mode and defaults to human", () => {
    expect(parseContinuationFormat({})).toBe("human");
    expect(parseContinuationFormat({ json: true })).toBe("json");
    expect(parseContinuationFormat({ markdown: true })).toBe("markdown");
    expect(parseContinuationFormat({ prompt: true })).toBe("prompt");
  });

  it("rejects conflicting, valued, and unsupported options", () => {
    expect(() => parseContinuationFormat({ json: true, prompt: true })).toThrow(
      /Choose only one/,
    );
    expect(() => parseContinuationFormat({ json: "yes" })).toThrow(
      /does not accept a value/,
    );
    expect(() => parseContinuationFormat({ provider: "codex" })).toThrow(
      /Unsupported option/,
    );

    try {
      parseContinuationFormat({ json: true, markdown: true });
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).exitCode).toBe(1);
    }
  });
});

describe("handoff export option parsing", () => {
  it("requires one documented format", () => {
    expect(parseHandoffExportFormat({ format: "json" })).toBe("json");
    expect(parseHandoffExportFormat({ format: "markdown" })).toBe("markdown");
    expect(parseHandoffExportFormat({ format: "prompt" })).toBe("prompt");
    expect(() => parseHandoffExportFormat({})).toThrow(/Usage/);
    expect(() => parseHandoffExportFormat({ format: "html" })).toThrow(
      /Unsupported handoff export format/,
    );
    expect(() => parseHandoffExportFormat({ format: "json", out: "file" })).toThrow(
      /Unsupported option/,
    );
  });
});
