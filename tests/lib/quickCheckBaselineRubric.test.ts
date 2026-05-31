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

  // Regression for bare date ranges (previously allowed by the removed from-YYYY-to-YYYY pattern)
  const BASELINE_WITH_BARE_DATE_RANGE = [
    "2.4  Baseline Scenario",
    "The baseline scenario is the most likely land-use scenario in the absence of the project.",
    "Historical land use data from 2000 to 2020 was reviewed.",
    "Satellite data was used to observe changes in the reference region.",
  ].join("\n");

  it("does not return 'supported' for bare date ranges without a tied rate or measurement (regression)", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD justify the baseline scenario?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: BASELINE_WITH_BARE_DATE_RANGE,
    });

    expect(result.baselineReview?.verdict).not.toBe("supported");
    expect(["partial", "needs_review"]).toContain(result.baselineReview?.verdict);
    expect(result.baselineReview?.gaps.some(g => g.includes("quantitative baseline assumption"))).toBe(true);
  });
});

// ============================================================================
// Real extracted PDD regression tests (Phase 2 follow-up)
// These use actual extracted fixture text from a VM0007-style PDD to protect
// the end-to-end routing + baselineReview production path (not just synthetic
// inline strings).
// ============================================================================

import * as fs from "fs";
import * as path from "path";

const REDD_EXTRACTED_FIXTURE = path.join(
  __dirname,
  "../fixtures/quick-check/pd_redd_v1_130-extracted.txt"
);
const REDD_EXTRACTED_TEXT = fs.readFileSync(REDD_EXTRACTED_FIXTURE, "utf-8");

describe("real extracted PDD regression — VM0007 baseline routing + baselineReview", () => {
  it("baseline question on real extracted VM0007 PDD returns reviewArea: baseline and produces baselineReview", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD justify the baseline scenario?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: REDD_EXTRACTED_TEXT,
    });

    expect(result.reviewArea).toBe("baseline");
    expect(result.baselineReview).toBeDefined();
    expect(result.baselineReview?.review_area).toBe("baseline");
  });

  it("baseline result from real extracted PDD includes cited extracted sections", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD justify the baseline scenario?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: REDD_EXTRACTED_TEXT,
    });

    expect(result.baselineReview).toBeDefined();
    expect(Array.isArray(result.baselineReview?.cited_sections)).toBe(true);
    expect(result.baselineReview!.cited_sections.length).toBeGreaterThan(0);
  });

  it("baseline result from real extracted PDD includes follow-up document recommendations", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD justify the baseline scenario?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: REDD_EXTRACTED_TEXT,
    });

    expect(result.baselineReview).toBeDefined();
    expect(Array.isArray(result.baselineReview?.recommended_follow_up_documents)).toBe(true);
    expect(result.baselineReview!.recommended_follow_up_documents.length).toBeGreaterThan(0);
  });

  it("boundary question on real extracted VM0007 PDD returns reviewArea: boundary and does not produce baselineReview", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD describe the project boundary?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: REDD_EXTRACTED_TEXT,
    });

    expect(result.reviewArea).toBe("boundary");
    expect(result.baselineReview).toBeUndefined();
  });

  it("additionality question on real extracted VM0007 PDD returns reviewArea: additionality and does not produce baselineReview", () => {
    const result = buildReviewQuestionResult({
      claimText: "Is additionality demonstrated in this PDD?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: REDD_EXTRACTED_TEXT,
    });

    expect(result.reviewArea).toBe("additionality");
    expect(result.baselineReview).toBeUndefined();
  });
});

// ============================================================================
// Real-document-style baseline regression evals (Phase 2)
// These use longer, messier PDD-style text with dates, page numbers, project
// sizes, mixed sections, and realistic (imperfect) baseline wording.
// ============================================================================

