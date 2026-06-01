import {
  buildPddHeadingIndex,
  debugSectionExtraction,
  extractPddSections,
} from "@/lib/chat/quickCheckSectionExtractor";
import type { DocumentParserAdapter, ParseDocumentTextInput, ParsedDocument } from "@/lib/documentParsing/types";

export const currentExtractorAdapter: DocumentParserAdapter = {
  id: "current-extractor",
  parseText(input: ParseDocumentTextInput): ParsedDocument {
    const rawText = input.rawText ?? "";
    return {
      adapterId: "current-extractor",
      rawText,
      sectionsByNumber: extractPddSections(rawText),
      headingIndex: buildPddHeadingIndex(rawText),
      diagnostics: rawText.trim() ? debugSectionExtraction(rawText) : undefined,
    };
  },
};
