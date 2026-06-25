import { describe, expect, it } from "@jest/globals";
import fs from "fs";
import path from "path";
import { classifyMethodologyRoles } from "@/lib/chat/methodologyRoleClassifier";

describe("CCB validation report fixture", () => {
  it("classifyMethodologyRoles must NOT promote VM0007 to primary for CCB report text", () => {
    const text = fs.readFileSync(
      path.join(process.cwd(), "tests/fixtures/quick-check/ccb-validation-report-extracted.txt"),
      "utf-8",
    );
    const result = classifyMethodologyRoles(text);
    expect(result.primaryMethodology).toBeNull();
    expect(result.referencedMethods.some((m) => m.id === "VM0007")).toBe(true);
  });
});
