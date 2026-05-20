import type { ReviewerDecision, DecisionRun } from '@/lib/evidence/decisions/types';
import type { CandidateLink, DocumentFragment, ExtractedFact, SourceDocument } from '@/lib/evidence/extraction/types';
import type { EvidenceInventoryItem } from '@/lib/evidence/inventory';
import type { CoverageGap, ReconciliationItem, ReconciliationRun } from '@/lib/evidence/reconciliation/types';
import type {
  ExtractedManualFindingDraft,
  LearningCase,
  ManualFinding,
  Project,
  ProjectCoverage,
  ProjectDocument,
  RuleReview,
} from '@/lib/projects/types';
import type { AOI, EvidencePin, VerificationRun } from '@/lib/proofMap/types';

export type SnapshotProjectMeta = Pick<
  Project,
  | 'id'
  | 'name'
  | 'reviewMode'
  | 'methodCode'
  | 'methodVersion'
  | 'methodCategory'
  | 'registry'
  | 'status'
  | 'createdAt'
  | 'lockedAt'
  | 'aoiLabel'
  | 'description'
>;

export type SnapshotDiffSectionKey =
  | 'project'
  | 'coverage'
  | 'reviews'
  | 'documents'
  | 'manualFindings'
  | 'extractedDrafts'
  | 'learningCases'
  | 'sources'
  | 'inventory'
  | 'fragments'
  | 'facts'
  | 'candidateLinks'
  | 'reconciliationItems'
  | 'reconciliationGaps'
  | 'reviewerDecisions'
  | 'evidencePins'
  | 'verificationRuns'
  | 'aoiData';

export type EvidenceSnapshotState = {
  project: SnapshotProjectMeta;
  coverage: ProjectCoverage;
  reviews: RuleReview[];
  documents: ProjectDocument[];
  manualFindings: ManualFinding[];
  extractedDrafts: ExtractedManualFindingDraft[];
  learningCases: LearningCase[];
  sources: SourceDocument[];
  inventory: EvidenceInventoryItem[];
  fragments: DocumentFragment[];
  facts: ExtractedFact[];
  candidateLinks: CandidateLink[];
  reconciliationRun: ReconciliationRun | null;
  decisionRun: DecisionRun | null;
  evidencePins: EvidencePin[];
  verificationRuns: VerificationRun[];
  aoiData: AOI | null;
};

export type EvidenceSnapshot = {
  schemaVersion: 'evidence_snapshot.v2';
  snapshotId: string;
  projectId: string;
  label: string;
  description?: string;
  capturedAt: string;
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

export type SnapshotDiffSectionSummary = {
  added: number;
  removed: number;
  changed: number;
};

export type EvidenceSnapshotDiff = {
  leftSnapshotId: string;
  rightSnapshotId: string;
  leftLabel: string;
  rightLabel: string;
  computedAt: string;
  summary: {
    added: number;
    removed: number;
    changed: number;
    coverageChange: {
      leftPercent: number;
      rightPercent: number;
      changed: boolean;
    };
    sectionCounts: Record<SnapshotDiffSectionKey, SnapshotDiffSectionSummary>;
  };
  details: Record<SnapshotDiffSectionKey, SnapshotDiffItem[]>;
};

export type SnapshotComparableSectionMap = {
  project: SnapshotProjectMeta[];
  coverage: ProjectCoverage[];
  reviews: RuleReview[];
  documents: ProjectDocument[];
  manualFindings: ManualFinding[];
  extractedDrafts: ExtractedManualFindingDraft[];
  learningCases: LearningCase[];
  sources: SourceDocument[];
  inventory: EvidenceInventoryItem[];
  fragments: DocumentFragment[];
  facts: ExtractedFact[];
  candidateLinks: CandidateLink[];
  reconciliationItems: ReconciliationItem[];
  reconciliationGaps: CoverageGap[];
  reviewerDecisions: ReviewerDecision[];
  evidencePins: EvidencePin[];
  verificationRuns: VerificationRun[];
  aoiData: AOI[];
};
