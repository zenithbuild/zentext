/**
 * Project ID derivation.
 *
 * Per docs/implementation/tech-stack-decision.md and
 * docs/implementation/data-model-and-store.md:
 *
 * - If a git remote `origin` exists: project-id = hash(normalize(origin URL))
 * - Else: project-id = hash(absolute project path)
 * - Human-readable project name stored separately from the stable id.
 * - Branch/worktree is NOT part of project-id in Stage 1.
 */

import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

/**
 * Normalize a git remote URL for stable hashing.
 *
 * - Strip trailing `.git`
 * - Lowercase scheme/host
 * - Drop credentials from the URL
 * - Normalize SSH/HTTPS variants to the same owner/repo shape
 */
export function normalizeGitUrl(url: string): string {
  let normalized = url.trim();

  // Strip trailing .git
  normalized = normalized.replace(/\.git$/, "");

  // SSH format: git@github.com:owner/repo → github.com/owner/repo
  const sshMatch = normalized.match(/^git@([^:]+):(.+)$/);
  if (sshMatch) {
    normalized = `${sshMatch[1].toLowerCase()}/${sshMatch[2]}`;
  } else {
    // HTTPS format: https://github.com/owner/repo or
    //              https://user:token@github.com/owner/repo
    try {
      const parsed = new URL(normalized);
      normalized = `${parsed.host?.toLowerCase() ?? ""}${parsed.pathname}`;
    } catch {
      // If URL parsing fails, just lowercase the whole thing
      normalized = normalized.toLowerCase();
    }
  }

  // Lowercase for case-insensitive matching
  normalized = normalized.toLowerCase();

  // Remove trailing slash
  normalized = normalized.replace(/\/$/, "");

  return normalized;
}

/**
 * Get the git remote origin URL for a directory, or null if not a git repo
 * or no origin remote is configured.
 */
export function getGitOriginUrl(cwd: string): string | null {
  try {
    const url = execSync("git remote get-url origin", {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return url || null;
  } catch {
    return null;
  }
}

/**
 * Derive a stable project ID from a working directory.
 *
 * - If git remote `origin` exists: SHA-256 hash of normalized origin URL
 * - Else: SHA-256 hash of resolved absolute path
 *
 * Returns a hex string (first 16 characters of SHA-256 — enough for
 * collision resistance in a local single-user store).
 */
export function deriveProjectId(cwd: string): string {
  const originUrl = getGitOriginUrl(cwd);

  if (originUrl) {
    const normalized = normalizeGitUrl(originUrl);
    return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
  }

  const absPath = resolve(cwd);
  return createHash("sha256").update(absPath).digest("hex").slice(0, 16);
}

/**
 * Derive a human-readable project name from a working directory.
 *
 * - If git remote origin exists: extract owner/repo from normalized URL
 * - Else: use the directory basename
 */
export function deriveProjectName(cwd: string): string {
  const originUrl = getGitOriginUrl(cwd);

  if (originUrl) {
    const normalized = normalizeGitUrl(originUrl);
    // normalized is like "github.com/owner/repo"
    const parts = normalized.split("/");
    if (parts.length >= 3) {
      return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
    }
    return parts[parts.length - 1] ?? "unknown";
  }

  const absPath = resolve(cwd);
  const basename = absPath.split("/").pop();
  return basename ?? "unknown";
}
