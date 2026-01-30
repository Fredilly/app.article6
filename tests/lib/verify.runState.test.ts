import { describe, expect, it } from "@jest/globals";
import { addLinkedRuleId, buildRunSummary, parseLinkedRuleId } from "@/lib/verify/runState";

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

describe("parseLinkedRuleId", () => {
  it("prefers rule param and parses hash rules", () => {
    expect(parseLinkedRuleId({ ruleParam: "R-100", hash: "#r-R-2" })).toBe("R-100");
    expect(parseLinkedRuleId({ ruleParam: null, hash: "#r-R-2" })).toBe("R-2");
    expect(parseLinkedRuleId({ ruleParam: null, hash: "#R-3" })).toBe("R-3");
    expect(parseLinkedRuleId({ ruleParam: null, hash: "#s-S-1" })).toBeNull();
  });
});
