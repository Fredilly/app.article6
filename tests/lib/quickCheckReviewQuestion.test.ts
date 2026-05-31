import { describe, expect, it } from "@jest/globals";
import {
  buildReviewQuestionResult,
  classifyReviewArea,
  detectReviewPath,
  resolveReviewSections,
  reviewAreaLabel,
  type ReviewArea,
} from "@/lib/chat/quickCheckReviewQuestion";

describe("detectReviewPath", () => {
  it("routes 'Does this PDD support additionality under VT0001?' to review_question_answering", () => {
    expect(detectReviewPath("Does this PDD support additionality under VT0001?")).toBe("review_question_answering");
  });

  it("routes 'Does this PDD define the project area, leakage belt, and reference region?' to review_question_answering", () => {
    expect(detectReviewPath("Does this PDD define the project area, leakage belt, and reference region?")).toBe("review_question_answering");
  });

  it("routes 'Does this PDD disclose methodology deviations...' to review_question_answering", () => {
    expect(detectReviewPath("Does this PDD disclose methodology deviations?")).toBe("review_question_answering");
  });

  it("routes 'Is the baseline scenario appropriate?' to review_question_answering", () => {
    expect(detectReviewPath("Is the baseline scenario appropriate?")).toBe("review_question_answering");
  });

  it("routes 'Is additionality demonstrated?' to review_question_answering", () => {
    expect(detectReviewPath("Is additionality demonstrated?")).toBe("review_question_answering");
  });

  it("routes 'Check the monitoring plan' to review_question_answering", () => {
    expect(detectReviewPath("Check the monitoring plan")).toBe("review_question_answering");
  });

  it("routes 'Review the leakage assessment' to review_question_answering", () => {
    expect(detectReviewPath("Review the leakage assessment")).toBe("review_question_answering");
  });

  it("routes empty text to claim_to_requirement_match", () => {
    expect(detectReviewPath("")).toBe("claim_to_requirement_match");
  });

  it("routes a specific evidence claim to claim_to_requirement_match", () => {
    expect(detectReviewPath("The monitoring report covers the full reporting period.")).toBe("claim_to_requirement_match");
  });
});

describe("classifyReviewArea — additionality", () => {
  it("classifies 'additionality' keyword", () => {
    expect(classifyReviewArea("Does this PDD demonstrate additionality?")).toBe("additionality");
  });

  it("classifies 'VT0001' keyword", () => {
    expect(classifyReviewArea("Does this PDD follow VT0001?")).toBe("additionality");
  });

  it("classifies 'barrier analysis'", () => {
    expect(classifyReviewArea("Does this PDD include a barrier analysis?")).toBe("additionality");
  });

  it("classifies 'investment analysis'", () => {
    expect(classifyReviewArea("Does this PDD describe the investment analysis?")).toBe("additionality");
  });

  it("classifies 'common practice'", () => {
    expect(classifyReviewArea("Does this PDD justify common practice?")).toBe("additionality");
  });

  it("classifies 'first of its kind'", () => {
    expect(classifyReviewArea("Does this PDD identify first of its kind?")).toBe("additionality");
  });
});

describe("classifyReviewArea — boundary", () => {
  it("classifies 'project area'", () => {
    expect(classifyReviewArea("Does this PDD define the project area?")).toBe("boundary");
  });

  it("classifies 'leakage belt' paired with 'project area' as boundary", () => {
    expect(classifyReviewArea("Does this PDD define the project area, leakage belt, and reference region?")).toBe("boundary");
  });

  it("classifies 'reference region'", () => {
    expect(classifyReviewArea("Does this PDD define the reference region?")).toBe("boundary");
  });

  it("classifies 'RRD'", () => {
    expect(classifyReviewArea("Does this PDD describe the RRD?")).toBe("boundary");
  });

  it("classifies 'geographic boundary'", () => {
    expect(classifyReviewArea("Does this PDD define the geographic boundary?")).toBe("boundary");
  });
});

describe("classifyReviewArea — leakage", () => {
  it("classifies 'leakage risk'", () => {
    expect(classifyReviewArea("Does this PDD disclose leakage risk?")).toBe("leakage");
  });

  it("classifies 'activity shifting'", () => {
    expect(classifyReviewArea("Does this PDD describe activity shifting?")).toBe("leakage");
  });

  it("classifies 'LK-ASU'", () => {
    expect(classifyReviewArea("Does this PDD address LK-ASU?")).toBe("leakage");
  });

  it("classifies 'displacement'", () => {
    expect(classifyReviewArea("Does this PDD disclose displacement?")).toBe("leakage");
  });

  it("classifies standalone 'leakage belt' as boundary when not paired with project area or reference region", () => {
    expect(classifyReviewArea("Please review the leakage belt analysis.")).toBe("boundary");
  });
});

describe("classifyReviewArea — deviations", () => {
  it("classifies methodology deviations", () => {
    expect(classifyReviewArea("Does this PDD disclose methodology deviations?")).toBe("deviations");
  });
});

