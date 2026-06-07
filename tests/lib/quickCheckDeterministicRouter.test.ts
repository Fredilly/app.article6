import { describe, expect, it } from "@jest/globals";
import type { DocumentStructure } from "@/lib/documentModel";
import {
  buildReviewQuestionResult,
  getStructuredQueryContext,
} from "@/lib/chat/quickCheckReviewQuestion";
import { parseDocumentText } from "@/lib/documentParsing";
import { compileEvidenceDocumentFromStructure } from "@/lib/quickCheck/evidence/compileEvidenceDocument";
import { validateQuotes } from "@/lib/quickCheck/evidence/validateQuotes";
import { buildSectionTableIndex } from "@/lib/quickCheck/indexing";
import { buildProjectFactContract } from "@/lib/quickCheck/projectFacts";

const FACT_PDD_TEXT = [
  "Project Title: Coastal Mangrove Restoration Project",
  "Host Country: Kenya",
  "Project Proponent: Blue Carbon Initiative",
  "Methodology Applied: VM0007 REDD+ Methodology Framework",
  "",
  "2.2 Project Location",
  "The project is located in Lamu County, Kenya.",
  "",
  "2.4 Baseline Scenario",
  "Without the project activity, mangrove clearing would continue and emissions would increase.",
].join("\n");

const SECTION_PDD_TEXT = [
  "1.0 Project Summary",
  "This project restores degraded forest land.",
  "",
  "2.4 Baseline Scenario",
  "The baseline scenario is continued grazing pressure and fuelwood extraction without the project.",
  "Remote sensing and field observations support the without-project scenario.",
  "",
  "3.1 Monitoring Plan",
  "Monitoring occurs annually.",
].join("\n");

const NON_PROVENANCE_TABLE_TEXT = [
  "1.0 Appendix",
  "A summary table is mentioned in the appendix narrative.",
  "The table itself is not extracted with row or column provenance here.",
].join("\n");

function buildResult(claimText: string, rawPddText: string) {
  return buildReviewQuestionResult({
    claimText,
    methodologyId: "VM0007",
    methodologyVersion: "4.2",
    rawPddText,
  });
}

function makeStructure(overrides: Partial<DocumentStructure>): DocumentStructure {
  return {
    id: "article6-document:test",
    source: "test-parser",
    parserAdapterId: "current-extractor",
    rawText: overrides.rawText ?? "",
    cleanText: overrides.cleanText ?? "",
    matchingText: overrides.matchingText ?? "",
    documentFamily: overrides.documentFamily ?? {
      family: "UNKNOWN",
      confidence: 0.2,
      evidence: [],
      signals: [],
      warnings: [],
    },
    qualityReport: overrides.qualityReport ?? {
      parserName: "test-parser",
      warnings: [],
      sourceContentMode: "unknown",
      pageCount: 1,
      textDensity: 0.2,
      ocrConfidence: undefined,
      tableHeavyWarning: false,
      layoutHeavyWarning: false,
      headersFootersDetected: false,
      weakExtractionWarning: false,
      hasStructuredHeadings: true,
      hasPageBoundaries: false,
      hasBoundingBoxes: false,
      hasTables: true,
    },
    pages: overrides.pages ?? [],
    blocks: overrides.blocks ?? [],
    sections: overrides.sections ?? [],
    extractionWarnings: overrides.extractionWarnings ?? [],
    parserDiagnostics: overrides.parserDiagnostics,
    debug: overrides.debug,
  };
}

