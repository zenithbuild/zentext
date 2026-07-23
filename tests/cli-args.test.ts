import { describe, expect, it } from "vitest";

import { parseArgs, repeatedStringFlag, stringFlag } from "../src/cli/args.js";

describe("CLI argument parsing", () => {
  it("preserves one repeatable value as a single-item collection", () => {
    const parsed = parseArgs(["handoff", "create", "--completed", "Read contract"]);
    expect(repeatedStringFlag(parsed.flags, "completed")).toEqual(["Read contract"]);
  });

  it("appends repeated values in invocation order without splitting commas", () => {
    const parsed = parseArgs([
      "handoff",
      "create",
      "--completed",
      "Implemented parser, without rewriting commands",
      "--completed",
      "Added regression test",
      "--files-changed",
      "src/cli/args.ts",
      "--files-changed",
      "tests/cli-args.test.ts",
      "--blockers",
      "Provider unavailable",
      "--blockers",
      "Need clean consumer",
      "--verification",
      "npm run typecheck:test",
      "--verification",
      "npm test -- cli-args",
    ]);

    expect(repeatedStringFlag(parsed.flags, "completed")).toEqual([
      "Implemented parser, without rewriting commands",
      "Added regression test",
    ]);
    expect(repeatedStringFlag(parsed.flags, "files-changed")).toEqual([
      "src/cli/args.ts",
      "tests/cli-args.test.ts",
    ]);
    expect(repeatedStringFlag(parsed.flags, "blockers")).toEqual([
      "Provider unavailable",
      "Need clean consumer",
    ]);
    expect(repeatedStringFlag(parsed.flags, "verification")).toEqual([
      "npm run typecheck:test",
      "npm test -- cli-args",
    ]);
  });

  it("preserves spaces, Unicode, and explicitly empty values", () => {
    const parsed = parseArgs([
      "task",
      "update",
      "--note",
      "First note with spaces",
      "--note",
      "検証済み ✅",
      "--note",
      "",
    ]);

    expect(repeatedStringFlag(parsed.flags, "note")).toEqual([
      "First note with spaces",
      "検証済み ✅",
      "",
    ]);
  });

  it("ignores a missing optional repeatable value under the existing flag policy", () => {
    const parsed = parseArgs(["handoff", "create", "--completed", "--json"]);
    expect(repeatedStringFlag(parsed.flags, "completed")).toEqual([]);
  });

  it("retains the existing last-value behavior for non-repeatable flags", () => {
    const parsed = parseArgs(["task", "create", "--title", "First", "--title", "Second"]);
    expect(stringFlag(parsed.flags, "title")).toBe("Second");
  });
});
