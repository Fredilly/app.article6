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
  | "methodology"
  | "monitoring_methodology"
  | "crediting_period"
  | "reporting_period"
  | "monitoring_period"
  | "leakage_statement"
  | "leakage_value"
  | "baseline_scenario"
  | "additionality_claim";

export type DocumentFact = {
  kind: DocumentFactKind;
  value: string;
  evidenceSpanIds: string[];
  confidence: "high" | "medium" | "low";
};

export type ProjectFactConfidence = "high" | "medium" | "low";

export type CanonicalProjectFactKey =
  | "projectTitle"
  | "hostCountry"
  | "projectCountry"
  | "projectStandard"
  | "documentType"
  | "methodologyPrimary"
  | "projectType"
  | "projectStartDate"
  | "creditingPeriod"
  | "projectProponent";

export type ProjectFactValue<T = string> = {
  value: T;
  confidence: ProjectFactConfidence;
  evidenceSpanIds: string[];
  page: number | null;
  sectionId?: string;
  heading?: string;
  extractionRule: string;
};

export type ProjectSectionFact = ProjectFactValue<string>;

export type ProjectFactContract = {
  projectTitle: ProjectFactValue<string> | null;
  hostCountry: ProjectFactValue<string> | null;
  projectCountry: ProjectFactValue<string> | null;
  projectStandard: ProjectFactValue<string> | null;
  documentType: ProjectFactValue<string> | null;
  methodologyPrimary: ProjectFactValue<string> | null;
  methodologyModules: Array<ProjectFactValue<string>>;
  projectType: ProjectFactValue<string> | null;
  projectStartDate: ProjectFactValue<string> | null;
  creditingPeriod: ProjectFactValue<string> | null;
  projectProponent: ProjectFactValue<string> | null;
  baselineSections: Array<ProjectSectionFact>;
  monitoringSections: Array<ProjectSectionFact>;
  leakageSections: Array<ProjectSectionFact>;
  additionalitySections: Array<ProjectSectionFact>;
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
