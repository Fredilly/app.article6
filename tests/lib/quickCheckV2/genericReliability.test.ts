import { describe, expect, it } from "@jest/globals";
import { extractAnswersForAllChecks } from "@/lib/quickCheckV2/answers";
import { loadAndParseExtractedText } from "@/lib/quickCheckV2/evidence";
import { validateAnswerResult, validateAnswerResults, type StatusResult } from "@/lib/quickCheckV2/status";
import type { AnswerResult } from "@/lib/quickCheckV2/answers";
import { buildQuickCheckEvidenceStackWithCompanions } from "@/lib/quickCheckV2/evidenceStackProducer";
import type { QuickCheckV2Block, QuickCheckV2ExtractedDocument, RetrievedCheckEvidence } from "@/lib/quickCheckV2/evidence";

const FIXTURE = "tests/fixtures/quick-check/v2/5595-asvata-alm-india/extracted.txt";

function answer(checkName: AnswerResult["checkName"], quote: string): AnswerResult {
  const evidence = {
    sourceType: "exact_section" as const,
    quote,
    page: 2,
    sectionHeading: checkName,
    sectionPath: ["2", "2.1"],
    spanId: `synthetic:${checkName}`,
  };
  return { checkName, answer: quote, evidence, evidenceStack: [{ ...evidence, role: "primary" as const }] };
}

function status(checkName: AnswerResult["checkName"], quote: string): StatusResult {
  return validateAnswerResult(answer(checkName, quote));
}

function methodologyStatus(blocks: QuickCheckV2Block[]): StatusResult {
  const evidence = {
    sourceType: "exact_section" as const,
    quote: blocks[0]!.text,
    page: blocks[0]!.page,
    sectionHeading: blocks[0]!.sectionHeading,
    sectionPath: blocks[0]!.sectionPath,
    spanId: blocks[0]!.spanId,
  };
  const document: QuickCheckV2ExtractedDocument = {
    documentId: "synthetic-methodology",
    parser: "test",
    blocks,
    diagnostics: { warnings: [] },
  };
  const selected: RetrievedCheckEvidence = { checkName: "methodology", evidence };
  return validateAnswerResult({
    checkName: "methodology",
    answer: evidence.quote,
    evidence,
    evidenceStack: buildQuickCheckEvidenceStackWithCompanions(document, selected),
  });
}

function methodologyBlock(text: string, heading: string): QuickCheckV2Block {
  return {
    spanId: `synthetic:${heading}:${text}`,
    page: 2,
    text,
    blockType: "body",
    sectionHeading: heading,
    sectionPath: ["2", "2.1"],
    source: "primary",
  };
}

describe("Quick Check v2 generic reliability protections", () => {
  it("reconciles 5595 without changing reviewed fixture truth", () => {
    const document = loadAndParseExtractedText(FIXTURE, "reviewed-fixture");
    const results = validateAnswerResults(extractAnswersForAllChecks(document));
    expect(results.map((result) => [result.checkName, result.status])).toStrictEqual([
      ["host_country", "FOUND"],
      ["methodology", "UNCLEAR"],
      ["baseline_scenario", "FOUND"],
      ["additionality", "UNCLEAR"],
      ["leakage", "UNCLEAR"],
      ["stakeholder_consultation", "FOUND"],
    ]);
    expect(results.find((result) => result.checkName === "stakeholder_consultation")?.evidence?.quote).toContain("Date of stakeholder consultation");
  });

  it("cannot promote untouched template instructions to FOUND", () => {
    const result = status("leakage", "Describe the procedure for quantification of leakage emissions in accordance with the applied methodology.");
    expect(result.status).toBe("UNCLEAR");
  });

  it("does not treat additionality framework requirements as a completed assessment", () => {
    const result = status("additionality", "The additionality of this project is demonstrated in two steps according to the methodology requirements.");
    expect(result.status).toBe("UNCLEAR");
  });

  it("does not silently resolve contradictory methodology versions", () => {
    const result = validateAnswerResult({
      ...answer("methodology", "Methodology VM0042 Methodology for improved agricultural land management 2.0"),
      evidenceStack: [
        { ...answer("methodology", "Methodology VM0042 Methodology for improved agricultural land management 2.0").evidence!, role: "primary", sourceType: "fact_contract" },
        { ...answer("methodology", "The project adheres to VM0042 v2.1 methodology.").evidence!, role: "caveat", label: "Conflicting methodology version declaration" },
      ],
    });
    expect(result.status).toBe("UNCLEAR");
    expect(result.reason).toBe("methodology_version_conflict");
  });

  it("only treats active methodology declarations as conflicting", () => {
    const active = methodologyBlock("The project applies VM0007 v1.8 methodology.", "Application of Methodology");
    const activeConflict = methodologyBlock("The project adheres to VM0007 v1.9 methodology.", "Eligibility");
    expect(methodologyStatus([active, activeConflict]).status).toBe("UNCLEAR");
    expect(methodologyStatus([
      active,
      methodologyBlock("The project previously used VM0007 v1.7 before the current methodology was adopted.", "Methodology History"),
    ]).status).toBe("FOUND");
    expect(methodologyStatus([
      active,
      methodologyBlock("Compared with VM0007 v1.7, the current project declaration uses the selected methodology.", "Methodology Comparison"),
    ]).status).toBe("FOUND");
  });

  it("keeps a related but incomplete leakage discussion unclear", () => {
    const result = status("leakage", "The possible source of leakage could be increased fuel wood and grazing activity outside the project boundary. There was no displacement of pre-project grazing activities.");
    expect(result.status).toBe("UNCLEAR");
  });

  it("still accepts substantive project-specific leakage quantification", () => {
    const result = status("leakage", "The project quantified leakage emissions at 0 tCO2e using the applied methodology equation and recorded the calculation for the monitoring period.");
    expect(result.status).toBe("FOUND");
  });

  it("accepts reasoned project-specific no-displacement evidence without requiring numbers", () => {
    const result = status("leakage", "State the project-specific leakage outcome: no displacement occurred because grazing is not permitted within the project area.");
    expect(result.status).toBe("FOUND");
  });

  it("protects substantive baseline evidence", () => {
    const result = status("baseline_scenario", "The baseline scenario is the continuation of pre-project agricultural management practices, including burning of crop residue and intensive tillage.");
    expect(result.status).toBe("FOUND");
  });
});
