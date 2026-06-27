import { currentExtractorAdapter } from "@/lib/documentParsing/adapters/currentExtractor";
import { buildPddHeadingIndex, extractPddSections } from "@/lib/chat/quickCheckSectionExtractor";
import type { DocumentHeading } from "@/lib/chat/quickCheckSectionExtractor";
import { buildDocumentQualityReport } from "@/lib/documentClassification";
import type {
  DocumentParserAdapter,
  ParseDocumentTextInput,
  ParsedDocument,
  ParsedElement,
  ParsedPage,
  ParsedTable,
  ParsedCell,
  ParserDiagnostics,
} from "@/lib/documentParsing/types";

type PymupdfHelperJson = {
  engine?: string;
  parser_version?: string;
  raw_text?: string;
  markdown?: string;
  pages?: Array<{
    page_number: number;
    text: string;
    blocks?: Array<{ text: string; bbox?: number[] | null }>;
  }>;
  headings?: Array<{ text: string; level: number; page_number: number }>;
  tables?: Array<{
    id: string;
    page_number: number;
    row_count: number;
    column_count: number;
    cells: Array<{ row: number; col: number; text: string }>;
  }>;
  warnings?: string[];
  error?: string;
  message?: string;
  detail?: string;
  traceback?: string;
};

type PymupdfHelperRunnerFn = (pdfPath: string) => string;
type PymupdfHelperParserFn = (stdout: string) => PymupdfHelperJson;

let pymupdfHelperRunner: PymupdfHelperRunnerFn | null = null;
let pymupdfHelperParser: PymupdfHelperParserFn | null = null;

type PymupdfImplementation = {
  isAvailable?: () => boolean;
  parseText: (input: ParseDocumentTextInput) => ParsedDocument;
};

let pymupdfImplementation: PymupdfImplementation | null = null;

export function setPymupdfImplementationForTests(
  implementation: PymupdfImplementation | null,
): void {
  pymupdfImplementation = implementation;
}

export function setPymupdfHelperRunnerForTests(
  runner: PymupdfHelperRunnerFn | null,
  parser?: PymupdfHelperParserFn | null,
): void {
  pymupdfHelperRunner = runner;
  if (parser !== undefined) {
    pymupdfHelperParser = parser;
  }
}

