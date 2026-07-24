import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  handoffCreate,
  init,
  taskCreate,
} from "../src/cli/commands.js";
import { openProject } from "../src/sdk.js";
import { SqliteStore } from "../src/store/sqlite-store.js";
import { ZentextError } from "../src/errors.js";

describe("stable memory interface and SDK", () => {
  let tempHome: string;
  let tempProject: string;
  let originalHome: string;

  beforeEach(async () => {
    tempHome = mkdtempSync(join(tmpdir(), "zentext-memory-home-"));
    tempProject = mkdtempSync(join(tmpdir(), "zentext-memory-project-"));
    originalHome = process.env.HOME ?? "";
    process.env.HOME = tempHome;
    await init(tempProject);
    await taskCreate(tempProject, {
      title: "Complete the portable report",
      goal: "Add and verify the remaining report section.",
      author: "tool-a",
    });
    await handoffCreate(tempProject, {
      from: "tool-a",
      completed: ["Created the report skeleton", "Added the first section"],
      filesChanged: ["work/report.md", "work/verification.log"],
      blockers: ["Second source remains unread"],
      verification: ["First section matches source A", "Subtotal is 28"],
      stoppingPoint: "The first section is complete; source B is untouched.",
      nextAction: "Read source B and add its value to work/report.md.",
    });
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    rmSync(tempHome, { recursive: true, force: true });
    rmSync(tempProject, { recursive: true, force: true });
  });

  it("reads, records progress, advances revision, and proves the previous handoff stale", async () => {
    const project = await openProject({ cwd: tempProject });
    const start = await project.getContinuation();
    const prior = await project.getCurrentHandoff();
    expect(prior).not.toBeNull();
    expect(start.handoff.record_id).toBe(prior!.record_id);
    expect(start.task.revision).toBe(1);

    const result = await project.recordProgress({
      expected_revision: start.task.revision,
      task_id: start.task.id,
      source_environment: "codex-desktop",
      completed: ["Read source B", "Added the remaining report section"],
      changed_files: ["work/report.md", "work/verification.log"],
      blockers: [
        {
          title: "Publication pending",
          blocker: "The report has not been published.",
          severity: "low",
        },
      ],
      verification: [
        {
          check: "Report total",
          result: "passed",
          summary: "The total equals 57.",
        },
        {
          check: "Fixture labels",
          result: "passed",
          summary: "Source order is preserved.",
        },
      ],
      notes: ["Fresh Codex participant continued without repeating Tool A work."],
      stopping_point: "The report is complete and both fixture checks pass.",
      next_action: "Review and publish the completed report.",
      accepted_decisions: [
        {
          title: "Preserve source order",
          decision: "Keep source A before source B.",
          rationale: "The fixture must remain directly auditable.",
        },
      ],
      files_inspected: ["fixture/source-b.txt"],
      commands_executed: ["npm test -- report"],
      parent_handoff_id: prior!.record_id,
    });

    expect(result.task.revision).toBe(2);
    expect(result.handoff.handoff.active_task.revision).toBe(2);
    expect(result.handoff.handoff.accepted_decisions).toContain(
      "Preserve source order: Keep source A before source B.",
    );
    const stale = await project.validateHandoff(prior!.record_id);
    expect(stale.current).toBe(false);
    expect(stale.handoff_revision).toBe(1);
    expect(stale.live_revision).toBe(2);

    const current = await project.getContinuation();
    expect(current.validation).toEqual({
      status: "current",
      task_revision: 2,
      handoff_revision: 2,
    });
    expect(current.handoff.completed).toEqual([
      "Read source B",
      "Added the remaining report section",
    ]);
    project.close();

    const store = new SqliteStore();
    await store.openProjectStore(tempProject);
    const validations = store.listRecords({ type: "validation" });
    expect(validations).toHaveLength(2);
    expect(validations[0].provenance?.source_environment).toBe("codex-desktop");
    expect(validations[0].provenance?.project_id).toBe(current.project.id);
    expect(validations[0].provenance?.commands_executed).toEqual(["npm test -- report"]);
    store.close();
  });

  it("rejects stale revisions, identity mismatches, unsafe paths, and likely secrets", async () => {
    const project = await openProject({ cwd: tempProject });
    const current = await project.getContinuation();
    await expect(
      project.updateTask({
        task_id: current.task.id,
        expected_revision: 99,
        source_environment: "codex-desktop",
        next_action: "Continue",
      }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    await expect(
      project.updateTask({
        task_id: current.task.id,
        expected_revision: current.task.revision,
        source_environment: "codex-desktop",
        notes: ["api_key=super-secret-value"],
      }),
    ).rejects.toMatchObject({ code: "SECRET_DETECTED" });
    project.close();

    await expect(
      openProject({ cwd: tempProject, project_id: "0000000000000000" }),
    ).rejects.toMatchObject({ code: "PROJECT_IDENTITY_MISMATCH" });
  });

  it("queries deterministic canonical records without terminal parsing", async () => {
    const project = await openProject({ cwd: tempProject });
    const records = await project.queryMemory({
      query: "portable report",
      type: "task",
      limit: 10,
    });
    expect(records).toHaveLength(1);
    expect(records[0].type).toBe("task");
    expect(records[0].title).toBe("Complete the portable report");
    project.close();
  });

  it("allows exactly one concurrent or duplicate write for a shared revision", async () => {
    const first = await openProject({ cwd: tempProject });
    const second = await openProject({ cwd: tempProject });
    const current = await first.getContinuation();
    const input = {
      task_id: current.task.id,
      expected_revision: current.task.revision,
      source_environment: "concurrency-test",
      summary: "One compare-and-swap update may succeed.",
    };

    const outcomes = await Promise.allSettled([
      first.updateTask(input),
      second.updateTask(input),
    ]);
    expect(outcomes.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
    const rejected = outcomes.find(
      (entry): entry is PromiseRejectedResult => entry.status === "rejected",
    );
    expect(rejected?.reason).toMatchObject({ code: "REVISION_CONFLICT" });

    first.close();
    second.close();
    const reopened = await openProject({ cwd: tempProject });
    const task = await reopened.getActiveTask();
    expect(task?.revision).toBe(current.task.revision + 1);
    reopened.close();
  });

  it("leaves canonical state readable and unchanged after a rejected write", async () => {
    const project = await openProject({ cwd: tempProject });
    const before = await project.getContinuation();
    const beforeRecords = await project.queryMemory({ query: "", limit: 100 });

    await expect(
      project.recordProgress({
        task_id: before.task.id,
        expected_revision: before.task.revision,
        source_environment: "failure-test",
        completed: ["This must not persist"],
        changed_files: ["work/report.md"],
        verification: [
          {
            check: "Rejected secret fixture",
            result: "failed",
            summary: "password=correct-horse-battery-staple",
          },
        ],
        stopping_point: "The unsafe write must be rejected.",
        next_action: "Confirm canonical state did not change.",
      }),
    ).rejects.toMatchObject({ code: "SECRET_DETECTED" });

    const after = await project.getContinuation();
    const afterRecords = await project.queryMemory({ query: "", limit: 100 });
    expect(after).toEqual(before);
    expect(afterRecords).toEqual(beforeRecords);
    project.close();
  });

  it("requires an explicit secret override and redacts every returned view", async () => {
    const project = await openProject({ cwd: tempProject });
    const before = await project.getContinuation();
    const syntheticSecret = "api_key=synthetic-release-readiness-value";

    const updated = await project.updateTask({
      task_id: before.task.id,
      expected_revision: before.task.revision,
      source_environment: "override-test",
      notes: [syntheticSecret],
      allow_secret_override: true,
    });
    expect(updated.notes).toEqual(["[REDACTED]"]);
    expect(updated.provenance?.secret_override_used).toBe(true);

    const active = await project.getActiveTask();
    const queried = await project.queryMemory({
      query: "synthetic-release-readiness",
      type: "task",
      limit: 10,
    });
    expect(JSON.stringify(active)).not.toContain(syntheticSecret);
    expect(JSON.stringify(queried)).not.toContain(syntheticSecret);
    project.close();
  });
});
