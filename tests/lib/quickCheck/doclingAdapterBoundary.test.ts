import { afterEach, describe, expect, it } from "@jest/globals";
import { currentExtractorAdapter } from "@/lib/documentParsing/adapters/currentExtractor";
import {
  doclingAdapter,
  parseDoclingText,
  setDoclingImplementationForTests,
  isDoclingMarkdown,
} from "@/lib/documentParsing/adapters/doclingAdapter";
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
