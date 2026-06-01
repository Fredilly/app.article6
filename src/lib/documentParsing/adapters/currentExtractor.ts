import {
  buildPddHeadingIndex,
  debugSectionExtraction,
  extractPddSections,
} from "@/lib/chat/quickCheckSectionExtractor";
import type { DocumentParserAdapter, ParseDocumentTextInput, ParsedDocument } from "@/lib/documentParsing/types";

function normalizeParserText(rawText: string): string {
  return rawText
    .replace(/\f/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function headingLevel(sectionNumber?: string): number | undefined {
  if (!sectionNumber) return undefined;
  return sectionNumber.split(".").length;
}

export const currentExtractorAdapter: DocumentParserAdapter = {
  id: "current-extractor",
  parseText(input: ParseDocumentTextInput): ParsedDocument {
    const rawText = input.rawText ?? "";
    const normalizedText = normalizeParserText(rawText);
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
    return {
      adapterId: "current-extractor",
      source: "current-extractor",
      rawText,
      normalizedText,
      pages: [{
        pageNumber: 1,
        rawText,
        normalizedText,
      }],
      blocks,
      headings,
      diagnostics: rawText.trim()
        ? {
            metadata: debugSectionExtraction(rawText),
          }
        : undefined,
      sectionsByNumber,
      headingIndex,
    };
  },
};
