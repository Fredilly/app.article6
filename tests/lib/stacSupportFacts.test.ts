import { buildStacSupportFactsState, extractStacSupportFacts } from "@/lib/verify/stacSupportFacts";

describe("extractStacSupportFacts", () => {
  describe("date range with mixed UTC offsets", () => {
    it("sorts by actual instant, not lexicographic order", () => {
      // These would sort incorrectly as strings:
      //   "2024-06-15T08:00:00+05:00" < "2024-06-15T10:00:00Z" < "2024-06-15T12:00:00-05:00"  (string)
      // But as instants:
      //   +05:00 = 03:00 UTC (earliest), Z = 10:00 UTC, -05:00 = 17:00 UTC (latest)
      const result = extractStacSupportFacts([
        { id: "a", datetime: "2024-06-15T12:00:00-05:00" },
        { id: "b", datetime: "2024-06-15T08:00:00+05:00" },
        { id: "c", datetime: "2024-06-15T10:00:00Z" },
      ]);

      expect(result.dateRange).toEqual({
        earliest: "2024-06-15T08:00:00+05:00",
        latest: "2024-06-15T12:00:00-05:00",
      });
    });

    it("handles Z vs +00:00 equivalence correctly", () => {
      const result = extractStacSupportFacts([
        { id: "a", datetime: "2024-01-01T00:00:00+00:00" },
        { id: "b", datetime: "2024-01-01T01:00:00Z" },
      ]);

      expect(result.dateRange).toEqual({
        earliest: "2024-01-01T00:00:00+00:00",
        latest: "2024-01-01T01:00:00Z",
      });
    });

    it("handles negative offsets that shift to next day", () => {
      // 2024-06-15T23:00:00-05:00 = 2024-06-16T04:00:00Z (next day in UTC)
      const result = extractStacSupportFacts([
        { id: "a", datetime: "2024-06-15T23:00:00-05:00" },
        { id: "b", datetime: "2024-06-15T10:00:00Z" },
      ]);

      expect(result.dateRange).toEqual({
        earliest: "2024-06-15T10:00:00Z",
        latest: "2024-06-15T23:00:00-05:00",
      });
    });
  });

  describe("invalid datetimes", () => {
    it("ignores unparseable datetimes for date range", () => {
      const result = extractStacSupportFacts([
        { id: "a", datetime: "not-a-date" },
        { id: "b", datetime: "2024-06-15T10:00:00Z" },
        { id: "c", datetime: "" },
      ]);

      expect(result.dateRange).toEqual({
        earliest: "2024-06-15T10:00:00Z",
        latest: "2024-06-15T10:00:00Z",
      });
    });

    it("returns null when all datetimes are invalid", () => {
      const result = extractStacSupportFacts([
        { id: "a", datetime: "garbage" },
        { id: "b", datetime: "" },
      ]);

      expect(result.dateRange).toBeNull();
    });

    it("returns null when no items have datetimes", () => {
      const result = extractStacSupportFacts([
        { id: "a" },
        { id: "b" },
      ]);

      expect(result.dateRange).toBeNull();
    });
  });

  describe("empty/blocked states", () => {
    it("returns empty summary for empty array", () => {
      const result = extractStacSupportFacts([]);
      expect(result.sceneCount).toBe(0);
      expect(result.dateRange).toBeNull();
      expect(result.facts).toEqual([]);
    });
  });

  describe("buildStacSupportFactsState", () => {
    it("requires an AOI before support facts can be used", () => {
      const result = buildStacSupportFactsState({
        ruleId: "R-1",
        hasAoi: false,
        evidencePins: [],
      });

      expect(result.lookupStatus).toBe("requires_aoi");
      expect(result.lookupMessage).toBe("AOI is required before STAC support facts can be used.");
      expect(result.linkedFacts).toEqual([]);
    });

    it("treats an empty successful search as no results, not failure", () => {
      const result = buildStacSupportFactsState({
        ruleId: "R-1",
        hasAoi: true,
        evidencePins: [],
        itemsById: {},
        runStatus: "ok",
      });

      expect(result.lookupStatus).toBe("no_results");
      expect(result.lookupError).toBeNull();
      expect(result.searchResultCount).toBe(0);
    });

    it("surfaces STAC lookup failures truthfully", () => {
      const result = buildStacSupportFactsState({
        ruleId: "R-1",
        hasAoi: true,
        evidencePins: [],
        runStatus: "error",
        runSummary: "Satellite search failed.",
      });

      expect(result.lookupStatus).toBe("lookup_failed");
      expect(result.lookupError).toBe("Satellite search failed.");
    });

    it("separates linked support facts from available but unlinked STAC results", () => {
      const result = buildStacSupportFactsState({
        ruleId: "R-1",
        hasAoi: true,
        aoiBbox: [0, 0, 2, 2],
        evidencePins: [
          {
            id: "pin-1",
            kind: "note",
            title: "scene-linked",
            itemId: "scene-linked",
            stac_item_ids: ["scene-linked"],
            cited_ids: ["R-1"],
            created_at: "2026-03-25T00:10:00Z",
          },
        ],
        itemsById: {
          "scene-linked": {
            id: "scene-linked",
            bbox: [0, 0, 1, 1],
            collection: "sentinel-2",
            properties: { datetime: "2026-03-25T00:00:00Z", "eo:cloud_cover": 7 },
            links: [{ rel: "self", href: "https://stac.example.test/items/scene-linked" }],
          },
          "scene-unlinked": {
            id: "scene-unlinked",
            bbox: [0, 0, 1, 1],
            collection: "landsat",
            properties: { datetime: "2026-03-26T00:00:00Z" },
          },
        },
        sourceRef: "https://stac.example.test",
        runStatus: "ok",
      });

      expect(result.lookupStatus).toBe("results_available");
      expect(result.linkedFacts).toHaveLength(1);
      expect(result.linkedFacts[0]).toEqual(
        expect.objectContaining({
          id: "scene-linked",
          sourceProvider: "stac.example.test",
          linkedRuleIds: ["R-1"],
        }),
      );
      expect(result.unlinkedFacts.map((fact) => fact.id)).toEqual(["scene-unlinked"]);
      expect(result.availableUnlinkedIds).toEqual(["scene-unlinked"]);
    });
  });
});
