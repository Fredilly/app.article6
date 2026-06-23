import { describe, expect, test } from "@jest/globals";
import type { DocumentStructure } from "@/lib/documentModel";
import { buildDocumentStructure } from "@/lib/documentModel";
import { parseDocumentText } from "@/lib/documentParsing";
import {
  compileEvidenceDocumentFromStructure,
} from "@/lib/quickCheck/evidence/compileEvidenceDocument";
import { validateQuotes } from "@/lib/quickCheck/evidence/validateQuotes";

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

describe("Evidence Compiler v2", () => {
  test("produces stable span IDs across repeated runs of the same structure", () => {
    const parsedDocument = parseDocumentText({
      rawText: [
        "1 Project Details",
        "Host country: Indonesia",
        "",
        "1.1 Project Participants",
        "Project participants: PT Example Carbon",
      ].join("\n"),
    });
    const documentStructure = buildDocumentStructure({ parsedDocument });

    const first = compileEvidenceDocumentFromStructure({
      docId: "stable-doc",
      documentStructure,
    });
    const second = compileEvidenceDocumentFromStructure({
      docId: "stable-doc",
      documentStructure,
    });

    expect(first.spans.map((span) => span.spanId)).toEqual(second.spans.map((span) => span.spanId));
  });

  test("preserves multi-page provenance, section path, heading path, parser source, and document family", () => {
    const parsedDocument = parseDocumentText({
      rawText: [
        "1 Project Details",
        "Host country: Indonesia",
        "\f",
        "2 Baseline Scenario",
        "Baseline scenario: forest conversion without the project.",
      ].join("\n"),
    });
    const documentStructure = buildDocumentStructure({ parsedDocument });
    const compiled = compileEvidenceDocumentFromStructure({
      docId: "multi-page-doc",
      documentStructure,
    });

    const baselineSpan = compiled.spans.find((span) => (
      span.page === 2 && (span.blockType === "paragraph" || span.blockType === "field")
    ));

    expect(baselineSpan).toEqual(expect.objectContaining({
      page: 2,
      sectionId: "section:2",
      heading: "Baseline Scenario",
      sectionPath: ["section:2"],
      headingPath: ["Baseline Scenario"],
      parserSource: "current-extractor",
      parserAdapterId: "pymupdf",
      documentFamily: documentStructure.documentFamily.family,
    }));
  });

  test("compiles CDM-style lettered sections without losing provenance", () => {
    const parsedDocument = parseDocumentText({
      rawText: [
        "A.1 Purpose of the project activity",
        "The project activity reduces methane emissions from wastewater treatment.",
      ].join("\n"),
    });
    const documentStructure = buildDocumentStructure({ parsedDocument });
    const compiled = compileEvidenceDocumentFromStructure({
      docId: "cdm-doc",
      documentStructure,
    });

    expect(compiled.spans.some((span) => (
      span.blockType === "section_heading"
      && span.sectionId === "section:A.1"
      && span.heading === "Purpose of the project activity"
    ))).toBe(true);
    expect(compiled.spans.some((span) => (
      span.blockType === "paragraph"
      && span.sectionId === "section:A.1"
      && span.headingPath.includes("Purpose of the project activity")
    ))).toBe(true);
  });

  test("compiles VCS narrative sections without relying on numbered headings", () => {
    const rawText = [
      "Katingan Peatland Restoration and Conservation Project",
      "Project Description",
      "This Verra VCS Program project description covers forest conservation activities.",
    ].join("\n");
    const documentStructure = makeStructure({
      rawText,
      cleanText: rawText,
      matchingText: rawText.toLowerCase(),
      documentFamily: {
        family: "VERRA_PD",
        confidence: 0.94,
        evidence: ["Verra"],
        signals: [],
        warnings: [],
      },
      sections: [{
        id: "section:project-description",
        titleRaw: "Project Description",
        titleClean: "Project Description",
        titleMatchingText: "project description",
        bodyRaw: "This Verra VCS Program project description covers forest conservation activities.",
        bodyClean: "This Verra VCS Program project description covers forest conservation activities.",
        bodyMatchingText: "this verra vcs program project description covers forest conservation activities.",
        displaySnippet: "This Verra VCS Program project description covers forest conservation activities.",
        matchingText: "project description this verra vcs program project description covers forest conservation activities.",
        childIds: [],
        blockIds: ["title", "heading-1", "paragraph-1"],
        sourceRefs: [],
        confidence: 0.9,
        extractionWarnings: [],
      }],
      blocks: [
        {
          id: "title",
          type: "heading",
          rawText: "Katingan Peatland Restoration and Conservation Project",
          cleanText: "Katingan Peatland Restoration and Conservation Project",
          matchingText: "katingan peatland restoration and conservation project",
          pageNumber: 1,
          sourceRefs: [],
          confidence: 0.95,
        },
        {
          id: "heading-1",
          type: "heading",
          rawText: "Project Description",
          cleanText: "Project Description",
          matchingText: "project description",
          pageNumber: 1,
          sectionId: "section:project-description",
          sourceRefs: [],
          confidence: 0.95,
        },
        {
          id: "paragraph-1",
          type: "paragraph",
          rawText: "This Verra VCS Program project description covers forest conservation activities.",
          cleanText: "This Verra VCS Program project description covers forest conservation activities.",
          matchingText: "this verra vcs program project description covers forest conservation activities.",
          pageNumber: 1,
          sectionId: "section:project-description",
          sourceRefs: [],
          confidence: 0.9,
        },
      ],
      pages: [{
        id: "page:1",
        pageNumber: 1,
        rawText,
        cleanText: rawText,
        matchingText: rawText.toLowerCase(),
        blockIds: ["title", "heading-1", "paragraph-1"],
        sourceRefs: [],
      }],
    });
    const compiled = compileEvidenceDocumentFromStructure({
      docId: "vcs-doc",
      documentStructure,
    });

    expect(compiled.spans.some((span) => span.blockType === "title" && span.text.includes("Katingan"))).toBe(true);
    expect(compiled.spans.some((span) => (
      span.blockType === "section_heading"
      && span.heading === "Project Description"
      && span.documentFamily === "VERRA_PD"
    ))).toBe(true);
    expect(compiled.spans.some((span) => (
      span.blockType === "paragraph"
      && span.headingPath.includes("Project Description")
    ))).toBe(true);
  });

  test("preserves table metadata and cell-level provenance when available", () => {
    const rawText = "Host country | Indonesia";
    const documentStructure = makeStructure({
      rawText,
      cleanText: rawText,
      matchingText: rawText.toLowerCase(),
      qualityReport: {
        parserName: "test-parser",
        warnings: [],
        sourceContentMode: "unknown",
        pageCount: 1,
        textDensity: 0.1,
        ocrConfidence: undefined,
        tableHeavyWarning: true,
        layoutHeavyWarning: false,
        headersFootersDetected: false,
        weakExtractionWarning: false,
        hasStructuredHeadings: false,
        hasPageBoundaries: false,
        hasBoundingBoxes: true,
        hasTables: true,
      },
      blocks: [{
        id: "table-1",
        type: "table",
        rawText,
        cleanText: rawText,
        matchingText: "host country | indonesia",
        pageNumber: 1,
        boundingBox: { x: 10, y: 20, width: 200, height: 40 },
        table: {
          id: "table-1",
          pageNumber: 1,
          columnCount: 2,
          rowCount: 1,
          headerRowCount: 1,
          cells: [
            { rowIndex: 0, columnIndex: 0, text: "Host country" },
            { rowIndex: 0, columnIndex: 1, text: "Indonesia" },
          ],
        },
        sourceRefs: [],
        confidence: 0.84,
      }],
    });
    const compiled = compileEvidenceDocumentFromStructure({
      docId: "table-doc",
      documentStructure,
    });

    expect(compiled.spans).toHaveLength(1);
    expect(compiled.spans[0]).toEqual(expect.objectContaining({
      blockType: "table",
      reliability: "limited",
      table: expect.objectContaining({
        tableId: "table-1",
        rowCount: 1,
        columnCount: 2,
        headerRowCount: 1,
        cells: [
          expect.objectContaining({
            rowIndex: 0,
            columnIndex: 0,
            text: "Host country",
            normalizedText: "host country",
            pageNumber: 1,
            sourceTableId: "table-1",
            sourceBlockId: "table-1",
            parserSource: "test-parser",
          }),
          expect.objectContaining({
            rowIndex: 0,
            columnIndex: 1,
            text: "Indonesia",
            normalizedText: "indonesia",
            pageNumber: 1,
            sourceTableId: "table-1",
            sourceBlockId: "table-1",
            parserSource: "test-parser",
          }),
        ],
        limitedProvenance: false,
      }),
      layout: expect.objectContaining({
        boundingBox: expect.any(Object),
      }),
    }));
    expect(compiled.spans[0]?.table?.cells?.[0]?.boundingBox).toBeUndefined();
  });

  test("excludes repeated headers and footers from quote validation", () => {
    const rawText = [
      "Verra VCS Program",
      "1 Project Details",
      "Host country: Indonesia",
      "Page 1 of 2",
      "\f",
      "Verra VCS Program",
      "2 Monitoring Plan",
      "Monitoring period: 2024",
      "Page 2 of 2",
    ].join("\n");

    const compiled = compileEvidenceDocumentFromStructure({
      docId: "header-footer-doc",
      documentStructure: makeStructure({
        rawText,
        cleanText: rawText,
        matchingText: rawText.toLowerCase(),
        pages: [
          {
            id: "page:1",
            pageNumber: 1,
            rawText: rawText.split("\f")[0] ?? "",
            cleanText: rawText.split("\f")[0] ?? "",
            matchingText: (rawText.split("\f")[0] ?? "").toLowerCase(),
            blockIds: ["header-1", "section-1", "field-1", "footer-1"],
            sourceRefs: [],
          },
          {
            id: "page:2",
            pageNumber: 2,
            rawText: rawText.split("\f")[1] ?? "",
            cleanText: rawText.split("\f")[1] ?? "",
            matchingText: (rawText.split("\f")[1] ?? "").toLowerCase(),
            blockIds: ["header-2", "section-2", "field-2", "footer-2"],
            sourceRefs: [],
          },
        ],
        blocks: [
          {
            id: "header-1",
            type: "header",
            rawText: "Verra VCS Program",
            cleanText: "Verra VCS Program",
            matchingText: "verra vcs program",
            pageNumber: 1,
            sourceRefs: [],
            confidence: 0.2,
          },
          {
            id: "section-1",
            type: "heading",
            rawText: "1 Project Details",
            cleanText: "1 Project Details",
            matchingText: "1 project details",
            pageNumber: 1,
            sectionId: "section:1",
            sourceRefs: [],
            confidence: 0.95,
          },
          {
            id: "field-1",
            type: "paragraph",
            rawText: "Host country: Indonesia",
            cleanText: "Host country: Indonesia",
            matchingText: "host country: indonesia",
            pageNumber: 1,
            sectionId: "section:1",
            sourceRefs: [],
            confidence: 0.92,
          },
          {
            id: "footer-1",
            type: "footer",
            rawText: "Page 1 of 2",
            cleanText: "Page 1 of 2",
            matchingText: "page 1 of 2",
            pageNumber: 1,
            sourceRefs: [],
            confidence: 0.2,
          },
          {
            id: "header-2",
            type: "header",
            rawText: "Verra VCS Program",
            cleanText: "Verra VCS Program",
            matchingText: "verra vcs program",
            pageNumber: 2,
            sourceRefs: [],
            confidence: 0.2,
          },
          {
            id: "section-2",
            type: "heading",
            rawText: "2 Monitoring Plan",
            cleanText: "2 Monitoring Plan",
            matchingText: "2 monitoring plan",
            pageNumber: 2,
            sectionId: "section:2",
            sourceRefs: [],
            confidence: 0.95,
          },
          {
            id: "field-2",
            type: "paragraph",
            rawText: "Monitoring period: 2024",
            cleanText: "Monitoring period: 2024",
            matchingText: "monitoring period: 2024",
            pageNumber: 2,
            sectionId: "section:2",
            sourceRefs: [],
            confidence: 0.92,
          },
          {
            id: "footer-2",
            type: "footer",
            rawText: "Page 2 of 2",
            cleanText: "Page 2 of 2",
            matchingText: "page 2 of 2",
            pageNumber: 2,
            sourceRefs: [],
            confidence: 0.2,
          },
        ],
        sections: [
          {
            id: "section:1",
            sectionNumber: "1",
            titleRaw: "Project Details",
            titleClean: "Project Details",
            titleMatchingText: "project details",
            bodyRaw: "Host country: Indonesia",
            bodyClean: "Host country: Indonesia",
            bodyMatchingText: "host country: indonesia",
            displaySnippet: "Host country: Indonesia",
            matchingText: "project details host country: indonesia",
            childIds: [],
            blockIds: ["section-1", "field-1"],
            sourceRefs: [],
            confidence: 0.95,
            extractionWarnings: [],
          },
          {
            id: "section:2",
            sectionNumber: "2",
            titleRaw: "Monitoring Plan",
            titleClean: "Monitoring Plan",
            titleMatchingText: "monitoring plan",
            bodyRaw: "Monitoring period: 2024",
            bodyClean: "Monitoring period: 2024",
            bodyMatchingText: "monitoring period: 2024",
            displaySnippet: "Monitoring period: 2024",
            matchingText: "monitoring plan monitoring period: 2024",
            childIds: [],
            blockIds: ["section-2", "field-2"],
            sourceRefs: [],
            confidence: 0.95,
            extractionWarnings: [],
          },
        ],
      }),
    });

    const [headerQuote, footerQuote, fieldQuote] = validateQuotes(compiled, [
      { quote: "Verra VCS Program" },
      { quote: "Page 1 of 2" },
      { quote: "Host country: Indonesia", page: 1 },
    ]);

    expect(compiled.spans.filter((span) => span.blockType === "header" || span.blockType === "footer").every((span) => span.reliability === "excluded")).toBe(true);
    expect(headerQuote.valid).toBe(false);
    expect(footerQuote.valid).toBe(false);
    expect(fieldQuote).toEqual(expect.objectContaining({ valid: true, matchType: "exact" }));
  });

  test("validates exact quotes, normalized quotes, and rejects unsupported quotes", () => {
    const parsedDocument = parseDocumentText({
      rawText: [
        "1 Additionality",
        "The Project is Additional because investment barriers remain unresolved.",
      ].join("\n"),
    });
    const documentStructure = buildDocumentStructure({ parsedDocument });
    const compiled = compileEvidenceDocumentFromStructure({
      docId: "quotes-doc",
      documentStructure,
    });

    const [exact, normalized, missing] = validateQuotes(compiled, [
      { quote: "The Project is Additional because investment barriers remain unresolved." },
      { quote: "the project is additional because   investment barriers remain unresolved" },
      { quote: "This quote does not exist." },
    ]);

    expect(exact).toEqual(expect.objectContaining({ valid: true, matchType: "exact", confidence: "high" }));
    expect(normalized).toEqual(expect.objectContaining({ valid: true, matchType: "normalized", confidence: "medium" }));
    expect(missing).toEqual(expect.objectContaining({ valid: false, matchType: "missing", confidence: "low" }));
  });
});

