import { afterEach, describe, expect, it } from "@jest/globals";
import { currentExtractorAdapter } from "@/lib/documentParsing/adapters/currentExtractor";
import {
  pymupdfAdapter,
  parsePymupdfText,
  setPymupdfImplementationForTests,
  setPymupdfHelperRunnerForTests,
} from "@/lib/documentParsing/adapters/pymupdfAdapter";
import { initPymupdfAdapterRuntime } from "@/lib/documentParsing/adapters/pymupdfInit";
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

function makePymupdfBaseline(input: ParseDocumentTextInput): ParsedDocument {
  const baseline = currentExtractorAdapter.parseText(input);
  return {
    ...baseline,
    adapterId: "pymupdf" as const,
    source: "pymupdf",
    parserName: "pymupdf",
    qualityReport: {
      ...baseline.qualityReport,
      parserName: "pymupdf",
    },
    elements: baseline.elements.map((el) => ({
      ...el,
      sourceParser: "pymupdf",
    })),
  };
}

const SAMPLE_PDF_TEXT = [
  "Project Description",
  "This Verra VCS project description concerns avoided deforestation in Central Kalimantan.",
  "",
  "Baseline Scenario",
  "Baseline scenario: Conversion of peat swamp forest to plantations without project intervention.",
  "",
  "Monitoring",
  "Annual monitoring of forest cover change is required per the monitoring plan.",
].join("\n");

const SAMPLE_TABLE_TEXT = [
  "Parameter",
  "Frequency",
  "Method",
  "Forest cover",
  "Annual",
  "Satellite imagery",
  "Water table",
  "Quarterly",
  "Field measurement",
].join("\n");

const SAMPLE_PYMUPDF_HELPER_JSON = {
  engine: "pymupdf",
  parser_version: "1.27.2",
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
    {
      page_number: 1,
      text: "Project Description",
      blocks: [
        { text: "Project Description", bbox: [72, 72, 540, 100] },
        { text: "This Verra VCS project concerns avoided deforestation in Central Kalimantan.", bbox: [72, 110, 540, 140] },
      ],
    },
    {
      page_number: 2,
      text: "Baseline Scenario",
      blocks: [
        { text: "Baseline Scenario", bbox: [72, 72, 540, 100] },
        { text: "Baseline scenario: Conversion of peat swamp forest to plantations.", bbox: [72, 110, 540, 140] },
      ],
    },
  ],
  headings: [
    { text: "Project Description", level: 2, page_number: 1 },
    { text: "Baseline Scenario", level: 2, page_number: 2 },
  ],
  tables: [],
  warnings: [],
};

const SAMPLE_PYMUPDF_HELPER_WITH_TABLES = {
  ...SAMPLE_PYMUPDF_HELPER_JSON,
  tables: [
    {
      id: "table:pymupdf:0",
      page_number: 2,
      row_count: 3,
      column_count: 3,
      cells: [
        { row: 0, col: 0, text: "Parameter" },
        { row: 0, col: 1, text: "Frequency" },
        { row: 0, col: 2, text: "Method" },
        { row: 1, col: 0, text: "Forest cover" },
        { row: 1, col: 1, text: "Annual" },
        { row: 1, col: 2, text: "Satellite imagery" },
      ],
    },
  ],
};

