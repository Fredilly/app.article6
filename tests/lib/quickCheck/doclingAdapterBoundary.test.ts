import { afterEach, describe, expect, it } from "@jest/globals";
import { currentExtractorAdapter } from "@/lib/documentParsing/adapters/currentExtractor";
import {
  doclingAdapter,
  parseDoclingText,
  setDoclingImplementationForTests,
  setDoclingHelperRunnerForTests,
  isDoclingMarkdown,
  mapDoclingHelperJsonToParsedDocument,
} from "@/lib/documentParsing/adapters/doclingAdapter";
import { parseDoclingHelperOutput, type DoclingHelperJson } from "@/lib/documentParsing/adapters/doclingHelper";
import { initDoclingAdapterRuntime } from "@/lib/documentParsing/adapters/doclingInit";
import {
  DOCUMENT_PARSER_ADAPTER_IDS,
  getDocumentParserAdapter,
  listDocumentParserAdapters,
  parseDocumentText,
} from "@/lib/documentParsing";
import type { ParserAdapter, ParsedDocument, ParseDocumentTextInput } from "@/lib/documentParsing";
import { buildDocumentStructure } from "@/lib/documentModel";
import {
  compileEvidenceDocumentFromStructure,
} from "@/lib/quickCheck/evidence/compileEvidenceDocument";
import { validateQuotes } from "@/lib/quickCheck/evidence/validateQuotes";

function makeDoclingBaseline(input: ParseDocumentTextInput): ParsedDocument {
  const baseline = currentExtractorAdapter.parseText(input);
  return {
    ...baseline,
    adapterId: "docling" as const,
    source: "docling",
    parserName: "docling",
    qualityReport: {
      ...baseline.qualityReport,
      parserName: "docling",
    },
    elements: baseline.elements.map((el) => ({
      ...el,
      sourceParser: "docling",
    })),
  };
}

const DOCLING_MARKDOWN = [
  "## Project Description",
  "This Verra VCS project description concerns avoided deforestation in Central Kalimantan.",
  "",
  "### Methodology",
  "The project uses VM0007 REDD+ Methodology Framework v1.6.",
  "",
  "## Baseline Scenario",
  "Baseline scenario: Conversion of peat swamp forest to plantations without project intervention.",
  "",
  "## Additionality",
  "The project is additional because investment barriers and land-use pressure would otherwise prevent conservation.",
  "",
  "## Monitoring",
  "Annual monitoring of forest cover change is required per the monitoring plan.",
].join("\n");

describe("Docling parser adapter", () => {
  afterEach(() => {
    delete process.env.QUICK_CHECK_PARSER;
    setDoclingImplementationForTests(null);
    setDoclingHelperRunnerForTests(null);
  });

  it("is registered in the adapter list alongside current-extractor and liteparse", () => {
    expect(DOCUMENT_PARSER_ADAPTER_IDS).toContain("docling");
    const adapters = listDocumentParserAdapters();
    const adapterIds = adapters.map((a) => a.id);
    expect(adapterIds).toContain("current-extractor");
    expect(adapterIds).toContain("liteparse");
    expect(adapterIds).toContain("docling");
  });

  it("satisfies the ParserAdapter interface", () => {
    const adapter: ParserAdapter = doclingAdapter;

    expect(adapter.id).toBe("docling");
    expect(typeof adapter.parseText).toBe("function");
  });

  it("falls back to current-extractor when no test implementation is set", () => {
    const parsed = doclingAdapter.parseText({
      rawText: "1 Project Details\nHost country: Indonesia",
    });

    expect(parsed.adapterId).toBe("current-extractor");
    expect(parsed.source).toBe("current-extractor");
    expect(parsed.diagnostics?.warnings).toContain(
      "Docling unavailable; fell back to current extractor.",
    );
  });

  it("uses test injection when an implementation is set", () => {
    setDoclingImplementationForTests({
      parseText: makeDoclingBaseline,
    });

    const parsed = doclingAdapter.parseText({
      rawText: "1 Project Details\nHost country: Indonesia",
    });

    expect(parsed.adapterId).toBe("docling");
    expect(parsed.source).toBe("docling");
    expect(parsed.parserName).toBe("docling");
  });

  it("falls back to current-extractor when test implementation throws", () => {
    setDoclingImplementationForTests({
      parseText() {
        throw new Error("simulated docling failure");
      },
    });

    const parsed = doclingAdapter.parseText({
      rawText: "1 Project Details\nHost country: Indonesia",
    });

    expect(parsed.adapterId).toBe("current-extractor");
    expect(parsed.diagnostics?.warnings?.some(
      (w) => w.includes("simulated docling failure"),
    )).toBe(true);
  });

  it("honours isAvailable flag when test implementation declares unavailability", () => {
    setDoclingImplementationForTests({
      isAvailable: () => false,
      parseText: makeDoclingBaseline,
    });

    const parsed = doclingAdapter.parseText({
      rawText: "1 Project Details\nHost country: Indonesia",
    });

    expect(parsed.adapterId).toBe("current-extractor");
    expect(parsed.diagnostics?.warnings).toContain(
      "Docling unavailable; fell back to current extractor.",
    );
  });
});

