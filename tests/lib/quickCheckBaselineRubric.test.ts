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
      "No quantitative baseline assumption, rate, or measurement clearly tied to baseline reasoning was found (dates, page numbers, or unrelated figures do not count).",
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

  // --- False positive hardening tests (numbers that should NOT trigger "supported") ---

  const BASELINE_WITH_DATE_ONLY = [
    "2.4  Baseline Scenario",
    "The baseline scenario is the most likely land-use scenario in the absence of the project.",
    "Historical land use data from the reference region was collected in 2018.",
    "The project is expected to start operations in 2025.",
  ].join("\n");

  const BASELINE_WITH_UNRELATED_PERCENT = [
    "2.4  Baseline Scenario",
    "The baseline scenario assumes continuation of current land use practices.",
    "Satellite imagery from the reference region shows that 65% of the area remains forested.",
    "The project boundary covers approximately 12,500 ha.",
  ].join("\n");

  const BASELINE_WITH_SECTION_AND_PAGE_NUMBERS = [
    "2.4  Baseline Scenario",
    "The baseline scenario is described in detail on page 47 of this PDD (see also section 3.2).",
    "Without the project, land-use patterns observed in 2005-2010 would continue.",
    "Version 1.2 of the methodology was used for this analysis.",
  ].join("\n");

  it("does not return 'supported' when the only numbers are dates (false positive guard)", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD justify the baseline scenario?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: BASELINE_WITH_DATE_ONLY,
    });

    expect(result.baselineReview?.verdict).not.toBe("supported");
    expect(["partial", "needs_review"]).toContain(result.baselineReview?.verdict);
    expect(result.baselineReview?.gaps.some(g => g.includes("quantitative baseline assumption"))).toBe(true);
  });

  it("does not return 'supported' for unrelated percentages or area sizes without baseline rate context", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD justify the baseline scenario?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: BASELINE_WITH_UNRELATED_PERCENT,
    });

    expect(result.baselineReview?.verdict).not.toBe("supported");
    expect(result.baselineReview?.gaps.some(g => g.includes("quantitative baseline assumption"))).toBe(true);
  });

  it("does not return 'supported' when numbers are page numbers, section references, versions, or years without rate context", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD justify the baseline scenario?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: BASELINE_WITH_SECTION_AND_PAGE_NUMBERS,
    });

    expect(result.baselineReview?.verdict).not.toBe("supported");
    // Should still detect some evidence signals but lack a properly tied quantitative claim
    expect(result.baselineReview?.gaps.some(g => g.includes("quantitative baseline assumption"))).toBe(true);
  });
});