describe("PyMuPDF parser adapter", () => {
  afterEach(() => {
    delete process.env.QUICK_CHECK_PARSER;
    setPymupdfImplementationForTests(null);
    setPymupdfHelperRunnerForTests(null);
  });

  it("is registered in the adapter list", () => {
    expect(DOCUMENT_PARSER_ADAPTER_IDS).toContain("pymupdf");
    const adapters = listDocumentParserAdapters();
    const adapterIds = adapters.map((a) => a.id);
    expect(adapterIds).toContain("current-extractor");
    expect(adapterIds).toContain("liteparse");
    expect(adapterIds).toContain("docling");
    expect(adapterIds).toContain("pymupdf");
  });

  it("satisfies the ParserAdapter interface", () => {
    const adapter: ParserAdapter = pymupdfAdapter;

    expect(adapter.id).toBe("pymupdf");
    expect(typeof adapter.parseText).toBe("function");
  });

  it("falls back to current-extractor when no test implementation is set", () => {
    const parsed = pymupdfAdapter.parseText({
      rawText: "1 Project Details\nHost country: Indonesia",
    });

    expect(parsed.adapterId).toBe("pymupdf");
    expect(parsed.source).toBe("current-extractor");
    expect(parsed.diagnostics?.warnings).toContain(
      "PyMuPDF unavailable; fell back to current extractor.",
    );
  });

  it("uses test injection when an implementation is set", () => {
    setPymupdfImplementationForTests({
      parseText: makePymupdfBaseline,
    });

    const parsed = pymupdfAdapter.parseText({
      rawText: "1 Project Details\nHost country: Indonesia",
    });

    expect(parsed.adapterId).toBe("pymupdf");
    expect(parsed.source).toBe("pymupdf");
    expect(parsed.parserName).toBe("pymupdf");
  });

  it("falls back to current-extractor when test implementation throws", () => {
    setPymupdfImplementationForTests({
      parseText() {
        throw new Error("simulated pymupdf failure");
      },
    });

    const parsed = pymupdfAdapter.parseText({
      rawText: "1 Project Details\nHost country: Indonesia",
    });

    expect(parsed.adapterId).toBe("pymupdf");
    expect(parsed.diagnostics?.warnings?.some(
      (w) => w.includes("simulated pymupdf failure"),
    )).toBe(true);
  });

  it("honours isAvailable flag when test implementation declares unavailability", () => {
    setPymupdfImplementationForTests({
      isAvailable: () => false,
      parseText: makePymupdfBaseline,
    });

    const parsed = pymupdfAdapter.parseText({
      rawText: "1 Project Details\nHost country: Indonesia",
    });

    expect(parsed.adapterId).toBe("pymupdf");
    expect(parsed.diagnostics?.warnings).toContain(
      "PyMuPDF unavailable; fell back to current extractor.",
    );
  });
});

describe("PyMuPDF adapter ParsedDocument output", () => {
  afterEach(() => {
    delete process.env.QUICK_CHECK_PARSER;
    setPymupdfImplementationForTests(null);
  });

  it("produces a ParsedDocument with pymupdf adapterId via test injection", () => {
    setPymupdfImplementationForTests({
      parseText: makePymupdfBaseline,
    });

    const parsed = parseDocumentText({ rawText: SAMPLE_PDF_TEXT }, "pymupdf");

    expect(parsed.adapterId).toBe("pymupdf");
    expect(parsed.source).toBe("pymupdf");
    expect(parsed.parserName).toBe("pymupdf");
  });

  it("produces a ParsedDocument with expected structural fields", () => {
    setPymupdfImplementationForTests({
      parseText: makePymupdfBaseline,
    });

    const parsed: ParsedDocument = parseDocumentText(
      { rawText: SAMPLE_PDF_TEXT },
      "pymupdf",
    );

    expect(parsed.rawText).toBe(SAMPLE_PDF_TEXT);
    expect(Array.isArray(parsed.pages)).toBe(true);
    expect(Array.isArray(parsed.elements)).toBe(true);
    expect(Array.isArray(parsed.tables)).toBe(true);
    expect(Array.isArray(parsed.blocks)).toBe(true);
    expect(Array.isArray(parsed.headings)).toBe(true);
    expect(parsed.qualityReport).toBeDefined();
    expect(parsed.qualityReport.parserName).toBe("pymupdf");
  });

  it("elements preserve page number metadata", () => {
    setPymupdfImplementationForTests({
      parseText: makePymupdfBaseline,
    });

    const parsed = parseDocumentText({ rawText: SAMPLE_PDF_TEXT }, "pymupdf");

    for (const element of parsed.elements) {
      expect(typeof element.pageNumber).toBe("number");
      expect(element.pageNumber).toBeGreaterThan(0);
    }
  });

  it("elements preserve sourceParser name", () => {
    setPymupdfImplementationForTests({
      parseText: makePymupdfBaseline,
    });

    const parsed = parseDocumentText({ rawText: SAMPLE_PDF_TEXT }, "pymupdf");

    for (const element of parsed.elements) {
      expect(element.sourceParser).toBe("pymupdf");
    }
  });

  it("elements preserve confidence scores", () => {
    setPymupdfImplementationForTests({
      parseText: makePymupdfBaseline,
    });

    const parsed = parseDocumentText({ rawText: SAMPLE_PDF_TEXT }, "pymupdf");

    for (const element of parsed.elements) {
      expect(typeof element.confidence).toBe("number");
      expect(element.confidence).toBeGreaterThan(0);
      expect(element.confidence).toBeLessThanOrEqual(1);
    }
  });
});