describe("Noise context detection in Evidence Compiler v2", () => {
  test("labels TOC lines as toc noise with excluded reliability", () => {
    const parsedDocument = parseDocumentText({
      rawText: [
        "Table of Contents",
        "1 Project Details ......... 3",
        "1.1 Location .............. 5",
        "2 Baseline Scenario ....... 8",
        "",
        "1 Project Details",
        "The project is located in Indonesia.",
      ].join("\n"),
    });
    const documentStructure = buildDocumentStructure({ parsedDocument });
    const compiled = compileEvidenceDocumentFromStructure({
      docId: "toc-doc",
      documentStructure,
    });

    const tocSpans = compiled.spans.filter((span) => span.noise?.includes("toc"));
    expect(tocSpans.length).toBeGreaterThan(0);
    for (const span of tocSpans) {
      expect(span.reliability).toBe("excluded");
    }

    const primarySpans = compiled.spans.filter((span) => span.reliability === "primary");
    expect(primarySpans.length).toBeGreaterThan(0);
  });

  test("labels contact details as contact noise with limited reliability", () => {
    const parsedDocument = parseDocumentText({
      rawText: [
        "Contact Information",
        "For further information contact: coordinator@example.com",
        "Tel: +62 21 555 1234",
        "Website: www.example.org",
        "",
        "1 Project Details",
        "Host country: Indonesia",
      ].join("\n"),
    });
    const documentStructure = buildDocumentStructure({ parsedDocument });
    const compiled = compileEvidenceDocumentFromStructure({
      docId: "contact-doc",
      documentStructure,
    });

    const contactSpans = compiled.spans.filter((span) => span.noise?.includes("contact"));
    expect(contactSpans.length).toBeGreaterThan(0);
    for (const span of contactSpans) {
      expect(span.reliability).not.toBe("primary");
    }
  });

  test("labels source-caption lines as source-caption noise with excluded reliability", () => {
    const parsedDocument = parseDocumentText({
      rawText: [
        "1 Project Location",
        "The project area is shown in Figure 1 below.",
        "Figure 1: Map of project area. Source: Adapted from regional land use plan.",
        "",
        "2 Baseline Scenario",
        "The baseline scenario represents the most likely land use.",
      ].join("\n"),
    });
    const documentStructure = buildDocumentStructure({ parsedDocument });
    const compiled = compileEvidenceDocumentFromStructure({
      docId: "source-caption-doc",
      documentStructure,
    });

    const captionSpans = compiled.spans.filter((span) => span.noise?.includes("source-caption"));
    expect(captionSpans.length).toBeGreaterThan(0);
    for (const span of captionSpans) {
      expect(span.reliability).toBe("excluded");
    }
  });

  test("treats headers/footers as excluded noise", () => {
    const parsedDocument = parseDocumentText({
      rawText: [
        "Project Description Document",
        "",
        "1 Project Details",
        "Host country: Indonesia",
        "\f",
        "Project Description Document",
        "",
        "2 Baseline Scenario",
        "Baseline scenario: forest conversion.",
        "\f",
        "Project Description Document",
        "",
        "3 Monitoring Plan",
        "The monitoring plan describes annual monitoring.",
      ].join("\n"),
    });
    const documentStructure = buildDocumentStructure({ parsedDocument });
    const compiled = compileEvidenceDocumentFromStructure({
      docId: "header-doc",
      documentStructure,
    });

    const headerSpans = compiled.spans.filter((span) => span.noise?.includes("header"));
    expect(headerSpans.length).toBeGreaterThan(0);
    for (const span of headerSpans) {
      expect(span.reliability).toBe("excluded");
    }
  });

  test("every compiled span has stable provenance fields", () => {
    const parsedDocument = parseDocumentText({
      rawText: [
        "1 Project Details",
        "Host country: Indonesia",
        "Project location: Central Kalimantan",
        "",
        "2 Baseline Scenario",
        "Baseline scenario: forest conversion without the project.",
      ].join("\n"),
    });
    const documentStructure = buildDocumentStructure({ parsedDocument });
    const compiled = compileEvidenceDocumentFromStructure({
      docId: "provenance-doc",
      documentStructure,
    });

    for (const span of compiled.spans) {
      expect(typeof span.spanId).toBe("string");
      expect(span.spanId.length).toBeGreaterThan(0);
      expect(span.text).toBeTruthy();
      expect(span.normalizedText).toBeTruthy();
      expect(span.reliability).toBeDefined();
      expect(span.confidence).toBeGreaterThan(0);
      expect(Array.isArray(span.headingPath)).toBe(true);
      expect(Array.isArray(span.sectionPath)).toBe(true);
      expect(["header", "title", "section_heading", "paragraph", "table", "field", "formula", "annex", "toc", "footer"]).toContain(span.blockType);
    }
  });
});
