import { describe, expect, it } from "@jest/globals";
import { coalesceCoverageRecords, validateCoverageRecords } from "@/lib/coverage/validate";
import type { CoverageRecord } from "@/lib/coverage/schema";

describe("coverage validation", () => {
  it("coalesces duplicate ruleIds deterministically", () => {
    const records: CoverageRecord[] = [
      {
        method_code: "M1",
        version: "v1",
        ruleId: "R-2",
        status: "weak",
        updated_at: "2024-01-01T00:00:00Z",
      },
      {
        method_code: "M1",
        version: "v1",
        ruleId: "R-1",
        status: "weak",
        updated_at: "2024-01-01T00:00:00Z",
      },
      {
        method_code: "M1",
        version: "v1",
        ruleId: "R-1",
        status: "covered",
        updated_at: "2023-01-01T00:00:00Z",
      },
      {
        method_code: "M1",
        version: "v1",
        ruleId: "R-2",
        status: "weak",
        updated_at: "2024-02-01T00:00:00Z",
      },
    ];

    const coalesced = coalesceCoverageRecords(records);
    expect(coalesced).toHaveLength(2);
    expect(coalesced[0]).toMatchObject({ ruleId: "R-1", status: "covered" });
    expect(coalesced[1]).toMatchObject({ ruleId: "R-2", status: "weak", updated_at: "2024-02-01T00:00:00Z" });
  });

  it("reports unknown ruleIds", () => {
    const input: CoverageRecord[] = [
      { method_code: "M1", version: "v1", ruleId: "R-1", status: "covered" },
      { method_code: "M1", version: "v1", ruleId: "R-3", status: "uncovered" },
    ];

    const result = validateCoverageRecords(input, new Set(["R-1", "R-2"]));
    expect(result.errors).toContain("record[1]: unknown ruleId R-3");
    expect(result.records).toHaveLength(1);
  });
});