describe("Docling adapter ParsedDocument output", () => {
  afterEach(() => {
    delete process.env.QUICK_CHECK_PARSER;
    setDoclingImplementationForTests(null);
  });

  it("produces a ParsedDocument with docling adapterId via test injection", () => {
    setDoclingImplementationForTests({
      parseText: makeDoclingBaseline,
    });

    const parsed = parseDocumentText({ rawText: DOCLING_MARKDOWN }, "docling");

    expect(parsed.adapterId).toBe("docling");
    expect(parsed.source).toBe("docling");
    expect(parsed.parserName).toBe("docling");
  });

  it("produces a ParsedDocument with expected structural fields", () => {
    setDoclingImplementationForTests({
      parseText: makeDoclingBaseline,
    });

    const parsed: ParsedDocument = parseDocumentText(
      { rawText: DOCLING_MARKDOWN },
      "docling",
    );

    expect(parsed.rawText).toBe(DOCLING_MARKDOWN);
    expect(Array.isArray(parsed.pages)).toBe(true);
    expect(Array.isArray(parsed.elements)).toBe(true);
    expect(Array.isArray(parsed.tables)).toBe(true);
    expect(Array.isArray(parsed.blocks)).toBe(true);
    expect(Array.isArray(parsed.headings)).toBe(true);
    expect(parsed.qualityReport).toBeDefined();
    expect(parsed.qualityReport.parserName).toBe("docling");
  });

  it("elements preserve page number metadata", () => {
    setDoclingImplementationForTests({
      parseText: makeDoclingBaseline,
    });

    const parsed = parseDocumentText({ rawText: DOCLING_MARKDOWN }, "docling");

    for (const element of parsed.elements) {
      expect(typeof element.pageNumber).toBe("number");
      expect(element.pageNumber).toBeGreaterThan(0);
    }
  });

  it("elements preserve sourceParser name", () => {
    setDoclingImplementationForTests({
      parseText: makeDoclingBaseline,
    });

    const parsed = parseDocumentText({ rawText: DOCLING_MARKDOWN }, "docling");

    for (const element of parsed.elements) {
      expect(element.sourceParser).toBe("docling");
    }
  });

  it("elements preserve confidence scores", () => {
    setDoclingImplementationForTests({
      parseText: makeDoclingBaseline,
    });

    const parsed = parseDocumentText({ rawText: DOCLING_MARKDOWN }, "docling");

    for (const element of parsed.elements) {
      expect(typeof element.confidence).toBe("number");
      expect(element.confidence).toBeGreaterThan(0);
      expect(element.confidence).toBeLessThanOrEqual(1);
    }
  });
});