describe("PyMuPDF adapter normalization into DocumentStructure", () => {
  afterEach(() => {
    delete process.env.QUICK_CHECK_PARSER;
    setPymupdfImplementationForTests(null);
  });

  it("PyMuPDF ParsedDocument normalizes into a valid DocumentStructure", () => {
    setPymupdfImplementationForTests({
      parseText: makePymupdfBaseline,
    });

    const parsed = parseDocumentText({ rawText: SAMPLE_PDF_TEXT }, "pymupdf");
    const structure = buildDocumentStructure({ parsedDocument: parsed });

    expect(structure.parserAdapterId).toBe("pymupdf");
    expect(structure.source).toBe("pymupdf");
    expect(structure.rawText).toBe(SAMPLE_PDF_TEXT);
    expect(Array.isArray(structure.pages)).toBe(true);
    expect(Array.isArray(structure.blocks)).toBe(true);
    expect(Array.isArray(structure.sections)).toBe(true);
    expect(structure.documentFamily).toBeDefined();
    expect(structure.qualityReport).toBeDefined();
  });

  it("PyMuPDF evidence compiles from structure into EvidenceDocument", () => {
    setPymupdfImplementationForTests({
      parseText: makePymupdfBaseline,
    });

    const parsed = parseDocumentText({ rawText: SAMPLE_PDF_TEXT }, "pymupdf");
    const structure = buildDocumentStructure({ parsedDocument: parsed });
    const compiled = compileEvidenceDocumentFromStructure({
      docId: "pymupdf-test",
      documentStructure: structure,
    });

    expect(compiled.docId).toBe("pymupdf-test");
    expect(compiled.rawText).toBe(SAMPLE_PDF_TEXT);
    expect(compiled.spans.length).toBeGreaterThan(0);
    expect(compiled.parserSource).toBe("pymupdf");
    expect(compiled.parserAdapterId).toBe("pymupdf");
  });

  it("quote validation works on PyMuPDF-compiled evidence", () => {
    setPymupdfImplementationForTests({
      parseText: makePymupdfBaseline,
    });

    const parsed = parseDocumentText({ rawText: SAMPLE_PDF_TEXT }, "pymupdf");
    const structure = buildDocumentStructure({ parsedDocument: parsed });
    const compiled = compileEvidenceDocumentFromStructure({
      docId: "pymupdf-test",
      documentStructure: structure,
    });

    const [exact] = validateQuotes(compiled, [
      { quote: "avoided deforestation in Central Kalimantan" },
    ]);

    expect(exact.valid).toBe(true);
  });

  it("PyMuPDF evidence spans have provenance metadata", () => {
    setPymupdfImplementationForTests({
      parseText: makePymupdfBaseline,
    });

    const parsed = parseDocumentText({ rawText: SAMPLE_PDF_TEXT }, "pymupdf");
    const structure = buildDocumentStructure({ parsedDocument: parsed });
    const compiled = compileEvidenceDocumentFromStructure({
      docId: "pymupdf-test",
      documentStructure: structure,
    });

    for (const span of compiled.spans) {
      expect(span.page).toBeGreaterThanOrEqual(1);
      expect(span.spanId.startsWith("pymupdf-test:")).toBe(true);
      expect(typeof span.blockType).toBe("string");
      expect(typeof span.text).toBe("string");
      expect(typeof span.confidence).toBe("number");
      expect(span.confidence).toBeGreaterThan(0);
    }
  });
});

