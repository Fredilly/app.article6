import { describe, expect, it } from '@jest/globals';
import type { RuleReview } from '@/lib/projects/types';
import { reportFindingCodeFromReviewStatus } from '@/lib/projects/reportFindings';

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
});
