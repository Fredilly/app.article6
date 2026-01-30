import { describe, expect, it } from "@jest/globals";
import { addLinkedRuleId, buildRunSummary } from "@/lib/verify/runState";

describe("buildRunSummary", () => {
  it("dedupes and sorts item and rule ids", () => {
    const summary = buildRunSummary({
      stac: { itemIds: ["b", "a", "a", "c"] },
      linkage: { linkedRuleIds: ["r2", "r1", "r1"] },
    });

    expect(summary.stac.itemIds).toEqual(["a", "b", "c"]);
    expect(summary.linkage.linkedRuleIds).toEqual(["r1", "r2"]);
  });
});

describe("addLinkedRuleId", () => {
  it("adds new active rule ids once", () => {
    const first = addLinkedRuleId([], "R-1");
    const second = addLinkedRuleId(first, "R-2");
    const duplicate = addLinkedRuleId(second, "R-2");

    expect(first).toEqual(["R-1"]);
    expect(second).toEqual(["R-1", "R-2"]);
    expect(duplicate).toEqual(["R-1", "R-2"]);
  });
});