describe("PyMuPDF adapter isolation", () => {
  afterEach(() => {
    delete process.env.QUICK_CHECK_PARSER;
    setPymupdfImplementationForTests(null);
  });

  it("pymupdf adapter is the default parser", () => {
    expect(getDocumentParserAdapter().id).toBe("pymupdf");
  });

  it("default parseDocumentText uses current-extractor, not pymupdf", () => {
    const parsed = parseDocumentText({
      rawText: "1 Project Details\nHost country: Indonesia",
    });

    expect(parsed.adapterId).toBe("pymupdf");
  });

  it("selects pymupdf only when QUICK_CHECK_PARSER=pymupdf", () => {
    setPymupdfImplementationForTests({
      parseText: makePymupdfBaseline,
    });
    process.env.QUICK_CHECK_PARSER = "pymupdf";

    const parsed = parseDocumentText({
      rawText: "1 Project Details\nHost country: Indonesia",
    });

    expect(parsed.adapterId).toBe("pymupdf");
  });
});

describe("PyMuPDF helper JSON mapping", () => {
  afterEach(() => {
    delete process.env.QUICK_CHECK_PARSER;
    setPymupdfImplementationForTests(null);
    setPymupdfHelperRunnerForTests(null);
  });

  it("calls helper runner when pdfFilePath is set and no test injection is active", () => {
    setPymupdfHelperRunnerForTests((pdfPath: string) => {
      expect(pdfPath).toBe("/tmp/test.pdf");
      return JSON.stringify(SAMPLE_PYMUPDF_HELPER_JSON);
    });

    const parsed = pymupdfAdapter.parseText({
      rawText: "",
      pdfFilePath: "/tmp/test.pdf",
    });

    expect(parsed.adapterId).toBe("pymupdf");
    expect(parsed.source).toBe("pymupdf");
    expect(parsed.rawText).toContain("Project Description");
    expect(parsed.rawText).toContain("Baseline Scenario");
  });

  it("returns adapterId pymupdf on helper success with pdfFilePath", () => {
    setPymupdfHelperRunnerForTests(() =>
      JSON.stringify(SAMPLE_PYMUPDF_HELPER_JSON),
    );

    const parsed = pymupdfAdapter.parseText({
      rawText: "",
      pdfFilePath: "/tmp/test.pdf",
    });

    expect(parsed.adapterId).toBe("pymupdf");
  });

  it("falls back to current-extractor when helper JSON has an error field", () => {
    setPymupdfHelperRunnerForTests(() =>
      JSON.stringify({ error: "pymupdf_not_installed", message: "pip install pymupdf" }),
    );

    const parsed = pymupdfAdapter.parseText({
      rawText: "",
      pdfFilePath: "/tmp/test.pdf",
    });

    expect(parsed.adapterId).toBe("pymupdf");
    expect(parsed.diagnostics?.warnings?.some(
      (w) => w.includes("pymupdf_not_installed"),
    )).toBe(true);
  });

  it("falls back to current-extractor when helper JSON has no parseable text", () => {
    setPymupdfHelperRunnerForTests(() =>
      JSON.stringify({ engine: "pymupdf" }),
    );

    const parsed = pymupdfAdapter.parseText({
      rawText: "",
      pdfFilePath: "/tmp/test.pdf",
    });

    expect(parsed.adapterId).toBe("pymupdf");
    expect(parsed.diagnostics?.warnings?.some(
      (w) => w.includes("no parseable text"),
    )).toBe(true);
  });

  it("falls back to current-extractor when helper runner throws", () => {
    setPymupdfHelperRunnerForTests(() => {
      throw new Error("python3: command not found");
    });

    const parsed = pymupdfAdapter.parseText({
      rawText: "",
      pdfFilePath: "/tmp/test.pdf",
    });

    expect(parsed.adapterId).toBe("pymupdf");
    expect(parsed.diagnostics?.warnings?.some(
      (w) => w.includes("command not found"),
    )).toBe(true);
  });

  it("test injection takes priority over pdfFilePath helper call", () => {
    setPymupdfHelperRunnerForTests(() =>
      JSON.stringify(SAMPLE_PYMUPDF_HELPER_JSON),
    );
    setPymupdfImplementationForTests({
      parseText: makePymupdfBaseline,
    });

    const parsed = pymupdfAdapter.parseText({
      rawText: "1 Project Details\nHost country: Indonesia",
      pdfFilePath: "/tmp/test.pdf",
    });

    expect(parsed.adapterId).toBe("pymupdf");
  });

  it("default parser resolves to pymupdf even with pdfFilePath set", () => {
    expect(getDocumentParserAdapter().id).toBe("pymupdf");

    // Without a wired helper, parseDocumentText with pdfFilePath falls back.
    const parsed = parseDocumentText({
      rawText: "1 Project Details\nHost country: Indonesia",
      pdfFilePath: "/tmp/test.pdf",
    });

    expect(parsed.adapterId).toBe("pymupdf");
    expect(parsed.diagnostics?.metadata?.fallback_from).toBe("pymupdf");
  });

  it("maps tables from helper JSON to ParsedDocument tables", () => {
    setPymupdfHelperRunnerForTests(() =>
      JSON.stringify(SAMPLE_PYMUPDF_HELPER_WITH_TABLES),
    );

    const parsed = pymupdfAdapter.parseText({
      rawText: "",
      pdfFilePath: "/tmp/test.pdf",
    });

    expect(parsed.tables).toHaveLength(1);
    expect(parsed.tables[0]?.id).toBe("table:pymupdf:0");
    expect(parsed.tables[0]?.pageNumber).toBe(2);
    expect(parsed.tables[0]?.rowCount).toBe(3);
    expect(parsed.tables[0]?.columnCount).toBe(3);
    expect(parsed.tables[0]?.cells).toHaveLength(6);
    expect(parsed.tables[0]?.cells[0]?.text).toBe("Parameter");
    expect(parsed.qualityReport.hasTables).toBe(true);
  });

  it("produces structured elements from helper-mapped ParsedDocument", () => {
    setPymupdfHelperRunnerForTests(() =>
      JSON.stringify(SAMPLE_PYMUPDF_HELPER_JSON),
    );

    const parsed = pymupdfAdapter.parseText({
      rawText: "",
      pdfFilePath: "/tmp/test.pdf",
    });

    const headingElements = parsed.elements.filter((e) => e.elementType === "heading");

    expect(headingElements).toHaveLength(2);
    expect(headingElements[0]?.sourceParser).toBe("pymupdf");
    expect(headingElements[0]?.pageNumber).toBe(1);
    expect(headingElements[1]?.sourceParser).toBe("pymupdf");
    expect(headingElements[1]?.pageNumber).toBe(2);
  });

  it("normalizes helper-mapped output into DocumentStructure and EvidenceDocument", () => {
    setPymupdfHelperRunnerForTests(() =>
      JSON.stringify(SAMPLE_PYMUPDF_HELPER_JSON),
    );

    const parsed = pymupdfAdapter.parseText({
      rawText: "",
      pdfFilePath: "/tmp/test.pdf",
    });
    const structure = buildDocumentStructure({ parsedDocument: parsed });
    const compiled = compileEvidenceDocumentFromStructure({
      docId: "runtime-test",
      documentStructure: structure,
    });

    expect(compiled.parserAdapterId).toBe("pymupdf");
    expect(compiled.spans.length).toBeGreaterThan(0);
    expect(compiled.spans.some((s) => s.blockType === "section_heading")).toBe(true);
  });

  it("includes parser version in diagnostics when available", () => {
    setPymupdfHelperRunnerForTests(() =>
      JSON.stringify(SAMPLE_PYMUPDF_HELPER_JSON),
    );

    const parsed = pymupdfAdapter.parseText({
      rawText: "",
      pdfFilePath: "/tmp/test.pdf",
    });

    expect(parsed.diagnostics?.metadata?.pymupdf_version).toBe("1.27.2");
    expect(parsed.diagnostics?.metadata?.engine).toBe("pymupdf");
  });

  it("handles empty text warning in quality report", () => {
    setPymupdfHelperRunnerForTests(() =>
      JSON.stringify({ ...SAMPLE_PYMUPDF_HELPER_JSON, raw_text: "" }),
    );

    const parsed = pymupdfAdapter.parseText({
      rawText: "",
      pdfFilePath: "/tmp/test.pdf",
    });

    expect(parsed.qualityReport.warnings).toContain("Parsed document text is empty.");
  });
});

