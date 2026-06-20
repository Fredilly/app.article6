import { afterEach, describe, expect, it } from "@jest/globals";
import { currentExtractorAdapter } from "@/lib/documentParsing/adapters/currentExtractor";
import {
  DOCUMENT_PARSER_ADAPTER_IDS,
  getDocumentParserAdapter,
  listDocumentParserAdapters,
  parseDocumentText,
} from "@/lib/documentParsing";
import type {
  ParsedDocument,
  ParsedElement,
  ParsedPage,
  ParserAdapter,
} from "@/lib/documentParsing";
import { buildDocumentStructure } from "@/lib/documentModel";
import type { DocumentStructure } from "@/lib/documentModel";
import {
  compileEvidenceDocument,
  compileEvidenceDocumentFromStructure,
} from "@/lib/quickCheck/evidence/compileEvidenceDocument";
import { validateQuotes } from "@/lib/quickCheck/evidence/validateQuotes";

describe("ParserAdapter boundary contract", () => {
  it("currentExtractorAdapter satisfies the ParserAdapter interface", () => {
    const adapter: ParserAdapter = currentExtractorAdapter;

    expect(adapter.id).toBe("current-extractor");
    expect(typeof adapter.parseText).toBe("function");
  });

  it("parseText always returns a ParsedDocument with required fields populated", () => {
    const parsed: ParsedDocument = currentExtractorAdapter.parseText({ rawText: "Hello" });

    expect(parsed.adapterId).toBe("current-extractor");
    expect(parsed.source).toBe("current-extractor");
    expect(parsed.parserName).toBe("current-extractor");
    expect(parsed.rawText).toBe("Hello");
    expect(parsed.normalizedText).toBe("Hello");
    expect(Array.isArray(parsed.pages)).toBe(true);
    expect(Array.isArray(parsed.elements)).toBe(true);
    expect(Array.isArray(parsed.tables)).toBe(true);
    expect(parsed.qualityReport).toBeDefined();
    expect(parsed.qualityReport.parserName).toBe("current-extractor");
    expect(Array.isArray(parsed.blocks)).toBe(true);
    expect(Array.isArray(parsed.headings)).toBe(true);
  });

  it("produces an empty ParsedDocument for blank input without throwing", () => {
    const parsed = currentExtractorAdapter.parseText({ rawText: "" });

    expect(parsed.pages).toHaveLength(1);
    expect(parsed.pages[0]?.elements).toEqual([]);
    expect(parsed.elements).toEqual([]);
    expect(parsed.tables).toEqual([]);
    expect(parsed.blocks).toEqual([]);
    expect(parsed.headings).toEqual([]);
    expect(parsed.qualityReport.pageCount).toBe(1);
  });

  it("every registered adapter satisfies the ParserAdapter interface", () => {
    const adapters = listDocumentParserAdapters();

    for (const adapter of adapters) {
      expect(DOCUMENT_PARSER_ADAPTER_IDS).toContain(adapter.id);
      expect(typeof adapter.parseText).toBe("function");
    }
  });

  it("current-extractor adapter always returns its own adapterId", () => {
    const parsed = currentExtractorAdapter.parseText({ rawText: "test" });
    expect(parsed.adapterId).toBe("current-extractor");
  });
});

