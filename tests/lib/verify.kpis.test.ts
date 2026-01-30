import { describe, expect, it } from "@jest/globals";
import { deriveRunKpis } from "@/lib/verify/kpis";
import { buildRunSummary } from "@/lib/verify/runState";

describe("deriveRunKpis", () => {
  it("derives counts and coverage from run summary", () => {
    const summary = buildRunSummary({
      stac: { itemIds: ["a", "b", "c"] },
      linkage: { linkedRuleIds: ["R-1", "R-2"] },
      exportState: { snapshotExportedAt: "2026-01-01T00:00:00Z" },
    });

    const kpis = deriveRunKpis(summary, { totalRules: 10 });

    expect(kpis.itemsCount).toBe(3);
    expect(kpis.linkedRulesCount).toBe(2);
    expect(kpis.coverage).toEqual({ numerator: 2, denominator: 10 });
    expect(kpis.snapshotExportedAt).toBe("2026-01-01T00:00:00Z");
  });

  it("omits denominator when total rules is unknown", () => {
    const summary = buildRunSummary({
      stac: { itemIds: ["a"] },
      linkage: { linkedRuleIds: [] },
    });

    const kpis = deriveRunKpis(summary);

    expect(kpis.coverage).toEqual({ numerator: 0 });
  });
});
