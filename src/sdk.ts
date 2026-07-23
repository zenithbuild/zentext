import {
  openMemoryStore,
  type HandoffValidationResult,
  type MemoryStore,
  type ProgressResult,
} from "./memory-interface.js";
import type {
  MemoryQueryInput,
  OpenProjectInput,
  RecordProgressInput,
  TaskUpdateInput,
} from "./schemas.js";
import type { ContinuationView } from "./continuation.js";
import type { AnyRecord, TaskRecord } from "./types/records.js";

export type ZentextProject = MemoryStore;

export async function openProject(
  input: OpenProjectInput,
): Promise<ZentextProject> {
  return openMemoryStore(input);
}

async function withProject<T>(
  project: OpenProjectInput,
  operation: (opened: ZentextProject) => Promise<T>,
): Promise<T> {
  const opened = await openProject(project);
  try {
    return await operation(opened);
  } finally {
    opened.close();
  }
}

export async function getContinuation(
  project: OpenProjectInput,
): Promise<ContinuationView> {
  return withProject(project, (opened) => opened.getContinuation());
}

export async function getActiveTask(
  project: OpenProjectInput,
): Promise<TaskRecord | null> {
  return withProject(project, (opened) => opened.getActiveTask());
}

export async function validateHandoff(
  project: OpenProjectInput,
  handoffId?: string,
): Promise<HandoffValidationResult> {
  return withProject(project, (opened) => opened.validateHandoff(handoffId));
}

export async function recordProgress(
  project: OpenProjectInput,
  input: RecordProgressInput,
): Promise<ProgressResult> {
  return withProject(project, (opened) => opened.recordProgress(input));
}

export async function updateTask(
  project: OpenProjectInput,
  input: TaskUpdateInput,
): Promise<TaskRecord> {
  return withProject(project, (opened) => opened.updateTask(input));
}

export async function queryMemory(
  project: OpenProjectInput,
  input: MemoryQueryInput,
): Promise<AnyRecord[]> {
  return withProject(project, (opened) => opened.queryMemory(input));
}