describe("ParsedDocument structure", () => {
  it("paginates multi-page input via form-feed (\\f) boundaries", () => {
    const parsed = parseDocumentText({
      rawText: "Page 1 content\n\fPage 2 content\n\fPage 3 content",
    });

    expect(parsed.pages).toHaveLength(3);
    expect(parsed.pages.map((p) => p.pageNumber)).toEqual([1, 2, 3]);
    expect(parsed.pages[0]?.rawText).toBe("Page 1 content\n");
    expect(parsed.pages[1]?.rawText).toBe("Page 2 content\n");
    expect(parsed.pages[2]?.rawText).toBe("Page 3 content");
    expect(parsed.qualityReport.hasPageBoundaries).toBe(true);
    expect(parsed.qualityReport.pageCount).toBe(3);
  });

  it("assigns single page when no form-feed is present", () => {
    const parsed = parseDocumentText({ rawText: "Single page content" });

    expect(parsed.pages).toHaveLength(1);
    expect(parsed.pages[0]?.pageNumber).toBe(1);
    expect(parsed.qualityReport.hasPageBoundaries).toBe(false);
    expect(parsed.qualityReport.pageCount).toBe(1);
  });

  it("each ParsedPage has all required fields", () => {
    const parsed = parseDocumentText({ rawText: "Multi\n\fPage" });

    for (const page of parsed.pages) {
      expect(typeof page.pageNumber).toBe("number");
      expect(page.pageNumber).toBeGreaterThan(0);
      expect(typeof page.rawText).toBe("string");
      expect(typeof page.normalizedText).toBe("string");
      expect(Array.isArray(page.elements)).toBe(true);
    }
  });

  it("preserves pages as ParsedPage type", () => {
    const parsed = parseDocumentText({ rawText: "Section 1\n\fSection 2" });
    const pages: ParsedPage[] = parsed.pages;

    expect(pages.length).toBeGreaterThanOrEqual(1);
    for (const page of pages) {
      expect(page.pageNumber).toBeGreaterThan(0);
      expect("rawText" in page).toBe(true);
      expect("normalizedText" in page).toBe(true);
      expect("elements" in page).toBe(true);
    }
  });
});

describe("ParsedElement metadata preservation", () => {
  const DOCUMENT_TEXT = [
    "1 Project Description",
    "This Verra VCS project description concerns avoided deforestation.",
    "",
    "2.1 Baseline Methodology",
    "The baseline methodology uses VM0007 REDD+.",
    "",
    "3 Monitoring",
    "Annual monitoring of forest cover change is required.",
  ].join("\n");

  it("preserves page number on every element", () => {
    const parsed = parseDocumentText({ rawText: DOCUMENT_TEXT });

    for (const element of parsed.elements) {
      expect(typeof element.pageNumber).toBe("number");
      expect(element.pageNumber).toBeGreaterThan(0);
    }
  });

  it("preserves element type classification", () => {
    const parsed = parseDocumentText({ rawText: DOCUMENT_TEXT });

    const headings = parsed.elements.filter((e) => e.elementType === "heading");
    const paragraphs = parsed.elements.filter((e) => e.elementType === "paragraph");

    expect(headings.length).toBeGreaterThanOrEqual(2);
    expect(paragraphs.length).toBeGreaterThanOrEqual(2);

    for (const element of parsed.elements) {
      expect(["heading", "paragraph", "table", "list_item", "footer", "header", "unknown"]).toContain(element.elementType);
    }
  });

  it("preserves heading level for section headings", () => {
    const parsed = parseDocumentText({ rawText: DOCUMENT_TEXT });

    const headingElements = parsed.elements.filter((e) => e.elementType === "heading");
    const sectionOne = headingElements.find((e) => e.sectionNumber === "1");

    expect(sectionOne).toBeDefined();
    expect(sectionOne?.headingLevel).toBe(1);

    const sectionTwoOne = headingElements.find((e) => e.sectionNumber === "2.1");
    expect(sectionTwoOne).toBeDefined();
    expect(sectionTwoOne?.headingLevel).toBe(2);

    const sectionThree = headingElements.find((e) => e.sectionNumber === "3");
    expect(sectionThree).toBeDefined();
    expect(sectionThree?.headingLevel).toBe(1);
  });

  it("preserves section path on elements", () => {
    const parsed = parseDocumentText({ rawText: DOCUMENT_TEXT });

    const headingElements = parsed.elements.filter((e) => e.elementType === "heading");
    const sectionOne = headingElements.find((e) => e.sectionNumber === "1");
    const sectionThree = headingElements.find((e) => e.sectionNumber === "3");

    expect(sectionOne?.sectionPath).toEqual(["1"]);
    expect(sectionThree?.sectionPath).toEqual(["3"]);
  });

  it("preserves source parser name on every element", () => {
    const parsed = parseDocumentText({ rawText: DOCUMENT_TEXT });

    for (const element of parsed.elements) {
      expect(typeof element.sourceParser).toBe("string");
      expect(element.sourceParser).toBe("current-extractor");
    }
  });

  it("preserves confidence score on every element", () => {
    const parsed = parseDocumentText({ rawText: DOCUMENT_TEXT });

    for (const element of parsed.elements) {
      expect(typeof element.confidence).toBe("number");
      expect(element.confidence).toBeGreaterThan(0);
      expect(element.confidence).toBeLessThanOrEqual(1);
    }

    const headingElements = parsed.elements.filter((e) => e.elementType === "heading");
    const paragraphElements = parsed.elements.filter((e) => e.elementType === "paragraph");

    for (const h of headingElements) {
      expect(h.confidence).toBeGreaterThanOrEqual(0.9);
    }
    for (const p of paragraphElements) {
      expect(p.confidence).toBeGreaterThanOrEqual(0.7);
    }
  });

  it("preserves text and normalizedText on every element", () => {
    const parsed = parseDocumentText({ rawText: DOCUMENT_TEXT });

    for (const element of parsed.elements) {
      expect(typeof element.text).toBe("string");
      expect(element.text.length).toBeGreaterThan(0);
      expect(typeof element.normalizedText).toBe("string");
      expect(element.normalizedText.length).toBeGreaterThan(0);
    }
  });

  it("preserves char offsets when available", () => {
    const parsed = parseDocumentText({ rawText: "1 Title\nBody text here." });

    const elementsWithOffsets = parsed.elements.filter(
      (e) => e.charStart !== undefined && e.charEnd !== undefined,
    );

    for (const element of elementsWithOffsets) {
      expect(typeof element.charStart).toBe("number");
      expect(typeof element.charEnd).toBe("number");
      expect(element.charEnd).toBeGreaterThan(element.charStart);
    }
  });
});