describe("Docling adapter normalization into DocumentStructure", () => {
  afterEach(() => {
    delete process.env.QUICK_CHECK_PARSER;
    setDoclingImplementationForTests(null);
  });

  it("Docling ParsedDocument normalizes into a valid DocumentStructure", () => {
    setDoclingImplementationForTests({
      parseText: makeDoclingBaseline,
    });

    const parsed = parseDocumentText({ rawText: DOCLING_MARKDOWN }, "docling");
    const structure = buildDocumentStructure({ parsedDocument: parsed });

    expect(structure.parserAdapterId).toBe("docling");
    expect(structure.source).toBe("docling");
    expect(structure.rawText).toBe(DOCLING_MARKDOWN);
    expect(Array.isArray(structure.pages)).toBe(true);
    expect(Array.isArray(structure.blocks)).toBe(true);
    expect(Array.isArray(structure.sections)).toBe(true);
    expect(structure.documentFamily).toBeDefined();
    expect(structure.qualityReport).toBeDefined();
  });

  it("Docling evidence compiles from structure into EvidenceDocument", () => {
    setDoclingImplementationForTests({
      parseText: makeDoclingBaseline,
    });

    const parsed = parseDocumentText({ rawText: DOCLING_MARKDOWN }, "docling");
    const structure = buildDocumentStructure({ parsedDocument: parsed });
    const compiled = compileEvidenceDocumentFromStructure({
      docId: "docling-test",
      documentStructure: structure,
    });

    expect(compiled.docId).toBe("docling-test");
    expect(compiled.rawText).toBe(DOCLING_MARKDOWN);
    expect(compiled.spans.length).toBeGreaterThan(0);
    expect(compiled.parserSource).toBe("docling");
    expect(compiled.parserAdapterId).toBe("docling");
  });

  it("quote validation works on Docling-compiled evidence", () => {
    setDoclingImplementationForTests({
      parseText: makeDoclingBaseline,
    });

    const parsed = parseDocumentText({ rawText: DOCLING_MARKDOWN }, "docling");
    const structure = buildDocumentStructure({ parsedDocument: parsed });
    const compiled = compileEvidenceDocumentFromStructure({
      docId: "docling-test",
      documentStructure: structure,
    });

    const [exact] = validateQuotes(compiled, [
      { quote: "VM0007 REDD+ Methodology Framework v1.6" },
    ]);

    expect(exact.valid).toBe(true);
  });

  it("Docling evidence spans have provenance metadata", () => {
    setDoclingImplementationForTests({
      parseText: makeDoclingBaseline,
    });

    const parsed = parseDocumentText({ rawText: DOCLING_MARKDOWN }, "docling");
    const structure = buildDocumentStructure({ parsedDocument: parsed });
    const compiled = compileEvidenceDocumentFromStructure({
      docId: "docling-test",
      documentStructure: structure,
    });

    for (const span of compiled.spans) {
      expect(span.page).toBeGreaterThanOrEqual(1);
      expect(span.spanId.startsWith("docling-test:")).toBe(true);
      expect(typeof span.blockType).toBe("string");
      expect(typeof span.text).toBe("string");
      expect(typeof span.confidence).toBe("number");
      expect(span.confidence).toBeGreaterThan(0);
    }
  });
});

describe("Docling adapter isolation", () => {
  afterEach(() => {
    delete process.env.QUICK_CHECK_PARSER;
    setDoclingImplementationForTests(null);
  });

  it("docling adapter is never the default parser", () => {
    expect(getDocumentParserAdapter().id).toBe("current-extractor");
    expect(getDocumentParserAdapter().id).not.toBe("docling");
  });

  it("default parseDocumentText uses current-extractor, not docling", () => {
    const parsed = parseDocumentText({
      rawText: "1 Project Details\nHost country: Indonesia",
    });

    expect(parsed.adapterId).toBe("current-extractor");
  });

  it("selects docling only when QUICK_CHECK_PARSER=docling", () => {
    setDoclingImplementationForTests({
      parseText: makeDoclingBaseline,
    });
    process.env.QUICK_CHECK_PARSER = "docling";

    const parsed = parseDocumentText({
      rawText: "1 Project Details\nHost country: Indonesia",
    });

    expect(parsed.adapterId).toBe("docling");
  });

  it("recognizes Docling markdown format", () => {
    expect(isDoclingMarkdown("## Section One\nContent here")).toBe(true);
    expect(isDoclingMarkdown("### Subsection\nMore content")).toBe(true);
  });

  it("does not recognize arbitrary text as Docling markdown", () => {
    expect(isDoclingMarkdown("1 Project Details\nHost country: Indonesia")).toBe(false);
    expect(isDoclingMarkdown("Plain paragraph text.")).toBe(false);
  });
});

const SAMPLE_DOCLING_HELPER_JSON: DoclingHelperJson = {
  engine: "docling",
  parser_version: "2.0.0",
  raw_text: [
    "Project Description",
    "This Verra VCS project concerns avoided deforestation in Central Kalimantan.",
    "\f",
    "Baseline Scenario",
    "Baseline scenario: Conversion of peat swamp forest to plantations.",
  ].join("\n"),
  markdown: [
    "## Project Description",
    "This Verra VCS project concerns avoided deforestation in Central Kalimantan.",
    "",
    "## Baseline Scenario",
    "Baseline scenario: Conversion of peat swamp forest to plantations.",
  ].join("\n"),
  pages: [
    { page_number: 1, text: "Project Description" },
    { page_number: 1, text: "This Verra VCS project concerns avoided deforestation in Central Kalimantan." },
    { page_number: 2, text: "Baseline Scenario" },
    { page_number: 2, text: "Baseline scenario: Conversion of peat swamp forest to plantations." },
  ],
  headings: [
    { text: "Project Description", level: 2, page_number: 1 },
    { text: "Baseline Scenario", level: 2, page_number: 2 },
  ],
  tables: [],
};

