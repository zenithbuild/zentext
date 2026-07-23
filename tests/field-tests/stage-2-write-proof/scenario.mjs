// Stage 2A write-domain reproducible scenario.
// This is a domain-level fixture used to exercise the canonical writer in a
// multi-agent-shaped flow. The independent Stage 2B continuation proof will be
// added after the write domain is reviewed and merged.
//
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteStore } from "../../../dist/store/sqlite-store.js";
import { createMemoryWriter } from "../../../dist/domain/memory-writer.js";
import { repack } from "../../../dist/repack/engine.js";

const tempHome = mkdtempSync(join(tmpdir(), "zentext-stage2-proof-"));
process.env.HOME = tempHome;
const tempProject = mkdtempSync(join(tmpdir(), "zentext-stage2-proof-proj-"));

const store = new SqliteStore();
const meta = await store.initProjectStore(tempProject);
const writer = createMemoryWriter(store);

// 1. Agent A creates an active task and an accepted decision.
const task = writer.createRecord({
  type: "task",
  title: "Implement auth",
  goal: "Add OAuth login flow",
  status: "active",
  author: "agent:a",
});
const decision = writer.createRecord({
  type: "decision",
  title: "Use SQLite",
  decision: "SQLite for local store",
  status: "accepted",
  author: "agent:a",
});

// 2. Agent B reads the state and updates the task using the expected revision.
store.close();
const storeB = new SqliteStore();
await storeB.openProjectStore(tempProject);
const writerB = createMemoryWriter(storeB);
const updatedTask = writerB.updateRecord(task.id, { next: "Wire up callback handler" }, { expectedRevision: task.revision });
storeB.close();

// 3. Agent C attempts a stale update and receives a conflict with no mutation.
const storeC = new SqliteStore();
await storeC.openProjectStore(tempProject);
const writerC = createMemoryWriter(storeC);
let conflict = false;
try {
  writerC.updateRecord(task.id, { title: "Oops" }, { expectedRevision: 1 });
} catch (err) {
  if (err.name === "MemoryWriterConflictError") conflict = true;
}
storeC.close();

// 4. Agent B supersedes the decision with a corrected decision.
const storeB2 = new SqliteStore();
await storeB2.openProjectStore(tempProject);
const writerB2 = createMemoryWriter(storeB2);
const { replacement: correctedDecision } = writerB2.supersedeRecord(decision.id, {
  type: "decision",
  title: "Use better-sqlite3",
  decision: "better-sqlite3 for native binding",
  status: "accepted",
  author: "agent:b",
});
storeB2.close();

// 5. Agent D archives completed work.
const storeD = new SqliteStore();
await storeD.openProjectStore(tempProject);
const writerD = createMemoryWriter(storeD);
writerD.archiveRecord(updatedTask.id);
storeD.close();

// 6. Agent D creates a handoff.
const storeD2 = new SqliteStore();
await storeD2.openProjectStore(tempProject);
const writerD2 = createMemoryWriter(storeD2);
const handoff = writerD2.createHandoff({
  type: "handoff",
  title: "Stage 2 handoff",
  from: "agent:d",
  to: "agent:e",
  context: "Auth module is wired; tests passing.",
  state: "Task archived; decision superseded.",
  next: "Integrate with signup flow",
  author: "agent:d",
});
storeD2.close();

// 7. A fresh read-only session reads and repacks the resulting state.
const storeRead = new SqliteStore();
await storeRead.openProjectStore(tempProject);
const finalTask = storeRead.getRecord(task.id);
const finalDecision = storeRead.getRecord(decision.id);
const finalHandoff = storeRead.getRecord(handoff.id);
const repackResult = repack(storeRead, meta);
const taskHistory = storeRead.getRecordHistory(task.id);
storeRead.close();

// Verify
const checks = [
  ["task has history create+update+archive", taskHistory.map(e => e.event).join(",") === "create,update,update"],
  ["task is done", finalTask.status === "done"],
  ["stale conflict happened", conflict],
  ["original decision is superseded", finalDecision.superseded_by === correctedDecision.id],
  ["latest handoff selected", finalHandoff.id === handoff.id && finalHandoff.status === "latest"],
  ["repack contains corrected decision", repackResult.markdown.includes("better-sqlite3")],
  ["repack does not treat original decision as current", !repackResult.markdown.includes("SQLite for local store") || repackResult.markdown.includes("superseded")],
];

let passed = 0;
for (const [label, ok] of checks) {
  console.log(ok ? "✓" : "✗", label);
  if (ok) passed += 1;
}

const report = {
  projectId: meta.projectId,
  passed,
  total: checks.length,
  finalState: {
    task: finalTask,
    originalDecision: finalDecision,
    correctedDecision: correctedDecision,
    handoff: finalHandoff,
  },
};

writeFileSync(join(tempHome, "stage-2-proof-report.json"), JSON.stringify(report, null, 2));

rmSync(tempHome, { recursive: true, force: true });
rmSync(tempProject, { recursive: true, force: true });

if (passed !== checks.length) {
  console.error("Stage 2 proof failed");
  process.exit(1);
}
console.log("Stage 2 write-domain proof passed");
