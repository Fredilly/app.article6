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
});
