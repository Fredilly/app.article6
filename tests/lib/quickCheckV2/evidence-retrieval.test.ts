import { describe, expect, it } from "@jest/globals";
import {
  loadAndParseExtractedText,
  retrieveEvidenceForAllChecks,
  retrieveEvidenceForCheck,
  type QuickCheckV2ExtractedDocument,
  type RetrievedCheckEvidence,
} from "@/lib/quickCheckV2/evidence";

const ENVIRA_FIXTURE_PATH =
  "tests/fixtures/quick-check/proj-desc-1382-extracted.txt";

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
  const enviraDoc = loadAndParseExtractedText(ENVIRA_FIXTURE_PATH);
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
      { checkName: "baseline_scenario", sectionText: "Baseline Scenario", page: 37 },
      { checkName: "additionality", sectionText: "Additionality", page: 38 },
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
});
