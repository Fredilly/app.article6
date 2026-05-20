import { canonicalJsonStringify } from '@/lib/export/canonicalJson';
import type { EvidenceInventoryItem } from '@/lib/evidence/inventory';
import type { RuleReview } from '@/lib/projects/types';
import type {
  FragmentQuality,
  QualityGrade,
  ReconciliationConfidenceLevel,
  SectionCoverage,
  EvidenceQualityMetrics,
} from './types';

function computeGrade(score: number): QualityGrade {
  if (score >= 0.8) return 'A';
  if (score >= 0.6) return 'B';
  if (score >= 0.4) return 'C';
  return 'D';
}

function computeConfidenceLevel(score: number): ReconciliationConfidenceLevel {
  if (score >= 0.75) return 'high';
  if (score >= 0.45) return 'medium';
  return 'low';
}

function countEvidenceFragments(item: EvidenceInventoryItem): number {
  const count = (item.pdd_fragments?.length ?? 0) + (item.workbook_record_groups?.length ?? 0);
  return Math.max(count, 1);
}

function computeFragmentQuality(item: EvidenceInventoryItem): FragmentQuality {
  const hasPageRef =
    item.pdd_fragments?.some(
      (f) => typeof f.page_start === 'number' || typeof f.page_end === 'number',
    ) ?? false;

  const hasSheetRef =
    item.workbook_record_groups?.some((g) => typeof g.source_sheet === 'string' && g.source_sheet.length > 0) ??
    false;

  const hasTextContent =
    item.pdd_fragments?.some((f) => typeof f.excerpt === 'string' && f.excerpt.length >= 20) ??
    item.workbook_record_groups?.some((g) => g.row_count > 0) ??
    false;

  const linkedRequirementCount = item.linked_requirement_ids?.length ?? 0;
  const isReconciled = item.reconciliation_status === 'linked';
  const hasProvenance =
    typeof item.provenance_summary === 'string' && item.provenance_summary.length > 0;
  const fragmentCount = countEvidenceFragments(item);

  let score = 0;
  if (hasPageRef) score += 0.2;
  if (hasSheetRef) score += 0.2;
  if (hasTextContent) score += 0.15;
  if (linkedRequirementCount >= 2) score += 0.2;
  else if (linkedRequirementCount === 1) score += 0.1;
  if (isReconciled) score += 0.15;
  if (hasProvenance) score += 0.1;

  score = Math.min(1, Math.max(0, score));

  let reconciliationConfidenceScore = 0;
  if (item.reconciliation_status === 'linked') reconciliationConfidenceScore += 0.45;
  else if (item.reconciliation_status === 'unmatched') reconciliationConfidenceScore += 0.15;
  else if (item.reconciliation_status === 'gap') reconciliationConfidenceScore += 0.05;
  else if (linkedRequirementCount > 0) reconciliationConfidenceScore += 0.3;
  if (hasPageRef || hasSheetRef) reconciliationConfidenceScore += 0.2;
  if (hasTextContent) reconciliationConfidenceScore += 0.15;
  if (hasProvenance) reconciliationConfidenceScore += 0.1;
  if (fragmentCount > 1) reconciliationConfidenceScore += 0.1;
  reconciliationConfidenceScore = Math.min(1, Math.max(0, reconciliationConfidenceScore));
  const reconciliationConfidenceLevel = computeConfidenceLevel(reconciliationConfidenceScore);

  return {
    evidenceId: item.evidence_id,
    displayName: item.display_name,
    fragmentCount,
    score,
    grade: computeGrade(score),
    hasPageRef,
    hasSheetRef,
    hasTextContent,
    linkedRequirementCount,
    isReconciled,
    hasProvenance,
    reconciliationConfidenceScore,
    reconciliationConfidenceLevel,
  };
}

export function computeMetrics(input: {
  inventoryItems: EvidenceInventoryItem[];
  reviews?: RuleReview[];
}): EvidenceQualityMetrics {
  const fragmentQualities = input.inventoryItems.map(computeFragmentQuality);

  const sectionMap = new Map<string, { title: string; total: number; linked: number; decided: number }>();

  for (const review of input.reviews ?? []) {
    const sectionId = review.sectionId || '__nosection__';
    const existing = sectionMap.get(sectionId);
    if (existing) {
      existing.total += 1;
      if (review.evidenceIds.length > 0) existing.linked += 1;
      if (review.status !== 'not-started') existing.decided += 1;
    } else {
      sectionMap.set(sectionId, {
        title: review.ruleTitle.split(' — ')[0] || sectionId,
        total: 1,
        linked: review.evidenceIds.length > 0 ? 1 : 0,
        decided: review.status !== 'not-started' ? 1 : 0,
      });
    }
  }

  const sectionCoverages: SectionCoverage[] = [];
  for (const [sectionId, data] of sectionMap) {
    sectionCoverages.push({
      sectionId,
      sectionTitle: data.title,
      totalRules: data.total,
      rulesWithLinkedEvidence: data.linked,
      rulesWithDecisions: data.decided,
      coverageFraction: data.total > 0 ? data.linked / data.total : 0,
      decisionFraction: data.total > 0 ? data.decided / data.total : 0,
    });
  }
  sectionCoverages.sort((a, b) => a.sectionId.localeCompare(b.sectionId));

  const linkedFragments = fragmentQualities.filter((f) => f.linkedRequirementCount > 0);
  const overallCoverage =
    fragmentQualities.length > 0 ? linkedFragments.length / fragmentQualities.length : 0;

  const totalScore = fragmentQualities.reduce((sum, f) => sum + f.score, 0);
  const averageQuality =
    fragmentQualities.length > 0 ? totalScore / fragmentQualities.length : 0;

  const metricsPayload = {
    fragmentQualities: fragmentQualities.map((f) => ({
      evidenceId: f.evidenceId,
      fragmentCount: f.fragmentCount,
      score: Math.round(f.score * 100) / 100,
      grade: f.grade,
      reconciliationConfidenceScore: Math.round(f.reconciliationConfidenceScore * 100) / 100,
      reconciliationConfidenceLevel: f.reconciliationConfidenceLevel,
    })),
    sectionCoverages: sectionCoverages.map((s) => ({
      sectionId: s.sectionId,
      coverageFraction: Math.round(s.coverageFraction * 100) / 100,
      decisionFraction: Math.round(s.decisionFraction * 100) / 100,
    })),
    overallCoverage: Math.round(overallCoverage * 100) / 100,
    averageQuality: Math.round(averageQuality * 100) / 100,
  };

  const fingerprint = canonicalJsonStringify(metricsPayload);

  return {
    fragmentQualities,
    sectionCoverages,
    overallCoverage,
    averageQuality,
    fragmentCount: fragmentQualities.length,
    fingerprint,
  };
}
