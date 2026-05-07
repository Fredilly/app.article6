export type ProjectStatus = 'in-progress' | 'locked';

export type ProjectReviewMode = 'methodology-linked' | 'manual';

export type RuleReviewStatus = 'not-started' | 'in-progress' | 'verified' | 'gap' | 'not-applicable';

export type ProjectRegistry = 'UNFCCC' | 'Verra' | 'Gold Standard' | 'Unknown';

export type ManualFindingType = 'CAR' | 'CL' | 'FAR' | 'VVB finding' | 'evidence gap';

export type ManualFindingClosureStatus = 'open' | 'in-review' | 'closed';

export type ExtractedManualFindingStatus = 'draft' | 'needs-review';

export type LearningCaseTrigger = 'project_locked' | 'export_generated';

export type LearningCase = {
  case_id: string;
  created_at: string;
  trigger: LearningCaseTrigger;
  review_mode: ProjectReviewMode;
  trust_level: 'user_entered_unverified';
  training_eligible: false;
  requires_human_review: true;
  registry_or_standard?: string;
  document_type: string;
  source_document_count: number;
  finding_count: number;
  finding_type_counts: {
    CAR: number;
    CL: number;
    FAR: number;
    other: number;
  };
  closure_counts: {
    open: number;
    'in-review': number;
    closed: number;
  };
  fields_present: Record<string, number>;
  fields_missing: Record<string, number>;
  reviewer_correction_summary?: {
    extracted_draft_count: number;
    draft_findings_ready_count: number;
    draft_findings_needing_review_count: number;
    reviewer_note_count: number;
  };
  export_quality_flags: string[];
  truth_rules_triggered: string[];
  recommended_evals: string[];
  source_retention_policy: string;
  dedup_key: string;
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
  learningCases: LearningCase[];
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
