import type { DocumentHeading } from "@/lib/chat/quickCheckSectionExtractor";

export const DOCUMENT_PARSER_ADAPTER_IDS = [
  "current-extractor",
  "liteparse",
] as const;

export const DEFAULT_DOCUMENT_PARSER_ADAPTER_ID = "current-extractor" as const;

export type DocumentParserAdapterId = typeof DOCUMENT_PARSER_ADAPTER_IDS[number];

export type ParseDocumentTextInput = {
  rawText: string;
};

export type ParsedPage = {
  pageNumber: number;
  rawText: string;
  normalizedText: string;
};

export type ParsedBlock = {
  id: string;
  type: "heading" | "paragraph" | "unknown";
  text: string;
  normalizedText: string;
  pageNumber?: number;
  headingLevel?: number;
  sectionNumber?: string;
};

export type ParsedHeading = {
  id: string;
  text: string;
  normalizedText: string;
  pageNumber?: number;
  level?: number;
  sectionNumber?: string;
};

export type ParserDiagnostics = {
  warnings?: string[];
  metadata?: Record<string, string>;
};

export type ParsedDocument = {
  adapterId: DocumentParserAdapterId;
  source: string;
  rawText: string;
  normalizedText: string;
  pages: ParsedPage[];
  blocks: ParsedBlock[];
  headings: ParsedHeading[];
  diagnostics?: ParserDiagnostics;
  // Bridge fields for the current Quick Check migration only.
  sectionsByNumber?: Record<string, string>;
  headingIndex?: DocumentHeading[];
};

export interface DocumentParserAdapter {
  readonly id: DocumentParserAdapterId;
  parseText(input: ParseDocumentTextInput): ParsedDocument;
}
