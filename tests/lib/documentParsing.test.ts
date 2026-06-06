import { afterEach, describe, expect, it } from "@jest/globals";
import {
  buildPddHeadingIndex,
  debugSectionExtraction,
  extractPddSections,
} from "@/lib/chat/quickCheckSectionExtractor";
import {
  DOCUMENT_PARSER_ADAPTER_IDS,
  DEFAULT_DOCUMENT_PARSER_ADAPTER_ID,
  getDocumentParserAdapter,
  listDocumentParserAdapters,
  parseDocumentText,
  resolveConfiguredDocumentParserAdapterId,
} from "@/lib/documentParsing";
import { currentExtractorAdapter } from "@/lib/documentParsing/adapters/currentExtractor";
import { setLiteParseImplementationForTests } from "@/lib/documentParsing/adapters/liteParse";

const VM0007_TEXT = [
  "1.9  Project Boundary",
  "The project area is defined in this section.",
  "",
  "2.4  Baseline Scenario",
  "The baseline scenario is the most likely land-use scenario without the project.",
  "",
  "4.3  Monitoring Plan",
  "The monitoring plan defines the monitoring frequency and responsibilities.",
].join("\n");

describe("documentParsing current extractor adapter", () => {
  afterEach(() => {
    delete process.env.QUICK_CHECK_PARSER;
    setLiteParseImplementationForTests(null);
  });

  it("registers both parser adapters while keeping current-extractor as the default", () => {
    expect(DOCUMENT_PARSER_ADAPTER_IDS).toEqual(["current-extractor", "liteparse"]);
    expect(listDocumentParserAdapters().map((adapter) => adapter.id)).toEqual(["current-extractor", "liteparse"]);
    expect(resolveConfiguredDocumentParserAdapterId(undefined)).toBe("current-extractor");
    expect(resolveConfiguredDocumentParserAdapterId("invalid-parser")).toBe("current-extractor");
    expect(getDocumentParserAdapter().id).toBe(DEFAULT_DOCUMENT_PARSER_ADAPTER_ID);
  });

  it("exposes the current extractor as the default parser adapter", () => {
    expect(getDocumentParserAdapter().id).toBe(DEFAULT_DOCUMENT_PARSER_ADAPTER_ID);
  });

  it("returns the same section and heading extraction as the legacy quick check helpers", () => {
    const parsed = parseDocumentText({ rawText: VM0007_TEXT });

    expect(parsed.adapterId).toBe("current-extractor");
    expect(parsed.source).toBe("current-extractor");
    expect(parsed.parserName).toBe("current-extractor");
    expect(parsed.rawText).toBe(VM0007_TEXT);
    expect(parsed.normalizedText).toBe(VM0007_TEXT);
    expect(parsed.pages).toEqual([
      {
        pageNumber: 1,
        rawText: VM0007_TEXT,
        normalizedText: VM0007_TEXT,
        elements: parsed.elements,
      },
    ]);
    expect(parsed.elements[0]).toEqual(expect.objectContaining({
      pageNumber: 1,
      elementType: "heading",
      sectionNumber: "1.9",
      sectionPath: ["1", "1.9"],
      sourceParser: "current-extractor",
    }));
    expect(parsed.elements.some((element) => element.elementType === "paragraph")).toBe(true);
    expect(parsed.tables).toEqual([]);
    expect(parsed.qualityReport).toEqual(expect.objectContaining({
      parserName: "current-extractor",
      hasStructuredHeadings: true,
      hasPageBoundaries: false,
      hasBoundingBoxes: false,
      hasTables: false,
    }));
    expect(parsed.headings.map((heading) => heading.sectionNumber)).toEqual(["1.9", "2.4", "4.3"]);
    expect(parsed.blocks.some((block) => block.type === "heading")).toBe(true);
    expect(parsed.blocks.some((block) => block.type === "paragraph")).toBe(true);
    expect(parsed.sectionsByNumber).toEqual(extractPddSections(VM0007_TEXT));
    expect(parsed.headingIndex).toEqual(buildPddHeadingIndex(VM0007_TEXT));
    expect(parsed.diagnostics).toEqual({
      metadata: debugSectionExtraction(VM0007_TEXT),
    });
  });

  it("avoids noisy diagnostics for blank input while keeping a stable empty shape", () => {
    const parsed = parseDocumentText({ rawText: "   " });

    expect(parsed.normalizedText).toBe("   ");
    expect(parsed.pages).toEqual([
      {
        pageNumber: 1,
        rawText: "   ",
        normalizedText: "   ",
        elements: [],
      },
    ]);
    expect(parsed.elements).toEqual([]);
    expect(parsed.tables).toEqual([]);
    expect(parsed.blocks).toEqual([]);
    expect(parsed.headings).toEqual([]);
    expect(parsed.sectionsByNumber).toEqual({});
    expect(parsed.headingIndex).toEqual([]);
    expect(parsed.diagnostics).toBeUndefined();
    expect(parsed.qualityReport).toEqual(expect.objectContaining({
      parserName: "current-extractor",
      hasStructuredHeadings: false,
    }));
  });

  it("preserves page metadata when raw text already contains page breaks", () => {
    const parsed = parseDocumentText({
      rawText: [
        "1 Project Details",
        "Host country: Indonesia",
        "\f",
        "2 Baseline Scenario",
        "Baseline scenario: forest conversion.",
      ].join("\n"),
    });

    expect(parsed.pages).toHaveLength(2);
    expect(parsed.pages.map((page) => page.pageNumber)).toEqual([1, 2]);
    expect(parsed.pages[1]?.elements.length).toBeGreaterThan(0);
    expect(parsed.pages[1]?.elements.some((element) => element.pageNumber === 2)).toBe(true);
    expect(parsed.elements.some((element) => element.pageNumber === 2)).toBe(true);
    expect(parsed.qualityReport.hasPageBoundaries).toBe(true);
  });

  it("selects liteparse from QUICK_CHECK_PARSER without changing the parsed-document contract", () => {
    setLiteParseImplementationForTests({
      parseText(input) {
        const baseline = currentExtractorAdapter.parseText(input);
        return {
          ...baseline,
          normalizedText: `${baseline.normalizedText}\n`,
          source: "liteparse",
        };
      },
    });
    process.env.QUICK_CHECK_PARSER = "liteparse";

    const parsed = parseDocumentText({ rawText: VM0007_TEXT });

    expect(getDocumentParserAdapter().id).toBe("liteparse");
    expect(parsed.adapterId).toBe("liteparse");
    expect(parsed.source).toBe("liteparse");
    expect(parsed.headings.map((heading) => heading.sectionNumber)).toEqual(["1.9", "2.4", "4.3"]);
    expect(parsed.sectionsByNumber).toEqual(extractPddSections(VM0007_TEXT));
    expect(parsed.headingIndex).toEqual(buildPddHeadingIndex(VM0007_TEXT));
  });

  it("falls back to current-extractor when liteparse is unavailable", () => {
    process.env.QUICK_CHECK_PARSER = "liteparse";

    const parsed = parseDocumentText({ rawText: VM0007_TEXT });

    expect(parsed.adapterId).toBe("current-extractor");
    expect(parsed.source).toBe("current-extractor");
    expect(parsed.diagnostics?.warnings).toContain("LiteParse unavailable; fell back to current extractor.");
  });

  it("falls back to current-extractor when liteparse throws at runtime", () => {
    setLiteParseImplementationForTests({
      parseText() {
        throw new Error("simulated liteparse failure");
      },
    });
    process.env.QUICK_CHECK_PARSER = "liteparse";

    const parsed = parseDocumentText({ rawText: VM0007_TEXT });

    expect(parsed.adapterId).toBe("current-extractor");
    expect(parsed.sectionsByNumber).toEqual(extractPddSections(VM0007_TEXT));
    expect(parsed.diagnostics?.warnings?.some((warning) => warning.includes("simulated liteparse failure"))).toBe(true);
  });
});
