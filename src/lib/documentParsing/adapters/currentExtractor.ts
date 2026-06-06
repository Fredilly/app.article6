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
    const blocks = headingIndex.flatMap((heading) => {
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
    });
    let searchCursor = 0;
    const elements: ParsedElement[] = headingIndex.flatMap((heading) => {
      const sectionPath = buildSectionPath(heading.sectionNumber);
      const headingOffset = findSequentialOffset(normalizedText, heading.title, searchCursor);
      const headingPageNumber = pageNumberForOffset(headingOffset, pageBoundaries);
      searchCursor = headingOffset + heading.title.length;
      const headingElement: ParsedElement = {
        id: `element:heading:${heading.sectionNumber}`,
        pageNumber: headingPageNumber,
        text: heading.title,
        normalizedText: heading.normalizedTitle,
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
