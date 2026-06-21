import { currentExtractorAdapter } from "@/lib/documentParsing/adapters/currentExtractor";
import { liteParseAdapter } from "@/lib/documentParsing/adapters/liteParse";
import { doclingAdapter } from "@/lib/documentParsing/adapters/doclingAdapter";
import { pymupdfAdapter } from "@/lib/documentParsing/adapters/pymupdfAdapter";
import {
  DOCUMENT_PARSER_ADAPTER_IDS,
  DEFAULT_DOCUMENT_PARSER_ADAPTER_ID,
  type DocumentParserAdapter,
  type DocumentParserAdapterId,
  type ParseDocumentTextInput,
  type ParsedDocument,
} from "@/lib/documentParsing/types";

const ADAPTERS: Record<DocumentParserAdapterId, DocumentParserAdapter> = {
  "current-extractor": currentExtractorAdapter,
  liteparse: liteParseAdapter,
  docling: doclingAdapter,
  pymupdf: pymupdfAdapter,
};

function isDocumentParserAdapterId(value: string): value is DocumentParserAdapterId {
  return (DOCUMENT_PARSER_ADAPTER_IDS as readonly string[]).includes(value);
}

export function listDocumentParserAdapters(): DocumentParserAdapter[] {
  return DOCUMENT_PARSER_ADAPTER_IDS.map((adapterId) => ADAPTERS[adapterId]);
}

export function resolveConfiguredDocumentParserAdapterId(
  configuredValue: string | undefined = process.env.QUICK_CHECK_PARSER,
): DocumentParserAdapterId {
  if (configuredValue && isDocumentParserAdapterId(configuredValue)) {
    return configuredValue;
  }
  return DEFAULT_DOCUMENT_PARSER_ADAPTER_ID;
}

export function getDocumentParserAdapter(
  adapterId: DocumentParserAdapterId = resolveConfiguredDocumentParserAdapterId(),
): DocumentParserAdapter {
  return ADAPTERS[adapterId];
}

export function parseDocumentText(
  input: ParseDocumentTextInput,
  adapterId: DocumentParserAdapterId = resolveConfiguredDocumentParserAdapterId(),
): ParsedDocument {
  return getDocumentParserAdapter(adapterId).parseText(input);
}

export * from "@/lib/documentClassification";
export * from "@/lib/documentParsing/types";
