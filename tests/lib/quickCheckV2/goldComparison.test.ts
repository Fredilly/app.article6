import { describe, expect, it } from "@jest/globals";
import {
  buildComparableQuickCheckRecord,
  normalizeExpectedQuickCheckGoldRecord,
} from "./goldComparison";

describe("Quick Check v2 gold answer comparison", () => {
  it("treats one terminal period as equivalent in answers only", () => {
    const runtime = buildComparableQuickCheckRecord(
      {
        checkName: "leakage",
        status: "FOUND",
        answer: "Leakage is not applicable.",
        evidence: {
          sourceType: "exact_section",
          quote: "Leakage is not applicable.",
          page: 17,
          sectionHeading: "Leakage",
          sectionPath: ["1", "1.19"],
          spanId: "synthetic-doc:p17:b1:leakage",
        },
        evidenceStack: [],
      },
      {},
    );
    const gold = normalizeExpectedQuickCheckGoldRecord({
      ...runtime,
      expectedAnswer: "Leakage is not applicable",
    });

    expect(runtime.expectedAnswer).toBe("Leakage is not applicable");
    expect(gold.expectedAnswer).toBe("Leakage is not applicable");
    expect(runtime.goldQuote).toBe("Leakage is not applicable.");
    expect(gold.goldQuote).toBe("Leakage is not applicable.");
  });

  it("does not remove substantive punctuation from answers", () => {
    const gold = normalizeExpectedQuickCheckGoldRecord({
      checkName: "leakage",
      expectedStatus: "FOUND",
      expectedAnswer: "Pathway A; pathway B",
      goldQuote: null,
      page: null,
      sectionHeading: null,
      sectionPath: [],
      spanId: null,
      sourceType: null,
    });

    expect(gold.expectedAnswer).toBe("Pathway A; pathway B");
  });
});
