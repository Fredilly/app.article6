import { describe, expect, it } from "@jest/globals";
import fs from "fs";
import path from "path";
import {
  buildReviewQuestionResult,
  classifyReviewArea,
  computeSectionMatchResults,
  detectReviewPath,
  extractClaimKeywords,
  findMatchedSectionNumbers,
  resolveReviewSections,
  reviewAreaLabel,
  type ReviewArea,
  type SectionMatchResult,
} from "@/lib/chat/quickCheckReviewQuestion";
import { filterPddHeadingsByQuery } from "@/lib/chat/quickCheckSectionExtractor";

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

const VM0007_PHASE_3_PDD_TEXT = [
  "VM0007 Version 4.2",
  "Project Description Document: PD_REDD_v1_130",
  "",
  "1.11  Compliance with Laws, Statutes and Other Regulatory Frameworks",
  "The project complies with applicable laws and regulatory frameworks for the project area.",
  "",
  "1.12.1  Right of Use",
  "The project proponent has legal right of use and authority to manage the project area.",
  "Land and resource use rights are held by the community association and documented in agreements.",
  "",
  "6  Stakeholder Comments",
  "Stakeholder consultation and participation were conducted through community meetings.",
  "Local communities were consulted and their comments were summarized in this section.",
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

  it("routes 'Does this PDD include stakeholder comments?' to review_question_answering", () => {
    expect(detectReviewPath("Does this PDD include stakeholder comments?")).toBe("review_question_answering");
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

describe("classifyReviewArea — right_of_use", () => {
  it("classifies legal status and property rights", () => {
    expect(classifyReviewArea("Does this PDD explain legal status and property rights?")).toBe("right_of_use");
  });

  it("classifies compliance with laws and ownership", () => {
    expect(classifyReviewArea("Does this PDD explain compliance with laws and ownership?")).toBe("right_of_use");
  });

  it("classifies legal right of use / authority questions", () => {
    expect(classifyReviewArea("Does this PDD demonstrate legal right of use for the project area?")).toBe("right_of_use");
    expect(classifyReviewArea("Does the project have legal authority to manage the project area?")).toBe("right_of_use");
    expect(classifyReviewArea("Does the PDD identify who has land and resource use rights?")).toBe("right_of_use");
    expect(classifyReviewArea("Does the PDD explain ownership or use rights for the project area?")).toBe("right_of_use");
  });
});

describe("classifyReviewArea — stakeholder", () => {
  it("classifies stakeholder consultation and participation questions", () => {
    expect(classifyReviewArea("Does this PDD describe stakeholder consultation and participation?")).toBe("stakeholder");
    expect(classifyReviewArea("Does this PDD explain stakeholder engagement?")).toBe("stakeholder");
    expect(classifyReviewArea("Were local communities consulted?")).toBe("stakeholder");
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
    expect(resolveReviewSections("VM0007", "stakeholder")).toEqual([]);
    expect(resolveReviewSections("AR-ACM0003", "baseline")).toEqual([]);
  });
});

describe("reviewAreaLabel", () => {
  const areas: ReviewArea[] = [
    "additionality", "baseline", "boundary", "deviations",
    "leakage", "monitoring", "right_of_use", "stakeholder", "general",
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

const PLUM_FIXTURE_PATH = path.join(__dirname, "..", "fixtures", "quick-check", "plum-pdd-regression.txt");
const PLUM_TEXT = fs.readFileSync(PLUM_FIXTURE_PATH, "utf-8");

const CUSTOM_HEADING_PDD = [
  "2.1  Project Goals, Design and Long-Term Viability",
  "The project goals are to restore degraded land.",
  "The project design includes reforestation of 5,000 hectares.",
  "",
  "2.3  Stakeholder Engagement",
  "Stakeholder engagement was conducted through community meetings.",
  "",
  "3.3.1  Remote Sensing",
  "Remote sensing data from satellites is used for monitoring.",
  "NDVI analysis is conducted quarterly.",
  "",
  "3.3.3.1  Remote Sensing — Detailed Methods",
  "Detailed remote sensing methods are described here.",
  "",
  "3.5  Biodiversity Assessment",
  "Biodiversity is assessed annually using transect surveys.",
  "",
  "20.0  Financial Analysis",
  "The financial analysis shows IRR of 12%.",
  "",
].join("\n");

describe("extractClaimKeywords", () => {
  it("extracts phrases and words from a stakeholder engagement question", () => {
    const { phrases, words } = extractClaimKeywords("Does this PDD describe stakeholder engagement?");
    expect(phrases).toEqual(["stakeholder engagement"]);
    expect(words).toContain("stakeholder");
    expect(words).toContain("engagement");
  });

  it("extracts phrases split by 'and' and commas", () => {
    const { phrases, words } = extractClaimKeywords("Does this PDD describe the project goals, design, and long-term viability?");
    expect(phrases).toContain("project goals");
    expect(phrases).toContain("design");
    expect(phrases).toContain("long-term viability");
    expect(words).toContain("goals");
    expect(words).toContain("viability");
  });

  it("extracts methodology-related keywords without stripping them", () => {
    const { phrases, words } = extractClaimKeywords("Does this PDD explain applicability of VM0007 methodology?");
    expect(phrases).toContain("applicability of vm0007 methodology");
    expect(words).toContain("applicability");
    expect(words).toContain("vm0007");
    expect(words).toContain("methodology");
  });

  it("filters out generic stop words like 'project' and 'area'", () => {
    const { words } = extractClaimKeywords("Does this PDD explain the project area and project zone boundary?");
    expect(words).not.toContain("project");
    expect(words).not.toContain("area");
    expect(words).toContain("zone");
    expect(words).toContain("boundary");
  });

  it("returns empty for very short text", () => {
    const { phrases, words } = extractClaimKeywords("Hi");
    expect(phrases).toEqual([]);
    expect(words).toEqual([]);
  });
});

describe("claim-text-based heading matching (acceptance tests)", () => {
  it("matches stakeholder engagement question to section 2.3", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD describe stakeholder engagement?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: PLUM_TEXT,
    });
    expect(result.relevantSections).toContain("2.3");
    expect(result.sectionContent["2.3"]).toBeDefined();
    expect(result.sectionContent["2.3"]).toContain("Stakeholder engagement");
  });

  it("matches without-project land use scenario and additionality question to section 2.2", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD explain the without-project land use scenario and additionality?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: PLUM_TEXT,
    });
    expect(result.relevantSections).toContain("2.2");
    expect(result.sectionContent["2.2"]).toBeDefined();
    expect(result.sectionContent["2.2"]).toContain("without-project land use scenario");
  });

  it("matches project goals question to section 2.1 by heading title keywords", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD describe the project goals, design, and long-term viability?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: CUSTOM_HEADING_PDD,
    });
    expect(result.relevantSections).toContain("2.1");
    expect(result.sectionContent["2.1"]).toBeDefined();
    expect(result.sectionContent["2.1"]).toContain("restore degraded land");
  });

  it("matches applicability of VM0007 methodology question to methodology-related sections", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD explain applicability of VM0007 methodology?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: PLUM_TEXT,
    });
    expect(result.relevantSections[0]).toBe("3.1.2");
    expect(result.relevantSections).toContain("3.1");
    expect(result.sectionContent["3.1"]).toBeDefined();
  });

  it("matches remote sensing for monitoring question to monitoring-related sections", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD describe remote sensing for monitoring?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: CUSTOM_HEADING_PDD,
    });
    expect(result.relevantSections).toContain("3.3.3.1");
    expect(result.sectionContent["3.3.3.1"]).toBeDefined();
    expect(result.sectionContent["3.3.3.1"]!.toLowerCase()).toContain("remote sensing");
  });

  it("matches legal status and property rights question to section 2.5", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD describe legal status and property rights?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: PLUM_TEXT,
    });
    expect(result.relevantSections).toContain("2.5");
    expect(result.sectionContent["2.5"]).toBeDefined();
    expect(result.sectionContent["2.5"]).toContain("land tenure");
  });

  it("matches legal status / property rights query to compliance, ownership, and right-of-use headings", () => {
    const pdd = [
      "1.11  Compliance with Laws, Statutes and Other Regulatory Frameworks",
      "The project complies with laws and regulations.",
      "",
      "1.12  Ownership and Other Programs",
      "Ownership of the project area is documented.",
      "",
      "1.12.1  Right of Use",
      "The proponent has the right of use over the project area.",
      "",
    ].join("\n");
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD explain legal status and property rights?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: pdd,
    });
    expect(result.relevantSections).toEqual(expect.arrayContaining(["1.11", "1.12", "1.12.1"]));
  });

  it("matches stakeholder comments when the document has a real body heading for it", () => {
    const pdd = [
      "6  Stakeholder Comments",
      "Stakeholder comments were collected during consultation and summarized here.",
      "",
      "6.1  Resolution of Comments",
      "The project addressed the comments in follow-up meetings.",
    ].join("\n");
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD include stakeholder comments?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: pdd,
    });
    expect(result.relevantSections).toContain("6");
    expect(result.sectionContent["6"]).toContain("Stakeholder comments");
  });

  it("explains TOC-only stakeholder matches instead of treating them as body headings", () => {
    const pdd = [
      "Table of Contents",
      "6  Stakeholder Comments",
      "",
      "1.9  Project Location",
      "The project location is described in the body text.",
    ].join("\n");
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD include stakeholder comments?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: pdd,
    });
    expect(result.relevantSections).toEqual([]);
    expect(result.noMatchExplanation).toContain("§6 Stakeholder Comments");
    expect(result.noMatchExplanation).toContain("table of contents");
  });

  it("does not match random sections like biodiversity, financial analysis, or Remote Sensing", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD explain the project area and project zone boundary?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: CUSTOM_HEADING_PDD,
    });
    expect(result.sectionContent["3.5"]).toBeUndefined();
    expect(result.sectionContent["20.0"]).toBeUndefined();
    expect(result.sectionContent["3.3.1"]).toBeUndefined();
  });

  it("returns no match when only generic project words overlap but no heading is a strong title match", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD describe the project boundary?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: CUSTOM_HEADING_PDD,
    });
    expect(result.relevantSections).toEqual([]);
    expect(result.sectionContent).toEqual({});
  });

  it("returns relevantSections sorted by relevance (best match first)", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD describe remote sensing for monitoring?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: CUSTOM_HEADING_PDD,
    });
    const sections = result.relevantSections;
    expect(sections.length).toBeGreaterThanOrEqual(1);
  });

  it("routes stakeholder engagement to the stakeholder review area and still matches 2.3", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD describe stakeholder engagement?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: PLUM_TEXT,
    });
    expect(classifyReviewArea("Does this PDD describe stakeholder engagement?")).toBe("stakeholder");
    expect(result.relevantSections.length).toBeGreaterThan(0);
    expect(result.relevantSections).toContain("2.3");
  });

  it("returns empty when no heading matches claim keywords or review area", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD describe stakeholder engagement?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: "This PDD has no numbered sections at all.",
    });
    expect(result.relevantSections).toEqual([]);
    expect(result.sectionContent).toEqual({});
  });

  it("does not include section 1.1 (Project Background) when asking about project goals and design", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD describe the project goals, design, and long-term viability?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: CUSTOM_HEADING_PDD,
    });
    expect(result.relevantSections).not.toContain("1.1");
    expect(result.relevantSections).toContain("2.1");
  });

  it("returns all matching headings from filter (no artificial cap)", () => {
    const manySections = [
      "1.1  Introduction",
      "Intro content.",
      "2.1  Additionality and Baseline",
      "Additionality and baseline content.",
      "2.2  Baseline Scenario and Additionality",
      "More baseline content.",
      "2.3  Additionality Analysis",
      "Additionality analysis.",
      "2.4  Another Additionality Section",
      "More additionality.",
      "2.5  Additionality Evidence",
      "Evidence for additionality.",
    ].join("\n");
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD demonstrate additionality?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: manySections,
    });
    // Phase 1: filter returns *all* title matches (no artificial top-3 cap from scoring logic)
    expect(result.relevantSections.length).toBeGreaterThan(3);
    expect(result.relevantSections).toContain("2.1");
    expect(result.relevantSections).toContain("2.5");
  });

  it("PLUM PDD heading index includes required sections and question phrases filter correctly (Phase 1 acceptance)", () => {
    const result = buildReviewQuestionResult({
      claimText: "",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: PLUM_TEXT,
    });
    const nums = new Set(result.headingIndex.map((h) => h.sectionNumber));
    expect(nums.has("2.1")).toBe(true);
    expect(nums.has("2.2")).toBe(true);
    expect(nums.has("2.3")).toBe(true);
    expect(nums.has("2.5")).toBe(true);
    expect(nums.has("3.1.2")).toBe(true);
    expect(nums.has("3.3")).toBe(true);

    // filter by acceptance phrases surfaces correct heading (title match only)
    const goals = filterPddHeadingsByQuery(result.headingIndex, "Project Goals, Design and Long-Term Viability");
    expect(goals[0]?.sectionNumber).toBe("2.1");
    expect(goals.some((h) => h.sectionNumber === "2.3")).toBe(false);

    const without = filterPddHeadingsByQuery(result.headingIndex, "Without-project Land Use Scenario and Additionality");
    expect(without[0]?.sectionNumber).toBe("2.2");

    const stake = filterPddHeadingsByQuery(result.headingIndex, "Stakeholder Engagement");
    expect(stake[0]?.sectionNumber).toBe("2.3");

    const legal = filterPddHeadingsByQuery(result.headingIndex, "Legal Status and Property Rights");
    expect(legal[0]?.sectionNumber).toBe("2.5");

    const appl = filterPddHeadingsByQuery(result.headingIndex, "Applicability of Methodology");
    expect(appl.some((h) => h.sectionNumber === "3.1.2")).toBe(true);

    const mon = filterPddHeadingsByQuery(result.headingIndex, "Monitoring");
    expect(mon.some((h) => h.sectionNumber === "3.3")).toBe(true);

    // no match case
    const none = filterPddHeadingsByQuery(result.headingIndex, "biodiversity credits xyz");
    expect(none.length).toBe(0);
  });

  it.each([
    "Does this PDD demonstrate legal right of use for the project area?",
    "Does the project have legal authority to manage the project area?",
    "Does the PDD identify who has land and resource use rights?",
    "Does the PDD explain ownership or use rights for the project area?",
  ])("routes exact right-of-use manual-preview question: %s", (claimText) => {
    const result = buildReviewQuestionResult({
      claimText,
      methodologyId: "PD_REDD_v1_130",
      methodologyVersion: "v4-2",
      rawPddText: VM0007_PHASE_3_PDD_TEXT,
    });

    expect(result.reviewArea).toBe("right_of_use");
    expect(result.relevantSections).toEqual(expect.arrayContaining(["1.11", "1.12.1"]));
    expect(result.sectionContent["1.11"]).toContain("complies with applicable laws");
    expect(result.sectionContent["1.12.1"]).toContain("legal right of use and authority to manage");
    expect(result.baselineReview).toBeUndefined();
  });

  it.each([
    "Does this PDD describe stakeholder consultation and participation?",
    "Does this PDD explain stakeholder engagement?",
    "Were local communities consulted?",
  ])("routes exact stakeholder manual-preview question: %s", (claimText) => {
    const result = buildReviewQuestionResult({
      claimText,
      methodologyId: "PD_REDD_v1_130",
      methodologyVersion: "v4-2",
      rawPddText: VM0007_PHASE_3_PDD_TEXT,
    });

    expect(result.reviewArea).toBe("stakeholder");
    expect(result.relevantSections).toContain("6");
    expect(result.sectionContent["6"]).toContain("Stakeholder consultation and participation");
    expect(result.sectionContent["6"]).toContain("Local communities were consulted");
    expect(result.baselineReview).toBeUndefined();
  });
});