describe("ParsedDocument normalization into DocumentStructure", () => {
  const NORMALIZED_TEXT = [
    "1 Project Details",
    "Host country: Indonesia",
    "Project location: Central Kalimantan",
    "",
    "2 Baseline Scenario",
    "Baseline scenario: forest conversion.",
  ].join("\n");

  it("normalizes ParsedDocument into a valid DocumentStructure", () => {
    const parsed = parseDocumentText({ rawText: NORMALIZED_TEXT });
    const structure: DocumentStructure = buildDocumentStructure({ parsedDocument: parsed });

    expect(structure.parserAdapterId).toBe("current-extractor");
    expect(structure.source).toBe("current-extractor");
    expect(structure.rawText).toBe(NORMALIZED_TEXT);
    expect(structure.cleanText).toBeDefined();
    expect(structure.matchingText).toBeDefined();
    expect(structure.documentFamily).toBeDefined();
    expect(structure.qualityReport).toBeDefined();
    expect(Array.isArray(structure.pages)).toBe(true);
    expect(Array.isArray(structure.blocks)).toBe(true);
    expect(Array.isArray(structure.sections)).toBe(true);
    expect(Array.isArray(structure.extractionWarnings)).toBe(true);
  });

  it("preserves page provenance in DocumentStructure", () => {
    const parsed = parseDocumentText({ rawText: NORMALIZED_TEXT });
    const structure = buildDocumentStructure({ parsedDocument: parsed });

    expect(structure.pages).toHaveLength(1);
    expect(structure.pages[0]?.pageNumber).toBe(1);
    expect(structure.pages[0]?.sourceRefs[0]?.parserAdapterId).toBe("current-extractor");
    expect(structure.pages[0]?.sourceRefs[0]?.pageNumber).toBe(1);
  });

  it("preserves block metadata from parser elements", () => {
    const parsed = parseDocumentText({ rawText: NORMALIZED_TEXT });
    const structure = buildDocumentStructure({ parsedDocument: parsed });

    const headingBlock = structure.blocks.find((b) => b.type === "heading");

    expect(headingBlock).toBeDefined();
    expect(headingBlock?.confidence).toBeGreaterThan(0);
    expect(headingBlock?.parserElementId).toBeDefined();
    expect(headingBlock?.pageNumber).toBe(1);

    const paragraphBlock = structure.blocks.find((b) => b.type === "paragraph");
    expect(paragraphBlock).toBeDefined();
    expect(paragraphBlock?.cleanText.length).toBeGreaterThan(0);
  });

  it("preserves section hierarchy from parser headings", () => {
    const parsed = parseDocumentText({ rawText: NORMALIZED_TEXT });
    const structure = buildDocumentStructure({ parsedDocument: parsed });

    const projectSection = structure.sections.find((s) => s.sectionNumber === "1");
    const baselineSection = structure.sections.find((s) => s.sectionNumber === "2");

    expect(projectSection).toBeDefined();
    expect(projectSection?.titleRaw).toContain("Project Details");
    expect(baselineSection).toBeDefined();
    expect(baselineSection?.titleRaw).toContain("Baseline Scenario");
  });

  it("handles nested section hierarchy", () => {
    const nestedText = [
      "4.3 Monitoring Plan",
      "The monitoring plan describes annual monitoring.",
      "4.3.1 Monitoring Frequency",
      "Monitoring occurs every 12 months.",
    ].join("\n");
    const parsed = parseDocumentText({ rawText: nestedText });
    const structure = buildDocumentStructure({ parsedDocument: parsed });

    const parent = structure.sections.find((s) => s.sectionNumber === "4.3");
    const child = structure.sections.find((s) => s.sectionNumber === "4.3.1");

    expect(parent).toBeDefined();
    expect(child).toBeDefined();
    expect(parent?.childIds).toContain(child?.id);
    expect(child?.parentId).toBe(parent?.id);
  });

  it("produces a DocumentStructure conforming to the type contract", () => {
    const parsed = parseDocumentText({ rawText: NORMALIZED_TEXT });
    const structure = buildDocumentStructure({ parsedDocument: parsed });

    expect(typeof structure.id).toBe("string");
    expect(structure.id.startsWith("article6-document:")).toBe(true);
    expect(structure.parserAdapterId).toBe("current-extractor");
    expect(structure.documentFamily.family).toBeDefined();
    expect(structure.documentFamily.confidence).toBeGreaterThan(0);
    expect(Array.isArray(structure.documentFamily.signals)).toBe(true);
    expect(structure.qualityReport.hasStructuredHeadings).toBeDefined();
    expect(Array.isArray(structure.extractionWarnings)).toBe(true);
  });
});

