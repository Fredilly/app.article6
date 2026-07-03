import { describe, expect, test } from "@jest/globals";
import { buildEnviraVm0007FixtureBackedReport } from "@/lib/preverif/enviraVm0007FixtureBackedReport";

describe("buildEnviraVm0007FixtureBackedReport", () => {
  test("uses reviewed fixture truth counts and preserves all 58 VM0007 rows", () => {
    const report = buildEnviraVm0007FixtureBackedReport();

    expect(report.summary.counts.FOUND).toBe(30);
    expect(report.summary.counts.UNCLEAR).toBe(8);
    expect(report.summary.counts.MISSING).toBe(3);
    expect(report.summary.counts["N/A"]).toBe(17);
    expect(report.summary.totalRules).toBe(58);
    expect(report.evidenceMapRows).toHaveLength(58);
  });
});
