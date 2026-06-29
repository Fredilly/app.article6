import { describe, expect, it } from "@jest/globals";
import { buildCoverageQueue } from "@/lib/coverage/queue";
import { getRuleDisplayMetadata } from "@/lib/coverage/ruleDisplay";

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

  describe("getRuleDisplayMetadata", () => {
    it("uses summary as humanTitle when available (rich format)", () => {
      const meta = getRuleDisplayMetadata({
        id: "Verra.AFOLU.VM0007.v1-8.R-1-0001",
        title: "Verra.AFOLU.VM0007.v1-8.R-1-0001",
        summary: "REDD forest land definition",
        sectionId: "S-1",
        sectionTitle: "Applicability Conditions",
      });
      expect(meta.humanTitle).toBe("REDD forest land definition");
      expect(meta.humanTitle).not.toBe(meta.stableId);
      expect(meta.stableId).toBe("Verra.AFOLU.VM0007.v1-8.R-1-0001");
      expect(meta.sectionId).toBe("S-1");
      expect(meta.sectionTitle).toBe("Applicability Conditions");
    });

    it("falls back to title when summary is missing (plain format)", () => {
      const meta = getRuleDisplayMetadata({
        id: "R-1-0001",
        title: "Forest definition threshold",
        summary: null,
        sectionId: "S-1",
      });
      expect(meta.humanTitle).toBe("Forest definition threshold");
      expect(meta.humanTitle).not.toBe(meta.stableId);
    });

    it("shows 'Unknown rule title' when both summary and title are empty", () => {
      const meta = getRuleDisplayMetadata({
        id: "R-42",
        title: null,
        summary: null,
      });
      expect(meta.humanTitle).toBe("Unknown rule title");
    });

    it("uses refs.primarySection as fallback sectionId", () => {
      const meta = getRuleDisplayMetadata({
        id: "R-1",
        title: "Some rule",
        refs: { primarySection: "S-2", sections: ["S-2", "S-3"] },
      });
      expect(meta.sectionId).toBe("S-2");
      expect(meta.sectionTitle).toBe("");
    });
  });
});
