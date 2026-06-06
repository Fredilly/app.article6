export type EvidenceBlockType =
  | "title"
  | "section_heading"
  | "paragraph"
  | "table"
  | "field"
  | "formula"
  | "annex"
  | "toc"
  | "footer";

export type EvidenceSpan = {
  spanId: string;
  docId: string;
  page: number | null;
  sectionId?: string;
  heading?: string;
  blockType: EvidenceBlockType;
  text: string;
  normalizedText: string;
  charStart: number;
  charEnd: number;
  confidence: number;
};

export type EvidenceDocument = {
  docId: string;
  rawText: string;
  spans: EvidenceSpan[];
};

export type DocumentFactKind =
  | "project_title"
  | "host_country"
  | "project_location"
  | "project_participants"
  | "baseline_methodology"
  | "monitoring_methodology"
  | "crediting_period"
  | "reporting_period"
  | "monitoring_period"
  | "leakage_statement"
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