describe("parseDoclingHelperOutput", () => {
  it("parses valid helper JSON", () => {
    const output = parseDoclingHelperOutput(JSON.stringify(SAMPLE_DOCLING_HELPER_JSON));

    expect(output.error).toBeUndefined();
    expect(output.engine).toBe("docling");
    expect(output.parser_version).toBe("2.0.0");
    expect(output.headings).toHaveLength(2);
    expect(output.headings?.[0]?.text).toBe("Project Description");
    expect(output.headings?.[0]?.level).toBe(2);
    expect(output.headings?.[0]?.page_number).toBe(1);
  });

  it("handles invalid JSON gracefully", () => {
    const output = parseDoclingHelperOutput("not json at all");

    expect(output.error).toBe("json_parse_failed");
    expect(output.message).toBe("Docling helper produced invalid JSON.");
  });

  it("handles empty string gracefully", () => {
    const output = parseDoclingHelperOutput("");

    expect(output.error).toBe("json_parse_failed");
  });

  it("handles helper JSON with error field", () => {
    const errorOutput = parseDoclingHelperOutput(
      JSON.stringify({ error: "docling_not_installed", message: "pip install docling" }),
    );

    expect(errorOutput.error).toBe("docling_not_installed");
    expect(errorOutput.message).toBe("pip install docling");
  });
});

