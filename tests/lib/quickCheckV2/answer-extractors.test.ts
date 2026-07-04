import { describe, expect, it } from "@jest/globals";
import {
  extractAnswerFromEvidence,
  extractAnswersForAllChecks,
  extractMethodologyDetailsFromEvidence,
} from "@/lib/quickCheckV2/answers";
import {
  loadAndParseExtractedText,
  retrieveEvidenceForAllChecks,
  type RetrievedCheckEvidence,
  type RetrievedEvidence,
  type QuickCheckV2ExtractedDocument,
} from "@/lib/quickCheckV2/evidence";
import { validateAnswerResult } from "@/lib/quickCheckV2/status";

const ENVIRA_FIXTURE_PATH =
  "tests/fixtures/quick-check/v2/envira/extracted.txt";
const ENVIRA_DOCUMENT_ID = "proj-desc-1382-extracted";
const MARCONDES_FIXTURE_PATH =
  "tests/fixtures/quick-check/v2/marcondes-pdd/extracted.txt";
const MARCONDES_DOCUMENT_ID = "marcondes-pdd-extracted";

function answerIsGroundedInEvidence(
  answer: string | null,
  evidence: RetrievedEvidence | null,
): boolean {
  if (!answer || !evidence) return answer === null;
  const answerTokens = answer
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4)
    .filter((token) => !["that", "this", "with", "from", "into", "through", "because", "project"].includes(token));
  const quote = evidence.quote.toLowerCase();
  const overlappingTokens = answerTokens.filter((token) => quote.includes(token));

  return overlappingTokens.length >= Math.min(2, answerTokens.length);
}

function makeSyntheticDocument(
  blocks: QuickCheckV2ExtractedDocument["blocks"],
): QuickCheckV2ExtractedDocument {
  return {
    documentId: "synthetic-doc",
    parser: "test",
    blocks,
    diagnostics: { warnings: [], pageCount: 20 },
  };
}

