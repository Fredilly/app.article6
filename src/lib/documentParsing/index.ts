import { currentExtractorAdapter } from "@/lib/documentParsing/adapters/currentExtractor";
import {
  DEFAULT_DOCUMENT_PARSER_ADAPTER_ID,
  type DocumentParserAdapter,
  type DocumentParserAdapterId,
  type ParseDocumentTextInput,
  type ParsedDocument,
} from "@/lib/documentParsing/types";

const ADAPTERS: Record<DocumentParserAdapterId, DocumentParserAdapter> = {
  "current-extractor": currentExtractorAdapter,
};

export function getDocumentParserAdapter(
  adapterId: DocumentParserAdapterId = DEFAULT_DOCUMENT_PARSER_ADAPTER_ID,
): DocumentParserAdapter {
  return ADAPTERS[adapterId];
}

export function parseDocumentText(
  input: ParseDocumentTextInput,
  adapterId: DocumentParserAdapterId = DEFAULT_DOCUMENT_PARSER_ADAPTER_ID,
): ParsedDocument {
  return getDocumentParserAdapter(adapterId).parseText(input);
}

export * from "@/lib/documentParsing/types";
