#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const target = resolve(process.argv[2] ?? "");
const startingRevision = Number(process.argv[3]);
const originalHandoffId = process.argv[4];
if (!process.argv[2] || !Number.isInteger(startingRevision) || !originalHandoffId) {
  throw new Error(
    "Usage: validate.mjs <fixture-directory> <starting-revision> <original-handoff-id>",
  );
}
const moduleSpecifier = process.env.ZENTEXT_MODULE
  ? pathToFileURL(resolve(process.env.ZENTEXT_MODULE)).href
  : "zentext";
const { openProject } = await import(moduleSpecifier);
const report = readFileSync(resolve(target, "work/report.md"), "utf8");
for (const expected of ["Alpha: 28", "Beta: 29", "Total: 57"]) {
  if (!report.includes(expected)) throw new Error(`Missing report evidence: ${expected}`);
}

const project = await openProject({ cwd: target });
try {
  const continuation = await project.getContinuation();
  const stale = await project.validateHandoff(originalHandoffId);
  if (continuation.task.revision !== startingRevision + 1) {
    throw new Error("Task revision did not advance exactly once.");
  }
  if (stale.current) {
    throw new Error("Original handoff is unexpectedly current.");
  }
  if (
    continuation.handoff.completed.some((entry) =>
      entry.includes("Read the Alpha source"),
    )
  ) {
    throw new Error("Fresh participant repeated Tool A's completed work.");
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        schema_version: 1,
        result: "passed",
        starting_revision: startingRevision,
        ending_revision: continuation.task.revision,
        original_handoff_current: stale.current,
        validation_status: continuation.validation.status,
        completed: continuation.handoff.completed,
        changed_files: continuation.handoff.files_changed,
        verification: continuation.handoff.verification,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  project.close();
}
