import { describe, expect, it } from "@jest/globals";
import { buildCoverageQueue } from "@/lib/coverage/queue";

describe("coverage queue", () => {
  it("builds a deterministic uncovered queue for large rule sets", () => {
    const rules = Array.from({ length: 50 }, (_, idx) => ({
      id: `R-${idx + 1}`,
      title: `Rule ${idx + 1}`,
      tags: [],
      sectionTitle: idx < 10 ? "Applicability Conditions" : "Project Boundary",
    }));
    const coveredRuleIds = new Set(["R-1", "R-2", "R-50"]);

    const summary = buildCoverageQueue({ rules, coveredRuleIds, limit: 10 });

    expect(summary.total).toBe(50);
    expect(summary.covered).toBe(3);
    expect(summary.uncovered).toBe(47);
    expect(summary.topUncovered).toHaveLength(10);
    expect(summary.topUncovered[0].id).toBe("R-3");
  });

  it("preserves sectionTitle on uncovered rules", () => {
    const rules = [
      { id: "R-1", title: "REDD forest land definition", tags: [], sectionTitle: "Applicability Conditions" },
      { id: "R-2", title: "REDD baseline deforestation category", tags: [], sectionTitle: "Applicability Conditions" },
      { id: "R-3", title: "Geographic boundary definition", tags: [], sectionTitle: "Project Boundary" },
    ];
    const coveredRuleIds = new Set<string>();

    const summary = buildCoverageQueue({ rules, coveredRuleIds, limit: 10 });

    expect(summary.topUncovered[0].sectionTitle).toBe("Applicability Conditions");
    expect(summary.topUncovered[2].sectionTitle).toBe("Project Boundary");
  });
});