describe("mapDoclingHelperJsonToParsedDocument", () => {
  it("produces adapterId docling", () => {
    const parsed = mapDoclingHelperJsonToParsedDocument(SAMPLE_DOCLING_HELPER_JSON, {
      rawText: "",
    });

    expect(parsed.adapterId).toBe("docling");
  });

  it("preserves raw_text from helper JSON", () => {
    const parsed = mapDoclingHelperJsonToParsedDocument(SAMPLE_DOCLING_HELPER_JSON, {
      rawText: "",
    });

    expect(parsed.rawText).toContain("Project Description");
    expect(parsed.rawText).toContain("Baseline Scenario");
    expect(parsed.rawText).toContain("\f");
  });

  it("maps page boundaries from form-feed separated raw_text", () => {
    const parsed = mapDoclingHelperJsonToParsedDocument(SAMPLE_DOCLING_HELPER_JSON, {
      rawText: "",
    });

    expect(parsed.pages).toHaveLength(2);
    expect(parsed.pages[0]?.pageNumber).toBe(1);
    expect(parsed.pages[1]?.pageNumber).toBe(2);
    expect(parsed.qualityReport.hasPageBoundaries).toBe(true);
    expect(parsed.qualityReport.pageCount).toBe(2);
  });

  it("maps headings into elements with correct elementType and metadata", () => {
    const parsed = mapDoclingHelperJsonToParsedDocument(SAMPLE_DOCLING_HELPER_JSON, {
      rawText: "",
    });

    const headingElements = parsed.elements.filter((e) => e.elementType === "heading");

    expect(headingElements).toHaveLength(2);
    expect(headingElements[0]?.text).toBe("Project Description");
    expect(headingElements[0]?.pageNumber).toBe(1);
    expect(headingElements[0]?.headingLevel).toBe(2);
    expect(headingElements[0]?.sourceParser).toBe("docling");

    expect(headingElements[1]?.text).toBe("Baseline Scenario");
    expect(headingElements[1]?.pageNumber).toBe(2);
  });

  it("maps paragraph items into elements", () => {
    const parsed = mapDoclingHelperJsonToParsedDocument(SAMPLE_DOCLING_HELPER_JSON, {
      rawText: "",
    });

    const paragraphElements = parsed.elements.filter((e) => e.elementType === "paragraph");

    expect(paragraphElements.length).toBeGreaterThan(0);
    expect(paragraphElements.some((e) => e.text.includes("Verra VCS"))).toBe(true);
    expect(paragraphElements.some((e) => e.text.includes("peat swamp"))).toBe(true);

    for (const el of paragraphElements) {
      expect(el.sourceParser).toBe("docling");
    }
  });

  it("assigns confidence scores to all elements", () => {
    const parsed = mapDoclingHelperJsonToParsedDocument(SAMPLE_DOCLING_HELPER_JSON, {
      rawText: "",
    });

    for (const element of parsed.elements) {
      expect(typeof element.confidence).toBe("number");
      expect(element.confidence).toBeGreaterThan(0);
      expect(element.confidence).toBeLessThanOrEqual(1);
    }

    const headings = parsed.elements.filter((e) => e.elementType === "heading");
    for (const h of headings) {
      expect(h.confidence).toBeGreaterThanOrEqual(0.9);
    }
  });

  it("assigns elements to correct pages", () => {
    const parsed = mapDoclingHelperJsonToParsedDocument(SAMPLE_DOCLING_HELPER_JSON, {
      rawText: "",
    });

    const page1 = parsed.pages[0];
    const page2 = parsed.pages[1];

    expect(page1).toBeDefined();
    expect(page2).toBeDefined();
    expect(page1?.elements.every((e) => e.pageNumber === 1)).toBe(true);
    expect(page2?.elements.every((e) => e.pageNumber === 2)).toBe(true);
  });

  it("sets quality report metadata", () => {
    const parsed = mapDoclingHelperJsonToParsedDocument(SAMPLE_DOCLING_HELPER_JSON, {
      rawText: "",
    });

    expect(parsed.qualityReport.parserName).toBe("docling");
    expect(parsed.qualityReport.sourceContentMode).toBe("native_pdf");
    expect(parsed.qualityReport.hasStructuredHeadings).toBe(true);
    expect(parsed.qualityReport.hasBoundingBoxes).toBe(true);
    expect(parsed.qualityReport.hasTables).toBe(false);
  });

  it("maps tables when present in helper JSON", () => {
    const withTable: DoclingHelperJson = {
      ...SAMPLE_DOCLING_HELPER_JSON,
      raw_text: [
        SAMPLE_DOCLING_HELPER_JSON.raw_text,
        "\f",
        "Monitoring Table",
        "| Parameter | Frequency |",
        "| Forest cover | Annual |",
      ].join("\n"),
      tables: [
        {
          id: "table:docling:0",
          page_number: 3,
          row_count: 2,
          column_count: 2,
          cells: [
            { row: 0, col: 0, text: "Parameter" },
            { row: 0, col: 1, text: "Frequency" },
            { row: 1, col: 0, text: "Forest cover" },
            { row: 1, col: 1, text: "Annual" },
          ],
        },
      ],
    };

    const parsed = mapDoclingHelperJsonToParsedDocument(withTable, { rawText: "" });

    expect(parsed.tables).toHaveLength(1);
    expect(parsed.tables[0]?.id).toBe("table:docling:0");
    expect(parsed.tables[0]?.pageNumber).toBe(3);
    expect(parsed.tables[0]?.rowCount).toBe(2);
    expect(parsed.tables[0]?.columnCount).toBe(2);
    expect(parsed.tables[0]?.cells).toHaveLength(4);
    expect(parsed.tables[0]?.cells[0]?.text).toBe("Parameter");
    expect(parsed.qualityReport.hasTables).toBe(true);
  });

  it("includes parser version in diagnostics when available", () => {
    const parsed = mapDoclingHelperJsonToParsedDocument(SAMPLE_DOCLING_HELPER_JSON, {
      rawText: "",
    });

    expect(parsed.diagnostics?.metadata?.docling_version).toBe("2.0.0");
    expect(parsed.diagnostics?.metadata?.engine).toBe("docling");
  });

  it("normalizes into DocumentStructure", () => {
    const parsed = mapDoclingHelperJsonToParsedDocument(SAMPLE_DOCLING_HELPER_JSON, {
      rawText: "",
    });
    const structure = buildDocumentStructure({ parsedDocument: parsed });

    expect(structure.parserAdapterId).toBe("docling");
    expect(structure.source).toBe("docling");
    expect(structure.blocks.length).toBeGreaterThan(0);
    expect(structure.sections.length).toBeGreaterThan(0);
  });

  it("normalizes into EvidenceDocument with provenance", () => {
    const parsed = mapDoclingHelperJsonToParsedDocument(SAMPLE_DOCLING_HELPER_JSON, {
      rawText: "",
    });
    const structure = buildDocumentStructure({ parsedDocument: parsed });
    const compiled = compileEvidenceDocumentFromStructure({
      docId: "docling-helper-test",
      documentStructure: structure,
    });

    expect(compiled.docId).toBe("docling-helper-test");
    expect(compiled.parserAdapterId).toBe("docling");
    expect(compiled.spans.length).toBeGreaterThan(0);
    expect(compiled.spans.some((s) => s.blockType === "section_heading")).toBe(true);
  });

  it("quote validation works on helper-mapped evidence", () => {
    const parsed = mapDoclingHelperJsonToParsedDocument(SAMPLE_DOCLING_HELPER_JSON, {
      rawText: "",
    });
    const structure = buildDocumentStructure({ parsedDocument: parsed });
    const compiled = compileEvidenceDocumentFromStructure({
      docId: "docling-helper-test",
      documentStructure: structure,
    });

    const [exact] = validateQuotes(compiled, [
      { quote: "Verra VCS project concerns avoided deforestation" },
    ]);

    expect(exact.valid).toBe(true);
  });
});

