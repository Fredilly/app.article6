import type {
  DocumentFamily,
  DocumentParserAdapterId,
  ParsedBoundingBox,
} from "@/lib/documentParsing";

export type EvidenceBlockType =
  | "header"
  | "title"
  | "section_heading"
  | "paragraph"
  | "table"
  | "field"
  | "formula"
  | "annex"
  | "toc"
  | "footer";

export type EvidenceSpanReliability = "primary" | "limited" | "excluded";

export type NoiseContext =
  | "header"
  | "footer"
  | "toc"
  | "contact"
  | "reference"
  | "source-caption";

export type EvidenceLayoutMetadata = {
  boundingBox?: ParsedBoundingBox;
  repeatedHeaderFooter?: boolean;
  limitedProvenance?: boolean;
  noiseContexts?: NoiseContext[];
};

export type EvidenceTableCellMetadata = {
  rowIndex: number;
  columnIndex: number;
  text: string;
  normalizedText: string;
  pageNumber?: number;
  boundingBox?: ParsedBoundingBox;
  sourceTableId?: string;
  sourceBlockId?: string;
  parserSource?: string;
};

export type EvidenceTableMetadata = {
  tableId?: string;
  caption?: string;
  rowCount?: number;
  columnCount?: number;
  headerRowCount?: number;
  cells?: EvidenceTableCellMetadata[];
  limitedProvenance?: boolean;
};

export type EvidenceSpan = {
  spanId: string;
  docId: string;
  page: number | null;
  sectionId?: string;
  heading?: string;
  headingPath: string[];
  sectionPath: string[];
  blockType: EvidenceBlockType;
  text: string;
  normalizedText: string;
  charStart: number | null;
  charEnd: number | null;
  sourceBlockId?: string;
  parserSource?: string;
  parserAdapterId?: DocumentParserAdapterId;
  documentFamily?: DocumentFamily;
  layout?: EvidenceLayoutMetadata;
  table?: EvidenceTableMetadata;
  reliability: EvidenceSpanReliability;
  confidence: number;
  noise?: NoiseContext[];
};

export type EvidenceDocument = {
  docId: string;
  rawText: string;
  parserSource?: string;
  parserAdapterId?: DocumentParserAdapterId;
  documentFamily?: DocumentFamily;
  spans: EvidenceSpan[];
};

export type DocumentFactKind =
  | "project_title"
  | "project_id"
  | "host_country"
  | "project_location"
  | "project_participants"
  | "methodology"
  | "monitoring_methodology"
  | "crediting_period"
  | "reporting_period"
  | "monitoring_period"
  | "leakage_value"
  | "baseline_scenario"
  | "additionality_claim";

export type DocumentFact = {
  kind: DocumentFactKind;
  value: string;
  evidenceSpanIds: string[];
  confidence: "high" | "medium" | "low";
};

export type CompileEvidenceDocumentInput = {
  docId: string;
  rawText: string;
};

export type QuoteValidationInput = {
  quote: string;
  page?: number | null;
  sectionId?: string;
  heading?: string;
};

export type QuoteValidationResult = {
  quote: string;
  valid: boolean;
  matchedSpanIds: string[];
  matchType: "exact" | "normalized" | "fuzzy" | "missing";
  confidence: "high" | "medium" | "low";
};
