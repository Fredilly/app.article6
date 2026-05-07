export type ProjectStatus = 'in-progress' | 'locked';

export type ProjectReviewMode = 'methodology-linked' | 'manual';

export type RuleReviewStatus = 'not-started' | 'in-progress' | 'verified' | 'gap' | 'not-applicable';

export type ProjectRegistry = 'UNFCCC' | 'Verra' | 'Gold Standard' | 'Unknown';

export type ManualFindingType = 'CAR' | 'CL' | 'FAR' | 'VVB finding' | 'evidence gap';

export type ManualFindingClosureStatus = 'open' | 'in-review' | 'closed';

export type ExtractedManualFindingStatus = 'draft' | 'needs-review';

export type RuleReview = {
  ruleId: string;
  ruleTitle: string;
  sectionId: string;
  status: RuleReviewStatus;
  outcome?: 'pass' | 'fail' | 'partial' | 'missing-evidence';
  note?: string;
  evidenceIds: string[];
  reviewedAt?: string;
};

export type ProjectDocument = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  extractedText?: string;
  manualFindingExtractionStatus?: 'not-run' | 'no-findings' | 'extracted' | 'extraction-failed';
  manualFindingExtractionMessage?: string;
  manualFindingExtractionTrace?: string;
};

export type ManualFinding = {
  id: string;
  findingId: string;
  findingType: ManualFindingType;
  requirement?: string;
  description?: string;
  sourceDocumentId?: string;
  sourcePageRange?: string;
  evidenceExcerpt?: string;
  projectResponse?: string;
  documentationSubmitted?: string;
  auditTeamEvaluation?: string;
  closureStatus: ManualFindingClosureStatus;
  reviewerNote?: string;
  createdAt: string;
  updatedAt: string;
};

export type ExtractedManualFindingDraft = {
  id: string;
  findingId: string;
  findingType?: Extract<ManualFindingType, 'CAR' | 'CL' | 'FAR'>;
  requirement?: string;
  description?: string;
  sourceDocumentId?: string;
  sourcePageRange?: string;
  evidenceExcerpt?: string;
  projectResponse?: string;
  documentationSubmitted?: string;
  auditTeamEvaluation?: string;
  closureStatus?: ManualFindingClosureStatus;
  reviewerNote?: string;
  extractionStatus: ExtractedManualFindingStatus;
  extractionMessage: string;
  createdAt: string;
  updatedAt: string;
};

export type Project = {
  id: string;
  name: string;
  reviewMode: ProjectReviewMode;
  methodCode?: string;
  methodVersion?: string;
  registry?: ProjectRegistry;
  status: ProjectStatus;
  createdAt: string;
  lockedAt?: string;
  aoiLabel?: string;
  description?: string;
  reviews: RuleReview[];
  documents: ProjectDocument[];
  manualFindings: ManualFinding[];
  extractedManualFindingDrafts: ExtractedManualFindingDraft[];
};

export type ProjectCoverage = {
  total: number;
  verified: number;
  gap: number;
  notStarted: number;
  notApplicable: number;
  inProgress: number;
  percentComplete: number;
};
