import type { DocumentHeading } from "@/lib/chat/quickCheckSectionExtractor";

export const DEFAULT_DOCUMENT_PARSER_ADAPTER_ID = "current-extractor" as const;

export type DocumentParserAdapterId = typeof DEFAULT_DOCUMENT_PARSER_ADAPTER_ID;

export type ParseDocumentTextInput = {
  rawText: string;
};

export type ParsedDocument = {
  adapterId: DocumentParserAdapterId;
  rawText: string;
  sectionsByNumber: Record<string, string>;
  headingIndex: DocumentHeading[];
  diagnostics?: Record<string, string>;
};

export interface DocumentParserAdapter {
  readonly id: DocumentParserAdapterId;
  parseText(input: ParseDocumentTextInput): ParsedDocument;
}
