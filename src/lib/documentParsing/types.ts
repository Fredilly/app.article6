import type { DocumentHeading } from "@/lib/chat/quickCheckSectionExtractor";
import type {
  DocumentFamily,
  DocumentFamilyClassification,
  DocumentFamilyClassifier,
  DocumentTemplateSignal,
} from "@/lib/documentClassification/documentFamilyTypes";

export const DOCUMENT_PARSER_ADAPTER_IDS = [
  "current-extractor",
  "liteparse",
  "docling",
] as const;

export const DEFAULT_DOCUMENT_PARSER_ADAPTER_ID = "current-extractor" as const;

export type DocumentParserAdapterId = typeof DOCUMENT_PARSER_ADAPTER_IDS[number];

export type ParseDocumentTextInput = {
  rawText: string;
  pdfFilePath?: string;
};

export type ParsedBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ParsedCell = {
  rowIndex: number;
  columnIndex: number;
  text: string;
  rowSpan?: number;
  colSpan?: number;
  boundingBox?: ParsedBoundingBox;
  confidence?: number;
};

export type { DocumentFamily, DocumentTemplateSignal, DocumentFamilyClassification };

export type ParsedTable = {
  id: string;
  pageNumber: number;
  caption?: string;
  columnCount?: number;
  rowCount?: number;
  headerRowCount?: number;
  boundingBox?: ParsedBoundingBox;
  cells: ParsedCell[];
  confidence?: number;
};

export type ParsedElementType =
  | "heading"
  | "paragraph"
  | "table"
  | "list_item"
  | "footer"
  | "header"
  | "unknown";

export type ParsedElement = {
  id: string;
  pageNumber: number;
  text: string;
  normalizedText: string;
  charStart?: number;
  charEnd?: number;
  elementType: ParsedElementType;
  headingLevel?: number;
  sectionNumber?: string;
  sectionPath?: string[];
  boundingBox?: ParsedBoundingBox;
  tableId?: string;
  table?: ParsedTable;
  sourceParser: string;
  confidence?: number;
};

export type ParsedPage = {
  pageNumber: number;
  rawText: string;
  normalizedText: string;
  elements: ParsedElement[];
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

export type DocumentQualityReport = {
  parserName: string;
  warnings: string[];
  metadata?: Record<string, string>;
  sourceContentMode: "native_pdf" | "scanned" | "unknown";
  pageCount: number;
  textDensity: number;
  ocrConfidence?: number;
  tableHeavyWarning: boolean;
  layoutHeavyWarning: boolean;
  headersFootersDetected: boolean;
  weakExtractionWarning: boolean;
  hasStructuredHeadings: boolean;
  hasPageBoundaries: boolean;
  hasBoundingBoxes: boolean;
  hasTables: boolean;
};

export type ParsedDocument = {
  adapterId: DocumentParserAdapterId;
  source: string;
  rawText: string;
  normalizedText: string;
  pages: ParsedPage[];
  elements: ParsedElement[];
  tables: ParsedTable[];
  parserName: string;
  qualityReport: DocumentQualityReport;
  blocks: ParsedBlock[];
  headings: ParsedHeading[];
  diagnostics?: ParserDiagnostics;
  // Bridge fields for the current Quick Check migration only.
  sectionsByNumber?: Record<string, string>;
  headingIndex?: DocumentHeading[];
};

export interface ParserAdapter {
  readonly id: DocumentParserAdapterId;
  parseText(input: ParseDocumentTextInput): ParsedDocument;
}

export type DocumentParserAdapter = ParserAdapter;

export type { DocumentFamilyClassifier };
