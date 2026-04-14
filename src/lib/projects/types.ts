export type ProjectStatus = 'in-progress' | 'finalized';

export type RuleReviewStatus = 'not-started' | 'in-progress' | 'verified' | 'gap' | 'not-applicable';

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
  status: ProjectStatus;
  createdAt: string;
  finalizedAt?: string;
  aoiLabel?: string;
  description?: string;
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
