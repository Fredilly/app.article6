import { describe, expect, it } from '@jest/globals';
import { shouldShowLockReview } from '@/components/projects/ProjectDetail';
import type { Project, ProjectCoverage } from '@/lib/projects/types';

function makeCoverage(overrides: Partial<ProjectCoverage> = {}): ProjectCoverage {
  return {
    total: 3,
    verified: 0,
    gap: 0,
    notStarted: 3,
    notApplicable: 0,
    inProgress: 0,
    percentComplete: 0,
    ...overrides,
  };
}

function makeMethodologyProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-method',
    name: 'Methodology Review',
    reviewMode: 'methodology-linked',
    methodCode: 'AR-ACM0003',
    methodVersion: 'v02-0',
    registry: 'UNFCCC',
    status: 'in-progress',
    createdAt: '2026-05-06T00:00:00.000Z',
    reviews: [],
    documents: [],
    manualFindings: [],
    extractedManualFindingDrafts: [],
    learningCases: [],
    ...overrides,
  };
}

function makeManualProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-manual',
    name: 'Manual Review',
    reviewMode: 'manual',
    registry: 'Unknown',
    status: 'in-progress',
    createdAt: '2026-05-06T00:00:00.000Z',
    reviews: [],
    documents: [],
    manualFindings: [],
    extractedManualFindingDrafts: [],
    learningCases: [],
    ...overrides,
  };
}

describe('shouldShowLockReview', () => {
  it('hides Lock Review for methodology-linked reviews when every rule is still not-started', () => {
    expect(shouldShowLockReview(
      makeMethodologyProject(),
      makeCoverage({ total: 5, notStarted: 5, verified: 0, gap: 0, inProgress: 0, percentComplete: 0 }),
    )).toBe(false);
  });

  it('shows Lock Review for methodology-linked reviews after at least one rule leaves not-started', () => {
    expect(shouldShowLockReview(
      makeMethodologyProject(),
      makeCoverage({ total: 5, notStarted: 4, inProgress: 1, percentComplete: 20 }),
    )).toBe(true);
  });

  it('hides Lock Review for manual reviews with no findings', () => {
    expect(shouldShowLockReview(
      makeManualProject(),
      makeCoverage({ total: 0, verified: 0, gap: 0, inProgress: 0, percentComplete: 0 }),
    )).toBe(false);
  });

  it('shows Lock Review for manual reviews once at least one finding exists', () => {
    expect(shouldShowLockReview(
      makeManualProject({
        manualFindings: [{
          id: 'finding-1',
          findingId: 'F-001',
          findingType: 'VVB finding',
          closureStatus: 'open',
          createdAt: '2026-05-06T00:00:00.000Z',
          updatedAt: '2026-05-06T00:00:00.000Z',
        }],
      }),
      makeCoverage({ total: 1, gap: 1, notStarted: 0, percentComplete: 0 }),
    )).toBe(true);
  });
});
