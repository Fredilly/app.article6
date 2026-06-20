import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { currentExtractorAdapter } from "@/lib/documentParsing/adapters/currentExtractor";
import { buildPddHeadingIndex, extractPddSections } from "@/lib/chat/quickCheckSectionExtractor";
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

const execFileAsync = promisify(execFile);

type DoclingImplementation = {
  isAvailable?: () => boolean;
  parseText: (input: ParseDocumentTextInput) => ParsedDocument;
};

let doclingImplementation: DoclingImplementation | null = null;

export function setDoclingImplementationForTests(
  implementation: DoclingImplementation | null,
): void {
  doclingImplementation = implementation;
}

function normalizeParserText(rawText: string): string {
  return rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function headingLevel(sectionNumber?: string): number | undefined {
  if (!sectionNumber) return undefined;
  return sectionNumber.split(".").length;
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

function hasDoclingMarkdown(rawText: string): boolean {
  return /^<!--\s*docling\s*-->|^\[DOCLING\]/m.test(rawText) || /^#+\s/.test(rawText.trim().split("\n")[0] ?? "");
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
      fallback_from: "docling",
    },
  };
}

function fallbackToCurrentExtractor(
  input: ParseDocumentTextInput,
  reason: string,
  metadata?: Record<string, string>,
): ParsedDocument {
  const fallback = currentExtractorAdapter.parseText(input);
  return {
    ...fallback,
    diagnostics: withFallbackDiagnostics(fallback.diagnostics, reason, metadata),
  };
}

/** Shape of the JSON produced by scripts/docling-parse.py */
export type DoclingHelperJson = {
  engine?: string;
  parser_version?: string;
  raw_text?: string;
  markdown?: string;
  pages?: Array<{ page_number: number; text: string }>;
  headings?: Array<{ text: string; level: number; page_number: number }>;
  tables?: Array<{
    id: string;
    page_number: number;
    row_count: number;
    column_count: number;
    cells: Array<{ row: number; col: number; text: string }>;
  }>;
  error?: string;
  message?: string;
  detail?: string;
  traceback?: string;
};

export function parseDoclingHelperOutput(stdout: string): DoclingHelperJson {
  try {
    return JSON.parse(stdout) as DoclingHelperJson;
  } catch {
    return { error: "json_parse_failed", message: "Docling helper produced invalid JSON." };
  }
}

/**
 * Run the Docling Python helper script against a PDF file.
 * Returns the parsed JSON output, or an error-shaped object on failure.
 */
export async function runDoclingHelper(pdfPath: string): Promise<DoclingHelperJson> {
  const scriptPath = path.resolve(process.cwd(), "scripts", "docling-parse.py");

  try {
    const { stdout } = await execFileAsync("python3", [scriptPath, pdfPath], {
      timeout: 120000,
      maxBuffer: 50 * 1024 * 1024,
    });
    return parseDoclingHelperOutput(stdout);
  } catch (err) {
    const error = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    if (error.stdout) {
      return parseDoclingHelperOutput(error.stdout);
    }
    return {
      error: "helper_execution_failed",
      message: `Docling helper process failed: ${error.message ?? "unknown error"}`,
      detail: error.stderr ?? "",
    };
  }
}

/**
 * Convert Docling helper JSON output into a ParsedDocument.
 */
