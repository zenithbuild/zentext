import { describe, it, expect } from "vitest";
import {
  normalizeGitUrl,
  deriveProjectId,
  deriveProjectName,
  getGitOriginUrl,
} from "../src/store/project-id.js";
import { resolve } from "node:path";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("normalizeGitUrl", () => {
  it("strips trailing .git", () => {
    expect(normalizeGitUrl("https://github.com/owner/repo.git")).toBe(
      "github.com/owner/repo",
    );
  });

  it("normalizes SSH format to owner/repo", () => {
    expect(normalizeGitUrl("git@github.com:owner/repo.git")).toBe(
      "github.com/owner/repo",
    );
  });

  it("drops credentials from HTTPS URL", () => {
    expect(
      normalizeGitUrl("https://user:token@github.com/owner/repo"),
    ).toBe("github.com/owner/repo");
  });

  it("lowercases host", () => {
    expect(normalizeGitUrl("https://GitHub.com/Owner/Repo")).toBe(
      "github.com/owner/repo",
    );
  });

  it("SSH and HTTPS variants normalize to the same value", () => {
    const ssh = normalizeGitUrl("git@github.com:owner/repo.git");
    const https = normalizeGitUrl("https://github.com/owner/repo.git");
    expect(ssh).toBe(https);
  });
});

describe("getGitOriginUrl", () => {
  it("returns origin URL for the zentext repo", () => {
    const url = getGitOriginUrl(process.cwd());
    expect(url).not.toBeNull();
    expect(url!.length).toBeGreaterThan(0);
  });

  it("returns null for a non-git directory", () => {
    const url = getGitOriginUrl("/tmp");
    expect(url).toBeNull();
  });
});

describe("deriveProjectId", () => {
  it("returns a stable 16-char hex string", () => {
    const id = deriveProjectId(process.cwd());
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is stable for the same directory", () => {
    const id1 = deriveProjectId(process.cwd());
    const id2 = deriveProjectId(process.cwd());
    expect(id1).toBe(id2);
  });

  it("is different for different directories", () => {
    const id1 = deriveProjectId(process.cwd());
    const id2 = deriveProjectId(resolve("/tmp"));
    expect(id1).not.toBe(id2);
  });

  it("does not include branch information in the id", () => {
    // project-id is based on origin URL or path, not branch
    const id = deriveProjectId(process.cwd());
    // The id is a hash, so it shouldn't contain branch names as readable text
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });

  it("normalizes filesystem aliases when no Git origin exists", () => {
    const root = mkdtempSync(join(tmpdir(), "zentext-project-id-"));
    const alias = `${root}-alias`;
    try {
      symlinkSync(root, alias);
      expect(deriveProjectId(alias)).toBe(deriveProjectId(root));
    } finally {
      rmSync(alias, { force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("deriveProjectName", () => {
  it("returns owner/repo for a git repo with origin", () => {
    const name = deriveProjectName(process.cwd());
    // Should be like "zenithbuild/zentext"
    expect(name).toContain("/");
  });

  it("returns basename for a non-git directory", () => {
    const name = deriveProjectName("/tmp");
    expect(name).toBe("tmp");
  });
});
