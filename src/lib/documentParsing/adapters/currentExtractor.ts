import {
  buildPddHeadingIndex,
  debugSectionExtraction,
  extractPddSections,
} from "@/lib/chat/quickCheckSectionExtractor";
import { buildDocumentQualityReport } from "@/lib/documentClassification";
import type {
  ParseDocumentTextInput,
  ParsedDocument,
  ParsedElement,
  ParsedElementType,
  ParsedPage,
  ParserAdapter,
} from "@/lib/documentParsing/types";

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

type PageBoundary = {
  pageNumber: number;
  charStart: number;
  charEnd: number;
};

function buildPageBoundaries(rawText: string): PageBoundary[] {
  const normalized = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const pageTexts = normalized.split("\f");
  const boundaries: PageBoundary[] = [];
  let cursor = 0;

  for (let index = 0; index < pageTexts.length; index += 1) {
    const pageText = pageTexts[index] ?? "";
    const charStart = cursor;
    const charEnd = charStart + pageText.length;
    boundaries.push({
      pageNumber: pageTexts.length > 1 ? index + 1 : 1,
      charStart,
      charEnd,
    });
    cursor = charEnd + (index < pageTexts.length - 1 ? 1 : 0);
  }

  return boundaries;
}

function pageNumberForOffset(offset: number, boundaries: PageBoundary[]): number {
  const boundary = boundaries.find((candidate) => offset >= candidate.charStart && offset <= candidate.charEnd);
  return boundary?.pageNumber ?? boundaries[boundaries.length - 1]?.pageNumber ?? 1;
}

function findSequentialOffset(haystack: string, needle: string, fromIndex: number): number {
  if (!needle.trim()) return fromIndex;
  const exactIndex = haystack.indexOf(needle, fromIndex);
  if (exactIndex >= 0) return exactIndex;

  const trimmedNeedle = needle.trim();
  const trimmedIndex = haystack.indexOf(trimmedNeedle, fromIndex);
  if (trimmedIndex >= 0) return trimmedIndex;

  return fromIndex;
}

const TITLE_LABEL_RE = /^(?:project description(?: document| \/ pd)?|project document|table of contents|contents)$/i;
const STANDALONE_METHOD_LABEL_RE =
  /^(?:title and reference of methodology applied|methodology applied|applied methodology|approved methodology|applied baseline methodology)$/i;
const PAGE_MARKER_RE = /^page\s+\d+(?:\s+of\s+\d+)?$/i;
const SECTION_HEADING_LINE_RE = /^\s*(?:(?:[A-Z]\.)?\d+(?:\.\d+)*|annex\s+[A-Z0-9]+|appendix\s+[A-Z0-9]+)\s*[.:)]?\s+\S/i;
const FIELD_LIKE_LINE_RE = /^[A-Z][A-Za-z0-9/ (),.+-]{1,80}:\s+\S/;

function introLineElementType(line: string): ParsedElementType {
  const trimmed = line.trim();
  if (!trimmed) return "unknown";
  if (TITLE_LABEL_RE.test(trimmed)) return "paragraph";
  if (PAGE_MARKER_RE.test(trimmed)) return "paragraph";
  if (FIELD_LIKE_LINE_RE.test(trimmed)) return "paragraph";
  if (/^(?:verra|vcs|ccb|gold standard|clean development mechanism)\b/i.test(trimmed)) return "paragraph";
  if (/^v(?:ersion)?\s*\d/i.test(trimmed) || /^vm\d{4}\b/i.test(trimmed)) return "paragraph";
  if (/^\d+(?:\s+of\s+\d+)?$/.test(trimmed) || /^--\s*\d+\s+of\s+\d+\s*--$/.test(trimmed)) return "paragraph";
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (trimmed.length <= 140 && wordCount >= 2 && !STANDALONE_METHOD_LABEL_RE.test(trimmed)) return "heading";
  return "paragraph";
}

type IntroLine = {
  text: string;
  charStart: number;
  charEnd: number;
};

