import { describe, expect, it } from "@jest/globals";
import {
  loadAndParseExtractedText,
  retrieveEvidenceForAllChecks,
  retrieveEvidenceForCheck,
  type QuickCheckV2ExtractedDocument,
  type RetrievedCheckEvidence,
} from "@/lib/quickCheckV2/evidence";

const ENVIRA_FIXTURE_PATH =
  "tests/fixtures/quick-check/v2/envira/extracted.txt";
const ENVIRA_DOCUMENT_ID = "proj-desc-1382-extracted";

function makeSyntheticDocument(
  blocks: QuickCheckV2ExtractedDocument["blocks"],
): QuickCheckV2ExtractedDocument {
  return {
    documentId: "synthetic-doc",
    parser: "test",
    blocks,
    diagnostics: { warnings: [], pageCount: 3 },
  };
}

describe("Quick Check v2 — Phase 3 evidence retrieval", () => {
  const enviraDoc = loadAndParseExtractedText(
    ENVIRA_FIXTURE_PATH,
    ENVIRA_DOCUMENT_ID,
  );
  const allEvidence = retrieveEvidenceForAllChecks(enviraDoc);

  it("returns all six structured checks", () => {
    expect(allEvidence.map((result) => result.checkName)).toStrictEqual([
      "host_country",
      "methodology",
      "baseline_scenario",
      "additionality",
      "leakage",
      "stakeholder_consultation",
    ]);
  });

  it("returns provenance-only evidence fields", () => {
    for (const result of allEvidence) {
      expect(Object.keys(result)).toStrictEqual(["checkName", "evidence"]);
      if (!result.evidence) continue;

      expect(Object.keys(result.evidence)).toStrictEqual([
        "sourceType",
        "quote",
        "page",
        "sectionHeading",
        "sectionPath",
        "spanId",
      ]);
      expect(result.evidence.page).toBeGreaterThan(0);
      expect(result.evidence.spanId).toMatch(/^proj-desc-1382-extracted:/);
      expect(Array.isArray(result.evidence.sectionPath)).toBe(true);
      expect(Object.keys(result.evidence)).not.toContain("answer");
      expect(Object.keys(result.evidence)).not.toContain("status");
      expect(Object.keys(result.evidence)).not.toContain("score");
    }
  });

  it("uses fact contract before exact section for host_country", () => {
    const result = retrieveEvidenceForCheck(enviraDoc, "host_country");
    expect(result.evidence).not.toBeNull();
    expect(result.evidence!.sourceType).toBe("fact_contract");
    expect(result.evidence!.quote).toContain("Acre, Brazil");
    expect(result.evidence!.page).toBe(3);
  });

  it("uses fact contract before exact section for methodology", () => {
    const result = retrieveEvidenceForCheck(enviraDoc, "methodology");
    expect(result.evidence).not.toBeNull();
    expect(result.evidence!.sourceType).toBe("fact_contract");
    expect(result.evidence!.quote).toMatch(/VM0007|VMD000/i);
    expect(result.evidence!.page).toBe(31);
  });

  it("uses exact section evidence for the remaining structured checks on Envira", () => {
    const expectations: Array<{
      checkName: RetrievedCheckEvidence["checkName"];
      sectionText: string;
      page: number;
    }> = [
      { checkName: "baseline_scenario", sectionText: "Conversion to Pasture", page: 38 },
      { checkName: "additionality", sectionText: "Simple Cost Analysis", page: 38 },
      { checkName: "leakage", sectionText: "Leakage", page: 69 },
      { checkName: "stakeholder_consultation", sectionText: "STAKEHOLDER COMMENTS", page: 122 },
    ];

    for (const expectation of expectations) {
      const result = retrieveEvidenceForCheck(enviraDoc, expectation.checkName);
      expect(result.evidence).not.toBeNull();
      expect(result.evidence!.sourceType).toBe("exact_section");
      expect(result.evidence!.sectionHeading).toContain(expectation.sectionText);
      expect(result.evidence!.page).toBe(expectation.page);
    }
  });

  it("prefers exact section evidence over an earlier raw-text fallback match", () => {
    const synthetic = makeSyntheticDocument([
      {
        spanId: "synthetic-doc:p1:b1:overview",
        page: 1,
        text: "Overview: leakage can happen when activity moves elsewhere.",
        blockType: "body",
        sectionHeading: "Overview",
        sectionPath: ["1"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p2:b2:heading",
        page: 2,
        text: "3.3 Leakage",
        blockType: "heading",
        sectionHeading: "Leakage",
        sectionPath: ["3", "3.3"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p2:b3:body",
        page: 2,
        text: "Leakage emissions are estimated using the project leakage accounting section.",
        blockType: "body",
        sectionHeading: "Leakage",
        sectionPath: ["3", "3.3"],
        source: "primary",
      },
    ]);

    const result = retrieveEvidenceForCheck(synthetic, "leakage");
    expect(result.evidence).not.toBeNull();
    expect(result.evidence!.sourceType).toBe("exact_section");
    expect(result.evidence!.spanId).toBe("synthetic-doc:p2:b3:body");
  });

  it("falls back to raw text when no fact contract or exact section evidence exists", () => {
    const synthetic = makeSyntheticDocument([
      {
        spanId: "synthetic-doc:p1:b1:heading",
        page: 1,
        text: "1 Overview",
        blockType: "heading",
        sectionHeading: "Overview",
        sectionPath: ["1"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p1:b2:body",
        page: 1,
        text: "The most likely baseline scenario is conversion to pasture in the project area.",
        blockType: "body",
        sectionHeading: "Overview",
        sectionPath: ["1"],
        source: "primary",
      },
    ]);

    const result = retrieveEvidenceForCheck(synthetic, "baseline_scenario");
    expect(result.evidence).not.toBeNull();
    expect(result.evidence!.sourceType).toBe("raw_text_fallback");
    expect(result.evidence!.quote).toContain("baseline scenario");
    expect(result.evidence!.page).toBe(1);
  });

  it("does not promote legal glossary definitions into PDD evidence", () => {
    const synthetic = makeSyntheticDocument([
      {
        spanId: "synthetic-doc:p1:b1:body",
        page: 1,
        text: "VCS ISSUANCE DEED OF REPRESENTATION",
        blockType: "body",
        sectionHeading: "Interpretation",
        sectionPath: ["1", "1.1"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p1:b2:body",
        page: 1,
        text: "\"Monitoring Report\" means the document that records data to allow the assessment of the Reductions generated by the Project during a given time period in accordance with the monitoring plan set out in the Project Description.",
        blockType: "body",
        sectionHeading: "Interpretation",
        sectionPath: ["1", "1.1"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p1:b3:body",
        page: 1,
        text: "\"Project Description\" means the document that describes the Project's Reduction activities.",
        blockType: "body",
        sectionHeading: "Interpretation",
        sectionPath: ["1", "1.1"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p1:b4:body",
        page: 1,
        text: "\"Verification Report\" means the written report of the verification covering the Reductions generated by the Project during the Verification Period.",
        blockType: "body",
        sectionHeading: "Interpretation",
        sectionPath: ["1", "1.1"],
        source: "primary",
      },
    ]);

    for (const result of retrieveEvidenceForAllChecks(synthetic)) {
      expect(result.evidence).toBeNull();
    }
  });

  it("does not accept a monitoring-report style baseline reference without an explicit baseline scenario definition", () => {
    const synthetic = makeSyntheticDocument([
      {
        spanId: "synthetic-doc:p1:b1:heading",
        page: 1,
        text: "2 General",
        blockType: "heading",
        sectionHeading: "General",
        sectionPath: ["2"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p1:b2:body",
        page: 1,
        text: "The Peruvian government proposes that the protected areas with REDD projects should harmonize their project baselines with national forest emission reference levels.",
        blockType: "body",
        sectionHeading: "General",
        sectionPath: ["2"],
        source: "primary",
      },
    ]);

    const result = retrieveEvidenceForCheck(synthetic, "baseline_scenario");
    expect(result.evidence).toBeNull();
  });

  it("ignores delegated supporting-document references and uses earlier baseline evidence instead", () => {
    const synthetic = makeSyntheticDocument([
      {
        spanId: "synthetic-doc:p4:b1:heading",
        page: 4,
        text: "1.7 Conditions prior to project initiation:",
        blockType: "heading",
        sectionHeading: "Conditions prior to project initiation:",
        sectionPath: ["1", "1.7"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p4:b2:body",
        page: 4,
        text: "It was not difficult to identify the baseline scenario for this project: rapid deforestation due to unplanned slash and burn agricultural expansion by subsistence farmers.",
        blockType: "body",
        sectionHeading: "Conditions prior to project initiation:",
        sectionPath: ["1", "1.7"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p9:b1:heading",
        page: 9,
        text: "2.4 Description of how the baseline scenario is identified and description of the identified baseline scenario:",
        blockType: "heading",
        sectionHeading: "Description of how the baseline scenario is identified and description of the identified baseline scenario:",
        sectionPath: ["2", "2.4"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p9:b2:body",
        page: 9,
        text: "Please refer to Supporting Document - VCS Methodology PD Requirements Section 6.1.",
        blockType: "body",
        sectionHeading: "Description of how the baseline scenario is identified and description of the identified baseline scenario:",
        sectionPath: ["2", "2.4"],
        source: "primary",
      },
    ]);

    const result = retrieveEvidenceForCheck(synthetic, "baseline_scenario");

    expect(result.evidence).not.toBeNull();
    expect(result.evidence!.page).toBe(4);
    expect(result.evidence!.quote).toContain("rapid deforestation due to unplanned slash and burn agricultural expansion by subsistence farmers");
  });

  it("expands wrapped methodology fact-contract evidence across the sentence boundary", () => {
    const synthetic = makeSyntheticDocument([
      {
        spanId: "synthetic-doc:p9:b1:heading",
        page: 9,
        text: "2.1 Title and reference of the VCS methodology applied to the project activity and explanation of methodology choices:",
        blockType: "heading",
        sectionHeading: "Title and reference of the VCS methodology applied to the project activity and explanation of methodology choices:",
        sectionPath: ["2", "2.1"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p9:b2:body",
        page: 9,
        text: "This project has used the VM0009 Methodology for Avoided Mosaic Deforestation of Tropical",
        blockType: "body",
        sectionHeading: "Title and reference of the VCS methodology applied to the project activity and explanation of methodology choices:",
        sectionPath: ["2", "2.1"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p9:b3:body",
        page: 9,
        text: "Forests, approved by the VCS for sectoral scope 14 on January 11th, 2011.",
        blockType: "body",
        sectionHeading: "Title and reference of the VCS methodology applied to the project activity and explanation of methodology choices:",
        sectionPath: ["2", "2.1"],
        source: "primary",
      },
    ]);

    const result = retrieveEvidenceForCheck(synthetic, "methodology");

    expect(result.evidence).not.toBeNull();
    expect(result.evidence!.page).toBe(9);
    expect(result.evidence!.quote).toContain("VM0009 Methodology for Avoided Mosaic Deforestation of Tropical Forests");
  });

  it("prefers a real additionality statement over a delegated supporting-document reference", () => {
    const synthetic = makeSyntheticDocument([
      {
        spanId: "synthetic-doc:p3:b1:heading",
        page: 3,
        text: "1.4 A brief description of the project:",
        blockType: "heading",
        sectionHeading: "A brief description of the project:",
        sectionPath: ["1", "1.4"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p3:b2:body",
        page: 3,
        text: "The project is shown to be clearly additional (under the project financial additionality tool) and the baseline, far hypothetical, is an intelligent extrapolation of empirically measured deforestation.",
        blockType: "body",
        sectionHeading: "A brief description of the project:",
        sectionPath: ["1", "1.4"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p9:b4:heading",
        page: 9,
        text: "2.5 Description of how the emissions of GHG by source in baseline scenario are reduced below those that would have occurred in the absence of the project activity (assessment and demonstration of additionality):",
        blockType: "heading",
        sectionHeading: "Description of how the emissions of GHG by source in baseline scenario are reduced below those that would have occurred in the absence of the project activity (assessment and demonstration of additionality):",
        sectionPath: ["2", "2.5"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p9:b5:body",
        page: 9,
        text: "Please refer to Supporting Document - VCS Methodology PD Requirements Sections 6.1 and 7.",
        blockType: "body",
        sectionHeading: "Description of how the emissions of GHG by source in baseline scenario are reduced below those that would have occurred in the absence of the project activity (assessment and demonstration of additionality):",
        sectionPath: ["2", "2.5"],
        source: "primary",
      },
    ]);

    const result = retrieveEvidenceForCheck(synthetic, "additionality");

    expect(result.evidence).not.toBeNull();
    expect(result.evidence!.page).toBe(3);
    expect(result.evidence!.quote).toContain("clearly additional");
  });

  it("rejects weak leakage mentions that do not explain leakage", () => {
    const synthetic = makeSyntheticDocument([
      {
        spanId: "synthetic-doc:p3:b1:heading",
        page: 3,
        text: "1.3 Estimated amount of emission reductions over the crediting period including project size:",
        blockType: "heading",
        sectionHeading: "Estimated amount of emission reductions over the crediting period including project size:",
        sectionPath: ["1", "1.3"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p3:b2:body",
        page: 3,
        text: "Additional tonnes may be deducted for leakage.",
        blockType: "body",
        sectionHeading: "Estimated amount of emission reductions over the crediting period including project size:",
        sectionPath: ["1", "1.3"],
        source: "primary",
      },
    ]);

    const result = retrieveEvidenceForCheck(synthetic, "leakage");
    expect(result.evidence).toBeNull();
  });

  it("recognizes stakeholder consultation with a trailing colon in the heading", () => {
    const synthetic = makeSyntheticDocument([
      {
        spanId: "synthetic-doc:p10:b1:heading",
        page: 10,
        text: "6 Stakeholders comments:",
        blockType: "heading",
        sectionHeading: "Stakeholders comments:",
        sectionPath: ["6"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p10:b2:body",
        page: 10,
        text: "Stakeholder comments were solicited via a public comment period on the internet, and by postings on local area notice boards.",
        blockType: "body",
        sectionHeading: "Stakeholders comments:",
        sectionPath: ["6"],
        source: "primary",
      },
    ]);

    const result = retrieveEvidenceForCheck(synthetic, "stakeholder_consultation");
    expect(result.evidence).not.toBeNull();
    expect(result.evidence!.page).toBe(10);
    expect(result.evidence!.sectionHeading).toBe("Stakeholders comments:");
  });

  it("prefers a deeper subsection that explicitly carries the mapped section phrase", () => {
    const synthetic = makeSyntheticDocument([
      {
        spanId: "synthetic-doc:p2:b1:heading",
        page: 2,
        text: "2.4 Baseline Scenario",
        blockType: "heading",
        sectionHeading: "Baseline Scenario",
        sectionPath: ["2", "2.4"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p2:b2:heading-fragment",
        page: 2,
        text: "2.4.1 Continuation of current land use",
        blockType: "heading",
        sectionHeading: "Continuation of current land use",
        sectionPath: ["2", "2.4", "2.4.1"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p2:b3:body",
        page: 2,
        text: "This scenario remains legally possible but is not the selected outcome.",
        blockType: "body",
        sectionHeading: "Continuation of current land use",
        sectionPath: ["2", "2.4", "2.4.1"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p2:b4:heading",
        page: 2,
        text: "2.4.2 Conversion to pasture",
        blockType: "heading",
        sectionHeading: "Conversion to pasture",
        sectionPath: ["2", "2.4", "2.4.2"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p2:b5:body",
        page: 2,
        text: "The most likely baseline scenario is conversion to pasture.",
        blockType: "body",
        sectionHeading: "Conversion to pasture",
        sectionPath: ["2", "2.4", "2.4.2"],
        source: "primary",
      },
    ]);

    const result = retrieveEvidenceForCheck(synthetic, "baseline_scenario");
    expect(result.evidence).not.toBeNull();
    expect(result.evidence!.sectionHeading).toBe("Conversion to pasture");
    expect(result.evidence!.quote).toBe(
      "The most likely baseline scenario is conversion to pasture.",
    );
  });

  it("rejects boilerplate blocks and stitches a split sentence inside the chosen subsection", () => {
    const synthetic = makeSyntheticDocument([
      {
        spanId: "synthetic-doc:p3:b1:heading",
        page: 3,
        text: "2.5 Additionality",
        blockType: "heading",
        sectionHeading: "Additionality",
        sectionPath: ["2", "2.5"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p3:b2:heading",
        page: 3,
        text: "2.5.1 Simple Cost Analysis",
        blockType: "heading",
        sectionHeading: "Simple Cost Analysis",
        sectionPath: ["2", "2.5", "2.5.1"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p3:b3:boilerplate",
        page: 3,
        text: "PROJECT DESCRIPTION: VCS Version 3",
        blockType: "body",
        sectionHeading: "Simple Cost Analysis",
        sectionPath: ["2", "2.5", "2.5.1"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p3:b4:body",
        page: 3,
        text: "As the project generates no financial benefit other than",
        blockType: "body",
        sectionHeading: "Simple Cost Analysis",
        sectionPath: ["2", "2.5", "2.5.1"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p3:b5:body",
        page: 3,
        text: "carbon revenue, a simple cost analysis is justified.",
        blockType: "body",
        sectionHeading: "Simple Cost Analysis",
        sectionPath: ["2", "2.5", "2.5.1"],
        source: "primary",
      },
    ]);

    const result = retrieveEvidenceForCheck(synthetic, "additionality");
    expect(result.evidence).not.toBeNull();
    expect(result.evidence!.spanId).toBe("synthetic-doc:p3:b4:body");
    expect(result.evidence!.quote).toBe(
      "As the project generates no financial benefit other than carbon revenue, a simple cost analysis is justified.",
    );
  });

  it("does not choose a subsection just because it contains Envira-specific words", () => {
    const synthetic = makeSyntheticDocument([
      {
        spanId: "synthetic-doc:p4:b1:heading",
        page: 4,
        text: "2.4 Baseline Scenario",
        blockType: "heading",
        sectionHeading: "Baseline Scenario",
        sectionPath: ["2", "2.4"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p4:b2:heading",
        page: 4,
        text: "2.4.1 Conversion to Pasture",
        blockType: "heading",
        sectionHeading: "Conversion to Pasture",
        sectionPath: ["2", "2.4", "2.4.1"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p4:b3:body",
        page: 4,
        text: "Envira Acre VCS project materials discuss conversion to pasture in a regional example.",
        blockType: "body",
        sectionHeading: "Conversion to Pasture",
        sectionPath: ["2", "2.4", "2.4.1"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p4:b4:heading",
        page: 4,
        text: "2.4.2 Alternative Land Use",
        blockType: "heading",
        sectionHeading: "Alternative Land Use",
        sectionPath: ["2", "2.4", "2.4.2"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p4:b5:body",
        page: 4,
        text: "The most likely baseline scenario is continued cattle ranching.",
        blockType: "body",
        sectionHeading: "Alternative Land Use",
        sectionPath: ["2", "2.4", "2.4.2"],
        source: "primary",
      },
    ]);

    const result = retrieveEvidenceForCheck(synthetic, "baseline_scenario");
    expect(result.evidence).not.toBeNull();
    expect(result.evidence!.quote).toContain("most likely baseline scenario");
    expect(result.evidence!.quote).not.toContain("Envira");
    expect(result.evidence!.quote).not.toContain("Acre");
    expect(result.evidence!.quote).not.toContain("VCS");
    expect(result.evidence!.sectionPath).toStrictEqual(["2", "2.4", "2.4.2"]);
    expect(result.evidence!.sourceType).toBe("exact_section");
  });

  it("prefers actual stakeholder consultation details over an unchanged-from-PDD placeholder", () => {
    const synthetic = makeSyntheticDocument([
      {
        spanId: "synthetic-doc:p22:b1:heading",
        page: 22,
        text: "2.3 Stakeholder Engagement",
        blockType: "heading",
        sectionHeading: "Stakeholder Engagement",
        sectionPath: ["2", "2.3"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p22:b2:heading",
        page: 22,
        text: "2.3.1 Community Consultation (G3.8)",
        blockType: "heading",
        sectionHeading: "Community Consultation (G3.8)",
        sectionPath: ["2", "2.3", "2.3.1"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p22:b3:body",
        page: 22,
        text: "Unchanged from the description in the validated PDD.",
        blockType: "body",
        sectionHeading: "Community Consultation (G3.8)",
        sectionPath: ["2", "2.3", "2.3.1"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p22:b4:body",
        page: 22,
        text: "For the population in the buffer zone, monthly visits of CIMA's technical field staff to communities provide an opportunity to present information and receive comments.",
        blockType: "body",
        sectionHeading: "Community Consultation (G3.8)",
        sectionPath: ["2", "2.3", "2.3.1"],
        source: "primary",
      },
    ]);

    const result = retrieveEvidenceForCheck(synthetic, "stakeholder_consultation");
    expect(result.evidence).not.toBeNull();
    expect(result.evidence!.spanId).toBe("synthetic-doc:p22:b4:body");
  });
});
