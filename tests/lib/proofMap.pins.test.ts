import { describe, expect, test } from "@jest/globals";
import { buildEvidencePin, dedupeStrings, kindFromCitedId, isRuleLikeId } from "@/lib/proofMap/pins";

describe("proofMap pins", () => {
  test("dedupes cited ids preserving order", () => {
    expect(dedupeStrings(["S-1", "S-1", " R-1 ", "", "S-1"])).toEqual(["S-1", "R-1"]);
  });

  test("buildEvidencePin uses cited ids exactly (deduped)", () => {
    const pin = buildEvidencePin({ title: "Purpose", cited_ids: ["S-1", "S-1", "R-1"], aoi_id: "aoi-1" });
    expect(pin.kind).toBe("note");
    expect(pin.title).toBe("Purpose");
    expect(pin.aoi_id).toBe("aoi-1");
    expect(pin.cited_ids).toEqual(["S-1", "R-1"]);
    expect(typeof pin.id).toBe("string");
    expect(pin.id.length).toBeGreaterThan(5);
  });

  test("kindFromCitedId routes S-* and R-* only", () => {
    expect(kindFromCitedId("S-10")).toBe("section");
    expect(kindFromCitedId("R-1-0001")).toBe("rule");
    expect(kindFromCitedId("UNFCCC.Forestry.AR-ACM0003.v02-0.R-1-0002")).toBe("rule");
    expect(kindFromCitedId("X-1")).toBeNull();
  });

  test("isRuleLikeId accepts namespaced method rule ids", () => {
    expect(isRuleLikeId("R-1")).toBe(true);
    expect(isRuleLikeId("UNFCCC.Forestry.AR-ACM0003.v02-0.R-1-0002")).toBe(true);
    expect(isRuleLikeId("S2A-001")).toBe(false);
  });
});
