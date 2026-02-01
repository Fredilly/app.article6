import { describe, expect, it } from "@jest/globals";
import { buildCoverageQueue } from "@/lib/coverage/queue";

describe("coverage queue", () => {
  it("builds a deterministic uncovered queue for large rule sets", () => {
    const rules = Array.from({ length: 50 }, (_, idx) => ({
      id: `R-${idx + 1}`,
      title: `Rule ${idx + 1}`,
      tags: [],
    }));
    const coveredRuleIds = new Set(["R-1", "R-2", "R-50"]);

    const summary = buildCoverageQueue({ rules, coveredRuleIds, limit: 10 });

    expect(summary.total).toBe(50);
    expect(summary.covered).toBe(3);
    expect(summary.uncovered).toBe(47);
    expect(summary.topUncovered).toHaveLength(10);
    expect(summary.topUncovered[0].id).toBe("R-3");
  });
});