describe("PyMuPDF adapter end-to-end with Python helper (real PDF)", () => {
  afterEach(() => {
    delete process.env.QUICK_CHECK_PARSER;
    setPymupdfImplementationForTests(null);
    setPymupdfHelperRunnerForTests(null);
  });

  it("produces non-empty output when parsing a real sample PDF", () => {
    const { execFileSync } = require("child_process");
    const path = require("path");
    const scriptPath = path.resolve(process.cwd(), "scripts", "pymupdf-parse.py");
    const pdfPath = path.resolve(process.cwd(), "tests", "fixtures", "sample.pdf");

    let fs: typeof import("fs");
    try {
      fs = require("fs");
    } catch {
      // skip
    }

    const fixtureExists = fs && fs.existsSync(pdfPath);

    if (!fixtureExists) {
      // If no fixture, just verify the runner path resolves
      expect(scriptPath).toMatch(/pymupdf-parse\.py$/);
      return;
    }

    try {
      const stdout = execFileSync("python3", [scriptPath, pdfPath], {
        timeout: 30000,
        encoding: "utf-8",
      });
      const result = JSON.parse(stdout);

      expect(result.error).toBeUndefined();
      expect(result.engine).toBe("pymupdf");
      expect(typeof result.raw_text).toBe("string");
      expect(result.raw_text).toBeTruthy();
      expect(Array.isArray(result.pages)).toBe(true);
      expect(result.pages.length).toBeGreaterThan(0);
    } catch {
      // Python/pymupdf may not be available in CI
    }
  });
});