describe("Normalized path evidence compilation", () => {
  const EVIDENCE_TEXT = [
    "Katingan Peatland Restoration and Conservation Project",
    "",
    "1 Project Details",
    "Host country: Indonesia",
    "Project location: Central Kalimantan, Indonesia",
    "Methodology: VM0007 REDD+ (v1.6)",
    "",
    "2 Baseline Scenario",
    "Baseline scenario: Conversion of peat swamp forest to plantations.",
  ].join("\n");

  it("compiles evidence spans from DocumentStructure", () => {
    const parsed = parseDocumentText({ rawText: EVIDENCE_TEXT });
    const structure = buildDocumentStructure({ parsedDocument: parsed });
    const compiled = compileEvidenceDocumentFromStructure({
      docId: "test-doc",
      documentStructure: structure,
    });

    expect(compiled.docId).toBe("test-doc");
    expect(compiled.rawText).toBe(EVIDENCE_TEXT);
    expect(compiled.spans.length).toBeGreaterThan(0);
    expect(compiled.parserSource).toBe("current-extractor");
    expect(compiled.parserAdapterId).toBe("current-extractor");

    const spanIds = compiled.spans.map((s) => s.spanId);
    expect(new Set(spanIds).size).toBe(spanIds.length);
  });

  it("evidence spans from structure maintain page provenance", () => {
    const parsed = parseDocumentText({ rawText: EVIDENCE_TEXT });
    const structure = buildDocumentStructure({ parsedDocument: parsed });
    const compiled = compileEvidenceDocumentFromStructure({
      docId: "test-doc",
      documentStructure: structure,
    });

    for (const span of compiled.spans) {
      expect(span.page).toBeGreaterThanOrEqual(1);
      expect(span.spanId.startsWith("test-doc:")).toBe(true);
      expect(typeof span.blockType).toBe("string");
      expect(typeof span.text).toBe("string");
      expect(typeof span.confidence).toBe("number");
      expect(span.confidence).toBeGreaterThan(0);
    }
  });

  it("evidence spans from structure have section context", () => {
    const parsed = parseDocumentText({ rawText: EVIDENCE_TEXT });
    const structure = buildDocumentStructure({ parsedDocument: parsed });
    const compiled = compileEvidenceDocumentFromStructure({
      docId: "test-doc",
      documentStructure: structure,
    });

    const projectSpans = compiled.spans.filter(
      (s) => s.heading === "Project Details",
    );
    expect(projectSpans.length).toBeGreaterThan(0);
    for (const span of projectSpans) {
      expect(span.sectionId).toBe("section:1");
    }
  });

  it("quote validation works on evidence compiled from structure", () => {
    const parsed = parseDocumentText({ rawText: EVIDENCE_TEXT });
    const structure = buildDocumentStructure({ parsedDocument: parsed });
    const compiled = compileEvidenceDocumentFromStructure({
      docId: "test-doc",
      documentStructure: structure,
    });

    const [exact, missing] = validateQuotes(compiled, [
      { quote: "Host country: Indonesia" },
      { quote: "This is not in the document" },
    ]);

    expect(exact).toEqual(expect.objectContaining({
      valid: true,
      matchType: "exact",
      confidence: "high",
    }));

    expect(missing).toEqual(expect.objectContaining({
      valid: false,
      matchType: "missing",
    }));
  });

  it("full chain: rawText -> ParsedDocument -> DocumentStructure -> EvidenceDocument produces consistent results", () => {
    const parsed = parseDocumentText({ rawText: EVIDENCE_TEXT });
    const structure = buildDocumentStructure({ parsedDocument: parsed });
    const compiledFromStructure = compileEvidenceDocumentFromStructure({
      docId: "full-chain",
      documentStructure: structure,
    });

    const compiledDirect = compileEvidenceDocument({
      docId: "full-chain",
      rawText: EVIDENCE_TEXT,
    });

    const fromStructureHeadings = compiledFromStructure.spans
      .filter((s) => s.heading)
      .map((s) => s.heading);
    const directHeadings = compiledDirect.spans
      .filter((s) => s.heading)
      .map((s) => s.heading);

    for (const heading of directHeadings) {
      expect(fromStructureHeadings).toContain(heading);
    }
  });
});

