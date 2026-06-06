import {
  buildPddHeadingIndex,
  debugSectionExtraction,
  extractPddSections,
} from "@/lib/chat/quickCheckSectionExtractor";
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

export const currentExtractorAdapter: ParserAdapter = {
  id: "current-extractor",
  parseText(input: ParseDocumentTextInput): ParsedDocument {
    const rawText = input.rawText ?? "";
    const normalizedText = normalizeParserText(rawText);
    const parserName = "current-extractor";
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
    const elements: ParsedElement[] = headingIndex.flatMap((heading) => {
      const sectionPath = buildSectionPath(heading.sectionNumber);
      const headingElement: ParsedElement = {
        id: `element:heading:${heading.sectionNumber}`,
        pageNumber: 1,
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
        ? [{
            id: `element:paragraph:${heading.sectionNumber}`,
            pageNumber: 1,
            text: heading.bodyText,
            normalizedText: normalizeParserText(heading.bodyText).replace(/\s+/g, " ").trim(),
            elementType: "paragraph" as const,
            sectionNumber: heading.sectionNumber,
            sectionPath,
            sourceParser: parserName,
            confidence: 0.8,
          }]
        : [];
      return [headingElement, ...bodyElements];
    });
    const pages = splitRawTextIntoPages(rawText).map((page) => ({
      ...page,
      elements: elements.filter((element) => element.pageNumber === page.pageNumber),
    }));
    const warnings = rawText.trim() ? [] : [];
    const diagnostics = rawText.trim()
      ? {
          metadata: debugSectionExtraction(rawText),
        }
      : undefined;

    return {
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
        warnings,
        metadata: diagnostics?.metadata,
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
  },
};