function normalizeParserText(rawText: string): string {
  return rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function buildSectionPath(sectionNumber?: string): string[] | undefined {
  if (!sectionNumber) return undefined;
  const parts = sectionNumber.split(".");
  return parts.map((_, index) => parts.slice(0, index + 1).join("."));
}

function splitRawTextIntoPages(rawText: string): ParsedPage[] {
  const normalized = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const pageTexts = normalized.split("\f");

  return pageTexts.map((pageText, index) => ({
    pageNumber: pageTexts.length > 1 ? index + 1 : 1,
    rawText: pageText,
    normalizedText: pageText,
    elements: [],
  }));
}

function withFallbackDiagnostics(
  diagnostics: ParserDiagnostics | undefined,
  warning: string,
  metadata?: Record<string, string>,
): ParserDiagnostics {
  return {
    warnings: [...(diagnostics?.warnings ?? []), warning],
    metadata: {
      ...(diagnostics?.metadata ?? {}),
      ...(metadata ?? {}),
      fallback_from: "pymupdf",
    },
  };
}

function fallbackToCurrentExtractor(
  input: ParseDocumentTextInput,
  reason: string,
  metadata?: Record<string, string>,
): ParsedDocument {
  const fallback = currentExtractorAdapter.parseText(input);
  const enrichedDiagnostics = withFallbackDiagnostics(fallback.diagnostics, reason, metadata);
  if (process.env.VERCEL) {
    console.warn("[pymupdf:vercel] PyMuPDF adapter fell back to current-extractor.", {
      reason,
      fallback_from: enrichedDiagnostics.metadata?.fallback_from,
      vercelEnv: process.env.VERCEL_ENV ?? "unknown",
    });
  }
  return {
    ...fallback,
    adapterId: "pymupdf" as const,
    diagnostics: enrichedDiagnostics,
  };
}

function lazyRunPymupdfHelperSync(pdfPath: string): string {
  if (!pymupdfHelperRunner) {
    throw new Error(
      "PyMuPDF helper runner is not initialised. " +
      "Call initPymupdfAdapterRuntime() from a server-only context, or use setPymupdfHelperRunnerForTests() in tests.",
    );
  }
  return pymupdfHelperRunner(pdfPath);
}

function lazyParsePymupdfHelperOutput(stdout: string): PymupdfHelperJson {
  if (pymupdfHelperParser) {
    return pymupdfHelperParser(stdout);
  }
  try {
    return JSON.parse(stdout) as PymupdfHelperJson;
  } catch {
    return { error: "json_parse_failed", message: "PyMuPDF helper produced invalid JSON." };
  }
}

/**
 * Build a headingIndex (DocumentHeading[]) from structured PyMuPDF elements.
 * Each heading element becomes a DocumentHeading with its associated paragraph
 * elements as body text. This replaces the regex-on-raw-text path when
 * structured elements are available.
 */
export function buildStructuredHeadingIndex(
  elements: ParsedElement[],
): DocumentHeading[] {
  const headings: DocumentHeading[] = [];
  const headingElements = elements.filter((e) => e.elementType === "heading");
  if (headingElements.length === 0) return [];

  for (let i = 0; i < headingElements.length; i++) {
    const el = headingElements[i]!;
    const sectionNumber = el.sectionNumber ?? String(i + 1);

    // Collect paragraph elements between this heading and the next
    const nextHeading = headingElements[i + 1];
    const elIndex = elements.indexOf(el);
    const nextIndex = nextHeading ? elements.indexOf(nextHeading) : elements.length;
    const bodyElements = elements.slice(elIndex + 1, nextIndex)
      .filter((e) => e.elementType !== "heading");

    const originalTitle = el.text;
    const originalBodyText = bodyElements.map((e) => e.text).join("\n").trim();
    const bodyText = originalBodyText.slice(0, 100_000); // consistent with HEADING_BODY_MAX
    const bodyPreview = bodyText.length > 280
      ? bodyText.slice(0, 280).replace(/\s+\S*$/, "") + " […]"
      : bodyText;

    headings.push({
      sectionNumber,
      title: originalTitle,
      originalTitle,
      normalizedTitle: originalTitle.toLowerCase().replace(/[^\w\s.-]/g, " ").replace(/\s+/g, " ").trim(),
      bodyPreview,
      bodyText,
      originalBodyText,
      normalizedBodyText: bodyText.toLowerCase().replace(/[^\w\s.-]/g, " ").replace(/\s+/g, " ").trim(),
    });
  }

  return headings;
}

/**
 * Build sectionsByNumber from structured PyMuPDF heading elements.
 * Each heading's section number maps to the full text of that heading plus
 * its body paragraphs — matching the contract of extractPddSections().
 */
function buildStructuredSectionsByNumber(
  elements: ParsedElement[],
): Record<string, string> {
  const sections: Record<string, string> = {};
  const headingElements = elements.filter((e) => e.elementType === "heading");
  if (headingElements.length === 0) return {};

  for (let i = 0; i < headingElements.length; i++) {
    const el = headingElements[i]!;
    const sectionNumber = el.sectionNumber ?? String(i + 1);

    const nextHeading = headingElements[i + 1];
    const elIndex = elements.indexOf(el);
    const nextIndex = nextHeading ? elements.indexOf(nextHeading) : elements.length;
    const bodyElements = elements.slice(elIndex + 1, nextIndex);

    sections[sectionNumber] = [
      el.text,
      ...bodyElements.map((e) => e.text),
    ].join("\n");
  }

  return sections;
}

function mapPymupdfHelperJsonToParsedDocument(
  helperJson: PymupdfHelperJson,
  input: ParseDocumentTextInput,
): ParsedDocument {
  const parserName = "pymupdf";
  const rawText = helperJson.raw_text ?? input.rawText ?? "";
  const normalizedText = normalizeParserText(rawText);

  const pages = splitRawTextIntoPages(rawText);
  const headings = (helperJson.headings ?? []).map((heading, index) => ({
    id: `heading:pymupdf:${index}`,
    text: heading.text,
    normalizedText: normalizeParserText(heading.text).replace(/\s+/g, " ").trim(),
    pageNumber: heading.page_number,
    level: heading.level,
    sectionNumber: String(index + 1),
  }));

  const tables: ParsedTable[] = (helperJson.tables ?? []).map((table, index) => ({
    id: table.id || `table:pymupdf:${index}`,
    pageNumber: table.page_number ?? 1,
    columnCount: table.column_count,
    rowCount: table.row_count,
    cells: (table.cells ?? []).map((cell): ParsedCell => ({
      rowIndex: cell.row,
      columnIndex: cell.col,
      text: cell.text,
    })),
  }));

  const elements: ParsedElement[] = [];
  let elementIndex = 0;

  for (const heading of helperJson.headings ?? []) {
    const sectionNumber = String(elementIndex + 1);
    const sectionPath = buildSectionPath(sectionNumber);

    elements.push({
      id: `element:pymupdf:heading:${elementIndex}`,
      pageNumber: heading.page_number ?? 1,
      text: heading.text,
      normalizedText: normalizeParserText(heading.text).replace(/\s+/g, " ").trim(),
      elementType: "heading",
      headingLevel: heading.level,
      sectionNumber,
      sectionPath,
      sourceParser: parserName,
      confidence: 0.95,
    });
    elementIndex += 1;
  }

  const headingTextSet = new Set((helperJson.headings ?? []).map((h) => h.text));
  const pageTexts = (helperJson.pages ?? []).filter(
    (p) => p.text && !headingTextSet.has(p.text),
  );
  for (const pageItem of pageTexts) {
    elements.push({
      id: `element:pymupdf:paragraph:${elementIndex}`,
      pageNumber: pageItem.page_number ?? 1,
      text: pageItem.text,
      normalizedText: normalizeParserText(pageItem.text).replace(/\s+/g, " ").trim(),
      elementType: "paragraph",
      sourceParser: parserName,
      confidence: 0.85,
    });
    elementIndex += 1;
  }

  for (const page of pages) {
    page.elements = elements.filter((e) => e.pageNumber === page.pageNumber);
  }

  // Build sections/headings from structured elements first, regex fallback only
  // when PyMuPDF produced no structured elements.
  const structuredHeadings = buildStructuredHeadingIndex(elements);
  const hasStructuredContent = structuredHeadings.length > 0;
  const sectionsByNumber = hasStructuredContent
    ? buildStructuredSectionsByNumber(elements)
    : extractPddSections(rawText);
  const headingIndex = hasStructuredContent
    ? structuredHeadings
    : buildPddHeadingIndex(rawText);
  const parserSectionSource = hasStructuredContent ? "pymupdf_structured" : "regex_fallback";
  const blocks = elements.map((element) => ({
    id: element.id,
    type: element.elementType === "heading" ? "heading" as const : "paragraph" as const,
    text: element.text,
    normalizedText: element.normalizedText,
    pageNumber: element.pageNumber,
    headingLevel: element.headingLevel,
    sectionNumber: element.sectionNumber,
  }));

  const parserVersion = helperJson.parser_version;
  const versionMetadata = parserVersion ? { pymupdf_version: parserVersion } : undefined;

  const helperWarnings = helperJson.warnings ?? [];
  const hasPageWarnings = helperWarnings.some((w) => w.includes("no extractable text") || w.includes("scanned"));
  const hasEmptyWarning = helperWarnings.some((w) => w.includes("No usable text"));

  const qrWarnings: string[] = [];
  if (!rawText.trim()) {
    qrWarnings.push("Parsed document text is empty.");
  }
  for (const w of helperWarnings) {
    qrWarnings.push(`pymupdf: ${w}`);
  }

  const parsedDocumentBase: ParsedDocument = {
    adapterId: "pymupdf",
    source: parserName,
    rawText,
    normalizedText,
    pages,
    elements,
    tables,
    parserName,
    qualityReport: {
      parserName,
      warnings: qrWarnings,
      metadata: {
        helper_script: "scripts/pymupdf-parse.py",
        ...(versionMetadata ?? {}),
      },
      sourceContentMode: "native_pdf",
      pageCount: pages.length || 1,
      textDensity: 0,
      tableHeavyWarning: tables.length > 5,
      layoutHeavyWarning: false,
      headersFootersDetected: false,
      weakExtractionWarning: hasEmptyWarning || hasPageWarnings,
      hasStructuredHeadings: headings.length > 0,
      hasPageBoundaries: pages.length > 1,
      hasBoundingBoxes: true,
      hasTables: tables.length > 0,
    },
    blocks,
    headings: headings.map((heading) => ({
      ...heading,
      sectionNumber: undefined,
    })),
    sectionsByNumber,
    headingIndex,
    diagnostics: {
      warnings: helperWarnings.length > 0 ? helperWarnings.map((w) => `pymupdf: ${w}`) : undefined,
      metadata: {
        engine: helperJson.engine ?? "pymupdf",
        ...(versionMetadata ?? {}),
        helper_script: "scripts/pymupdf-parse.py",
        parser_section_source: parserSectionSource,
      },
    },
  };

  return {
    ...parsedDocumentBase,
    qualityReport: buildDocumentQualityReport(parsedDocumentBase),
  };
}

export const pymupdfAdapter: DocumentParserAdapter = {
  id: "pymupdf",
  parseText(input: ParseDocumentTextInput): ParsedDocument {
    const implementation = pymupdfImplementation;

    if (implementation && implementation.isAvailable?.() !== false) {
      try {
        return implementation.parseText(input);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return fallbackToCurrentExtractor(
          input,
          `PyMuPDF failed at runtime; fell back to current extractor. ${message}`,
        );
      }
    }

    if (input.pdfFilePath) {
      try {
        const stdout = lazyRunPymupdfHelperSync(input.pdfFilePath);
        const helperJson = lazyParsePymupdfHelperOutput(stdout);

        if (helperJson.error) {
          const reason = `PyMuPDF helper returned error: ${helperJson.error}`;
          const metadata: Record<string, string> = {};
          if (helperJson.message) metadata.helper_message = helperJson.message;
          if (helperJson.detail) metadata.helper_detail = helperJson.detail;
          return fallbackToCurrentExtractor(input, reason, metadata);
        }

        if (!helperJson.raw_text && !helperJson.markdown) {
          return fallbackToCurrentExtractor(
            input,
            "PyMuPDF helper returned no parseable text.",
          );
        }

        return mapPymupdfHelperJsonToParsedDocument(helperJson, input);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const metadata: Record<string, string> = {};
        const errorObj = error as { stderr?: string; code?: string };
        if (errorObj.stderr) {
          metadata.helper_stderr = errorObj.stderr;
        }
        if (errorObj.code) {
          metadata.helper_exit_code = errorObj.code;
        }
        return fallbackToCurrentExtractor(
          input,
          `PyMuPDF helper execution failed: ${message}`,
          metadata,
        );
      }
    }

    return fallbackToCurrentExtractor(input, "PyMuPDF unavailable; fell back to current extractor.");
  },
};

export function parsePymupdfText(input: ParseDocumentTextInput): ParsedDocument {
  return pymupdfAdapter.parseText(input);
}