describe("ParserAdapter isolation", () => {
  it("parser output does not influence router status policy", () => {
    const parsed = parseDocumentText({
      rawText: [
        "1 Project Details",
        "Host country: Indonesia",
      ].join("\n"),
    });
    const structure = buildDocumentStructure({ parsedDocument: parsed });

    expect(structure.documentFamily.family).toBeDefined();
    expect(structure.documentFamily.confidence).toBeGreaterThan(0);
    expect(structure.blocks.length).toBeGreaterThan(0);

    const headingBlock = structure.blocks.find((b) => b.type === "heading");
    expect(headingBlock).toBeDefined();
    expect(headingBlock?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("no vendor API calls or external parser dependencies needed", () => {
    const adapter = getDocumentParserAdapter("current-extractor");
    const parsed = adapter.parseText({ rawText: "Test content" });

    expect(parsed.adapterId).toBe("current-extractor");
    expect(parsed.parserName).toBe("current-extractor");
    expect(parsed.qualityReport.parserName).toBe("current-extractor");
  });

  it("multi-page documents preserve per-page element assignment", () => {
    const parsed = parseDocumentText({
      rawText: [
        "1 Project Details",
        "Host country: Indonesia",
        "\f",
        "2 Baseline Scenario",
        "Baseline scenario: forest conversion.",
        "\f",
        "3 Monitoring",
        "Annual monitoring of forest cover.",
      ].join("\n"),
    });

    expect(parsed.pages).toHaveLength(3);
    expect(parsed.qualityReport.hasPageBoundaries).toBe(true);

    const page2Elements = parsed.elements.filter((e) => e.pageNumber === 2);
    expect(page2Elements.length).toBeGreaterThan(0);
    expect(page2Elements.some((e) => e.text.includes("Baseline Scenario"))).toBe(true);

    const page3Elements = parsed.elements.filter((e) => e.pageNumber === 3);
    expect(page3Elements.length).toBeGreaterThan(0);
    expect(page3Elements.some((e) => e.text.includes("Monitoring"))).toBe(true);

    const page2Page = parsed.pages.find((p) => p.pageNumber === 2);
    expect(page2Page).toBeDefined();
    expect(page2Page?.rawText).toContain("Baseline Scenario");
    expect(page2Page?.elements.every((e) => e.pageNumber === 2)).toBe(true);
  });
});
