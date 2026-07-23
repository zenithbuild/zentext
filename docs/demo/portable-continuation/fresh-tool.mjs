#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [continuationPath, project, progressPath] = process.argv.slice(2);
if (!continuationPath || !project || !progressPath) {
  throw new Error(
    "Usage: node fresh-tool.mjs <continuation.json> <project> <progress.json>",
  );
}

const continuation = JSON.parse(readFileSync(continuationPath, "utf8"));
if (continuation.validation?.status !== "current") {
  throw new Error("Fresh tool refused non-current continuation state.");
}

const { task, handoff, project: projectIdentity } = continuation;

process.stdout.write(
  [
    "Fresh Tool B started with no Tool A session or conversation.",
    "Input: portable Zentext JSON plus the project files.",
    "",
    `Recovered project: ${projectIdentity.name} (${projectIdentity.id})`,
    `Recovered task: ${task.title}`,
    `Task revision: ${task.revision}`,
    "Completed work:",
    ...handoff.completed.map((item) => `- ${item}`),
    "Changed files:",
    ...handoff.files_changed.map((item) => `- ${item}`),
    "Blockers:",
    ...handoff.blockers.map((item) => `- ${item}`),
    "Verification:",
    ...handoff.verification.map((item) => `- ${item}`),
    `Stopping point: ${handoff.stopping_point}`,
    `Exact next action: ${handoff.next_action}`,
    "",
    "Recovered state explained before changing anything.",
    "",
  ].join("\n"),
);

const requirement = readFileSync(
  join(project, "requirements/health-response.txt"),
  "utf8",
)
  .trim()
  .split("=")[1];
if (!requirement) {
  throw new Error("Response-body requirement is missing.");
}
if (!handoff.next_action.includes("response body")) {
  throw new Error("Continuation did not identify the response-body next action.");
}

const routePath = join(project, "src/health-route.mjs");
const testPath = join(project, "test/health-route.test.mjs");
const route = readFileSync(routePath, "utf8");
if (!route.includes('body: "pending"')) {
  throw new Error("Expected Tool A's pending body boundary.");
}
writeFileSync(routePath, route.replace('body: "pending"', `body: "${requirement}"`));

appendFileSync(
  testPath,
  [
    "",
    'test("health route returns the required body", () => {',
    `  assert.equal(healthRoute().body, ${JSON.stringify(requirement)});`,
    "});",
    "",
  ].join("\n"),
);

const verification = execFileSync(process.execPath, ["--test"], {
  cwd: project,
  encoding: "utf8",
});

const progress = {
  summary: `Fresh Tool B implemented and verified the required '${requirement}' response body.`,
  notes: [
    `Updated the health route body from pending to '${requirement}'.`,
    "Added the missing response-body assertion and passed the complete test suite.",
  ],
  next_action: "Review the completed health-route change.",
};
writeFileSync(progressPath, `${JSON.stringify(progress, null, 2)}\n`);

process.stdout.write(
  [
    `Continued from the exact next action: implemented body='${requirement}'.`,
    "Repeated Tool A's completed work: no.",
    "",
    verification.trim(),
    "",
    "Progress update written for Zentext.",
    "",
  ].join("\n"),
);
