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
});
