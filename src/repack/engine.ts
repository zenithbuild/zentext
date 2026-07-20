/**
 * Shared repack engine for Zentext.
 *
 * Generates a deterministic, prioritized, size-bounded markdown context
 * payload from a Store. Used by both `zentext repack` and (later) the MCP
 * `memory.repack` tool so outputs never drift.
 */

import type { Store } from "../types/store.js";
import type { AnyRecord } from "../types/records.js";

export interface RepackOptions {
  /** Optional topic to prioritize matching records. */
  focus?: string;
  /** Approximate character budget (default 12000). */
  maxSize?: number;
}

export interface RepackResult {
  /** Generated markdown payload. */
  markdown: string;
}

const DEFAULT_MAX_SIZE = 12000;

const INACTIVE_STATUSES: ReadonlySet<string> = new Set([
  "done",
  "canceled",
  "resolved",
  "archived",
  "inactive",
  "superseded",
  "rejected",
  "redacted",
]);

/** Priority order used when ranking record groups. Lower number = higher priority. */
const GROUP_PRIORITY: Readonly<Record<string, number>> = {
  primaryTask: 1,
  blockers: 2,
  decisions: 3,
  latestHandoff: 4,
  validations: 5,
  policies: 6,
  otherActiveTasks: 7,
  logs: 8,
  custom: 9,
  stale: 10,
};

/** A classified record carrying its priority group and sort keys. */
interface ClassifiedRecord {
  record: AnyRecord;
  group: string;
  statusRelevance: number;
  focusMatched: boolean;
}

export function repack(store: Store, meta: { projectName: string; projectId: string }, options: RepackOptions = {}): RepackResult {
  const maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
  const focus = (options.focus ?? "").trim().toLowerCase();

  const all = store.listRecords();
  

  const active: ClassifiedRecord[] = [];
  const inactive: ClassifiedRecord[] = [];

  for (const record of all) {
    const isInactive = INACTIVE_STATUSES.has(record.status);
    const matched = focus ? focusMatches(record, focus) : false;

    if (isInactive) {
      inactive.push({
        record,
        group: "stale",
        statusRelevance: statusRank(record.status),
        focusMatched: matched,
      });
      continue;
    }

    active.push({
      record,
      group: classifyActiveRecord(record),
      statusRelevance: statusRank(record.status),
      focusMatched: matched,
    });
  }

  const selected = selectRecords(active, focus);
  const groups = groupByPriority(selected);

  const rendered: RenderedSection[] = [];

  // Primary active task (always included if it exists).
  if ((groups.primaryTask?.length ?? 0) > 0) {
    rendered.push({
      name: "primaryTask",
      markdown: renderPrimaryTask(groups.primaryTask[0]!.record),
      required: true,
    });
  }

  // Open blockers (always included if any exist).
  if ((groups.blockers?.length ?? 0) > 0) {
    rendered.push({
      name: "blockers",
      markdown: renderBlockers(groups.blockers.map((c) => c.record)),
      required: true,
    });
  }

  // Latest handoff (preserve if practical).
  if ((groups.latestHandoff?.length ?? 0) > 0) {
    rendered.push({
      name: "latestHandoff",
      markdown: renderLatestHandoff(groups.latestHandoff[0]!.record),
      required: false,
    });
  }

  // Accepted/proposed decisions.
  if ((groups.decisions?.length ?? 0) > 0) {
    rendered.push({
      name: "decisions",
      markdown: renderDecisions(groups.decisions.map((c) => c.record)),
      required: false,
    });
  }

  // Recent validation results.
  if ((groups.validations?.length ?? 0) > 0) {
    rendered.push({
      name: "validations",
      markdown: renderValidations(groups.validations.map((c) => c.record)),
      required: false,
    });
  }

  // Active policies.
  if ((groups.policies?.length ?? 0) > 0) {
    rendered.push({
      name: "policies",
      markdown: renderPolicies(groups.policies.map((c) => c.record)),
      required: false,
    });
  }

  // Other active tasks summarized.
  if ((groups.otherActiveTasks?.length ?? 0) > 0) {
    rendered.push({
      name: "otherActiveTasks",
      markdown: renderOtherActiveTasks(groups.otherActiveTasks.map((c) => c.record)),
      required: false,
    });
  }

  // Recent safe logs.
  if ((groups.logs?.length ?? 0) > 0) {
    rendered.push({
      name: "logs",
      markdown: renderLogs(groups.logs.map((c) => c.record)),
      required: false,
    });
  }

  // Custom records (low priority unless focus-matched).
  if ((groups.custom?.length ?? 0) > 0) {
    rendered.push({
      name: "custom",
      markdown: renderCustomRecords(groups.custom.map((c) => c.record)),
      required: false,
    });
  }

  // Build header with generation metadata.
  const generatedAt = new Date().toISOString();
  const header = renderHeader({
    projectName: meta.projectName,
    projectId: meta.projectId,
    generatedAt,
    focus: options.focus,
    totalRecords: all.length,
    maxSize,
  });

  const body = fitToBudget(rendered, maxSize);
  const staleSection = renderStaleSection(inactive);

  const parts: string[] = [header, body];
  if (staleSection) {
    parts.push(staleSection);
  }

  return { markdown: parts.join("\n\n").trim() + "\n" };
}

