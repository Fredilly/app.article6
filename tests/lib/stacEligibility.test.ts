import { isStacEligible, stacEligibilityReason } from "@/lib/verify/stacEligibility";

describe("stacEligibility", () => {
  describe("isStacEligible", () => {
    it("returns true for monitoring tag", () => {
      expect(isStacEligible(["monitoring"])).toBe(true);
    });

    it("returns true for satellite tag", () => {
      expect(isStacEligible(["satellite"])).toBe(true);
    });

    it("returns true for remote-sensing tag", () => {
      expect(isStacEligible(["remote-sensing"])).toBe(true);
    });

    it("returns true when eligible tag is mixed with others", () => {
      expect(isStacEligible(["baseline", "monitoring", "emissions"])).toBe(true);
    });

    it("returns false for non-eligible tags", () => {
      expect(isStacEligible(["baseline", "emissions"])).toBe(false);
    });

    it("returns false for empty tags", () => {
      expect(isStacEligible([])).toBe(false);
    });

    it("is case-insensitive", () => {
      expect(isStacEligible(["Monitoring"])).toBe(true);
      expect(isStacEligible(["REMOTE-SENSING"])).toBe(true);
    });
  });

  describe("stacEligibilityReason", () => {
    it("returns reason for eligible tags", () => {
      const reason = stacEligibilityReason(["monitoring"]);
      expect(reason).toContain("monitoring");
    });

    it("returns null for non-eligible tags", () => {
      expect(stacEligibilityReason(["baseline"])).toBeNull();
    });
  });
});