export function mapDoclingHelperJsonToParsedDocument(
  helperJson: DoclingHelperJson,
  input: ParseDocumentTextInput,
): ParsedDocument {
  const parserName = "docling";
  const rawText = helperJson.raw_text ?? input.rawText ?? "";
  const normalizedText = normalizeParserText(rawText);
  const projectRoot = process.cwd();
  const scriptRelPath = path.relative(projectRoot, path.resolve(projectRoot, "scripts", "docling-parse.py"));

  const pages = splitRawTextIntoPages(rawText);
  const headings = (helperJson.headings ?? []).map((heading, index) => ({
    id: `heading:docling:${index}`,
    text: heading.text,
    normalizedText: normalizeParserText(heading.text).replace(/\s+/g, " ").trim(),
    pageNumber: heading.page_number,
    level: heading.level,
    sectionNumber: String(index + 1),
  }));

  const tables: ParsedTable[] = (helperJson.tables ?? []).map((table, index) => ({
    id: table.id || `table:docling:${index}`,
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
      id: `element:docling:heading:${elementIndex}`,
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
      id: `element:docling:paragraph:${elementIndex}`,
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

  const sectionsByNumber = extractPddSections(rawText);
  const headingIndex = buildPddHeadingIndex(rawText);
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
  const versionMetadata = parserVersion ? { docling_version: parserVersion } : undefined;

  const parsedDocumentBase: ParsedDocument = {
    adapterId: "docling",
    source: parserName,
    rawText,
    normalizedText,
    pages,
    elements,
    tables,
    parserName,
    qualityReport: {
      parserName,
      warnings: rawText.trim() ? [] : ["Parsed document text is empty."],
      metadata: {
        helper_script: scriptRelPath,
        ...(versionMetadata ?? {}),
      },
      sourceContentMode: "native_pdf",
      pageCount: pages.length || 1,
      textDensity: 0,
      tableHeavyWarning: tables.length > 5,
      layoutHeavyWarning: false,
      headersFootersDetected: false,
      weakExtractionWarning: false,
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
      metadata: {
        engine: helperJson.engine ?? "docling",
        ...(versionMetadata ?? {}),
        helper_script: scriptRelPath,
      },
    },
  };

  return {
    ...parsedDocumentBase,
    qualityReport: buildDocumentQualityReport(parsedDocumentBase),
  };
}

function parseDoclingMarkdownSections(rawText: string): {
  sections: Array<{ sectionNumber: string; title: string; bodyText: string; level: number }>;
} {
  const lines = rawText.split("\n");
  const sections: Array<{ sectionNumber: string; title: string; bodyText: string; level: number }> = [];
  let currentSection: { sectionNumber: string; title: string; bodyLines: string[]; level: number } | null = null;
  let sectionCounter = 0;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      if (currentSection) {
        sections.push({
          sectionNumber: String(currentSection.sectionNumber),
          title: currentSection.title,
          bodyText: currentSection.bodyLines.join("\n"),
          level: currentSection.level,
        });
      }
      sectionCounter += 1;
      currentSection = {
        sectionNumber: String(sectionCounter),
        title: headingMatch[2]?.trim() ?? "",
        bodyLines: [],
        level: headingMatch[1]?.length ?? 1,
      };
    } else if (currentSection) {
      const trimmed = line.trim();
      if (trimmed) {
        currentSection.bodyLines.push(trimmed);
      }
    }
  }

  if (currentSection) {
    sections.push({
      sectionNumber: String(currentSection.sectionNumber),
      title: currentSection.title,
      bodyText: currentSection.bodyLines.join("\n"),
      level: currentSection.level,
    });
  }

  return { sections };
}

function buildElementsFromDoclingMarkdown(rawText: string, parserName: string): {
  elements: ParsedElement[];
  pages: ParsedPage[];
  tables: ParsedTable[];
} {
  const pages = splitRawTextIntoPages(rawText);
  const { sections } = parseDoclingMarkdownSections(rawText);
  const elements: ParsedElement[] = [];
  const tables: ParsedTable[] = [];
  let elementIndex = 0;

  if (sections.length === 0) {
    const nonEmptyLines = rawText.split("\n").filter((line) => line.trim());
    for (const line of nonEmptyLines) {
      const pageNumber = pages.find((p) => p.rawText.includes(line))?.pageNumber ?? 1;
      elements.push({
        id: `element:docling:${elementIndex}`,
        pageNumber,
        text: line.trim(),
        normalizedText: normalizeParserText(line.trim()).replace(/\s+/g, " ").trim(),
        elementType: "paragraph",
        sourceParser: parserName,
        confidence: 0.85,
      });
      elementIndex += 1;
    }
    for (const page of pages) {
      page.elements = elements.filter((e) => e.pageNumber === page.pageNumber);
    }
    return { elements, pages, tables };
  }

  for (const section of sections) {
    const sectionNumber = section.sectionNumber;
    const sectionPath = buildSectionPath(sectionNumber);
    const pageNumber = pages.find((p) => p.rawText.includes(section.title))?.pageNumber ?? 1;

    elements.push({
      id: `element:docling:heading:${sectionNumber}`,
      pageNumber,
      text: section.title,
      normalizedText: normalizeParserText(section.title).replace(/\s+/g, " ").trim(),
      elementType: "heading",
      headingLevel: section.level,
      sectionNumber,
      sectionPath,
      sourceParser: parserName,
      confidence: 0.95,
    });
    elementIndex += 1;

    if (section.bodyText.trim()) {
      elements.push({
        id: `element:docling:paragraph:${sectionNumber}`,
        pageNumber,
        text: section.bodyText,
        normalizedText: normalizeParserText(section.bodyText).replace(/\s+/g, " ").trim(),
        elementType: "paragraph",
        sectionNumber,
        sectionPath,
        sourceParser: parserName,
        confidence: 0.85,
      });
      elementIndex += 1;
    }
  }

  for (const page of pages) {
    page.elements = elements.filter((e) => e.pageNumber === page.pageNumber);
  }

  return { elements, pages, tables };
}

function buildDoclingParsedDocument(
  input: ParseDocumentTextInput,
): ParsedDocument {
  const parserName = "docling";
  const rawText = input.rawText ?? "";
  const normalizedText = normalizeParserText(rawText);
  const { elements, pages, tables } = buildElementsFromDoclingMarkdown(rawText, parserName);
  const sectionsByNumber = extractPddSections(rawText);
  const headingIndex = buildPddHeadingIndex(rawText);
  const headings = headingIndex.map((heading) => ({
    id: `heading:docling:${heading.sectionNumber}`,
    text: heading.title,
    normalizedText: heading.normalizedTitle,
    level: headingLevel(heading.sectionNumber),
    sectionNumber: heading.sectionNumber,
  }));
  const blocks = elements.map((element) => ({
    id: element.id,
    type: element.elementType === "heading" ? "heading" as const : "paragraph" as const,
    text: element.text,
    normalizedText: element.normalizedText,
    pageNumber: element.pageNumber,
    headingLevel: element.headingLevel,
    sectionNumber: element.sectionNumber,
  }));

  const parsedDocumentBase: ParsedDocument = {
    adapterId: "docling",
    source: parserName,
    rawText,
    normalizedText,
    pages,
    elements,
    tables,
    parserName,
    qualityReport: {
      parserName,
      warnings: rawText.trim() ? [] : ["Parsed document text is empty."],
      sourceContentMode: "native_pdf",
      pageCount: pages.length || 1,
      textDensity: 0,
      tableHeavyWarning: tables.length > 5,
      layoutHeavyWarning: false,
      headersFootersDetected: false,
      weakExtractionWarning: false,
      hasStructuredHeadings: headings.length > 0,
      hasPageBoundaries: pages.length > 1,
      hasBoundingBoxes: true,
      hasTables: tables.length > 0,
    },
    blocks,
    headings,
    sectionsByNumber,
    headingIndex,
  };

  return {
    ...parsedDocumentBase,
    qualityReport: buildDocumentQualityReport(parsedDocumentBase),
  };
}

export const doclingAdapter: DocumentParserAdapter = {
  id: "docling",
  parseText(input: ParseDocumentTextInput): ParsedDocument {
    const implementation = doclingImplementation;

    if (implementation && implementation.isAvailable?.() !== false) {
      try {
        return implementation.parseText(input);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return fallbackToCurrentExtractor(
          input,
          `Docling failed at runtime; fell back to current extractor. ${message}`,
        );
      }
    }

    if (input.rawText && hasDoclingMarkdown(input.rawText)) {
      return buildDoclingParsedDocument(input);
    }

    return fallbackToCurrentExtractor(input, "Docling unavailable; fell back to current extractor.");
  },
};

export function parseDoclingText(input: ParseDocumentTextInput): ParsedDocument {
  return doclingAdapter.parseText(input);
}

export function isDoclingMarkdown(text: string): boolean {
  return hasDoclingMarkdown(text);
}