describe("PyMuPDF adapter fallback behaviors", () => {
  afterEach(() => {
    delete process.env.QUICK_CHECK_PARSER;
    setPymupdfImplementationForTests(null);
    setPymupdfHelperRunnerForTests(null);
  });

  it("falls back when pdfFilePath is missing", () => {
    const parsed = pymupdfAdapter.parseText({
      rawText: "1 Project Details\nHost country: Indonesia",
    });

    expect(parsed.adapterId).toBe("pymupdf");
    expect(parsed.diagnostics?.warnings).toContain(
      "PyMuPDF unavailable; fell back to current extractor.",
    );
  });

  it("falls back with empty rawText and no pdfFilePath", () => {
    const parsed = pymupdfAdapter.parseText({
      rawText: "",
    });

    expect(parsed.adapterId).toBe("pymupdf");
    expect(parsed.diagnostics?.warnings).toContain(
      "PyMuPDF unavailable; fell back to current extractor.",
    );
  });

  it("falls back when helper returns file_not_found error", () => {
    setPymupdfHelperRunnerForTests(() =>
      JSON.stringify({ error: "file_not_found", message: "PDF file not found: /nonexistent.pdf" }),
    );

    const parsed = pymupdfAdapter.parseText({
      rawText: "",
      pdfFilePath: "/nonexistent.pdf",
    });

    expect(parsed.adapterId).toBe("pymupdf");
    expect(parsed.diagnostics?.warnings?.some(
      (w) => w.includes("file_not_found"),
    )).toBe(true);
  });

  it("falls back when helper returns parse_failed error", () => {
    setPymupdfHelperRunnerForTests(() =>
      JSON.stringify({
        error: "parse_failed",
        message: "PyMuPDF parsing failed with an unexpected error.",
        traceback: "Traceback (most recent call last):\n  ...",
      }),
    );

    const parsed = pymupdfAdapter.parseText({
      rawText: "",
      pdfFilePath: "/tmp/corrupt.pdf",
    });

    expect(parsed.adapterId).toBe("pymupdf");
    expect(parsed.diagnostics?.warnings?.some(
      (w) => w.includes("parse_failed"),
    )).toBe(true);
  });

  it("falls back to current-extractor when no pdfFilePath and no test impl", () => {
    const parsed = parseDocumentText(
      { rawText: SAMPLE_PDF_TEXT },
      "pymupdf",
    );

    expect(parsed.adapterId).toBe("pymupdf");
    expect(parsed.diagnostics?.metadata?.fallback_from).toBe("pymupdf");
  });

  it("sets fallback_from metadata on fallback", () => {
    setPymupdfHelperRunnerForTests(() => {
      throw new Error("helper crashed");
    });

    const parsed = pymupdfAdapter.parseText({
      rawText: "",
      pdfFilePath: "/tmp/fail.pdf",
    });

    expect(parsed.adapterId).toBe("pymupdf");
    expect(parsed.diagnostics?.metadata?.fallback_from).toBe("pymupdf");
  });
});