function buildTableStructuredContext() {
  const rawText = [
    "3.1 Monitoring Plan",
    "Parameter | Value",
    "Monitoring frequency | Annual",
    "Plot revisit cycle | 12 months",
  ].join("\n");
  const documentStructure = makeStructure({
    rawText,
    cleanText: rawText,
    matchingText: rawText.toLowerCase(),
    sections: [{
      id: "section:3.1",
      sectionNumber: "3.1",
      titleRaw: "Monitoring Plan",
      titleClean: "Monitoring Plan",
      titleMatchingText: "monitoring plan",
      bodyRaw: rawText,
      bodyClean: rawText,
      bodyMatchingText: rawText.toLowerCase(),
      displaySnippet: rawText,
      matchingText: `monitoring plan ${rawText.toLowerCase()}`,
      parentId: undefined,
      childIds: [],
      blockIds: ["heading-1", "table-1"],
      sourceRefs: [],
      confidence: 0.96,
      extractionWarnings: [],
    }],
    blocks: [
      {
        id: "heading-1",
        type: "heading",
        rawText: "3.1 Monitoring Plan",
        cleanText: "3.1 Monitoring Plan",
        matchingText: "3.1 monitoring plan",
        pageNumber: 1,
        sectionId: "section:3.1",
        sectionPath: ["section:3", "section:3.1"],
        sourceRefs: [],
        confidence: 0.95,
      },
      {
        id: "table-1",
        type: "table",
        rawText: "Parameter | Value\nMonitoring frequency | Annual\nPlot revisit cycle | 12 months",
        cleanText: "Parameter | Value\nMonitoring frequency | Annual\nPlot revisit cycle | 12 months",
        matchingText: "parameter value monitoring frequency annual plot revisit cycle 12 months",
        pageNumber: 1,
        sectionId: "section:3.1",
        sectionPath: ["section:3", "section:3.1"],
        table: {
          id: "table-1",
          pageNumber: 1,
          rowCount: 3,
          columnCount: 2,
          headerRowCount: 1,
          cells: [
            { rowIndex: 0, columnIndex: 0, text: "Parameter" },
            { rowIndex: 0, columnIndex: 1, text: "Value" },
            { rowIndex: 1, columnIndex: 0, text: "Monitoring frequency" },
            { rowIndex: 1, columnIndex: 1, text: "Annual" },
            { rowIndex: 2, columnIndex: 0, text: "Plot revisit cycle" },
            { rowIndex: 2, columnIndex: 1, text: "12 months" },
          ],
        },
        sourceRefs: [],
        confidence: 0.92,
      },
    ],
    pages: [{
      id: "page:1",
      pageNumber: 1,
      rawText,
      cleanText: rawText,
      matchingText: rawText.toLowerCase(),
      blockIds: ["heading-1", "table-1"],
      sourceRefs: [],
    }],
  });
  const evidenceDocument = compileEvidenceDocumentFromStructure({
    docId: "router-table-test",
    documentStructure,
  });
  const sectionTableIndex = buildSectionTableIndex({
    documentStructure,
    evidenceDocument,
  });
  return {
    parsedDocument: parseDocumentText({ rawText }),
    documentStructure,
    evidenceDocument,
    projectFactContract: buildProjectFactContract(evidenceDocument),
    sectionTableIndex,
  };
}

function expectAnsweredProvenance(rawPddText: string, result: ReturnType<typeof buildResult>) {
  expect(result.routerResult.status).toBe("answered");
  expect(result.routerResult.evidenceSpanIds.length).toBeGreaterThan(0);
  expect(result.routerResult.quotes.length).toBeGreaterThan(0);
  expect(result.routerResult.pages.length).toBeGreaterThan(0);
  expect(result.routerResult.sectionPaths.length).toBeGreaterThan(0);
  expect(result.routerResult.route).not.toBe("fallback");
  expect(result.routerResult.confidence).toBeGreaterThanOrEqual(0.7);

  const context = getStructuredQueryContext(rawPddText);
  const validations = validateQuotes(
    context.evidenceDocument,
    result.routerResult.quotes.map((quote) => ({ quote })),
  );
  expect(validations.every((validation) => validation.valid)).toBe(true);
}

describe("deterministic router contract", () => {
  it("answers fact questions from ProjectFactContract with validated provenance", () => {
    const result = buildResult("What is the project title and host country?", FACT_PDD_TEXT);

    expect(result.routerResult.route).toBe("project_fact_contract");
    expect(result.routerResult.answerText).toContain("Project title:");
    expect(result.routerResult.answerText).toContain("Host country: Kenya.");
    expectAnsweredProvenance(FACT_PDD_TEXT, result);
  });

  it("answers section questions from the section index", () => {
    const result = buildResult("Explain the baseline scenario.", SECTION_PDD_TEXT);

    expect(result.routerResult.route).toBe("section_index");
    expect(result.routerResult.answerText).toContain("Baseline Scenario");
    expectAnsweredProvenance(SECTION_PDD_TEXT, result);
  });

  it("answers table questions only when table-backed provenance exists", () => {
    const structuredQueryContext = buildTableStructuredContext();
    const result = buildReviewQuestionResult({
      claimText: "What does the table say about monitoring frequency?",
      methodologyId: "VM0007",
      methodologyVersion: "4.2",
      rawPddText: structuredQueryContext.documentStructure.rawText,
      structuredQueryContext,
    });

    expect(result.routerResult.route).toBe("table_index");
    expect(result.routerResult.answerText).toContain("Monitoring frequency");
    expectAnsweredProvenance(structuredQueryContext.documentStructure.rawText, result);
  });

  it("returns no_evidence for unsupported questions", () => {
    const result = buildResult("What is the stock price of the project developer?", FACT_PDD_TEXT);

    expect(result.routerResult.status).toBe("no_evidence");
    expect(result.routerResult.route).toBe("fallback");
    expect(result.routerResult.evidenceSpanIds).toEqual([]);
    expect(result.routerResult.quotes).toEqual([]);
  });

  it("returns unclear for low-confidence or ambiguous questions", () => {
    const result = buildResult("baseline methodology", FACT_PDD_TEXT);

    expect(result.routerResult.status).toBe("unclear");
    expect(result.routerResult.route).toBe("fallback");
    expect(result.routerResult.warnings).toContain("ambiguous_intent");
  });

  it("keeps baseline questions from answering from tables unless the query is calculation-specific", () => {
    const result = buildResult("What does the table say about the baseline scenario?", NON_PROVENANCE_TABLE_TEXT);

    expect(result.routerResult.route).toBe("fallback");
    expect(result.routerResult.status).toBe("no_evidence");
  });
});