describe("Docling helper failure fallback", () => {
  afterEach(() => {
    delete process.env.QUICK_CHECK_PARSER;
    setDoclingImplementationForTests(null);
  });

  it("parseDoclingHelperOutput handles helper JSON with file_not_found error", () => {
    const output = parseDoclingHelperOutput(
      JSON.stringify({ error: "file_not_found", message: "PDF file not found: /nonexistent.pdf" }),
    );

    expect(output.error).toBe("file_not_found");
    expect(output.message).toContain("PDF file not found");
  });

  it("parseDoclingHelperOutput handles helper JSON with docling_not_installed error", () => {
    const output = parseDoclingHelperOutput(
      JSON.stringify({
        error: "docling_not_installed",
        message: "Docling is not installed. Install it with: pip install docling",
      }),
    );

    expect(output.error).toBe("docling_not_installed");
    expect(output.message).toContain("pip install docling");
  });

  it("parseDoclingHelperOutput handles helper JSON with parse_failed error", () => {
    const output = parseDoclingHelperOutput(
      JSON.stringify({
        error: "parse_failed",
        message: "Docling parsing failed with an unexpected error.",
        traceback: "Traceback (most recent call last):\n  ...",
      }),
    );

    expect(output.error).toBe("parse_failed");
    expect(output.traceback).toBeDefined();
  });

  it("parseDoclingHelperOutput handles helper JSON with missing_argument error", () => {
    const output = parseDoclingHelperOutput(
      JSON.stringify({
        error: "missing_argument",
        message: "Usage: python3 scripts/docling-parse.py <pdf_path>",
      }),
    );

    expect(output.error).toBe("missing_argument");
  });

  it("parseDoclingHelperOutput handles helper JSON with helper_execution_failed error", () => {
    const output = parseDoclingHelperOutput(
      JSON.stringify({
        error: "helper_execution_failed",
        message: "Docling helper process failed: python3 not found",
        detail: "/bin/sh: python3: command not found",
      }),
    );

    expect(output.error).toBe("helper_execution_failed");
    expect(output.detail).toContain("command not found");
  });

  it("adapter falls back to current-extractor when test injection throws, preserving diagnostics", () => {
    setDoclingImplementationForTests({
      parseText() {
        throw new Error("simulated docling failure");
      },
    });

    const parsed = doclingAdapter.parseText({
      rawText: "1 Project Details\nHost country: Indonesia",
    });

    expect(parsed.adapterId).toBe("current-extractor");
    expect(parsed.diagnostics?.warnings?.some(
      (w) => w.includes("simulated docling failure"),
    )).toBe(true);
  });

  it("adapter falls back to current-extractor when test injection is unavailable", () => {
    const parsed = doclingAdapter.parseText({
      rawText: "1 Project Details\nHost country: Indonesia",
    });

    expect(parsed.adapterId).toBe("current-extractor");
    expect(parsed.diagnostics?.warnings).toContain(
      "Docling unavailable; fell back to current extractor.",
    );
  });

  it("adapter falls back when isAvailable returns false", () => {
    setDoclingImplementationForTests({
      isAvailable: () => false,
      parseText: makeDoclingBaseline,
    });

    const parsed = doclingAdapter.parseText({
      rawText: "1 Project Details\nHost country: Indonesia",
    });

    expect(parsed.adapterId).toBe("current-extractor");
    expect(parsed.diagnostics?.warnings).toContain(
      "Docling unavailable; fell back to current extractor.",
    );
  });
});