function collectIntroLines(rawText: string, headingIndex: ReturnType<typeof buildPddHeadingIndex>): IntroLine[] {
  if (!rawText.trim()) return [];
  let introEnd = rawText.length;
  if (headingIndex.length > 0) {
    const headingOffsets = headingIndex
      .map((heading) => rawText.indexOf(heading.title))
      .filter((offset) => offset >= 0);
    if (headingOffsets.length > 0) {
      introEnd = Math.min(...headingOffsets);
    }
  }
  let scanCursor = 0;
  for (const line of rawText.split("\n")) {
    if (SECTION_HEADING_LINE_RE.test(line.trim())) {
      introEnd = Math.min(introEnd, scanCursor);
      break;
    }
    scanCursor += line.length + 1;
  }
  const introText = rawText.slice(0, introEnd);
  if (!introText.trim()) return [];

  const lines: IntroLine[] = [];
  let cursor = 0;
  for (const line of introText.split("\n")) {
    const charStart = cursor;
    const charEnd = charStart + line.length;
    cursor = charEnd + 1;
    if (!line.trim()) continue;
    lines.push({ text: line.trim(), charStart, charEnd });
  }
  return lines;
}

function buildIntroElements(input: {
  rawText: string;
  normalizedText: string;
  parserName: string;
  pageBoundaries: PageBoundary[];
  headingIndex: ReturnType<typeof buildPddHeadingIndex>;
}): ParsedElement[] {
  const introLines = collectIntroLines(input.rawText, input.headingIndex);
  const elements: ParsedElement[] = [];

  for (let index = 0; index < introLines.length; index += 1) {
    const line = introLines[index]!;
    const nextLine = introLines[index + 1];
    const pageNumber = pageNumberForOffset(line.charStart, input.pageBoundaries);

    if (STANDALONE_METHOD_LABEL_RE.test(line.text) && nextLine) {
      const combinedText = `${line.text}: ${nextLine.text}`;
      elements.push({
        id: `element:intro:${index}`,
        pageNumber,
        text: combinedText,
        normalizedText: normalizeParserText(combinedText).replace(/\s+/g, " ").trim(),
        charStart: line.charStart,
        charEnd: nextLine.charEnd,
        elementType: "paragraph",
        sourceParser: input.parserName,
        confidence: 0.85,
      });
      index += 1;
      continue;
    }

    const elementType = introLineElementType(line.text);
    elements.push({
      id: `element:intro:${index}`,
      pageNumber,
      text: line.text,
      normalizedText: normalizeParserText(line.text).replace(/\s+/g, " ").trim(),
      charStart: line.charStart,
      charEnd: line.charEnd,
      elementType,
      sourceParser: input.parserName,
      confidence: elementType === "heading" ? 0.92 : 0.8,
    });
  }

  return elements;
}

