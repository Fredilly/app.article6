import { describe, expect, test } from "@jest/globals";
import type { DocumentStructure } from "@/lib/documentModel";
import { buildDocumentStructure } from "@/lib/documentModel";
import { parseDocumentText } from "@/lib/documentParsing";
import { compileEvidenceDocumentFromStructure } from "@/lib/quickCheck/evidence/compileEvidenceDocument";
import {
  buildSectionTableIndex,
  buildSectionTopicMap,
  buildSectionTree,
  buildTableIndex,
  findBestTopicMatch,
  validateSectionTree,
  validateTableIndex,
} from "@/lib/quickCheck/indexing";
import {
  loadProjectFactFixtureManifest,
  runProjectFactFixturePipeline,
} from "./projectFactContractFixtureHarness";

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
      hasTables: false,
    },
    pages: overrides.pages ?? [],
    blocks: overrides.blocks ?? [],
    sections: overrides.sections ?? [],
    extractionWarnings: overrides.extractionWarnings ?? [],
    parserDiagnostics: overrides.parserDiagnostics,
    debug: overrides.debug,
  };
}

function findFixture(fixtureId: string) {
  const manifest = loadProjectFactFixtureManifest();
  const fixture = manifest.fixtures.find((entry) => entry.id === fixtureId);
  if (!fixture) {
    throw new Error(`Expected fixture "${fixtureId}" to exist in the project fact manifest.`);
  }
  return fixture;
}