describe("Docling runtime connection: adapter calls helper via pdfFilePath", () => {
  afterEach(() => {
    delete process.env.QUICK_CHECK_PARSER;
    setDoclingImplementationForTests(null);
    setDoclingHelperRunnerForTests(null);
  });

  it("calls helper runner when pdfFilePath is set and no test injection is active", () => {
    setDoclingHelperRunnerForTests((pdfPath: string) => {
      expect(pdfPath).toBe("/tmp/test.pdf");
      return JSON.stringify(SAMPLE_DOCLING_HELPER_JSON);
    });

    const parsed = doclingAdapter.parseText({
      rawText: "",
      pdfFilePath: "/tmp/test.pdf",
    });

    expect(parsed.adapterId).toBe("docling");
    expect(parsed.source).toBe("docling");
    expect(parsed.rawText).toContain("Project Description");
    expect(parsed.rawText).toContain("Baseline Scenario");
  });

  it("returns adapterId docling on helper success with pdfFilePath", () => {
    setDoclingHelperRunnerForTests(() =>
      JSON.stringify(SAMPLE_DOCLING_HELPER_JSON),
    );

    const parsed = doclingAdapter.parseText({
      rawText: "",
      pdfFilePath: "/tmp/test.pdf",
    });

    expect(parsed.adapterId).toBe("docling");
  });

  it("falls back to current-extractor when helper JSON has an error field", () => {
    setDoclingHelperRunnerForTests(() =>
      JSON.stringify({ error: "docling_not_installed", message: "pip install docling" }),
    );

    const parsed = doclingAdapter.parseText({
      rawText: "",
      pdfFilePath: "/tmp/test.pdf",
    });

    expect(parsed.adapterId).toBe("current-extractor");
    expect(parsed.diagnostics?.warnings?.some(
      (w) => w.includes("docling_not_installed"),
    )).toBe(true);
  });

  it("falls back to current-extractor when helper JSON has no parseable text", () => {
    setDoclingHelperRunnerForTests(() =>
      JSON.stringify({ engine: "docling" }),
    );

    const parsed = doclingAdapter.parseText({
      rawText: "",
      pdfFilePath: "/tmp/test.pdf",
    });

    expect(parsed.adapterId).toBe("current-extractor");
    expect(parsed.diagnostics?.warnings?.some(
      (w) => w.includes("no parseable text"),
    )).toBe(true);
  });

  it("falls back to current-extractor when helper runner throws", () => {
    setDoclingHelperRunnerForTests(() => {
      throw new Error("python3: command not found");
    });

    const parsed = doclingAdapter.parseText({
      rawText: "",
      pdfFilePath: "/tmp/test.pdf",
    });

    expect(parsed.adapterId).toBe("current-extractor");
    expect(parsed.diagnostics?.warnings?.some(
      (w) => w.includes("command not found"),
    )).toBe(true);
  });

  it("falls back when pdfFilePath is missing (no file path provided)", () => {
    const parsed = doclingAdapter.parseText({
      rawText: "1 Project Details\nHost country: Indonesia",
    });

    expect(parsed.adapterId).toBe("current-extractor");
    expect(parsed.diagnostics?.warnings).toContain(
      "Docling unavailable; fell back to current extractor.",
    );
  });

  it("test injection takes priority over pdfFilePath helper call", () => {
    setDoclingHelperRunnerForTests(() =>
      JSON.stringify(SAMPLE_DOCLING_HELPER_JSON),
    );
    setDoclingImplementationForTests({
      parseText: makeDoclingBaseline,
    });

    const parsed = doclingAdapter.parseText({
      rawText: "1 Project Details\nHost country: Indonesia",
      pdfFilePath: "/tmp/test.pdf",
    });

    expect(parsed.adapterId).toBe("docling");
  });

  it("default parser remains current-extractor even with pdfFilePath set", () => {
    const parsed = parseDocumentText({
      rawText: "1 Project Details\nHost country: Indonesia",
      pdfFilePath: "/tmp/test.pdf",
    });

    expect(parsed.adapterId).toBe("current-extractor");
    expect(getDocumentParserAdapter().id).toBe("current-extractor");
  });

  it("produces structured elements from helper-mapped ParsedDocument", () => {
    setDoclingHelperRunnerForTests(() =>
      JSON.stringify(SAMPLE_DOCLING_HELPER_JSON),
    );

    const parsed = doclingAdapter.parseText({
      rawText: "",
      pdfFilePath: "/tmp/test.pdf",
    });

    const headingElements = parsed.elements.filter((e) => e.elementType === "heading");

    expect(headingElements).toHaveLength(2);
    expect(headingElements[0]?.sourceParser).toBe("docling");
    expect(headingElements[0]?.pageNumber).toBe(1);
    expect(headingElements[1]?.sourceParser).toBe("docling");
    expect(headingElements[1]?.pageNumber).toBe(2);
  });

  it("normalizes helper-mapped output into DocumentStructure and EvidenceDocument", () => {
    setDoclingHelperRunnerForTests(() =>
      JSON.stringify(SAMPLE_DOCLING_HELPER_JSON),
    );

    const parsed = doclingAdapter.parseText({
      rawText: "",
      pdfFilePath: "/tmp/test.pdf",
    });
    const structure = buildDocumentStructure({ parsedDocument: parsed });
    const compiled = compileEvidenceDocumentFromStructure({
      docId: "runtime-test",
      documentStructure: structure,
    });

    expect(compiled.parserAdapterId).toBe("docling");
    expect(compiled.spans.length).toBeGreaterThan(0);
    expect(compiled.spans.some((s) => s.blockType === "section_heading")).toBe(true);
  });
});