export const currentExtractorAdapter: ParserAdapter = {
  id: "current-extractor",
  parseText(input: ParseDocumentTextInput): ParsedDocument {
    const rawText = input.rawText ?? "";
    const normalizedText = normalizeParserText(rawText);
    const parserName = "current-extractor";
    const pageBoundaries = buildPageBoundaries(rawText);
    const sectionsByNumber = extractPddSections(rawText);
    const headingIndex = buildPddHeadingIndex(rawText);
    const headings = headingIndex.map((heading) => ({
      id: `heading:${heading.sectionNumber}`,
      text: heading.title,
      normalizedText: heading.normalizedTitle,
      level: headingLevel(heading.sectionNumber),
      sectionNumber: heading.sectionNumber,
    }));
    const introElements = buildIntroElements({
      rawText,
      normalizedText,
      parserName,
      pageBoundaries,
      headingIndex,
    });
    const introBlocks = introElements.map((element) => ({
      id: element.id,
      type: element.elementType === "heading" ? "heading" as const : "paragraph" as const,
      text: element.text,
      normalizedText: element.normalizedText,
      pageNumber: element.pageNumber,
    }));
    const blocks = [
      ...introBlocks,
      ...headingIndex.flatMap((heading) => {
      const headingBlock = {
        id: `block:heading:${heading.sectionNumber}`,
        type: "heading" as const,
        text: heading.title,
        normalizedText: heading.normalizedTitle,
        headingLevel: headingLevel(heading.sectionNumber),
        sectionNumber: heading.sectionNumber,
      };
      const bodyBlocks = heading.bodyText
        ? [{
            id: `block:body:${heading.sectionNumber}`,
            type: "paragraph" as const,
            text: heading.bodyText,
            normalizedText: normalizeParserText(heading.bodyText).replace(/\s+/g, " ").trim(),
            sectionNumber: heading.sectionNumber,
          }]
        : [];
      return [headingBlock, ...bodyBlocks];
    }),
    ];
    let searchCursor = 0;
    const sectionElements: ParsedElement[] = headingIndex.flatMap((heading) => {
      const sectionPath = buildSectionPath(heading.sectionNumber);
      const headingOffset = findSequentialOffset(normalizedText, heading.title, searchCursor);
      const headingPageNumber = pageNumberForOffset(headingOffset, pageBoundaries);
      searchCursor = headingOffset + heading.title.length;
      const headingElement: ParsedElement = {
        id: `element:heading:${heading.sectionNumber}`,
        pageNumber: headingPageNumber,
        text: heading.title,
        normalizedText: heading.normalizedTitle,
        charStart: headingOffset,
        charEnd: headingOffset + heading.title.length,
        elementType: "heading",
        headingLevel: headingLevel(heading.sectionNumber),
        sectionNumber: heading.sectionNumber,
        sectionPath,
        sourceParser: parserName,
        confidence: 0.95,
      };
      const bodyElements = heading.bodyText
        ? (() => {
            const bodyOffset = findSequentialOffset(normalizedText, heading.bodyText, searchCursor);
            const bodyPageNumber = pageNumberForOffset(bodyOffset, pageBoundaries);
            searchCursor = bodyOffset + heading.bodyText.length;
            return [{
              id: `element:paragraph:${heading.sectionNumber}`,
              pageNumber: bodyPageNumber,
              text: heading.bodyText,
              normalizedText: normalizeParserText(heading.bodyText).replace(/\s+/g, " ").trim(),
              charStart: bodyOffset,
              charEnd: bodyOffset + heading.bodyText.length,
              elementType: "paragraph" as const,
              sectionNumber: heading.sectionNumber,
              sectionPath,
              sourceParser: parserName,
              confidence: 0.8,
            }];
          })()
        : [];
      return [headingElement, ...bodyElements];
    });
    const elements: ParsedElement[] = [...introElements, ...sectionElements];
    const pages = splitRawTextIntoPages(rawText).map((page) => ({
      ...page,
      elements: elements.filter((element) => element.pageNumber === page.pageNumber),
    }));
    const diagnostics = rawText.trim()
      ? {
          metadata: debugSectionExtraction(rawText),
        }
      : undefined;

    const parsedDocumentBase: ParsedDocument = {
      adapterId: "current-extractor",
      source: parserName,
      rawText,
      normalizedText,
      pages,
      elements,
      tables: [],
      parserName,
      qualityReport: {
        parserName,
        warnings: rawText.trim() ? [] : ["Parsed document text is empty."],
        metadata: diagnostics?.metadata,
        sourceContentMode: "unknown",
        pageCount: pages.length || 1,
        textDensity: 0,
        ocrConfidence: undefined,
        tableHeavyWarning: false,
        layoutHeavyWarning: false,
        headersFootersDetected: false,
        weakExtractionWarning: false,
        hasStructuredHeadings: headings.length > 0,
        hasPageBoundaries: pages.length > 1,
        hasBoundingBoxes: false,
        hasTables: false,
      },
      blocks,
      headings,
      diagnostics,
      sectionsByNumber,
      headingIndex,
    };

    return {
      ...parsedDocumentBase,
      qualityReport: buildDocumentQualityReport(parsedDocumentBase),
    };
  },
};
