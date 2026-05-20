export type DocumentKind = "pdd" | "workbook" | "monitoring-report" | "other";

export type SourceDocument = {
  id: string;
  fileName: string;
  mime: string;
  kind: DocumentKind;
  sizeBytes: number;
  contentSha256: string;
};

export type DocumentFragment = {
  fragmentId: string;
  documentId: string;
  kind: DocumentKind;
  index: number;
  label: string;
  text: string;
  contentSha256: string;
  pageStart?: number;
  pageEnd?: number;
  sheetName?: string;
  sheetIndex?: number;
};

export type ExtractedFact = {
  factId: string;
  fragmentId: string;
  documentId: string;
  factType: FactType;
  value: string;
  context: string;
  pageRef?: string;
  sheetRef?: string;
  contentSha256: string;
};

export type FactType =
  | "project-description"
  | "baseline-scenario"
  | "emission-reduction"
  | "carbon-stock"
  | "leakage"
  | "additionality"
  | "monitoring-period"
  | "parameter-value"
  | "methodology-reference"
  | "date"
  | "location"
  | "quantity"
  | "other";

export type CandidateLink = {
  linkId: string;
  factId: string;
  ruleId: string;
  ruleTitle: string;
  sectionId: string;
  matchType: MatchType;
  matchReason: string;
  confidence: number;
  contentSha256: string;
};

export type MatchType =
  | "exact-evidence-id"
  | "evidence-label-match"
  | "keyword-overlap"
  | "section-match"
  | "parameter-name-match";

export type ExtractionInputFingerprint = {
  documents: Array<{ id: string; contentSha256: string }>;
  methodCode: string;
  methodVersion: string;
};

export type ExtractionRun = {
  runId: string;
  projectId: string;
  startedAt: string;
  inputFingerprint: string;
  fragments: DocumentFragment[];
  fragmentSetFingerprint: string;
  facts: ExtractedFact[];
  factSetFingerprint: string;
  candidateLinks: CandidateLink[];
  linkSetFingerprint: string;
};

export type ExtractionConfig = {
  factExtractionMinLength: number;
  candidateLinkMinConfidence: number;
};
