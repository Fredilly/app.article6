import deriveLinksFromProperties from "@/lib/proofMap/deriveLinksFromProperties";

describe("deriveLinksFromProperties", () => {
  test("derives rule/section ids from common fields", () => {
    const out = deriveLinksFromProperties({
      rule_ids: ["R-1", "R-2#anchor", "R-1"],
      sectionIds: ["S-10", "S-11#x"],
      cited_ids: ["S-12", "R-3"],
    });

    expect(out.ruleIds).toEqual(["R-1", "R-2", "R-3"]);
    expect(out.sectionIds).toEqual(["S-10", "S-11", "S-12"]);
  });
});