describe("Section and table index", () => {
  test("builds a section tree and topic map for numeric sections", () => {
    const parsed = parseDocumentText({
      rawText: [
        "1 Project Description",
        "The project is implemented in Indonesia.",
        "",
        "2 Baseline Scenario",
        "Without the project, grid electricity remains fossil-intensive.",
        "",
        "3 Monitoring Plan",
        "Monitoring procedures are described here.",
        "",
        "4 Leakage",
        "Leakage is not expected.",
        "",
        "5 Demonstration of Additionality",
        "The activity is additional.",
      ].join("\n"),
    });
    const structure = buildDocumentStructure({ parsedDocument: parsed });
    const evidence = compileEvidenceDocumentFromStructure({ docId: "numeric-doc", documentStructure: structure });
    const sectionTree = buildSectionTree({ documentStructure: structure, evidenceDocument: evidence });
    const topicMap = buildSectionTopicMap({ documentStructure: structure, sectionTree });

    expect(sectionTree.orderedNodeIds).toEqual([
      "section:1",
      "section:2",
      "section:3",
      "section:4",
      "section:5",
    ]);
    expect(sectionTree.nodesById["section:2"]).toEqual(expect.objectContaining({
      heading: "Baseline Scenario",
      sectionNumber: "2",
      evidenceSpanIds: expect.arrayContaining(["numeric-doc:element:heading:2"]),
      pageNumbers: [1],
    }));
    expect(topicMap.baseline[0]).toEqual(expect.objectContaining({
      sectionId: "section:2",
      heading: "Baseline Scenario",
      pageNumbers: [1],
    }));
    expect(topicMap.monitoring[0]).toEqual(expect.objectContaining({
      sectionId: "section:3",
      heading: "Monitoring Plan",
    }));
    expect(topicMap.leakage[0]).toEqual(expect.objectContaining({
      sectionId: "section:4",
      heading: "Leakage",
    }));
    expect(topicMap.additionality[0]).toEqual(expect.objectContaining({
      sectionId: "section:5",
      heading: "Demonstration of Additionality",
    }));
  });

  test("supports CDM-style lettered sections and preserves nested paths", () => {
    const parsed = parseDocumentText({
      rawText: [
        "A.1 Purpose of the project activity",
        "This section introduces the CDM project activity.",
        "",
        "B.4 Leakage",
        "Leakage emissions are negligible.",
        "",
        "B.5 Monitoring methodology and plan",
        "Monitoring parameters and QA/QC procedures are described here.",
      ].join("\n"),
    });
    const structure = buildDocumentStructure({ parsedDocument: parsed });
    const evidence = compileEvidenceDocumentFromStructure({ docId: "cdm-doc", documentStructure: structure });
    const index = buildSectionTableIndex({ documentStructure: structure, evidenceDocument: evidence });

    expect(index.sectionTree.nodesById["section:A.1"]).toEqual(expect.objectContaining({
      heading: "Purpose of the project activity",
      sectionNumber: "A.1",
      sectionPath: expect.arrayContaining(["section:A.1"]),
    }));
    expect(index.sectionTree.nodesById["section:B.5"]).toEqual(expect.objectContaining({
      heading: "Monitoring methodology and plan",
      sectionNumber: "B.5",
      pageNumbers: [1],
    }));
    expect(index.sectionTopicMap.leakage[0]).toEqual(expect.objectContaining({
      sectionId: "section:B.4",
      heading: "Leakage",
    }));
    expect(index.sectionTopicMap.monitoring[0]).toEqual(expect.objectContaining({
      sectionId: "section:B.5",
      heading: "Monitoring methodology and plan",
    }));
    expect(index.sectionTopicMap.methodology[0]).toEqual(expect.objectContaining({
      sectionId: "section:B.5",
    }));
  });

  test("builds a table index with cell provenance from structure-backed evidence", () => {
    const rawText = "Host country | Indonesia";
    const structure = makeStructure({
      rawText,
      cleanText: rawText,
      matchingText: rawText.toLowerCase(),
      sections: [{
        id: "section:1",
        sectionNumber: "1",
        titleRaw: "Project Details",
        titleClean: "Project Details",
        titleMatchingText: "project details",
        bodyRaw: rawText,
        bodyClean: rawText,
        bodyMatchingText: rawText.toLowerCase(),
        displaySnippet: rawText,
        matchingText: `project details ${rawText.toLowerCase()}`,
        parentId: undefined,
        childIds: [],
        blockIds: ["heading-1", "table-1"],
        sourceRefs: [],
        confidence: 0.95,
        extractionWarnings: [],
      }],
      blocks: [
        {
          id: "heading-1",
          type: "heading",
          rawText: "1 Project Details",
          cleanText: "1 Project Details",
          matchingText: "1 project details",
          pageNumber: 1,
          sectionId: "section:1",
          sectionPath: ["section:1"],
          sourceRefs: [],
          confidence: 0.95,
        },
        {
          id: "table-1",
          type: "table",
          rawText,
          cleanText: rawText,
          matchingText: rawText.toLowerCase(),
          pageNumber: 1,
          sectionId: "section:1",
          sectionPath: ["section:1"],
          table: {
            id: "table-1",
            pageNumber: 1,
            rowCount: 1,
            columnCount: 2,
            headerRowCount: 0,
            cells: [
              { rowIndex: 0, columnIndex: 0, text: "Host country" },
              { rowIndex: 0, columnIndex: 1, text: "Indonesia" },
            ],
          },
          sourceRefs: [],
          confidence: 0.9,
        },
      ],
      pages: [{
        id: "page:1",
        pageNumber: 1,
        rawText: ["1 Project Details", rawText].join("\n"),
        cleanText: ["1 Project Details", rawText].join("\n"),
        matchingText: "1 project details host country | indonesia",
        blockIds: ["heading-1", "table-1"],
        sourceRefs: [],
      }],
    });
    const evidence = compileEvidenceDocumentFromStructure({ docId: "table-doc", documentStructure: structure });
    const tableIndex = buildTableIndex({ evidenceDocument: evidence });

    expect(tableIndex.tables).toHaveLength(1);
    expect(tableIndex.tables[0]).toEqual(expect.objectContaining({
      tableId: "table-1",
      sectionId: "section:1",
      pageNumbers: [1],
      rowCount: 1,
      columnCount: 2,
      limitedProvenance: false,
    }));
    expect(tableIndex.tables[0].cells).toEqual([
      expect.objectContaining({
        rowIndex: 0,
        columnIndex: 0,
        text: "Host country",
        sectionId: "section:1",
        pageNumber: 1,
      }),
      expect.objectContaining({
        rowIndex: 0,
        columnIndex: 1,
        text: "Indonesia",
        normalizedText: "indonesia",
        sourceTableId: "table-1",
      }),
    ]);
  });

  test("reuses the real-fixture pipeline and maps core topics without a new parser path", () => {
    const cdmFixture = findFixture("real-cdm");
    const { structure, evidence } = runProjectFactFixturePipeline(cdmFixture);
    const index = buildSectionTableIndex({ documentStructure: structure, evidenceDocument: evidence });

    expect(structure.documentFamily.family).toBe("CDM_PDD");
    expect(index.sectionTopicMap.baseline[0]).toEqual(expect.objectContaining({
      heading: "Baseline scenario",
      pageNumbers: expect.arrayContaining([1]),
    }));
    expect(index.sectionTopicMap.monitoring[0]).toEqual(expect.objectContaining({
      heading: "Monitoring methodology and plan",
    }));
    expect(index.sectionTopicMap.leakage[0]).toEqual(expect.objectContaining({
      heading: "Leakage",
    }));
    expect(index.sectionTopicMap.additionality[0]).toEqual(expect.objectContaining({
      heading: "Demonstration of additionality",
    }));
    expect(index.sectionTree.roots.length).toBeGreaterThan(0);
  });

  test("validateSectionTree flags orphan parent ids and missing provenance", () => {
    const validation = validateSectionTree({
      roots: [],
      orderedNodeIds: ["section:orphan"],
      nodesById: {
        "section:orphan": {
          id: "section:orphan",
          parentId: "section:missing",
          sectionId: "section:orphan",
          heading: "Orphan Section",
          headingPath: ["Orphan Section"],
          sectionPath: ["section:orphan"],
          evidenceSpanIds: ["span:1"],
          sourceBlockIds: [],
          pageNumbers: [],
          confidence: 0.75,
          children: [],
        },
      },
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContainEqual(expect.objectContaining({
      code: "orphan_parent_id",
      affectedId: "section:orphan",
    }));
    expect(validation.warnings).toContainEqual(expect.objectContaining({
      code: "missing_page_provenance",
      affectedId: "section:orphan",
    }));
  });

  test("validateTableIndex flags duplicate table ids and missing cell provenance", () => {
    const validation = validateTableIndex({
      tables: [
        {
          evidenceSpanId: "span:table:1",
          tableId: "dup-table",
          sectionPath: ["section:1"],
          headingPath: ["Project Details"],
          pageNumbers: [],
          confidence: 0.9,
          limitedProvenance: false,
          cells: [{
            evidenceSpanId: "span:table:missing",
            rowIndex: 0,
            columnIndex: 0,
            text: "Host country",
            normalizedText: "host country",
            sectionPath: ["section:1"],
            headingPath: ["Project Details"],
            confidence: 0.9,
            limitedProvenance: false,
          }],
        },
        {
          evidenceSpanId: "span:table:2",
          tableId: "dup-table",
          sectionPath: ["section:1"],
          headingPath: ["Project Details"],
          pageNumbers: [1],
          confidence: 0.8,
          limitedProvenance: true,
          cells: [],
        },
      ],
      cells: [],
      byEvidenceSpanId: {
        "span:table:1": {
          evidenceSpanId: "span:table:1",
          tableId: "dup-table",
          sectionPath: ["section:1"],
          headingPath: ["Project Details"],
          pageNumbers: [],
          confidence: 0.9,
          limitedProvenance: false,
          cells: [],
        },
        "span:table:2": {
          evidenceSpanId: "span:table:2",
          tableId: "dup-table",
          sectionPath: ["section:1"],
          headingPath: ["Project Details"],
          pageNumbers: [1],
          confidence: 0.8,
          limitedProvenance: true,
          cells: [],
        },
      },
      byTableId: {},
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContainEqual(expect.objectContaining({
      code: "duplicate_table_id",
      affectedId: "dup-table",
    }));
    expect(validation.errors).toContainEqual(expect.objectContaining({
      code: "missing_cell_span_reference",
      affectedId: "dup-table",
    }));
    expect(validation.warnings).toContainEqual(expect.objectContaining({
      code: "missing_table_provenance",
      affectedId: "dup-table",
    }));
    expect(validation.warnings).toContainEqual(expect.objectContaining({
      code: "missing_cell_provenance",
      affectedId: "dup-table",
    }));
  });

  test("findBestTopicMatch returns no_evidence for unsupported topics", () => {
    const parsed = parseDocumentText({
      rawText: [
        "2 Baseline Scenario",
        "Without the project, baseline emissions remain high.",
      ].join("\n"),
    });
    const structure = buildDocumentStructure({ parsedDocument: parsed });
    const evidence = compileEvidenceDocumentFromStructure({ docId: "unsupported-topic", documentStructure: structure });
    const index = buildSectionTableIndex({ documentStructure: structure, evidenceDocument: evidence });

    expect(findBestTopicMatch("finance", index.sectionTopicMap)).toEqual({
      status: "no_evidence",
      reason: "unsupported_topic",
    });
  });

  test("findBestTopicMatch does not promote ambiguous weak matches", () => {
    const result = findBestTopicMatch("baseline", {
      baseline: [
        {
          topic: "baseline",
          heading: "Project Description",
          headingPath: ["Project Description"],
          sectionPath: ["section:1"],
          evidenceSpanIds: ["span:1"],
          pageNumbers: [1],
          confidence: 0.78,
          reasons: ["baseline"],
        },
        {
          topic: "baseline",
          heading: "Context",
          headingPath: ["Context"],
          sectionPath: ["section:2"],
          evidenceSpanIds: ["span:2"],
          pageNumbers: [2],
          confidence: 0.76,
          reasons: ["without the project"],
        },
      ],
      monitoring: [],
      leakage: [],
      additionality: [],
      methodology: [],
      project_location: [],
      project_participants: [],
      crediting_period: [],
      safeguards: [],
      sdg: [],
    });

    expect(result).toEqual({
      status: "no_evidence",
      reason: "weak_match",
    });
  });

  test("weak unknown-family fixture stays unassigned for topic selection", () => {
    const fixture = findFixture("more-real-weak");
    const { structure, evidence } = runProjectFactFixturePipeline(fixture);
    const index = buildSectionTableIndex({ documentStructure: structure, evidenceDocument: evidence });

    expect(structure.documentFamily.family).toBe("UNKNOWN");
    expect(findBestTopicMatch("monitoring", index.sectionTopicMap).status).toBe("no_evidence");
    expect(validateSectionTree(index.sectionTree).errors).toEqual([]);
  });

  test("table-heavy fixture remains valid while preserving limited-provenance tables", () => {
    const fixture = findFixture("more-real-ccb1530");
    const { structure, evidence } = runProjectFactFixturePipeline(fixture);
    const index = buildSectionTableIndex({ documentStructure: structure, evidenceDocument: evidence });
    const validation = validateTableIndex(index.tableIndex);

    expect(structure.qualityReport.tableHeavyWarning).toBe(true);
    expect(validation.errors).toEqual([]);
    if (index.tableIndex.tables.length > 0) {
      expect(index.tableIndex.tables.some((table) => table.limitedProvenance || table.pageNumbers.length > 0)).toBe(true);
    }
    expect(findBestTopicMatch("baseline", index.sectionTopicMap).status).toBe("no_evidence");
  });

  test("additionality does not match 'Additional Information' or generic 'additional' sections", () => {
    const parsed = parseDocumentText({
      rawText: [
        "1 Project Description",
        "The project is a REDD+ activity in Indonesia.",
        "",
        "2 Additional Information",
        "This section provides supplementary data and context.",
        "",
        "3 Additional Contact Details",
        "Contact information for the project proponents.",
        "",
        "4 Demonstration of Additionality",
        "The activity is additional because it would not occur without carbon finance.",
      ].join("\n"),
    });
    const structure = buildDocumentStructure({ parsedDocument: parsed });
    const evidence = compileEvidenceDocumentFromStructure({ docId: "additionality-guard", documentStructure: structure });
    const topicMap = buildSectionTopicMap({ documentStructure: structure, sectionTree: buildSectionTree({ documentStructure: structure, evidenceDocument: evidence }) });

    // The canonical "Demonstration of Additionality" heading must be the top match
    expect(topicMap.additionality.length).toBeGreaterThanOrEqual(1);
    expect(topicMap.additionality[0]).toEqual(expect.objectContaining({
      sectionId: "section:4",
      heading: "Demonstration of Additionality",
      confidence: expect.any(Number),
    }));
    expect(topicMap.additionality[0].confidence).toBeGreaterThanOrEqual(0.95);

    // Sections containing only "additional" (not "additionality") in their
    // heading must NOT be the top match — they may appear as lower-confidence
    // body-text matches but never above the canonical heading.
    for (const ref of topicMap.additionality) {
      if (ref.sectionId === "section:2" || ref.sectionId === "section:3") {
        expect(ref.confidence).toBeLessThan(topicMap.additionality[0].confidence);
      }
    }
  });

  test("baseline does not match grid emission factor or calculation sections", () => {
    const parsed = parseDocumentText({
      rawText: [
        "1.1 Baseline Scenario",
        "Without the project, deforestation continues. The baseline scenario involves business-as-usual land use.",
        "",
        "2.3 Grid Emission Factor Calculation",
        "The grid emission factor is calculated using OM and BM combined margin methodology.",
        "",
        "3.2 Baseline Emissions",
        "Baseline emissions are calculated using the approved methodology.",
        "",
        "4.1 Ex-Ante Calculation of Emission Reductions",
        "Emission reductions are calculated ex-ante using the baseline approach.",
      ].join("\n"),
    });
    const structure = buildDocumentStructure({ parsedDocument: parsed });
    const evidence = compileEvidenceDocumentFromStructure({ docId: "baseline-guard", documentStructure: structure });
    const topicMap = buildSectionTopicMap({ documentStructure: structure, sectionTree: buildSectionTree({ documentStructure: structure, evidenceDocument: evidence }) });

    // "Baseline Scenario" is the only match — calculation/grid sections are excluded
    expect(topicMap.baseline.length).toBe(1);
    expect(topicMap.baseline[0]).toEqual(expect.objectContaining({
      sectionId: "section:1.1",
      heading: "Baseline Scenario",
      confidence: expect.any(Number),
    }));
    // Canonical "Baseline Scenario" heading gets the top confidence boost
    expect(topicMap.baseline[0].confidence).toBeGreaterThanOrEqual(0.97);
  });

  test("baseline scenario is still promoted even when body mentions calculation terms", () => {
    const parsed = parseDocumentText({
      rawText: [
        "1.2 Baseline Scenario",
        "The baseline scenario uses emission factors and grid emission data. Without the project, deforestation continues.",
      ].join("\n"),
    });
    const structure = buildDocumentStructure({ parsedDocument: parsed });
    const evidence = compileEvidenceDocumentFromStructure({ docId: "baseline-scenario-body", documentStructure: structure });
    const topicMap = buildSectionTopicMap({ documentStructure: structure, sectionTree: buildSectionTree({ documentStructure: structure, evidenceDocument: evidence }) });

    // "Baseline Scenario" heading should still match despite calculation terms in body
    expect(topicMap.baseline).toHaveLength(1);
    expect(topicMap.baseline[0]).toEqual(expect.objectContaining({
      sectionId: "section:1.2",
      heading: "Baseline Scenario",
    }));
    expect(topicMap.baseline[0].confidence).toBeGreaterThanOrEqual(0.95);
  });

  test("builds a multi-level numeric section tree with parent/child relations", () => {
    const parsed = parseDocumentText({
      rawText: [
        "3 Monitoring and Verification",
        "This section describes the monitoring and verification approach.",
        "",
        "3.1 General Monitoring Plan",
        "The general monitoring plan covers all project activities.",
        "",
        "3.1.1 Data and Parameters Monitored",
        "The following data and parameters are monitored.",
        "",
        "3.1.2 Data and Parameters Not Monitored",
        "Some parameters are excluded from monitoring.",
        "",
        "3.2 Verification Plan",
        "Verification is conducted by an independent third party.",
      ].join("\n"),
    });
    const structure = buildDocumentStructure({ parsedDocument: parsed });
    const evidence = compileEvidenceDocumentFromStructure({ docId: "deep-hierarchy", documentStructure: structure });
    const sectionTree = buildSectionTree({ documentStructure: structure, evidenceDocument: evidence });

    expect(sectionTree.nodesById["section:3"].children).toHaveLength(2);
    expect(sectionTree.nodesById["section:3"].children[0].sectionId).toBe("section:3.1");
    expect(sectionTree.nodesById["section:3"].children[1].sectionId).toBe("section:3.2");

    expect(sectionTree.nodesById["section:3.1"].children).toHaveLength(2);
    expect(sectionTree.nodesById["section:3.1"].children[0].sectionId).toBe("section:3.1.1");
    expect(sectionTree.nodesById["section:3.1"].children[1].sectionId).toBe("section:3.1.2");

    expect(sectionTree.nodesById["section:3.1.1"].parentId).toBe("section:3.1");
    expect(sectionTree.nodesById["section:3.1.1"].sectionNumber).toBe("3.1.1");
    expect(sectionTree.nodesById["section:3.1.1"].heading).toBe("Data and Parameters Monitored");
  });

  test("parser fallback: weak sections produce a valid but lower-confidence topic map", () => {
    // Simulate a document with no structured sections — just raw heading spans
    const structure = makeStructure({
      rawText: "Monitoring Plan\nWe will monitor biomass.\nBaseline Scenario\nWithout the project, land is deforested.",
      cleanText: "Monitoring Plan\nWe will monitor biomass.\nBaseline Scenario\nWithout the project, land is deforested.",
      matchingText: "monitoring plan we will monitor biomass baseline scenario without the project land is deforested",
      sections: [], // No DocumentStructure sections — pure span-based indexing
      blocks: [],
      pages: [],
    });
    // Build evidence with just heading and paragraph spans
    const evidence: typeof import("@/lib/quickCheck/evidence/evidenceTypes").EvidenceDocument = {
      docId: "fallback-doc",
      rawText: structure.rawText,
      spans: [
        { spanId: "s1", docId: "fallback-doc", page: 1, sectionId: "section:monitoring-plan",
          heading: "Monitoring Plan", headingPath: ["Monitoring Plan"], sectionPath: ["section:monitoring-plan"],
          blockType: "section_heading", text: "Monitoring Plan", normalizedText: "monitoring plan",
          charStart: 0, charEnd: 15, reliability: "primary", confidence: 0.85 },
        { spanId: "s2", docId: "fallback-doc", page: 1, sectionId: "section:monitoring-plan",
          heading: "Monitoring Plan", headingPath: ["Monitoring Plan"], sectionPath: ["section:monitoring-plan"],
          blockType: "paragraph", text: "We will monitor biomass.", normalizedText: "we will monitor biomass",
          charStart: 16, charEnd: 38, reliability: "primary", confidence: 0.85 },
        { spanId: "s3", docId: "fallback-doc", page: 1, sectionId: "section:baseline-scenario",
          heading: "Baseline Scenario", headingPath: ["Baseline Scenario"], sectionPath: ["section:baseline-scenario"],
          blockType: "section_heading", text: "Baseline Scenario", normalizedText: "baseline scenario",
          charStart: 39, charEnd: 56, reliability: "primary", confidence: 0.85 },
        { spanId: "s4", docId: "fallback-doc", page: 1, sectionId: "section:baseline-scenario",
          heading: "Baseline Scenario", headingPath: ["Baseline Scenario"], sectionPath: ["section:baseline-scenario"],
          blockType: "paragraph", text: "Without the project, land is deforested.", normalizedText: "without the project land is deforested",
          charStart: 57, charEnd: 95, reliability: "primary", confidence: 0.85 },
      ],
    };
    const sectionTree = buildSectionTree({ documentStructure: structure, evidenceDocument: evidence });
    const topicMap = buildSectionTopicMap({ documentStructure: structure, sectionTree });

    expect(sectionTree.orderedNodeIds.length).toBeGreaterThanOrEqual(2);
    expect(topicMap.monitoring.length).toBeGreaterThanOrEqual(1);
    expect(topicMap.baseline.length).toBeGreaterThanOrEqual(1);
    expect(topicMap.baseline[0]).toEqual(expect.objectContaining({
      heading: "Baseline Scenario",
      sectionPath: ["section:baseline-scenario"],
    }));
    expect(topicMap.monitoring[0]).toEqual(expect.objectContaining({
      heading: "Monitoring Plan",
    }));
  });

  test("table index preserves all provenance fields for parser-backed tables", () => {
    const rawText = "Parameter | Value | Unit\nBaseline carbon stocks | 100 | tCO2e";
    const structure = makeStructure({
      rawText,
      cleanText: rawText,
      matchingText: rawText.toLowerCase(),
      sections: [{
        id: "section:2",
        sectionNumber: "2",
        titleRaw: "Baseline Data",
        titleClean: "Baseline Data",
        titleMatchingText: "baseline data",
        bodyRaw: rawText,
        bodyClean: rawText,
        bodyMatchingText: rawText.toLowerCase(),
        displaySnippet: rawText,
        matchingText: `baseline data ${rawText.toLowerCase()}`,
        parentId: undefined,
        childIds: [],
        blockIds: ["heading-2", "table-2"],
        sourceRefs: [],
        confidence: 0.9,
        extractionWarnings: [],
      }],
      blocks: [
        {
          id: "heading-2",
          type: "heading",
          rawText: "2 Baseline Data",
          cleanText: "2 Baseline Data",
          matchingText: "2 baseline data",
          pageNumber: 2,
          sectionId: "section:2",
          sectionPath: ["section:2"],
          sourceRefs: [],
          confidence: 0.9,
        },
        {
          id: "table-2",
          type: "table",
          rawText,
          cleanText: rawText,
          matchingText: rawText.toLowerCase(),
          pageNumber: 2,
          sectionId: "section:2",
          sectionPath: ["section:2"],
          table: {
            id: "table-carbon-stocks",
            pageNumber: 2,
            caption: "Carbon stock estimates",
            rowCount: 2,
            columnCount: 3,
            headerRowCount: 1,
            cells: [
              { rowIndex: 0, columnIndex: 0, text: "Parameter" },
              { rowIndex: 0, columnIndex: 1, text: "Value" },
              { rowIndex: 0, columnIndex: 2, text: "Unit" },
              { rowIndex: 1, columnIndex: 0, text: "Baseline carbon stocks" },
              { rowIndex: 1, columnIndex: 1, text: "100" },
              { rowIndex: 1, columnIndex: 2, text: "tCO2e" },
            ],
          },
          sourceRefs: [],
          confidence: 0.88,
        },
      ],
      pages: [{
        id: "page:2",
        pageNumber: 2,
        rawText: ["2 Baseline Data", rawText].join("\n"),
        cleanText: ["2 Baseline Data", rawText].join("\n"),
        matchingText: "2 baseline data parameter | value | unit baseline carbon stocks | 100 | tco2e",
        blockIds: ["heading-2", "table-2"],
        sourceRefs: [],
      }],
    });
    const evidence = compileEvidenceDocumentFromStructure({ docId: "table-provenance-doc", documentStructure: structure });
    const tableIndex = buildTableIndex({ evidenceDocument: evidence });

    expect(tableIndex.tables).toHaveLength(1);
    const indexed = tableIndex.tables[0];
    expect(indexed).toEqual(expect.objectContaining({
      tableId: "table-carbon-stocks",
      sectionId: "section:2",
      sectionPath: ["section:2"],
      heading: "Baseline Data",
      headingPath: ["Baseline Data"],
      pageNumbers: [2],
      rowCount: 2,
      columnCount: 3,
      headerRowCount: 1,
      limitedProvenance: false,
    }));
    expect(indexed.cells).toHaveLength(6);
    expect(indexed.cells[3]).toEqual(expect.objectContaining({
      rowIndex: 1,
      columnIndex: 0,
      text: "Baseline carbon stocks",
      sourceTableId: "table-carbon-stocks",
      sectionId: "section:2",
      pageNumber: 2,
    }));
    // Every cell must have row/column coordinates
    for (const cell of indexed.cells) {
      expect(cell.rowIndex).toBeGreaterThanOrEqual(0);
      expect(cell.columnIndex).toBeGreaterThanOrEqual(0);
    }
  });
});
