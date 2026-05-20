export type SnapshotProjectMeta = {
  name: string;
  reviewMode: string;
  methodCode?: string;
  methodVersion?: string;
  status: string;
  lockedAt?: string;
  aoiLabel?: string;
  description?: string;
};

export type SnapshotReview = {
  ruleId: string;
  ruleTitle: string;
  sectionId: string;
  status: string;
  outcome?: string;
  note?: string;
  evidenceIds: string[];
  reviewedAt?: string;
};

export type SnapshotDocument = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  contentSha256?: string;
};

export type SnapshotFinding = {
  id: string;
  findingId: string;
  findingType: string;
  requirement?: string;
  sourceDocumentId?: string;
  closureStatus: string;
  createdAt: string;
};

export type SnapshotExtractedDraft = {
  id: string;
  findingId: string;
  findingType?: string;
  requirement?: string;
  description?: string;
  sourceDocumentId?: string;
  sourcePageRange?: string;
  evidenceExcerpt?: string;
  closureStatus?: string;
  extractionStatus: string;
  extractionMessage: string;
  createdAt: string;
};

export type SnapshotLearningCase = {
  caseId: string;
  trigger: string;
  createdAt: string;
};

export type SnapshotDecision = {
  decisionId: string;
  ruleId: string;
  ruleTitle: string;
  sectionId: string;
  status: string;
  rationale: string;
  reviewedAt: string;
  evidenceIds: string[];
};

export type SnapshotPin = {
  id: string;
  kind: string;
  title: string;
  ruleId?: string;
  citedIds: string[];
  attachmentCount: number;
  stacItemCount: number;
  createdAt: string;
};

export type SnapshotVerificationRun = {
  id: string;
  status: string;
  citedIdsCount: number;
  attachmentCount: number;
  createdAt: string;
};

export type SnapshotAoiData = {
  id: string;
  name: string;
  areaKm2: number;
  createdAt: string;
};

export type SnapshotCoverage = {
  total: number;
  verified: number;
  gap: number;
  notStarted: number;
  notApplicable: number;
  inProgress: number;
  percentComplete: number;
};

export type EvidenceSnapshotState = {
  project: SnapshotProjectMeta;
  reviews: SnapshotReview[];
  documents: SnapshotDocument[];
  manualFindings: SnapshotFinding[];
  extractedDrafts: SnapshotExtractedDraft[];
  learningCases: SnapshotLearningCase[];
  decisions: SnapshotDecision[];
  evidencePins: SnapshotPin[];
  verificationRuns: SnapshotVerificationRun[];
  aoiData: SnapshotAoiData | null;
  coverage: SnapshotCoverage;
};

export type EvidenceSnapshot = {
  snapshotId: string;
  projectId: string;
  label: string;
  description?: string;
  createdAt: string;
  fingerprint: string;
  state: EvidenceSnapshotState;
};

export type SnapshotDiffKind = 'added' | 'removed' | 'changed';

export type SnapshotDiffItem = {
  kind: SnapshotDiffKind;
  id: string;
  label: string;
  left?: Record<string, unknown>;
  right?: Record<string, unknown>;
};

export type EvidenceSnapshotDiff = {
  leftSnapshotId: string;
  rightSnapshotId: string;
  leftLabel: string;
  rightLabel: string;
  computedAt: string;
  summary: {
    reviewsAdded: number;
    reviewsRemoved: number;
    reviewsChanged: number;
    documentsAdded: number;
    documentsRemoved: number;
    findingsAdded: number;
    findingsRemoved: number;
    findingsChanged: number;
    extractedDraftsAdded: number;
    extractedDraftsRemoved: number;
    extractedDraftsChanged: number;
    decisionsChanged: number;
    evidencePinsAdded: number;
    evidencePinsRemoved: number;
    verificationRunsAdded: number;
    verificationRunsRemoved: number;
    coverageChange: { leftPercent: number; rightPercent: number };
  };
  details: {
    reviews: SnapshotDiffItem[];
    documents: SnapshotDiffItem[];
    findings: SnapshotDiffItem[];
    extractedDrafts: SnapshotDiffItem[];
    decisions: SnapshotDiffItem[];
    evidencePins: SnapshotDiffItem[];
    verificationRuns: SnapshotDiffItem[];
  };
};