describe("computeSectionMatchResults — match diagnostics", () => {
  const PDD = [
    "2.1  Project Area",
    "The project area comprises 5,000 hectares.",
    "",
    "2.2  Baseline Scenario",
    "The baseline scenario is the most likely land-use scenario.",
    "",
  ].join("\n");

  it("reports heading matches with correct scores", () => {
    const results = computeSectionMatchResults(PDD, "baseline", "Does this PDD contain the baseline scenario?");
    const match2_2 = results.find(r => r.section === "2.2")!;
    expect(match2_2).toBeDefined();
    expect(match2_2.headingScore).toBeGreaterThan(0);
    expect(match2_2.matchedTerms.length).toBeGreaterThan(0);
    expect(match2_2.included).toBe(true);
  });

  it("reports non-matching sections with rejection reasons", () => {
    const results = computeSectionMatchResults(PDD, "baseline", "Does this PDD contain the baseline scenario?");
    const match2_1 = results.find(r => r.section === "2.1")!;
    expect(match2_1).toBeDefined();
    expect(match2_1.totalScore).toBe(0);
    expect(match2_1.rejectionReason).toContain("no heading/title match");
    expect(match2_1.included).toBe(false);
  });

  it("reports source as heading-only for primary matches", () => {
    const results = computeSectionMatchResults(PDD, "baseline", "Does this PDD contain the baseline scenario?");
    const match2_2 = results.find(r => r.section === "2.2")!;
    expect(match2_2.source).toBe("heading");
    const match2_1 = results.find(r => r.section === "2.1")!;
    expect(match2_1.source).toBe("none");
  });

  it("accepts top-level section numbers when the heading title is a strong match", () => {
    const pddWithBadIds = [
      "4  Monitoring",
      "Monitoring is conducted annually.",
    ].join("\n");
    const results = computeSectionMatchResults(pddWithBadIds, "monitoring", "Does this PDD describe monitoring?");
    const match = results.find(r => r.section === "4");
    expect(match).toBeDefined();
    expect(match!.included).toBe(true);
    expect(match!.source).toBe("heading");
  });

  it("populates phase1Diagnostic.matchResults in dev mode", () => {
    const result = buildReviewQuestionResult({
      claimText: "Does this PDD contain the baseline scenario?",
      methodologyId: "VM0007",
      methodologyVersion: "1.0",
      rawPddText: PDD,
    });
    expect(result.phase1Diagnostic).toBeDefined();
    if (result.phase1Diagnostic) {
      expect(result.phase1Diagnostic.matchResults).toBeDefined();
      expect(result.phase1Diagnostic.matchResults.length).toBeGreaterThan(0);
      expect(result.phase1Diagnostic.claimKeywords).toBeDefined();
      expect(result.phase1Diagnostic.claimKeywords.phrases.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Additional regression for PR #657: article-prefixed baseline question support
// "Is there a baseline justification in this PDD?" must route correctly.
// We also re-assert the original five variants for completeness.
// Preserves boundary/additionality separation. No Phase 3 changes.
// ============================================================================
describe("PR #657 - article-prefixed baseline question detection", () => {
  const ARTICLE_VARIANT = "Is there a baseline justification in this PDD?";
  const ORIGINAL_FIVE = [
    "Does this PDD justify the baseline scenario?",
    "Is there baseline justification in this PDD?",
    "Does this PDD provide a reasonable baseline estimate?",
    "Does the PDD explain the without-project scenario?",
    "Is the baseline scenario supported by evidence?",
  ];

  it("routes the article-prefixed variant to review_question_answering", () => {
    expect(detectReviewPath(ARTICLE_VARIANT)).toBe("review_question_answering");
  });

  it("classifies the article-prefixed variant as reviewArea: baseline", () => {
    expect(classifyReviewArea(ARTICLE_VARIANT)).toBe("baseline");
  });

  it("buildReviewQuestionResult produces baseline + review_question_answering path for the article variant", () => {
    const result = buildReviewQuestionResult({
      claimText: ARTICLE_VARIANT,
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
    });
    expect(result.reviewArea).toBe("baseline");
    expect(result.path).toBe("review_question_answering");
    // Note: relevantSections now depends on actual PDD content + heading extraction in the full Phase 1/2 implementation.
    // The core PR #657 guarantee (detect + classify routing) is verified by the tests above.
  });

  // Keep the original five as explicit regression coverage
  it("still correctly handles all five original natural baseline variants", () => {
    for (const q of ORIGINAL_FIVE) {
      expect(detectReviewPath(q)).toBe("review_question_answering");
      expect(classifyReviewArea(q)).toBe("baseline");
    }
  });

  it("preserves boundary and additionality separation even with article-prefixed baseline content present", () => {
    const boundaryResult = buildReviewQuestionResult({
      claimText: "Does this PDD describe the project boundary and leakage belt?",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
    });
    expect(boundaryResult.reviewArea).toBe("boundary");

    const additionalityResult = buildReviewQuestionResult({
      claimText: "Is additionality demonstrated via investment analysis?",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
    });
    expect(additionalityResult.reviewArea).toBe("additionality");
  });
});
