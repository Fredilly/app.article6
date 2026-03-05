import { describe, expect, it } from "@jest/globals";
import { shouldShowPairwisePreferenceWidget } from "@/components/verify/PairwisePreferenceWidget";

describe("PairwisePreferenceWidget helpers", () => {
  it("hides when fewer than 2 candidates", () => {
    expect(shouldShowPairwisePreferenceWidget([])).toBe(false);
    expect(
      shouldShowPairwisePreferenceWidget([
        {
          evidenceKey: "e-1",
          title: "Item 1",
        },
      ]),
    ).toBe(false);
  });

  it("shows when at least 2 candidates", () => {
    expect(
      shouldShowPairwisePreferenceWidget([
        { evidenceKey: "e-1", title: "Item 1" },
        { evidenceKey: "e-2", title: "Item 2" },
      ]),
    ).toBe(true);
  });
});
