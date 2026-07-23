import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("M1 cross-platform field-test contract", () => {
  it("validates the honest pre-execution baseline", () => {
    const validator = join(
      process.cwd(),
      "tests/field-tests/m1-cross-platform-continuation/validate.mjs",
    );
    const output = execFileSync(process.execPath, [validator, "--allow-pending"], {
      encoding: "utf8",
    });

    expect(output).toContain("baseline contract is valid");
  });
});