// -----------------------------------------------------------------------------
// Classification
// -----------------------------------------------------------------------------

function classifyActiveRecord(record: AnyRecord): string {
  switch (record.type) {
    case "task":
      return "otherActiveTasks";
    case "blocker":
      return "blockers";
    case "decision":
      return "decisions";
    case "handoff":
      return record.status === "latest" ? "latestHandoff" : "stale";
    case "validation":
      return "validations";
    case "policy":
      return "policies";
    case "log":
      return "logs";
    case "custom":
      return "custom";
    default:
      return "otherActiveTasks";
  }
}

function statusRank(status: string): number {
  // Lower = more relevant / current.
  switch (status) {
    case "active":
    case "blocked":
    case "latest":
    case "open":
    case "accepted":
      return 1;
    case "proposed":
    case "passed":
    case "failed":
    case "inconclusive":
    case "recorded":
      return 2;
    case "advisory":
      return 3;
    case "required":
      return 2;
    default:
      return 5;
  }
}

// -----------------------------------------------------------------------------
// Selection and grouping
// -----------------------------------------------------------------------------

function selectRecords(active: ClassifiedRecord[], focus: string): ClassifiedRecord[] {
  // Sort tasks to pick the primary one: focus match first, then updated_at desc,
  // then id asc. Other active/blocked tasks stay summarized.
  const tasks = active
    .filter((c) => c.record.type === "task")
    .sort(compareRecords);

  let primaryTask: ClassifiedRecord | null = null;
  if (tasks.length > 0) {
    if (focus) {
      const focused = tasks.find((c) => c.focusMatched);
      primaryTask = focused ?? tasks[0]!;
    } else {
      primaryTask = tasks[0]!;
    }
  }

  const latestHandoff = active
    .filter((c) => c.record.type === "handoff" && c.record.status === "latest")
    .sort(compareRecords)[0] ?? null;

  const selected: ClassifiedRecord[] = [];

  for (const c of active) {
    if (c.record.type === "task") {
      if (primaryTask && c.record.id === primaryTask.record.id) {
        selected.push({ ...c, group: "primaryTask" });
      } else {
        selected.push(c);
      }
      continue;
    }

    if (c.record.type === "handoff") {
      if (latestHandoff && c.record.id === latestHandoff.record.id) {
        selected.push({ ...c, group: "latestHandoff" });
      }
      // Non-latest handoffs are already filtered by inactive status handling.
      continue;
    }

    selected.push(c);
  }

  return selected.sort((a, b) => {
    const groupDiff = GROUP_PRIORITY[a.group] - GROUP_PRIORITY[b.group];
    if (groupDiff !== 0) return groupDiff;
    return compareRecords(a, b);
  });
}

