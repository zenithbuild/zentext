#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const project = process.argv[2];
if (!project) {
  throw new Error("Usage: node tool-a.mjs <project>");
}

mkdirSync(join(project, "src"), { recursive: true });
mkdirSync(join(project, "test"), { recursive: true });

writeFileSync(
  join(project, "src/health-route.mjs"),
  [
    "export function healthRoute() {",
    '  return { status: 200, body: "pending" };',
    "}",
    "",
  ].join("\n"),
);

writeFileSync(
  join(project, "test/health-route.test.mjs"),
  [
    'import assert from "node:assert/strict";',
    'import test from "node:test";',
    "",
    'import { healthRoute } from "../src/health-route.mjs";',
    "",
    'test("health route returns status 200", () => {',
    "  assert.equal(healthRoute().status, 200);",
    "});",
    "",
  ].join("\n"),
);

const verification = execFileSync(process.execPath, ["--test"], {
  cwd: project,
  encoding: "utf8",
});

process.stdout.write(
  [
    "Tool A completed the first work boundary.",
    "- Added a health-route skeleton.",
    "- Added and passed the status-code test.",
    "- Left the response body intentionally pending.",
    "",
    verification.trim(),
    "",
    "Tool A exits here. It does not inspect or implement the body requirement.",
    "",
  ].join("\n"),
);
