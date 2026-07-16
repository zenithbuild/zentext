/**
 * CLI output formatting helpers for Zentext.
 *
 * Keep output human-readable and scoped to Phase 2 (read/inspect only).
 */

import type { AnyRecord, RecordType, RecordRefs } from "../types/records.js";

const ENVELOPE_FIELDS = new Set([
  "id",
  "project",
  "type",
  "title",
  "status",
  "summary",
  "created_at",
  "updated_at",
  "revision",
  "author",
  "tags",
  "refs",
  "schema_version",
  "supersedes",
  "superseded_by",
]);

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function formatRefs(refs: RecordRefs): string {
  const parts: string[] = [];
  if (refs.files && refs.files.length > 0) {
    parts.push(`files: ${refs.files.join(", ")}`);
  }
  if (refs.commits && refs.commits.length > 0) {
    parts.push(`commits: ${refs.commits.join(", ")}`);
  }
  if (refs.branches && refs.branches.length > 0) {
    parts.push(`branches: ${refs.branches.join(", ")}`);
  }
  return parts.length > 0 ? parts.join(" | ") : "(none)";
}

function formatValue(value: unknown): string {
  if (value === undefined) return "";
  if (value === null) return "(null)";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    if (value.length === 0) return "(empty)";
    return value.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(", ");
  }
  return JSON.stringify(value, null, 2);
}

export function formatRecord(record: AnyRecord): string {
  const lines: string[] = [];

  lines.push(`${record.type.toUpperCase()}: ${record.title}`);
  lines.push(`  id:         ${record.id}`);
  lines.push(`  status:     ${record.status}`);
  lines.push(`  project:    ${record.project}`);
  if (record.summary) {
    lines.push(`  summary:    ${record.summary}`);
  }
  lines.push(`  created:    ${formatTimestamp(record.created_at)}`);
  lines.push(`  updated:    ${formatTimestamp(record.updated_at)}`);
  lines.push(`  revision:   ${record.revision}`);
  lines.push(`  author:     ${record.author}`);
  lines.push(`  tags:       ${record.tags.length > 0 ? record.tags.join(", ") : "(none)"}`);
  lines.push(`  refs:       ${formatRefs(record.refs)}`);
  if (record.supersedes && record.supersedes.length > 0) {
    lines.push(`  supersedes: ${record.supersedes.join(", ")}`);
  }
  if (record.superseded_by) {
    lines.push(`  superseded_by: ${record.superseded_by}`);
  }

  const payloadFields = Object.entries(record as unknown as Record<string, unknown>).filter(
    ([key]) => !ENVELOPE_FIELDS.has(key),
  );

  if (payloadFields.length > 0) {
    lines.push("");
    lines.push("Payload:");
    for (const [key, value] of payloadFields) {
      const formatted = formatValue(value);
      if (formatted.includes("\n")) {
        lines.push(`  ${key}:`);
        for (const line of formatted.split("\n")) {
          lines.push(`    ${line}`);
        }
      } else {
        lines.push(`  ${key}: ${formatted}`);
      }
    }
  }

  return lines.join("\n");
}

export interface ListRow {
  id: string;
  type: RecordType;
  status: string;
  title: string;
  updated_at: string;
}

export function formatList(rows: ListRow[], title = "Records"): string {
  if (rows.length === 0) {
    return `${title}:\n  (none)`;
  }

  const idWidth = Math.max(12, ...rows.map((r) => r.id.length));
  const typeWidth = Math.max(6, ...rows.map((r) => r.type.length));
  const statusWidth = Math.max(8, ...rows.map((r) => r.status.length));

  const header =
    `${"id".padEnd(idWidth)}  ${"type".padEnd(typeWidth)}  ${"status".padEnd(statusWidth)}  updated_at              title`;
  const divider = "-".repeat(header.length);

  const lines: string[] = [`${title}:`, header, divider];

  for (const row of rows) {
    const updated = formatTimestamp(row.updated_at);
    lines.push(
      `${row.id.padEnd(idWidth)}  ${row.type.padEnd(typeWidth)}  ${row.status.padEnd(statusWidth)}  ${updated.padEnd(24)} ${row.title}`,
    );
  }

  return lines.join("\n");
}

export function formatStatus(meta: {
  projectName: string;
  projectId: string;
  storePath: string;
  schemaVersion: number;
  recordCounts: Record<RecordType, number>;
  openBlockers: number;
  activeTasks: number;
  latestHandoff: AnyRecord | null;
  latestValidation: AnyRecord | null;
  lastUpdatedAt: string | null;
}): string {
  const lines: string[] = [];
  lines.push(`Project: ${meta.projectName}`);
  lines.push(`ID:      ${meta.projectId}`);
  lines.push(`Store:   ${meta.storePath}`);
  lines.push(`Schema:  v${meta.schemaVersion}`);
  lines.push("");
  lines.push("Record counts:");
  for (const type of [
    "task",
    "decision",
    "blocker",
    "handoff",
    "log",
    "validation",
    "policy",
    "custom",
  ] as RecordType[]) {
    lines.push(`  ${type.padEnd(12)} ${meta.recordCounts[type]}`);
  }
  lines.push("");
  lines.push(`Open blockers: ${meta.openBlockers}`);
  lines.push(`Active tasks:  ${meta.activeTasks}`);

  if (meta.latestHandoff) {
    lines.push("");
    lines.push(`Latest handoff: ${meta.latestHandoff.id} — ${meta.latestHandoff.title}`);
    if (meta.latestHandoff.summary) {
      lines.push(`  ${meta.latestHandoff.summary}`);
    }
  }

  if (meta.latestValidation) {
    lines.push("");
    lines.push(
      `Latest validation: ${meta.latestValidation.id} — ${meta.latestValidation.status} — ${meta.latestValidation.title}`,
    );
  }

  if (meta.lastUpdatedAt) {
    lines.push("");
    lines.push(`Last updated: ${formatTimestamp(meta.lastUpdatedAt)}`);
  }

  return lines.join("\n");
}

export function formatInit(meta: {
  projectName: string;
  projectId: string;
  storePath: string;
  schemaVersion: number;
  created: boolean;
}): string {
  const state = meta.created ? "created" : "already existed";
  const lines: string[] = [
    `Project: ${meta.projectName}`,
    `ID:      ${meta.projectId}`,
    `Store:   ${meta.storePath}`,
    `Schema:  v${meta.schemaVersion}`,
    `State:   ${state}`,
    "",
    "Next: run `zentext status` to see the current project memory.",
  ];
  return lines.join("\n");
}
