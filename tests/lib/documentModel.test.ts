import { afterEach, describe, expect, it } from "@jest/globals";
import { parseDocumentText } from "@/lib/documentParsing";
import { buildArticle6DocumentModel, buildDocumentStructure } from "@/lib/documentModel";
import { currentExtractorAdapter } from "@/lib/documentParsing/adapters/currentExtractor";
import { setLiteParseImplementationForTests } from "@/lib/documentParsing/adapters/liteParse";

const NESTED_PDD_TEXT = [
  "4.3  Monitoring Plan",
  "The monitoring plan describes annual monitoring activities.",
  "",
  "4.3.1  Monitoring Frequency",
  "Monitoring occurs every 12 months with documented field checks.",
  "",
  "6  Stakeholder Comments",
  "Stakeholder comments are recorded in community meeting summaries.",
].join("\n");

describe("buildArticle6DocumentModel", () => {
  afterEach(() => {
    delete process.env.QUICK_CHECK_PARSER;
    setLiteParseImplementationForTests(null);
  });

  it("converts parser output into a canonical Article6 document model", () => {
    const parsedDocument = parseDocumentText({ rawText: NESTED_PDD_TEXT });
    const model = buildDocumentStructure({ parsedDocument });

    expect(model.parserAdapterId).toBe("current-extractor");
    expect(model.source).toBe("current-extractor");
    expect(model.rawText).toBe(NESTED_PDD_TEXT);
    expect(model.cleanText).toContain("4.3 Monitoring Plan");
    expect(model.matchingText).toContain("monitoring plan");
    expect(model.pages).toHaveLength(1);
    expect(model.blocks.some((block) => block.type === "heading")).toBe(true);
    expect(model.blocks.some((block) => block.type === "paragraph")).toBe(true);
    expect(model.blocks[0]?.pageNumber).toBe(1);
    expect(model.debug).toBeUndefined();

    const monitoringPlan = model.sections.find((section) => section.sectionNumber === "4.3");
    const monitoringFrequency = model.sections.find((section) => section.sectionNumber === "4.3.1");
    const stakeholderComments = model.sections.find((section) => section.sectionNumber === "6");

    expect(monitoringPlan).toBeDefined();
    expect(monitoringFrequency).toBeDefined();
    expect(stakeholderComments).toBeDefined();
    expect(monitoringPlan?.childIds).toContain(monitoringFrequency?.id);
    expect(monitoringFrequency?.parentId).toBe(monitoringPlan?.id);
    expect(monitoringPlan?.displaySnippet).toContain("annual monitoring activities");
    expect(monitoringPlan?.sourceRefs[0]?.sectionNumber).toBe("4.3");
    expect(monitoringPlan?.sourceRefs[0]?.quality).toBe("synthetic");
    expect(monitoringPlan?.blockIds.length).toBeGreaterThan(0);
    expect(monitoringPlan?.confidence).toBeGreaterThan(0.9);
    expect(model.pages[0]?.sourceRefs[0]?.quality).toBe("synthetic");
    expect(model.blocks[0]?.sourceRefs[0]?.quality).toBe("synthetic");
    expect(model.blocks[0]?.sourceRefs[0]?.pageNumber).toBe(1);
  });

  it("preserves raw parser text separately from clean and matching text", () => {
    const parsedDocument = parseDocumentText({ rawText: "1.1  Title\r\nBody with   extra\tspacing\f" });
    const model = buildArticle6DocumentModel({ parsedDocument });

    expect(model.rawText).toContain("\r\n");
    expect(model.cleanText).not.toContain("\r");
    expect(model.cleanText).not.toContain("\f");
    expect(model.matchingText).toBe(model.matchingText.toLowerCase());
  });

  it("emits extraction warnings when parser output has text but no headings or sections", () => {
    const model = buildArticle6DocumentModel({
      parsedDocument: {
        adapterId: "current-extractor",
        source: "test-parser",
        rawText: "Loose body text without recoverable headings.",
        normalizedText: "Loose body text without recoverable headings.",
        pages: [{
          pageNumber: 1,
          rawText: "Loose body text without recoverable headings.",
          normalizedText: "Loose body text without recoverable headings.",
          elements: [],
        }],
        elements: [],
        tables: [],
        parserName: "test-parser",
        qualityReport: {
          parserName: "test-parser",
          warnings: ["heuristic fallback used"],
          hasStructuredHeadings: false,
          hasPageBoundaries: false,
          hasBoundingBoxes: false,
          hasTables: false,
        },
        blocks: [],
        headings: [],
        diagnostics: {
          warnings: ["heuristic fallback used"],
        },
      },
    });

    expect(model.sections).toEqual([]);
    expect(model.extractionWarnings.map((warning) => warning.code)).toEqual([
      "parser_warning",
      "no_sections_detected",
      "no_headings_detected",
    ]);
  });

  it("only exposes parser output when explicitly requested for debugging", () => {
    const parsedDocument = parseDocumentText({ rawText: NESTED_PDD_TEXT });

    const withoutDebug = buildArticle6DocumentModel({ parsedDocument });
    const withDebug = buildArticle6DocumentModel({ parsedDocument, includeDebugPayload: true });

    expect(withoutDebug.debug).toBeUndefined();
    expect(withDebug.debug?.parserOutput).toEqual(parsedDocument);
  });

  it("keeps the canonical document model path intact when liteparse is selected", () => {
    setLiteParseImplementationForTests({
      parseText(input) {
        const baseline = currentExtractorAdapter.parseText(input);
        return {
          ...baseline,
          source: "liteparse",
        };
      },
    });
    process.env.QUICK_CHECK_PARSER = "liteparse";

    const parsedDocument = parseDocumentText({ rawText: NESTED_PDD_TEXT });
    const model = buildArticle6DocumentModel({ parsedDocument });

    expect(parsedDocument.adapterId).toBe("liteparse");
    expect(model.parserAdapterId).toBe("liteparse");
    expect(model.sections.map((section) => section.sectionNumber)).toEqual(expect.arrayContaining(["4.3", "4.3.1", "6"]));
    expect(model.blocks.some((block) => block.type === "heading")).toBe(true);
    expect(model.pages).toHaveLength(1);
  });

  it("normalizes parsed page provenance into document structure pages", () => {
    const parsedDocument = parseDocumentText({
      rawText: [
        "1 Project Details",
        "Host country: Indonesia",
        "\f",
        "2 Baseline Scenario",
        "Baseline scenario: forest conversion.",
      ].join("\n"),
    });

    const model = buildDocumentStructure({ parsedDocument });

    expect(model.pages).toHaveLength(2);
    expect(model.pages[0]).toEqual(expect.objectContaining({
      pageNumber: 1,
    }));
    expect(model.pages[1]).toEqual(expect.objectContaining({
      pageNumber: 2,
    }));
    expect(model.pages[0]?.sourceRefs[0]).toEqual(expect.objectContaining({
      parserAdapterId: "current-extractor",
      pageNumber: 1,
    }));
    expect(model.pages[1]?.sourceRefs[0]).toEqual(expect.objectContaining({
      parserAdapterId: "current-extractor",
      pageNumber: 2,
    }));
    expect(model.blocks.some((block) => block.pageNumber === 2)).toBe(true);
    expect(model.blocks.some((block) => block.sourceRefs.some((ref) => ref.pageNumber === 2))).toBe(true);
  });
});
