import type { StructuredHandoff } from "./handoff.js";

export type HandoffQualityCode =
  | "VAGUE_STOPPING_POINT"
  | "MISSING_VERIFICATION"
  | "MISSING_NEXT_ACTION"
  | "MISSING_COMPLETED_WORK"
  | "CONFLICTING_STATUS"
  | "MISSING_FILE_REFERENCES";

export interface HandoffQualityWarning {
  code: HandoffQualityCode;
  message: string;
  remediation: string;
}

const VAGUE = new Set(["done", "stopped", "continue", "work in progress", "next"]);

export function validateHandoffQuality(
  handoff: StructuredHandoff,
): HandoffQualityWarning[] {
  const warnings: HandoffQualityWarning[] = [];
  if (
    handoff.stopping_point.trim().length < 12 ||
    VAGUE.has(handoff.stopping_point.trim().toLowerCase())
  ) {
    warnings.push({
      code: "VAGUE_STOPPING_POINT",
      message: "The stopping point is too vague for a fresh tool to locate the work.",
      remediation: "Name the last concrete operation, file, symbol, or observed state.",
    });
  }
  if (handoff.verification.length === 0) {
    warnings.push({
      code: "MISSING_VERIFICATION",
      message: "No verification evidence is recorded.",
      remediation: "Record the exact check and its result, or explain why verification is pending.",
    });
  }
  if (
    !["done", "canceled"].includes(handoff.active_task.status) &&
    handoff.next_action.trim().length < 8
  ) {
    warnings.push({
      code: "MISSING_NEXT_ACTION",
      message: "The handoff has no actionable next step.",
      remediation: "Record one exact next action that a fresh tool can begin immediately.",
    });
  }
  if (handoff.completed.length === 0) {
    warnings.push({
      code: "MISSING_COMPLETED_WORK",
      message: "No completed work is recorded.",
      remediation: "List completed work explicitly so the receiving tool does not repeat it.",
    });
  }
  if (
    ["done", "canceled"].includes(handoff.active_task.status) &&
    handoff.next_action.trim().length > 0
  ) {
    warnings.push({
      code: "CONFLICTING_STATUS",
      message: "A completed task still declares a next action.",
      remediation: "Remove the next action or reactivate the task before creating the handoff.",
    });
  }
  const referencedFiles = handoff.references.files ?? [];
  if (handoff.files_changed.length === 0 && referencedFiles.length === 0) {
    warnings.push({
      code: "MISSING_FILE_REFERENCES",
      message: "No changed or inspected file references are recorded.",
      remediation: "Record relevant repository-relative files, or state why the work touched none.",
    });
  }
  return warnings;
}
