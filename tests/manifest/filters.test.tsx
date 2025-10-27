import { describe, expect, it } from "@jest/globals";

import { parseTags, serializeFilters } from "@/app/manifest/_state/useManifestFilters";

describe("manifest filter helpers", () => {
  it("parses comma-separated tags into a unique, lowercase list", () => {
    expect(parseTags("calc, eligibility, Calc , , baseline")).toEqual([
      "calc",
      "eligibility",
      "baseline",
    ]);
  });

  it("serializes filters while omitting empty values", () => {
    expect(
      serializeFilters({
        search: "",
        tags: [],
      }),
    ).toBe("");

    expect(
      serializeFilters({
        search: " baseline ",
        tags: ["calc", "eligibility"],
      }),
    ).toBe("q=baseline&tags=calc%2Celigibility");
  });
});
