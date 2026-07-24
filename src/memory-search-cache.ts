import { createHash } from "node:crypto";

import {
  MEMORY_SEARCH_SCHEMA_VERSION,
  MEMORY_SEARCH_STRATEGY,
  canonicalMemorySearchCacheInput,
  type MemorySearchPage,
  type MemorySearchState,
  type ParsedMemorySearchInput,
} from "./memory-search.js";

export const MEMORY_SEARCH_CACHE_MAX_ENTRIES = 64;
export const MEMORY_SEARCH_CACHE_MAX_BYTES = 4 * 1024 * 1024;
export const MEMORY_SEARCH_CACHE_MAX_TRACKED_PROJECTS = 128;
export const MEMORY_SEARCH_CACHE_KEY_VERSION = 1;

export interface MemorySearchCacheStats {
  hits: number;
  misses: number;
  stores: number;
  evictions: number;
  skipped_oversized: number;
  entries: number;
  bytes: number;
  maximum_entries: number;
  maximum_bytes: number;
  maximum_tracked_projects: number;
}

interface CacheCounters {
  hits: number;
  misses: number;
  stores: number;
  evictions: number;
  skippedOversized: number;
}

interface CacheEntry {
  projectId: string;
  stateFingerprint: string;
  page: MemorySearchPage;
  bytes: number;
}

const entries = new Map<string, CacheEntry>();
const counters = new Map<string, CacheCounters>();
let totalBytes = 0;

function projectCounters(projectId: string): CacheCounters {
  let current = counters.get(projectId);
  if (current) {
    counters.delete(projectId);
    counters.set(projectId, current);
    return current;
  }
  while (counters.size >= MEMORY_SEARCH_CACHE_MAX_TRACKED_PROJECTS) {
    const oldest = counters.keys().next().value as string | undefined;
    if (!oldest) break;
    counters.delete(oldest);
  }
  current = {
    hits: 0,
    misses: 0,
    stores: 0,
    evictions: 0,
    skippedOversized: 0,
  };
  counters.set(projectId, current);
  return current;
}

function deleteEntry(key: string, countEviction: boolean): void {
  const entry = entries.get(key);
  if (!entry) return;
  entries.delete(key);
  totalBytes -= entry.bytes;
  if (countEviction) projectCounters(entry.projectId).evictions += 1;
}

function pageBytes(page: MemorySearchPage): number {
  return Buffer.byteLength(JSON.stringify(page), "utf8");
}

function clonePage(page: MemorySearchPage): MemorySearchPage {
  return structuredClone(page);
}

export function createMemorySearchCacheKey(
  projectId: string,
  state: MemorySearchState,
  input: ParsedMemorySearchInput,
): string {
  const payload = {
    cache_key_version: MEMORY_SEARCH_CACHE_KEY_VERSION,
    project_id: projectId,
    state_fingerprint: state.fingerprint,
    active_task_id: state.active_task_id,
    active_task_revision: state.active_task_revision,
    search_schema_version: MEMORY_SEARCH_SCHEMA_VERSION,
    retrieval_strategy: MEMORY_SEARCH_STRATEGY,
    input: canonicalMemorySearchCacheInput(input),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function getCachedMemorySearch(
  projectId: string,
  key: string,
): MemorySearchPage | null {
  const entry = entries.get(key);
  const stats = projectCounters(projectId);
  if (!entry || entry.projectId !== projectId) {
    stats.misses += 1;
    return null;
  }
  entries.delete(key);
  entries.set(key, entry);
  stats.hits += 1;
  return clonePage(entry.page);
}

export function setCachedMemorySearch(
  projectId: string,
  key: string,
  stateFingerprint: string,
  page: MemorySearchPage,
): void {
  const bytes = pageBytes(page);
  const stats = projectCounters(projectId);
  if (bytes > MEMORY_SEARCH_CACHE_MAX_BYTES) {
    stats.skippedOversized += 1;
    return;
  }

  for (const [existingKey, entry] of entries) {
    if (
      entry.projectId === projectId &&
      entry.stateFingerprint !== stateFingerprint
    ) {
      deleteEntry(existingKey, true);
    }
  }

  deleteEntry(key, false);
  while (
    entries.size >= MEMORY_SEARCH_CACHE_MAX_ENTRIES ||
    totalBytes + bytes > MEMORY_SEARCH_CACHE_MAX_BYTES
  ) {
    const oldest = entries.keys().next().value as string | undefined;
    if (!oldest) break;
    deleteEntry(oldest, true);
  }

  entries.set(key, {
    projectId,
    stateFingerprint,
    page: clonePage(page),
    bytes,
  });
  totalBytes += bytes;
  stats.stores += 1;
}

export function getMemorySearchCacheStats(
  projectId: string,
): MemorySearchCacheStats {
  const stats = projectCounters(projectId);
  let projectEntries = 0;
  let projectBytes = 0;
  for (const entry of entries.values()) {
    if (entry.projectId !== projectId) continue;
    projectEntries += 1;
    projectBytes += entry.bytes;
  }
  return {
    hits: stats.hits,
    misses: stats.misses,
    stores: stats.stores,
    evictions: stats.evictions,
    skipped_oversized: stats.skippedOversized,
    entries: projectEntries,
    bytes: projectBytes,
    maximum_entries: MEMORY_SEARCH_CACHE_MAX_ENTRIES,
    maximum_bytes: MEMORY_SEARCH_CACHE_MAX_BYTES,
    maximum_tracked_projects: MEMORY_SEARCH_CACHE_MAX_TRACKED_PROJECTS,
  };
}

export function resetMemorySearchCache(): void {
  entries.clear();
  counters.clear();
  totalBytes = 0;
}