function compareRecords(a: ClassifiedRecord, b: ClassifiedRecord): number {
  const relevanceDiff = a.statusRelevance - b.statusRelevance;
  if (relevanceDiff !== 0) return relevanceDiff;
  if (a.record.updated_at > b.record.updated_at) return -1;
  if (a.record.updated_at < b.record.updated_at) return 1;
  return a.record.id.localeCompare(b.record.id);
}

function groupByPriority(selected: ClassifiedRecord[]): Record<string, ClassifiedRecord[]> {
  const groups: Record<string, ClassifiedRecord[]> = {};
  for (const c of selected) {
    groups[c.group] ??= [];
    groups[c.group].push(c);
  }
  return groups;
}

// -----------------------------------------------------------------------------
// Focus matching
// -----------------------------------------------------------------------------

function focusMatches(record: AnyRecord, focus: string): boolean {
  const haystack = extractSearchableText(record).toLowerCase();
  return haystack.includes(focus);
}

function extractSearchableText(record: AnyRecord): string {
  const parts: string[] = [
    record.title,
    record.summary ?? "",
    record.status,
    record.tags.join(" "),
    ...(record.refs.files ?? []),
    ...(record.refs.commits ?? []),
    ...(record.refs.branches ?? []),
  ];

  const payload = record as unknown as Record<string, unknown>;
  switch (record.type) {
    case "task":
      parts.push(stringify(payload.goal));
      parts.push(...((payload.steps as string[] | undefined) ?? []));
      parts.push(stringify(payload.next));
      break;
    case "decision":
      parts.push(stringify(payload.decision));
      parts.push(stringify(payload.rationale));
      parts.push(...((payload.alternatives_considered as string[] | undefined) ?? []));
      break;
    case "blocker":
      parts.push(stringify(payload.blocker));
      parts.push(stringify(payload.workaround));
      break;
    case "handoff":
      parts.push(stringify(payload.context));
      parts.push(stringify(payload.state));
      parts.push(stringify(payload.next));
      parts.push(...((payload.open_questions as string[] | undefined) ?? []));
      parts.push(...((payload.completed_this_session as string[] | undefined) ?? []));
      break;
    case "log":
      parts.push(stringify(payload.command));
      parts.push(stringify(payload.summary));
      parts.push(stringify(payload.safe_excerpt));
      break;
    case "validation":
      parts.push(stringify(payload.check));
      parts.push(stringify(payload.summary));
      break;
    case "policy":
      parts.push(stringify(payload.rule));
      break;
    case "custom":
      parts.push(stringify(payload.kind));
      parts.push(stringify(payload.body));
      break;
  }

  return parts.join(" ");
}