describe("resolveReviewSections — VM0007", () => {
  it("maps additionality to sections 2.5, 2.4, 1.10", () => {
    expect(resolveReviewSections("VM0007", "additionality")).toEqual(["2.5", "2.4", "1.10"]);
  });

  it("maps baseline to sections 2.4, 2.5, 1.10", () => {
    expect(resolveReviewSections("VM0007", "baseline")).toEqual(["2.4", "2.5", "1.10"]);
  });

  it("maps boundary to sections 2.3, 1.9", () => {
    expect(resolveReviewSections("VM0007", "boundary")).toEqual(["2.3", "1.9"]);
  });

  it("maps deviations to section 2.6", () => {
    expect(resolveReviewSections("VM0007", "deviations")).toEqual(["2.6"]);
  });

  it("maps leakage to sections 1.13, 3.3", () => {
    expect(resolveReviewSections("VM0007", "leakage")).toEqual(["1.13", "3.3"]);
  });

  it("maps monitoring to section 4", () => {
    expect(resolveReviewSections("VM0007", "monitoring")).toEqual(["4"]);
  });

  it("maps right_of_use to sections 1.11, 1.12.1", () => {
    expect(resolveReviewSections("VM0007", "right_of_use")).toEqual(["1.11", "1.12.1"]);
  });

  it("returns empty array for non-VM0007 methodology", () => {
    expect(resolveReviewSections("AR-ACM0003", "baseline")).toEqual([]);
  });
});

describe("reviewAreaLabel", () => {
  const areas: ReviewArea[] = [
    "additionality", "baseline", "boundary", "deviations",
    "leakage", "monitoring", "right_of_use", "general",
  ];
  for (const area of areas) {
    it(`returns a non-empty label for ${area}`, () => {
      expect(reviewAreaLabel(area).length).toBeGreaterThan(0);
    });
  }
});

// ============================================================================
// Phase 2 regression: harden baseline question detection for natural variants
// (Original 5 questions from prior work + article-prefixed variant for PR #657.)
// All must route to reviewArea: baseline and review_question_answering.
// Preserves additionality + boundary separation. No Phase 3 changes. Do not mark Phase 2 done.
// ============================================================================
describe("Phase 2 baseline question detection hardening — natural language variants", () => {
  const BASELINE_QUESTIONS: string[] = [
    "Does this PDD justify the baseline scenario?",
    "Is there baseline justification in this PDD?",
    "Does this PDD provide a reasonable baseline estimate?",
    "Does the PDD explain the without-project scenario?",
    "Is the baseline scenario supported by evidence?",
  ];

  describe("detectReviewPath routes the 5 natural baseline variants to review_question_answering", () => {
    for (const q of BASELINE_QUESTIONS) {
      it(`routes "${q}" to review_question_answering`, () => {
        expect(detectReviewPath(q)).toBe("review_question_answering");
      });
    }
  });

  describe("classifyReviewArea maps the 5 natural baseline variants to reviewArea: baseline", () => {
    for (const q of BASELINE_QUESTIONS) {
      it(`classifies "${q}" as baseline`, () => {
        expect(classifyReviewArea(q)).toBe("baseline");
      });
    }
  });

  describe("buildReviewQuestionResult + VM0007 static routes (PD_REDD_v1_130 equivalent synthetic) recovers baseline section for the variants", () => {
    for (const q of BASELINE_QUESTIONS) {
      it(`"${q}" yields reviewArea=baseline with recoverable 2.4 baseline section`, () => {
        const result = buildReviewQuestionResult({
          claimText: q,
          methodologyId: "VM0007",
          methodologyVersion: "4.2",
        });
        expect(result.reviewArea).toBe("baseline");
        expect(result.path).toBe("review_question_answering");
        // VM0007 baseline routes include the recoverable baseline section (2.4)
        expect(result.relevantSections).toContain("2.4");
      });
    }

    // Additional regression test for article-prefixed variant (PR #657)
    it('"Is there a baseline justification in this PDD?" (with article) yields reviewArea=baseline + review_question_answering', () => {
      const q = "Is there a baseline justification in this PDD?";
      const result = buildReviewQuestionResult({
        claimText: q,
        methodologyId: "VM0007",
        methodologyVersion: "4.2",
      });
      expect(detectReviewPath(q)).toBe("review_question_answering");
      expect(classifyReviewArea(q)).toBe("baseline");
      expect(result.reviewArea).toBe("baseline");
      expect(result.path).toBe("review_question_answering");
      expect(result.relevantSections).toContain("2.4");
    });

    it("preserves boundary separation (boundary question does not become baseline even with baseline PDD content present)", () => {
      const result = buildReviewQuestionResult({
        claimText: "Does this PDD describe the project boundary and leakage belt?",
        methodologyId: "VM0007",
        methodologyVersion: "1.0",
      });
      expect(result.reviewArea).toBe("boundary");
      expect(result.relevantSections).toContain("2.3");
      // Must not leak into baseline
      expect(classifyReviewArea("Does this PDD describe the project boundary and leakage belt?")).toBe("boundary");
    });

    it("preserves additionality separation (additionality question does not become baseline)", () => {
      const result = buildReviewQuestionResult({
        claimText: "Is additionality demonstrated via investment analysis and common practice?",
        methodologyId: "VM0007",
        methodologyVersion: "1.0",
      });
      expect(result.reviewArea).toBe("additionality");
      expect(classifyReviewArea("Is additionality demonstrated via investment analysis and common practice?")).toBe("additionality");
    });
  });
});
