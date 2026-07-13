export type ReviewedEvidenceState = "FOUND" | "UNCLEAR" | "MISSING" | "N/A";
export type ReviewedOutcome = "CONFORMS" | "ACTION_REQUIRED" | "NOT_APPLICABLE";

export type ReviewedEvidenceProvenance = Readonly<{
  docId: string;
  page: number | null;
  sectionPath: readonly string[];
  spanId: string;
  sectionHeading: string | null;
  sourceType: string | null;
}>;

export type ReviewedEvidenceRecord = Readonly<{
  quote: string;
  page: number | null;
  section: string | null;
  spanId: string;
  provenance: ReviewedEvidenceProvenance;
  rejectionReason?: string;
}>;

export type ReviewedEvidenceMapRow = Readonly<{
  rowId: string;
  stableRuleId: string;
  ruleReference: string;
  requirementText: string;
  finalEvidenceState: ReviewedEvidenceState;
  reviewerOutcome: ReviewedOutcome;
  reviewerEvidence: readonly ReviewedEvidenceRecord[];
  rejectedEvidence: readonly ReviewedEvidenceRecord[];
  draftFindingCandidate: string | null;
  contradictionState: string;
  clientAction: string;
}>;

export type ReviewedEvidenceMapSnapshot = Readonly<{
  canonicalAuditId: string;
  stableProjectId: string;
  sourceDocument: Readonly<{
    documentId: string;
    documentName: string | null;
    contentSha256: string;
  }>;
  methodologyId: string;
  methodologyVersion: string;
  rows: readonly ReviewedEvidenceMapRow[];
  readOnly: true;
}>;
