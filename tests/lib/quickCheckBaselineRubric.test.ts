import { describe, expect, it } from "@jest/globals";
import { buildReviewQuestionResult } from "@/lib/chat/quickCheckReviewQuestion";

const STRONG_BASELINE_PDD = [
  "1.9  Project Location",
  "Project location Machinga District, Malawi.",
  "",
  "2.4  Baseline Scenario",
  "The baseline scenario is the most likely land-use scenario in the absence of the project activity.",
  "Historical deforestation rates from satellite imagery show a 1.2% annual loss in the reference region.",
  "",
].join("\n");

const WEAK_BASELINE_PDD = [
  "1.9  Project Location",
  "Project location Machinga District, Malawi.",
  "",
  "2.4  Baseline Scenario",
  "The baseline scenario assumes the same land use without the project.",
  "",
].join("\n");

const MISSING_BASELINE_PDD = [
  "1.9  Project Location",
  "Project location Machinga District, Malawi.",
  "",
  "2.5  Additionality",
  "The project faces implementation barriers and depends on carbon revenue.",
  "",
].join("\n");

describe("baseline evidence-backed review", () => {
  it("returns supported when a strong baseline section is matched", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD justify the baseline scenario?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: STRONG_BASELINE_PDD,
    });

    expect(result.reviewArea).toBe("baseline");
    expect(result.relevantSections).toEqual(["2.4"]);
    expect(result.baselineReview).toEqual(expect.objectContaining({
      review_area: "baseline",
      verdict: "supported",
      cited_sections: ["2.4"],
    }));
    expect(result.baselineReview?.evidence_summary).toContain("§2.4 Baseline Scenario");
    expect(result.baselineReview?.gaps).toEqual([]);
  });

  it("returns partial with gaps when the baseline section is weak", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD justify the baseline scenario?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: WEAK_BASELINE_PDD,
    });

    expect(result.relevantSections).toEqual(["2.4"]);
    expect(result.baselineReview).toEqual(expect.objectContaining({
      review_area: "baseline",
      verdict: "partial",
      cited_sections: ["2.4"],
    }));
    expect(result.baselineReview?.gaps).toContain(
      "No clear baseline justification basis was found, such as historical trends, drivers, or reference data.",
    );
    expect(result.baselineReview?.gaps).toContain(
      "No quantitative baseline assumption, rate, or measurement was found in the matched section text.",
    );
  });

  it("returns missing with a clear reason when no baseline section is matched", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD justify the baseline scenario?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: MISSING_BASELINE_PDD,
    });

    expect(result.relevantSections).toEqual([]);
    expect(result.baselineReview).toEqual(expect.objectContaining({
      review_area: "baseline",
      verdict: "missing",
      cited_sections: [],
    }));
    expect(result.baselineReview?.evidence_summary).toContain("No baseline-matched document section was recovered");
    expect(result.baselineReview?.gaps[0]).toContain("No uploaded PDD section heading matched");
  });
});
