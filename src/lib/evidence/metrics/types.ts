import type { EvidenceInventoryItem } from '@/lib/evidence/inventory';
import type { RuleReview } from '@/lib/projects/types';

export type QualityGrade = 'A' | 'B' | 'C' | 'D';

export type FragmentQuality = {
  evidenceId: string;
  displayName: string;
  score: number;
  grade: QualityGrade;
  hasPageRef: boolean;
  hasSheetRef: boolean;
  hasTextContent: boolean;
  linkedRequirementCount: number;
  isReconciled: boolean;
  hasProvenance: boolean;
};

export type SectionCoverage = {
  sectionId: string;
  sectionTitle: string;
  totalRules: number;
  rulesWithLinkedEvidence: number;
  rulesWithDecisions: number;
  coverageFraction: number;
  decisionFraction: number;
};

export type EvidenceQualityMetrics = {
  fragmentQualities: FragmentQuality[];
  sectionCoverages: SectionCoverage[];
  overallCoverage: number;
  averageQuality: number;
  fragmentCount: number;
  fingerprint: string;
};

export type MetricsInput = {
  inventoryItems: EvidenceInventoryItem[];
  reviews?: RuleReview[];
};
