export type ProjectStatus = 'in-progress' | 'locked';

export type ProjectReviewMode = 'methodology-linked' | 'manual';

export type RuleReviewStatus = 'not-started' | 'in-progress' | 'verified' | 'gap' | 'not-applicable';

export type ProjectRegistry = 'UNFCCC' | 'Verra' | 'Gold Standard' | 'Unknown';

export type ManualFindingType = 'CAR' | 'CL' | 'FAR' | 'VVB finding' | 'evidence gap';

export type ManualFindingClosureStatus = 'open' | 'in-review' | 'closed';

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
};

export type ManualFinding = {
  id: string;
  findingId: string;
  findingType: ManualFindingType;
  sourceDocumentId?: string;
  evidenceExcerpt?: string;
  projectResponse?: string;
  closureStatus: ManualFindingClosureStatus;
  reviewerNote?: string;
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
