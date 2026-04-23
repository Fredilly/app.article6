import type { RuleReview } from '@/lib/projects/types';

export type ReportFindingCode = 'OK' | 'CL' | 'NC' | 'FAR' | 'PENDING' | 'NA';

export type ReportFinding = {
  findingId: string;
  ruleId: string;
  ruleTitle: string;
  sectionId: string;
  sectionTitle: string;
  code: ReportFindingCode;
  sourceStatus: RuleReview['status'];
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
  const defaultRationale = code === 'OK'
    ? 'Reviewer marked this requirement as verified; no additional rationale was recorded.'
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
    limitation: code === 'PENDING' || code === 'CL'
      ? 'Finding is not a completed verification conclusion.'
      : undefined,
  };
}
