import { describe, expect, it } from "@jest/globals";
import { computeKpis, linkedRuleIdsFromPins } from "@/lib/kpis/computeKpis";
import type { EvidencePin } from "@/lib/proofMap/types";

describe("computeKpis", () => {
  it("derives linked rules from persisted pins only", () => {
    const pins: EvidencePin[] = [
      { id: "p1", kind: "note", title: "one", cited_ids: ["R-1", "S-2"], created_at: "2026-01-01T00:00:00Z" },
      { id: "p2", kind: "note", title: "two", cited_ids: ["R-1", "R-2"], created_at: "2026-01-01T00:00:00Z" },
    ];
    expect(linkedRuleIdsFromPins(pins)).toEqual(["R-1", "R-2"]);
  });

  it("computes coverage and selected item count", () => {
    const kpis = computeKpis({
      pins: [{ id: "p1", kind: "note", title: "one", cited_ids: ["R-4"], created_at: "2026-01-01T00:00:00Z" }],
      totalRules: 10,
      selectedEvidenceItemIds: ["item-a", "item-a", "item-b"],
    });
    expect(kpis.linkedRulesCount).toBe(1);
    expect(kpis.coverage?.numerator).toBe(1);
    expect(kpis.coverage?.denominator).toBe(10);
    expect(kpis.itemsCount).toBe(2);
  });

  it("counts namespaced rule ids as linked", () => {
    const pins: EvidencePin[] = [
      {
        id: "p3",
        kind: "note",
        title: "three",
        cited_ids: ["UNFCCC.Forestry.AR-ACM0003.v02-0-R-1-0002"],
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    expect(linkedRuleIdsFromPins(pins)).toEqual(["UNFCCC.Forestry.AR-ACM0003.v02-0-R-1-0002"]);
    expect(computeKpis({ pins, totalRules: 10 }).linkedRulesCount).toBe(1);
  });
});
