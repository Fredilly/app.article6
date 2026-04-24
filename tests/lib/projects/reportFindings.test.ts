import { describe, expect, it } from '@jest/globals';
import type { RuleReview } from '@/lib/projects/types';
import { buildReportFinding, reportFindingCodeFromReviewStatus } from '@/lib/projects/reportFindings';

describe('report finding mapping', () => {
  it.each([
    ['verified', 'OK'],
    ['gap', 'NC'],
    ['in-progress', 'CL'],
    ['not-started', 'PENDING'],
    ['not-applicable', 'NA'],
  ] as const)('maps %s to %s', (status, code) => {
    expect(reportFindingCodeFromReviewStatus(status)).toBe(code);
  });

  it('does not map any current review status to FAR by default', () => {
    const statuses: RuleReview['status'][] = ['verified', 'gap', 'in-progress', 'not-started', 'not-applicable'];

    expect(statuses.map(reportFindingCodeFromReviewStatus)).not.toContain('FAR');
  });

  it('qualifies verified findings that have no evidence references or reviewer rationale', () => {
    const finding = buildReportFinding({
      ruleId: 'R-weak',
      ruleTitle: 'Confirm monitoring evidence exists.',
      sectionId: 'S-3',
      status: 'verified',
      evidenceIds: [],
    }, 0, 'Monitoring');

    expect(finding.code).toBe('OK');
    expect(finding.rationale).toMatch(/no reviewer rationale or linked evidence reference/i);
    expect(finding.limitation).toMatch(/support-limited/i);
  });
});
