#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const allowPending = process.argv.includes("--allow-pending");
const scenario = JSON.parse(readFileSync(join(root, "scenario.json"), "utf8"));
const results = JSON.parse(readFileSync(join(root, "results.json"), "utf8"));

assert.equal(scenario.schema_version, 1);
assert.equal(results.schema_version, scenario.schema_version);
assert.equal(results.scenario_id, scenario.scenario_id);

const requiredSurfaces = [
  "continue_human",
  "continue_json",
  "continue_markdown",
  "continue_prompt",
  "export_json",
  "export_markdown",
  "export_prompt",
  "prompt_template",
];

for (const surface of requiredSurfaces) {
  assert.ok(surface in results.surfaces, `missing surface result: ${surface}`);
  assert.ok(
    ["pass", "fail", "not-run"].includes(results.surfaces[surface]),
    `invalid surface result: ${surface}`,
  );
}

const repeatableKeys = [
  "completed",
  "files_changed",
  "blockers",
  "verification",
  "notes",
];
for (const key of repeatableKeys) {
  assert.ok(Array.isArray(results.repeated_values[key]), `${key} must be an array`);
}

const allowedClassifications = new Set([
  "zentext",
  "harness",
  "provider",
  "formatting",
  "environment",
  "isolation",
  "unavailable",
]);
for (const failure of results.failures) {
  assert.ok(allowedClassifications.has(failure.classification));
  assert.equal(typeof failure.summary, "string");
  assert.ok(failure.summary.length > 0);
}

const participantKeys = [
  "tool",
  "version_or_model",
  "environment",
  "input_surface",
  "prior_state_available",
  "result",
  "explained_before_continuing",
  "continued_from_exact_next_action",
  "repeated_completed_work",
  "evidence",
];
for (const participant of results.participants) {
  for (const key of participantKeys) {
    assert.ok(key in participant, `participant missing ${key}`);
  }
  assert.ok(["pass", "fail", "unavailable"].includes(participant.result));
}

if (allowPending && results.execution_status === "not-run") {
  console.log("M1 field-test baseline contract is valid; execution remains pending.");
  process.exit(0);
}

assert.equal(results.execution_status, "pass");
for (const surface of requiredSurfaces) {
  assert.equal(results.surfaces[surface], "pass", `${surface} did not pass`);
}

assert.deepEqual(results.repeated_values.completed, scenario.tool_a.completed);
assert.deepEqual(results.repeated_values.files_changed, scenario.tool_a.files_changed);
assert.deepEqual(results.repeated_values.blockers, scenario.tool_a.blockers);
assert.deepEqual(results.repeated_values.verification, scenario.tool_a.verification);
assert.deepEqual(results.repeated_values.notes, scenario.task.notes);

assert.equal(results.isolation.fresh_project_per_run, true);
assert.equal(results.isolation.isolated_home_per_run, true);
assert.equal(results.isolation.tool_a_exited_before_receiver, true);
assert.equal(results.isolation.prior_conversation_available, false);
assert.equal(results.isolation.shared_provider_session, false);
assert.equal(results.isolation.answer_carried_in_memory, false);

const revisions = results.revision_evidence;
assert.equal(typeof revisions.before, "number");
assert.equal(typeof revisions.after, "number");
assert.equal(typeof revisions.handoff_revision, "number");
assert.ok(revisions.after > revisions.before, "task revision did not advance");
assert.equal(revisions.handoff_revision, revisions.before);
assert.notEqual(revisions.validation_exit_code, 0);
assert.notEqual(revisions.continuation_exit_code, 0);
assert.equal(revisions.stale_rejected, true);

const passing = results.participants.filter((participant) => participant.result === "pass");
assert.ok(passing.length >= 3, "fewer than three participants passed");
assert.ok(
  new Set(passing.map((participant) => participant.tool_family ?? participant.tool)).size >= 3,
  "passing participants are not from three distinct tool or model families",
);
for (const participant of passing) {
  assert.equal(participant.prior_state_available, false);
  assert.equal(participant.explained_before_continuing, true);
  assert.equal(participant.continued_from_exact_next_action, true);
  assert.equal(participant.repeated_completed_work, false);
  assert.ok(participant.evidence.length > 0);
}

console.log(`M1 field test passed with ${passing.length} isolated participants.`);

