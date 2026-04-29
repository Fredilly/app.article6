export type ProjectStatus = 'in-progress' | 'locked';

export type RuleReviewStatus = 'not-started' | 'in-progress' | 'verified' | 'gap' | 'not-applicable';

export type ProjectRegistry = 'UNFCCC' | 'Verra' | 'Gold Standard' | 'Unknown';

export type ProjectEvidenceIntakeType = 'pdd' | 'monitoring-report' | 'workbook';

export type ProjectEvidenceIntakeStatus = 'source-not-supplied' | 'supplied' | 'linked';

export type ProjectEvidenceIntakeItem = {
  type: ProjectEvidenceIntakeType;
  label: string;
  status: ProjectEvidenceIntakeStatus;
  sourceName?: string;
  provenanceNote?: string;
  updatedAt?: string;
};

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

export type Project = {
  id: string;
  name: string;
  methodCode: string;
  methodVersion: string;
  registry?: ProjectRegistry;
  status: ProjectStatus;
  createdAt: string;
  lockedAt?: string;
  aoiLabel?: string;
  description?: string;
  evidenceIntake: ProjectEvidenceIntakeItem[];
  reviews: RuleReview[];
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