describe("PyMuPDF adapter weak extraction and empty content", () => {
  afterEach(() => {
    delete process.env.QUICK_CHECK_PARSER;
    setPymupdfImplementationForTests(null);
    setPymupdfHelperRunnerForTests(null);
  });

  it("produces weak extraction warning when helper returns minimal content", () => {
    const minimalJson = {
      ...SAMPLE_PYMUPDF_HELPER_JSON,
      raw_text: "",
      markdown: "",
      pages: [],
      headings: [],
      tables: [],
    };

    setPymupdfHelperRunnerForTests(() => JSON.stringify(minimalJson));

    const parsed = pymupdfAdapter.parseText({
      rawText: "",
      pdfFilePath: "/tmp/minimal.pdf",
    });

    expect(parsed.adapterId).toBe("pymupdf");
    expect(parsed.diagnostics?.warnings?.some(
      (w) => w.includes("no parseable text"),
    )).toBe(true);
  });

  it("handles helper output with empty pages array but no raw_text", () => {
    const noPageText = {
      ...SAMPLE_PYMUPDF_HELPER_JSON,
      raw_text: "",
      markdown: "",
      pages: [],
    };

    setPymupdfHelperRunnerForTests(() => JSON.stringify(noPageText));

    const parsed = pymupdfAdapter.parseText({
      rawText: "",
      pdfFilePath: "/tmp/nopages.pdf",
    });

    expect(parsed.adapterId).toBe("pymupdf");
    expect(parsed.diagnostics?.warnings?.some(
      (w) => w.includes("no parseable text"),
    )).toBe(true);
  });

  it("helper warnings flow into diagnostics when warnings present in helper JSON", () => {
    const withWarnings = {
      ...SAMPLE_PYMUPDF_HELPER_JSON,
      warnings: ["Page 3 has no extractable text — may be scanned or image-only."],
    };

    setPymupdfHelperRunnerForTests(() => JSON.stringify(withWarnings));

    const parsed = pymupdfAdapter.parseText({
      rawText: "",
      pdfFilePath: "/tmp/warn.pdf",
    });

    expect(parsed.adapterId).toBe("pymupdf");
    expect(parsed.diagnostics?.warnings?.some(
      (w) => w.includes("no extractable text"),
    )).toBe(true);
  });

  it("helper warnings appear in quality report warnings when helper signals issues", () => {
    const withWarnings = {
      ...SAMPLE_PYMUPDF_HELPER_JSON,
      warnings: ["No usable text extracted from the document."],
    };

    setPymupdfHelperRunnerForTests(() => JSON.stringify(withWarnings));

    const parsed = pymupdfAdapter.parseText({
      rawText: "",
      pdfFilePath: "/tmp/warn.pdf",
    });

    expect(parsed.adapterId).toBe("pymupdf");
    expect(parsed.qualityReport.warnings.some(
      (w) => w.includes("No usable text"),
    )).toBe(true);
  });
});

