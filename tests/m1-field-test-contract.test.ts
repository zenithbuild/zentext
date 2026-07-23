import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("M1 cross-platform field-test contract", () => {
  it("validates the completed three-tool evidence", () => {
    const validator = join(
      process.cwd(),
      "tests/field-tests/m1-cross-platform-continuation/validate.mjs",
    );
    const output = execFileSync(process.execPath, [validator], {
      encoding: "utf8",
    });

    expect(output).toContain("field test passed with 3 isolated participants");
  });
});