describe("Quick Check v2 — Phase 4 tiny answer extractors", () => {
  const document = loadAndParseExtractedText(
    ENVIRA_FIXTURE_PATH,
    ENVIRA_DOCUMENT_ID,
  );
  const marcondesDocument = loadAndParseExtractedText(
    MARCONDES_FIXTURE_PATH,
    MARCONDES_DOCUMENT_ID,
  );
  const selectedEvidence = retrieveEvidenceForAllChecks(document);
  const answers = extractAnswersForAllChecks(document);
  const marcondesAnswers = extractAnswersForAllChecks(marcondesDocument);

  it("returns answer results for all six structured checks", () => {
    expect(answers.map((result) => result.checkName)).toStrictEqual([
      "host_country",
      "methodology",
      "baseline_scenario",
      "additionality",
      "leakage",
      "stakeholder_consultation",
    ]);
    expect(answers).toHaveLength(6);
  });

  it("returns Brazil for host_country", () => {
    const result = answers.find((item) => item.checkName === "host_country");
    expect(result?.answer).toBe("Brazil");
  });

  it("returns Brazil for the Marcondes host_country check", () => {
    const result = marcondesAnswers.find((item) => item.checkName === "host_country");
    expect(result?.answer).toBe("Brazil");
  });

  it("returns a methodology answer that includes VM0007", () => {
    const result = answers.find((item) => item.checkName === "methodology");
    expect(result?.answer).toContain("VM0007");
  });

  it("extracts host country from a possessive country reference", () => {
    const evidence = {
      sourceType: "fact_contract" as const,
      quote: "The PNCAZ is managed by CIMA under a Total Management Contract with the Peru’s Natural Protected Areas Service (SERNANP).",
      page: 13,
      sectionHeading: "Project Location (G3.3)",
      sectionPath: ["2", "2.1", "2.1.7"],
      spanId: "synthetic-doc:p13:b1:host",
    };

    expect(extractAnswerFromEvidence({
      checkName: "host_country",
      evidence,
    }).answer).toBe("Peru");
  });

  it("extracts a clean methodology answer with the version number", () => {
    const evidence = {
      sourceType: "exact_section" as const,
      quote: "The methodology used to quantify the avoided emissions is the framework and component modules of the modular REDD methodology VM0007 REDD Methodology Modules Version 1.3 approved 20 November 2012.",
      page: 15,
      sectionHeading: "Title and Reference of Methodology",
      sectionPath: ["2", "2.1", "2.1.8"],
      spanId: "synthetic-doc:p15:b1:methodology",
    };

    expect(extractAnswerFromEvidence({
      checkName: "methodology",
      evidence,
    }).answer).toBe("VM0007: REDD Methodology Modules Version 1.3");
  });

  it("extracts structured methodology metadata from the Marcondes table row", () => {
    const result = marcondesAnswers.find((item) => item.checkName === "methodology");
    const methodology = extractMethodologyDetailsFromEvidence(result?.evidence ?? null);

    expect(result?.answer).toBe("VM0007 REDD+ Methodology Framework v1.8");
    expect(methodology).toStrictEqual({
      methodologyId: "VM0007",
      methodologyName: "REDD+ Methodology Framework",
      methodologyAlias: "REDD+MF",
      pddDeclaredMethodologyVersion: "v1.8",
      versionStatus: "DECLARED",
      evidencePage: 61,
      evidenceSection: "Title and Reference of Methodology (VCS, 3.1)",
      evidenceQuote: result?.evidence?.quote,
    });
  });

  it("prefers the Table 30 methodology row over the conflicting v1.7 prose sentence", () => {
    const evidence = {
      sourceType: "fact_contract" as const,
      quote: "As required by VM0007 v1.7, the project area consists of contiguous, discrete areas covered by forest that meet the definition of eligible forest, which would be an area that has been forested for at least 10 years prior to the project start date. Table 30. Methodologies, modules, and tools applied Applied Methodology VM0007 REDD+ Methodology Framework (REDD+MF) (Avoided Planned Deforestation) 1.8 Module VMD0001 Estimation of carbon stocks in the above- and below-ground biomass in live trees and non-tree pools 1.2",
      page: 61,
      sectionHeading: "Title and Reference of Methodology (VCS, 3.1)",
      sectionPath: ["3", "3.1", "3.1.1"],
      spanId: "synthetic-doc:p61:b1:methodology",
    };

    const result = extractAnswerFromEvidence({
      checkName: "methodology",
      evidence,
    });

    expect(result.answer).toBe("VM0007 REDD+ Methodology Framework v1.8");
    expect(extractMethodologyDetailsFromEvidence(result.evidence)).toStrictEqual({
      methodologyId: "VM0007",
      methodologyName: "REDD+ Methodology Framework",
      methodologyAlias: "REDD+MF",
      pddDeclaredMethodologyVersion: "v1.8",
      versionStatus: "DECLARED",
      evidencePage: 61,
      evidenceSection: "Title and Reference of Methodology (VCS, 3.1)",
      evidenceQuote: evidence.quote,
    });
  });

  it("extracts a concise VM0009 methodology answer from a wrapped sentence", () => {
    const evidence = {
      sourceType: "fact_contract" as const,
      quote: "This project has used the VM0009 Methodology for Avoided Mosaic Deforestation of Tropical Forests, approved by the VCS for sectoral scope 14 on January 11th, 2011.",
      page: 9,
      sectionHeading: "Title and reference of the VCS methodology applied to the project activity and explanation of methodology choices:",
      sectionPath: ["2", "2.1"],
      spanId: "synthetic-doc:p9:b1:methodology",
    };

    expect(extractAnswerFromEvidence({
      checkName: "methodology",
      evidence,
    }).answer).toBe("VM0009 Methodology for Avoided Mosaic Deforestation of Tropical Forests");
  });

  it("keeps answers grounded in the selected Phase 3 evidence", () => {
    for (const result of answers) {
      expect(answerIsGroundedInEvidence(result.answer, result.evidence)).toBe(true);
    }
  });

  it("returns non-null answers for the Envira fixture", () => {
    for (const result of answers) {
      expect(result.answer).not.toBeNull();
    }
  });

  it("extracts a no-leakage answer from an explicit not-applicable leakage statement", () => {
    const evidence = {
      sourceType: "exact_section" as const,
      quote: "Leakage: Not applicable",
      page: 4,
      sectionHeading: "Leakage",
      sectionPath: ["3", "3.1"],
      spanId: "synthetic-doc:p4:b1:leakage",
    };

    const result = extractAnswerFromEvidence({
      checkName: "leakage",
      evidence,
    });

    expect(result.answer).toBe("No leakage was identified.");
    expect(validateAnswerResult(result)).toMatchObject({
      status: "FOUND",
      reason: "answer_and_provenance_complete",
    });
  });

  it("does not mark the Marcondes leakage placeholder as FOUND", () => {
    const result = marcondesAnswers.find((item) => item.checkName === "leakage");
    expect(result?.answer).toBeNull();
    expect(validateAnswerResult(result ?? { checkName: "leakage", answer: null, evidence: null })).toMatchObject({
      status: "UNCLEAR",
      reason: "answer_missing",
    });
  });

  it("extracts the Marcondes baseline scenario from Scenario 2 evidence", () => {
    const result = marcondesAnswers.find((item) => item.checkName === "baseline_scenario");
    expect(result?.answer).toContain("Legal deforestation of 20% of the property (APD)");
    expect(result?.answer).toContain("forest suppression for pasture");
  });

  it("extracts the Marcondes additionality evidence from the carbon finance barrier sentence", () => {
    const result = marcondesAnswers.find((item) => item.checkName === "additionality");
    expect(result?.answer).toContain("would not occur without carbon finance");
    expect(result?.answer).toContain("financial barriers");
  });

  it("extracts the Marcondes stakeholder consultation summary from the FPIC timeline", () => {
    const result = marcondesAnswers.find((item) => item.checkName === "stakeholder_consultation");
    expect(result?.answer).toContain("Exploratory visit");
    expect(result?.answer).toContain("FPIC Principal Assembly");
  });

  it("returns null when evidence is missing", () => {
    const noEvidence: RetrievedCheckEvidence = {
      checkName: "additionality",
      evidence: null,
    };

    expect(extractAnswerFromEvidence(noEvidence)).toStrictEqual({
      checkName: "additionality",
      answer: null,
      evidence: null,
    });
  });

  it("preserves the original Phase 3 evidence object", () => {
    for (let index = 0; index < answers.length; index += 1) {
      expect(answers[index]!.evidence).toStrictEqual(selectedEvidence[index]!.evidence);
    }
  });

  it("does not leak status, score, or router fields", () => {
    for (const result of answers) {
      expect(Object.keys(result)).toStrictEqual(["checkName", "answer", "evidence"]);
      expect(Object.keys(result)).not.toContain("status");
      expect(Object.keys(result)).not.toContain("score");
      expect(Object.keys(result)).not.toContain("router");
      if (result.evidence) {
        expect(Object.keys(result.evidence)).not.toContain("status");
        expect(Object.keys(result.evidence)).not.toContain("score");
        expect(Object.keys(result.evidence)).not.toContain("router");
      }
    }
  });

  it("prefers an explicit baseline-development section over an earlier generic baseline mention", () => {
    const synthetic = makeSyntheticDocument([
      {
        spanId: "synthetic-doc:p4:b1:heading",
        page: 4,
        text: "A.4.3 Brief explanation of how emissions are reduced",
        blockType: "heading",
        sectionHeading: "Brief explanation of how emissions are reduced",
        sectionPath: ["A", "A.4", "A.4.3"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p4:b2:body",
        page: 4,
        text: "The project reduces consumption of grid electricity when compared to the baseline scenario.",
        blockType: "body",
        sectionHeading: "Brief explanation of how emissions are reduced",
        sectionPath: ["A", "A.4", "A.4.3"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p15:b1:heading",
        page: 15,
        text: "B.5. Details of the baseline and its development:",
        blockType: "heading",
        sectionHeading: "Details of the baseline and its development:",
        sectionPath: ["B", "B.5"],
        source: "primary",
      },
      {
        spanId: "synthetic-doc:p15:b2:body",
        page: 15,
        text: "The baseline is defined independently for each component project activity as the electricity consumption in the year previous to project implementation.",
        blockType: "body",
        sectionHeading: "Details of the baseline and its development:",
        sectionPath: ["B", "B.5"],
        source: "primary",
      },
    ]);

    const result = extractAnswersForAllChecks(synthetic).find(
      (item) => item.checkName === "baseline_scenario",
    );

    expect(result?.evidence?.page).toBe(15);
    expect(result?.evidence?.sectionPath).toStrictEqual(["B", "B.5"]);
    expect(result?.evidence?.quote).toBe(
      "The baseline is defined independently for each component project activity as the electricity consumption in the year previous to project implementation.",
    );
    expect(result?.answer).toBe(
      "The electricity consumption in the year previous to project implementation.",
    );
  });
});