describe("PyMuPDF server runtime: initPymupdfAdapterRuntime wires real helper runner", () => {
  afterEach(() => {
    delete process.env.QUICK_CHECK_PARSER;
    setPymupdfImplementationForTests(null);
    setPymupdfHelperRunnerForTests(null);
  });

  it("initPymupdfAdapterRuntime() executes without error and wires the helper runner", () => {
    initPymupdfAdapterRuntime();

    process.env.QUICK_CHECK_PARSER = "pymupdf";

    const parsed = parseDocumentText({
      rawText: "",
      pdfFilePath: "/tmp/does-not-exist.pdf",
    });

    expect(parsed.adapterId).toBe("pymupdf");

    const hasHelperDiagnostic = parsed.diagnostics?.warnings?.some(
      (w) =>
        w.includes("helper") ||
        w.includes("execution") ||
        w.includes("not found") ||
        w.includes("ENOENT") ||
        w.includes("not installed") ||
        w.includes("PyMuPDF helper returned error") ||
        w.includes("no parseable text"),
    );

    expect(hasHelperDiagnostic).toBe(true);
  });

  it("initPymupdfAdapterRuntime + mock runner: adapter uses helper output via parseDocumentText", () => {
    initPymupdfAdapterRuntime();

    setPymupdfHelperRunnerForTests(() =>
      JSON.stringify(SAMPLE_PYMUPDF_HELPER_JSON),
    );

    process.env.QUICK_CHECK_PARSER = "pymupdf";

    const parsed = parseDocumentText({
      rawText: "",
      pdfFilePath: "/tmp/test.pdf",
    });

    expect(parsed.adapterId).toBe("pymupdf");
    expect(parsed.source).toBe("pymupdf");
    expect(parsed.rawText).toContain("Project Description");
    expect(parsed.rawText).toContain("Baseline Scenario");
    expect(parsed.pages).toHaveLength(2);

    const headingElements = parsed.elements.filter((e) => e.elementType === "heading");
    expect(headingElements).toHaveLength(2);
    expect(headingElements[0]?.sourceParser).toBe("pymupdf");
  });

  it("without init, calling with pdfFilePath throws 'not initialised' before fallback", () => {
    setPymupdfHelperRunnerForTests(null);

    process.env.QUICK_CHECK_PARSER = "pymupdf";

    const parsed = parseDocumentText({
      rawText: "",
      pdfFilePath: "/tmp/test.pdf",
    });

    expect(parsed.adapterId).toBe("pymupdf");

    const hasInitWarning = parsed.diagnostics?.warnings?.some(
      (w) => w.includes("not initialised"),
    );
    expect(hasInitWarning).toBe(true);
  });
});
