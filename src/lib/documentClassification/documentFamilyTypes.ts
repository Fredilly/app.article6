export type DocumentFamily =
  | "CDM_PDD"
  | "VCS_PD"
  | "VERRA_PD"
  | "GOLD_STANDARD_PDD"
  | "REDD_AFOLU"
  | "ENERGY"
  | "UNKNOWN";

export type DocumentTemplateSignal = {
  kind:
    | "program_keyword"
    | "template_keyword"
    | "sector_keyword"
    | "quality_metric"
    | "quality_warning";
  family?: Exclude<DocumentFamily, "UNKNOWN">;
  label: string;
  evidence: string;
  weight: number;
  pageNumber?: number;
};

export type DocumentFamilyClassification = {
  family: DocumentFamily;
  confidence: number;
  evidence: string[];
  signals: DocumentTemplateSignal[];
  warnings: string[];
};

export interface DocumentFamilyClassifier {
  classify: (parsedDocument: any) => DocumentFamilyClassification;
}