describe("real-document-style baseline regression evals (VM0007 only)", () => {
  const STRONG_REALISTIC_BASELINE_PDD = [
    "2.3  Project Location and Boundaries",
    "The project is located in the province of Zambezia, Mozambique. The project area covers 48,750 hectares as delineated in the attached maps (see Figure 2.1 on page 14). The project boundary was defined using Landsat imagery acquired on 15 March 2010 and updated with Sentinel-2 data from 2022.",
    "",
    "2.4  Baseline Scenario",
    "The baseline scenario is the continuation of the most likely land-use scenario in the absence of the project activity. Without the project, smallholder agriculture and charcoal production would continue to drive deforestation in the reference region.",
    "Historical analysis of satellite imagery covering the period 2000-2020 (see Annex 3, pages 87-112) indicates an average annual deforestation rate of 1.85% within the reference region. This rate is derived from supervised classification of Landsat 5, 7 and 8 scenes acquired between 15 January and 30 April of each year. The analysis shows a total loss of 14,320 hectares of forest cover between 2005 and 2018.",
    "Key drivers of deforestation identified through participatory rural appraisal and analysis of national land-use statistics include: expansion of subsistence agriculture (42%), charcoal production for urban markets (31%), and small-scale commercial logging (18%). These trends are expected to persist or accelerate in the without-project scenario due to population growth of 2.7% per annum and limited enforcement of existing forest regulations.",
    "Page 23 of 156",
  ].join("\n");

  const WEAK_REALISTIC_BASELINE_PDD = [
    "1.1  Introduction",
    "This Project Design Document describes a REDD+ initiative in the Central Region of Ghana. The total project area is approximately 32,400 ha.",
    "",
    "2.4  Baseline Scenario",
    "In the absence of the proposed project activities, the current land use practices are expected to continue. The area has historically been used for a combination of small-scale farming and fuelwood collection.",
    "Some forest loss has occurred in the past, as can be seen from older maps dated 1998 and 2007 (Appendix B). The project area is bordered by community lands to the north and a protected area to the south.",
    "Data collection for this analysis was completed in June 2019. Additional field visits were conducted in February 2021 (see field notes on page 67).",
    "The without-project scenario assumes that  the rate of land conversion will remain similar to what has been observed in neighbouring districts over the last decade.",
  ].join("\n");

  const FALSE_POSITIVE_NUMBERS_BASELINE_PDD = [
    "2.1  General Project Information",
    "Project ID: REDD-GH-042. Version 2.3 of this PDD was submitted on 12 September 2022.",
    "",
    "2.4  Baseline Scenario",
    "The baseline scenario represents the most likely land use in the absence of the project. The project area comprises 27,850 ha of which approximately 65% is currently under some form of forest cover according to the 2015 national forest inventory.",
    "Land use data was compiled from various sources including the 2008 and 2016 district development plans. A total of 1,245 households were surveyed between March and July 2019 (survey instrument reproduced in Annex 4, pages 44-51).",
    "Without the project, it is assumed that the current mosaic of agriculture, fallow and degraded woodland will persist. The reference region experienced a population increase from 186,000 in 2010 to 214,000 in 2020.",
    "See also Section 3.2 (page 31) for additional information on land tenure and Section 4.7 (page 58) for climate data covering the period 1995-2021.",
  ].join("\n");

  const NO_BASELINE_SECTION_PDD = [
    "1.2  Project Boundary",
    "The project boundary encompasses 19,600 ha of miombo woodland in the Eastern Province of Zambia. The boundary was delineated using a combination of GPS tracks collected during the 14-22 April 2018 field campaign and high-resolution imagery acquired on 03 May 2018 (see Map 1.1 on page 9).",
    "",
    "2.5  Additionality",
    "The project faces significant implementation barriers including limited access to carbon finance, weak enforcement of land-use regulations, and high transaction costs associated with community engagement across 14 villages.",
    "Without carbon revenues the project would not be financially viable. The internal rate of return without carbon credit sales is estimated at 2.1%, below the 8% benchmark used by the project developer.",
    "Page 17 of 94",
  ].join("\n");

  it("returns supported for strong, realistic baseline evidence with rates and historical data", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD justify the baseline scenario?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: STRONG_REALISTIC_BASELINE_PDD,
    });

    expect(result.reviewArea).toBe("baseline");
    expect(result.relevantSections).toContain("2.4");
    expect(result.baselineReview?.verdict).toBe("supported");
    expect(result.baselineReview?.cited_sections).toContain("2.4");
    // Should not have the "no quantitative" gap
    expect(result.baselineReview?.gaps.some(g => g.includes("quantitative baseline assumption"))).toBe(false);
  });

  it("returns partial for baseline section that mentions scenario but lacks tied quantitative evidence", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD justify the baseline scenario?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: WEAK_REALISTIC_BASELINE_PDD,
    });

    expect(result.reviewArea).toBe("baseline");
    expect(result.relevantSections).toContain("2.4");
    expect(result.baselineReview?.verdict).toBe("partial");
    expect(result.baselineReview?.gaps.some(g => g.includes("quantitative baseline assumption"))).toBe(true);
  });

  it("does not return supported when baseline section contains only dates, project sizes and page numbers without rate context", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD justify the baseline scenario?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: FALSE_POSITIVE_NUMBERS_BASELINE_PDD,
    });

    expect(result.reviewArea).toBe("baseline");
    expect(result.baselineReview?.verdict).not.toBe("supported");
    expect(["partial", "needs_review"]).toContain(result.baselineReview?.verdict);
    expect(result.baselineReview?.gaps.some(g => g.includes("quantitative baseline assumption"))).toBe(true);
  });

  it("returns missing when the uploaded PDD has no baseline section matching the question", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD justify the baseline scenario?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: NO_BASELINE_SECTION_PDD,
    });

    expect(result.reviewArea).toBe("baseline");
    expect(result.relevantSections).toEqual([]);
    expect(result.baselineReview?.verdict).toBe("missing");
    expect(result.baselineReview?.cited_sections).toEqual([]);
  });

  it("does not produce baselineReview when the question is about boundary or additionality", () => {
    // Strong baseline text but non-baseline question
    const resultBoundary = buildReviewQuestionResult({
      claimText: "Does this PDD describe the project boundary?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: STRONG_REALISTIC_BASELINE_PDD,
    });

    expect(resultBoundary.reviewArea).toBe("boundary");
    expect(resultBoundary.baselineReview).toBeUndefined();

    const resultAdditionality = buildReviewQuestionResult({
      claimText: "Is additionality demonstrated for this project?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: STRONG_REALISTIC_BASELINE_PDD,
    });

    expect(resultAdditionality.reviewArea).toBe("additionality");
    expect(resultAdditionality.baselineReview).toBeUndefined();
  });
});
