import type { ManualFinding, RuleReview } from '@/lib/projects/types';

export type ReportFindingCode = 'OK' | 'CL' | 'NC' | 'FAR' | 'PENDING' | 'NA';

export type ReportFinding = {
  findingId: string;
  ruleId: string;
  ruleTitle: string;
  sectionId: string;
  sectionTitle: string;
  code: ReportFindingCode;
  sourceStatus: RuleReview['status'] | ManualFinding['closureStatus'];
  rationale: string;
  evidenceIds: string[];
  limitation?: string;
};

export function reportFindingCodeFromReviewStatus(status: RuleReview['status']): ReportFindingCode {
  if (status === 'verified') return 'OK';
  if (status === 'gap') return 'NC';
  if (status === 'in-progress') return 'CL';
  if (status === 'not-started') return 'PENDING';
  if (status === 'not-applicable') return 'NA';
  return 'PENDING';
}

export function buildReportFinding(
  review: RuleReview,
  index: number,
  sectionTitle: string,
): ReportFinding {
  const code = reportFindingCodeFromReviewStatus(review.status);
  const note = review.note?.trim();
  const lacksSupport = code === 'OK' && !note && review.evidenceIds.length === 0;
  const defaultRationale = code === 'OK'
    ? lacksSupport
      ? 'Reviewer marked this requirement as verified, but no reviewer rationale or linked evidence reference is recorded.'
      : 'Reviewer marked this requirement as verified; no additional rationale was recorded.'
    : code === 'NC'
      ? 'Reviewer marked this requirement as a gap; no additional rationale was recorded.'
      : code === 'CL'
        ? 'Review is in progress; conclusion is not final.'
        : code === 'NA'
          ? 'Reviewer marked this requirement as not applicable.'
          : 'Requirement has not yet been assessed.';

  return {
    findingId: `F-${String(index + 1).padStart(3, '0')}`,
    ruleId: review.ruleId,
    ruleTitle: review.ruleTitle,
    sectionId: review.sectionId,
    sectionTitle,
    code,
    sourceStatus: review.status,
    rationale: note || defaultRationale,
    evidenceIds: review.evidenceIds,
    limitation: lacksSupport
      ? 'Draft OK is support-limited: no linked evidence reference or reviewer rationale is available.'
      : code === 'PENDING' || code === 'CL'
        ? 'Finding is not a completed verification conclusion.'
        : undefined,
  };
}

export function manualFindingCodeFromType(type: ManualFinding['findingType']): ReportFindingCode {
  if (type === 'CAR' || type === 'VVB finding' || type === 'evidence gap') return 'NC';
  if (type === 'FAR') return 'FAR';
  return 'CL';
}

export function buildManualReportFinding(
  finding: ManualFinding,
  sourceDocumentLabel: string,
): ReportFinding {
  const rationale = finding.reviewerNote?.trim()
    || finding.evidenceExcerpt?.trim()
    || finding.projectResponse?.trim()
    || 'Manual review finding recorded without additional reviewer rationale.';

  return {
    findingId: finding.findingId,
    ruleId: sourceDocumentLabel,
    ruleTitle: finding.findingType,
    sectionId: 'MANUAL',
    sectionTitle: 'Manual Review Findings',
    code: manualFindingCodeFromType(finding.findingType),
    sourceStatus: finding.closureStatus,
    rationale,
    evidenceIds: finding.sourceDocumentId ? [finding.sourceDocumentId] : [],
    limitation: finding.closureStatus === 'closed'
      ? undefined
      : 'Finding remains open inside a project-level manual review workflow.',
  };
}