describe("Docling server runtime: initDoclingAdapterRuntime wires real helper runner", () => {
  afterEach(() => {
    delete process.env.QUICK_CHECK_PARSER;
    setDoclingImplementationForTests(null);
    setDoclingHelperRunnerForTests(null);
  });

  it("initDoclingAdapterRuntime() executes without error and wires the helper runner", () => {
    initDoclingAdapterRuntime();

    process.env.QUICK_CHECK_PARSER = "docling";

    const parsed = parseDocumentText({
      rawText: "",
      pdfFilePath: "/tmp/does-not-exist.pdf",
    });

    // initDoclingAdapterRuntime wired the real runner — adapter tried to call
    // the Python helper (which may fail when python3/docling is unavailable).
    // The adapter must NOT throw "not initialised" and must fall back gracefully.
    expect(parsed.adapterId).toBe("current-extractor");

    const hasHelperDiagnostic = parsed.diagnostics?.warnings?.some(
      (w) =>
        w.includes("helper") ||
        w.includes("execution") ||
        w.includes("not found") ||
        w.includes("ENOENT") ||
        w.includes("not installed") ||
        w.includes("Docling helper returned error") ||
        w.includes("no parseable text"),
    );

    expect(hasHelperDiagnostic).toBe(true);
  });

  it("initDoclingAdapterRuntime + mock runner: adapter uses helper output via parseDocumentText", () => {
    // Simulate what initDoclingAdapterRuntime does, but with a mock for determinism
    initDoclingAdapterRuntime();

    // Override with mock runner for deterministic output
    setDoclingHelperRunnerForTests(() =>
      JSON.stringify(SAMPLE_DOCLING_HELPER_JSON),
    );

    process.env.QUICK_CHECK_PARSER = "docling";

    const parsed = parseDocumentText({
      rawText: "",
      pdfFilePath: "/tmp/test.pdf",
    });

    expect(parsed.adapterId).toBe("docling");
    expect(parsed.source).toBe("docling");
    expect(parsed.rawText).toContain("Project Description");
    expect(parsed.rawText).toContain("Baseline Scenario");
    expect(parsed.pages).toHaveLength(2);

    const headingElements = parsed.elements.filter((e) => e.elementType === "heading");
    expect(headingElements).toHaveLength(2);
    expect(headingElements[0]?.sourceParser).toBe("docling");
  });

  it("without init, calling with pdfFilePath throws 'not initialised' before fallback", () => {
    // Ensure runner is unset
    setDoclingHelperRunnerForTests(null);

    process.env.QUICK_CHECK_PARSER = "docling";

    const parsed = parseDocumentText({
      rawText: "",
      pdfFilePath: "/tmp/test.pdf",
    });

    // Without init, adapter should still fall back (the helper runner throws
    // "not initialised" internally, which is caught by the adapter)
    expect(parsed.adapterId).toBe("current-extractor");

    const hasInitWarning = parsed.diagnostics?.warnings?.some(
      (w) => w.includes("not initialised"),
    );
    expect(hasInitWarning).toBe(true);
  });

  it("initDoclingAdapterRuntime works with QUICK_CHECK_PARSER=docling and rawText fallback", () => {
    initDoclingAdapterRuntime();

    process.env.QUICK_CHECK_PARSER = "docling";

    // With rawText but no pdfFilePath, adapter should process the markdown
    const parsed = parseDocumentText({
      rawText: DOCLING_MARKDOWN,
    });

    // Should still parse (using markdown mode since init doesn't affect rawText path)
    expect(parsed.adapterId).toBe("docling");
    expect(parsed.source).toBe("docling");
    expect(parsed.rawText).toBe(DOCLING_MARKDOWN);
  });
});
