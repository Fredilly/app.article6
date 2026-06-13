import type { DocumentFamily } from "@/lib/documentParsing";

export type ProjectFactConfidence = "high" | "medium" | "low";

export type ProjectFactValue = string | string[] | null;

export type ProjectFactField<T extends ProjectFactValue = string | null> = {
  value: T;
  confidence: ProjectFactConfidence;
  evidenceSpanIds: string[];
  pageNumbers: number[];
  sectionPath: string[];
  heading?: string;
  extractionRule: string;
  sourceParser?: string;
  family?: DocumentFamily;
  warnings: string[];
};

export type ProjectFactContractDocumentType =
  | "PROJECT_DESIGN_DOCUMENT"
  | "PROJECT_DESCRIPTION"
  | "DOCUMENT";

export type ProjectFactContract = {
  documentFamily: DocumentFamily;
  documentType: ProjectFactContractDocumentType;
  projectTitle: ProjectFactField<string | null>;
  projectId: ProjectFactField<string | null>;
  hostCountry: ProjectFactField<string | null>;
  projectCountry: ProjectFactField<string | null>;
  projectLocation: ProjectFactField<string | null>;
  projectStandard: ProjectFactField<string | null>;
  projectType: ProjectFactField<string | null>;
  projectProponent: ProjectFactField<string | null>;
  methodologyPrimary: ProjectFactField<string | null>;
  methodologyModules: ProjectFactField<string[] | null>;
  baselineMethodology: ProjectFactField<string | null>;
  monitoringMethodology: ProjectFactField<string | null>;
  creditingPeriod: ProjectFactField<string | null>;
  reportingPeriod: ProjectFactField<string | null>;
  monitoringPeriod: ProjectFactField<string | null>;
  projectStartDate: ProjectFactField<string | null>;
  baselineSections: ProjectFactField<string[] | null>;
  monitoringSections: ProjectFactField<string[] | null>;
  leakageSections: ProjectFactField<string[] | null>;
  additionalitySections: ProjectFactField<string[] | null>;
  warnings: string[];
};