function stringify(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(stringify).join(" ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// -----------------------------------------------------------------------------
// Rendering
// -----------------------------------------------------------------------------

interface HeaderMeta {
  projectName: string;
  projectId: string;
  generatedAt: string;
  focus?: string;
  totalRecords: number;
  maxSize: number;
}

function renderHeader(meta: HeaderMeta): string {
  const lines: string[] = [
    `# Zentext context — ${meta.projectName}`,
    `Generated: ${meta.generatedAt} | focus: ${meta.focus ?? "none"} | from: ${meta.totalRecords} records | budget: ${meta.maxSize} chars`,
    "",
    `> Point-in-time snapshot. Live memory is at ~/.zentext/projects/${meta.projectId}/store.sqlite`,
  ];
  return lines.join("\n");
}

function renderPrimaryTask(record: AnyRecord): string {
  const r = record as unknown as Record<string, unknown>;
  const lines: string[] = [
    "## Active task",
    `- ${record.title} (${record.status})`,
  ];
  if (r.goal) lines.push(`- Goal: ${r.goal}`);
  if (r.next) lines.push(`- Next: ${r.next}`);
  if (record.summary) lines.push(`- Summary: ${record.summary}`);
  lines.push(`- Refs: ${renderRefs(record.refs)}`);
  return lines.join("\n");
}

function renderBlockers(records: AnyRecord[]): string {
  const lines: string[] = [`## Blockers (${records.length})`];
  for (const record of records) {
    const r = record as unknown as Record<string, unknown>;
    const severity = r.severity ? `[${r.severity}] ` : "";
    lines.push(`- ${severity}${record.title} — ${record.summary ?? "no summary"}`);
    if (r.workaround) {
      lines.push(`  - Workaround: ${r.workaround}`);
    }
  }
  return lines.join("\n");
}

function renderDecisions(records: AnyRecord[]): string {
  const lines: string[] = [`## Decisions (${records.length})`];
  for (const record of records) {
    const r = record as unknown as Record<string, unknown>;
    lines.push(`- ${record.title} (${record.status})`);
    if (r.decision) lines.push(`  - Decision: ${r.decision}`);
    if (r.rationale) lines.push(`  - Rationale: ${r.rationale}`);
    const alternatives = r.alternatives_considered as string[] | undefined;
    if (alternatives && alternatives.length > 0) {
      lines.push(`  - Rejected alternatives: ${alternatives.join(", ")}`);
    }
  }
  return lines.join("\n");
}

function renderLatestHandoff(record: AnyRecord): string {
  const r = record as unknown as Record<string, unknown>;
  const lines: string[] = [
    "## Latest handoff",
    `- ${record.title} (${record.status}) — ${record.id}`,
    `- From: ${r.from ?? "unknown"} to ${r.to ?? "unknown"} at ${formatTimestamp(record.updated_at)}`,
  ];
  if (r.context) lines.push(`- Context: ${r.context}`);
  if (r.state) lines.push(`- State: ${r.state}`);
  if (r.next) lines.push(`- Next: ${r.next}`);
  const questions = r.open_questions as string[] | undefined;
  if (questions && questions.length > 0) {
    lines.push(`- Open questions: ${questions.join("; ")}`);
  }
  const completed = r.completed_this_session as string[] | undefined;
  if (completed && completed.length > 0) {
    lines.push(`- Completed this session: ${completed.join("; ")}`);
  }
  return lines.join("\n");
}

function renderValidations(records: AnyRecord[]): string {
  const lines: string[] = [`## Validation state (${records.length})`];
  for (const record of records) {
    const r = record as unknown as Record<string, unknown>;
    const check = r.check ?? record.title;
    const result = r.result ?? record.status;
    const summary = record.summary ? ` — ${record.summary}` : "";
    const runAt = r.run_at ? ` (run ${r.run_at})` : "";
    lines.push(`- ${check}: ${result}${summary}${runAt}`);
  }
  return lines.join("\n");
}

function renderPolicies(records: AnyRecord[]): string {
  const lines: string[] = [`## Active policies (${records.length})`];
  for (const record of records) {
    const r = record as unknown as Record<string, unknown>;
    const scope = r.scope ?? "project";
    const enforcement = r.enforcement ?? "advisory";
    lines.push(`- ${record.title} (${scope}, ${enforcement})`);
    if (r.rule) lines.push(`  - Rule: ${r.rule}`);
  }
  return lines.join("\n");
}

function renderOtherActiveTasks(records: AnyRecord[]): string {
  const lines: string[] = [`## Other active tasks (${records.length})`];
  for (const record of records) {
    const r = record as unknown as Record<string, unknown>;
    const next = r.next ? ` — Next: ${r.next}` : "";
    lines.push(`- ${record.title} (${record.status})${next}`);
  }
  return lines.join("\n");
}

function renderLogs(records: AnyRecord[]): string {
  const lines: string[] = [`## Recent logs (${records.length})`];
  for (const record of records) {
    const r = record as unknown as Record<string, unknown>;
    const command = r.command ?? "action";
    const exitCode = r.exit_code !== undefined ? ` (exit ${r.exit_code})` : "";
    lines.push(`- ${command}${exitCode}: ${record.summary ?? "no summary"}`);
  }
  return lines.join("\n");
}

function renderCustomRecords(records: AnyRecord[]): string {
  const lines: string[] = [`## Custom notes (${records.length})`];
  for (const record of records) {
    const r = record as unknown as Record<string, unknown>;
    lines.push(`- ${record.title} (${r.kind ?? "custom"})`);
    if (record.summary) lines.push(`  - ${record.summary}`);
  }
  return lines.join("\n");
}

function renderStaleSection(_inactive: ClassifiedRecord[]): string | null {
  // Phase 3 intentionally does not surface a stale-records section.
  // Status-based inactive records are already excluded from current-truth sections,
  // and age-based/manual staleness belongs in the future audit/staleness phase.
  return null;
}

function renderRefs(refs: { files?: string[]; commits?: string[]; branches?: string[] }): string {
  const parts: string[] = [];
  if (refs.files && refs.files.length > 0) parts.push(`files: ${refs.files.join(", ")}`);
  if (refs.commits && refs.commits.length > 0) parts.push(`commits: ${refs.commits.join(", ")}`);
  if (refs.branches && refs.branches.length > 0) parts.push(`branches: ${refs.branches.join(", ")}`);
  return parts.length > 0 ? parts.join(" | ") : "(none)";
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toISOString();
}

// -----------------------------------------------------------------------------
// Size-budget enforcement
// -----------------------------------------------------------------------------

interface RenderedSection {
  name: string;
  markdown: string;
  required: boolean;
}

function fitToBudget(sections: RenderedSection[], maxSize: number): string {
  // The header is not counted toward the section budget; sections consume the
  // bulk of the payload.
  const working = sections.filter((s) => s.markdown.length > 0);

  let total = working.reduce((sum, s) => sum + s.markdown.length, 0);
  if (total <= maxSize) {
    return working.map((s) => s.markdown).join("\n\n");
  }

  const omitted: string[] = [];
  // Drop lowest-priority non-required sections first.
  const dropOrder = ["custom", "logs", "otherActiveTasks", "policies", "validations", "decisions", "latestHandoff"];
  for (const name of dropOrder) {
    if (total <= maxSize) break;
    const idx = working.findIndex((s) => s.name === name);
    if (idx === -1) continue;
    const removed = working.splice(idx, 1)[0]!;
    omitted.push(sectionLabel(removed.name));
    total -= removed.markdown.length;
  }

  // If still over budget after dropping optional sections, summarize remaining
  // non-required sections rather than dropping them.
  if (total > maxSize) {
    for (let i = working.length - 1; i >= 0; i--) {
      if (total <= maxSize) break;
      const s = working[i]!;
      if (s.required) continue;
      const originalLength = s.markdown.length;
      s.markdown = summarizeSection(s);
      total -= originalLength - s.markdown.length;
    }
  }

  const body = working.map((s) => s.markdown).join("\n\n");
  if (omitted.length === 0) return body;

  const notice = [
    "## Omitted context notice",
    `Lower-priority sections were dropped to stay within the ${maxSize}-character budget: ${omitted.join(", ")}.`,
  ].join("\n");

  // Never let the notice itself push the payload past the budget. If mandatory
  // content already exceeds the budget, return the body as-is rather than adding noise.
  if (body.length + notice.length + 2 > maxSize) {
    return body;
  }

  return [body, notice].join("\n\n");
}

function sectionLabel(name: string): string {
  const labels: Record<string, string> = {
    primaryTask: "active task",
    blockers: "blockers",
    latestHandoff: "latest handoff",
    decisions: "decisions",
    validations: "validations",
    policies: "policies",
    otherActiveTasks: "other active tasks",
    logs: "logs",
    custom: "custom notes",
  };
  return labels[name] ?? name;
}

function summarizeSection(section: RenderedSection): string {
  const lines = section.markdown.split("\n");
  const title = lines[0] ?? `## ${sectionLabel(section.name)}`;
  return [title, "_Content summarized to fit size budget._"].join("\n");
}
