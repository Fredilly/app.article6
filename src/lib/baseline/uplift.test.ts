import { describe, expect, it } from "@jest/globals";
import type { BaselineKey } from "@/lib/baseline/baselineStore";
import { computeUplift, isComparable } from "@/lib/baseline/uplift";

const baseProv: BaselineKey = {
  methodId: "AR-ACM0003",
  versionId: "v02-0",
  harnessVersion: "abc123",
  datasetHash: "hash-1",
};

describe("baseline uplift", () => {
  it("marks provenance as comparable when fields match", () => {
    const result = isComparable(baseProv, { ...baseProv });
    expect(result.ok).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it("returns explicit reasons when provenance differs", () => {
    const result = isComparable(baseProv, { ...baseProv, datasetHash: "hash-2" });
    expect(result.ok).toBe(false);
    expect(result.reasons).toContain("dataset hash changed");
  });

  it("requires non-empty dataset hash for comparability", () => {
    const result = isComparable(baseProv, { ...baseProv, datasetHash: "" });
    expect(result.ok).toBe(false);
    expect(result.reasons).toContain("dataset hash missing");
  });

  it("computes KPI deltas", () => {
    const uplift = computeUplift(
      { itemsCount: 10, linkedRulesCount: 3, coverage: { numerator: 3, denominator: 10 } },
      { itemsCount: 12, linkedRulesCount: 5, coverage: { numerator: 5, denominator: 10 } },
    );
    expect(uplift.coverageDeltaPct).toBeCloseTo(20);
    expect(uplift.linkedRulesDelta).toBe(2);
    expect(uplift.itemsDelta).toBe(2);
  });
});
