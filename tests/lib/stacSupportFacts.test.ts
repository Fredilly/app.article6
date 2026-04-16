import { extractStacSupportFacts } from "@/lib/verify/stacSupportFacts";

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
});
