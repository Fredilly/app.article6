import { describe, expect, it } from "@jest/globals";
import {
  buildReviewQuestionResult,
  classifyReviewArea,
  detectReviewPath,
  resolveReviewSections,
  reviewAreaLabel,
  type ReviewArea,
} from "@/lib/chat/quickCheckReviewQuestion";

const VM0007_BASELINE_PDD_TEXT = [
  "1.10  Leakage",
  "The leakage belt is defined as a 3 km buffer.",
  "",
  "2.4  Baseline Scenario",
  "The baseline scenario is the most likely land-use scenario without the project.",
  "The project area consists of degraded grassland.",
  "",
  "2.5  Additionality",
  "The project is additional and faces barriers to implementation.",
  "",
].join("\n");

const REALISTIC_PDD_TEXT = [
  "VM0007 Version 1.1",
  "Project Description Document",
  "",
  "Page 1 of 42",
  "",
  "1.9  Project Boundary",
  "The project area is located in the central region.",
  "Geographic coordinates are provided in the annex.",
  "",
  "Page 2 of 42",
  "",
  "2.4  Baseline Scenario",
  "The baseline scenario is the most likely land-use scenario",
  "in the absence of the project activity. The project area",
  "consists of degraded grassland that has been subject to",
  "overgrazing for the past decade.",
  "",
  "Page 3 of 42",
  "VM0007 Version 1.1",
  "",
  "2.5  Additionality",
  "The project is additional because it faces significant",
  "barriers to implementation. A barrier analysis is provided",
  "in the following paragraphs.",
  "",
].join("\n");

const PDD_WITH_PAGE_BREAKS = [
  "1.10  Leakage",
  "The leakage belt is defined as a 3 km buffer around the project area.\f",
  "Monitoring of the leakage belt will occur annually.\f",
  "2.4  Baseline Scenario",
  "The baseline scenario is the most likely land-use scenario.\f",
  "Carbon stocks are expected to decline without the project.",
].join("\n");

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

describe("resolveReviewSections — static routing (deprecated, returns empty)", () => {
  it("returns empty array for any methodology", () => {
    expect(resolveReviewSections("VM0007", "additionality")).toEqual([]);
    expect(resolveReviewSections("VM0007", "baseline")).toEqual([]);
    expect(resolveReviewSections("VM0007", "boundary")).toEqual([]);
    expect(resolveReviewSections("VM0007", "deviations")).toEqual([]);
    expect(resolveReviewSections("VM0007", "leakage")).toEqual([]);
    expect(resolveReviewSections("VM0007", "monitoring")).toEqual([]);
    expect(resolveReviewSections("VM0007", "right_of_use")).toEqual([]);
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

describe("buildReviewQuestionResult — section content extraction (Phase 1)", () => {
  it("populates sectionContent for baseline heading when PDD text is provided", () => {
    const result = buildReviewQuestionResult({
      claimText: "Is the baseline scenario appropriate?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: VM0007_BASELINE_PDD_TEXT,
    });
    expect(result.sectionContent["2.4"]).toBeDefined();
    expect(result.sectionContent["2.4"]).toContain("degraded grassland");
  });

  it("populates sectionContent for additionality heading", () => {
    const result = buildReviewQuestionResult({
      claimText: "Is additionality demonstrated?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: VM0007_BASELINE_PDD_TEXT,
    });
    expect(result.sectionContent["2.5"]).toBeDefined();
    expect(result.sectionContent["2.5"]).toContain("barriers to implementation");
  });

  it("returns empty sectionContent when no PDD text is provided", () => {
    const result = buildReviewQuestionResult({
      claimText: "Is the baseline scenario appropriate?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
    });
    expect(result.sectionContent).toEqual({});
  });

  it("does not use methodology to restrict section extraction — any methodology works", () => {
    const result = buildReviewQuestionResult({
      claimText: "Is the baseline scenario appropriate?",
      methodologyId: "AR-ACM0003",
      methodologyVersion: "1.0",
      rawPddText: VM0007_BASELINE_PDD_TEXT,
    });
    expect(result.sectionContent["2.4"]).toBeDefined();
    expect(result.sectionContent["2.4"]).toContain("degraded grassland");
  });

  it("leaves sectionContent empty when no headings can be extracted", () => {
    const textWithoutRelevantSections = "This PDD text has no section headings at all.";
    const result = buildReviewQuestionResult({
      claimText: "Is the baseline scenario appropriate?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: textWithoutRelevantSections,
    });
    expect(result.relevantSections).toEqual([]);
    expect(result.sectionContent).toEqual({});
  });

  it("extracts section 1.10 content for leakage review area", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD disclose leakage risk?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: VM0007_BASELINE_PDD_TEXT,
    });
    expect(result.relevantSections).toContain("1.10");
    expect(result.sectionContent["1.10"]).toBeDefined();
    expect(result.sectionContent["1.10"]).toContain("3 km buffer");
  });

  it("handles empty claim text gracefully", () => {
    const result = buildReviewQuestionResult({
      claimText: "",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: VM0007_BASELINE_PDD_TEXT,
    });
    expect(result.reviewArea).toBe("general");
    expect(result.relevantSections).toEqual([]);
    expect(result.sectionContent).toEqual({});
  });

  it("extracts baseline section from realistic PDD text with header/footer noise", () => {
    const result = buildReviewQuestionResult({
      claimText: "Is the baseline scenario appropriate?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: REALISTIC_PDD_TEXT,
    });
    expect(result.sectionContent["2.4"]).toBeDefined();
    expect(result.sectionContent["2.4"]).toContain("overgrazing");
    expect(result.sectionContent["2.4"]).not.toContain("VM0007 Version");
  });

  it("extracts sections from PDD text with page break characters", () => {
    const result = buildReviewQuestionResult({
      claimText: "Is the baseline scenario appropriate?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: PDD_WITH_PAGE_BREAKS,
    });
    expect(result.sectionContent["2.4"]).toBeDefined();
    expect(result.sectionContent["2.4"]).toContain("land-use scenario");
    expect(result.sectionContent["2.4"]).toContain("Carbon stocks");
  });

  it("matches sections by heading title not by static route", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD justify the baseline scenario?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: REALISTIC_PDD_TEXT,
    });
    expect(result.relevantSections).toEqual(["2.4"]);
    expect(result.sectionContent["2.4"]).toBeDefined();
    expect(result.sectionContent["2.5"]).toBeUndefined();
    expect(result.sectionContent["1.9"]).toBeUndefined();
  });

  it("extracts additionality, leakage sections using their own claim texts", () => {
    const addResult = buildReviewQuestionResult({
      claimText: "Is additionality demonstrated?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: REALISTIC_PDD_TEXT,
    });
    expect(addResult.sectionContent["2.5"]).toBeDefined();
    expect(addResult.sectionContent["2.5"]).toContain("barrier analysis");

    const leakResult = buildReviewQuestionResult({
      claimText: "Does this PDD disclose leakage risk?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: PDD_WITH_PAGE_BREAKS,
    });
    expect(leakResult.sectionContent["1.10"]).toBeDefined();
    expect(leakResult.sectionContent["1.10"]).toContain("Monitoring of the leakage belt");
  });
});
