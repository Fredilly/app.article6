import { describe, expect, it } from '@jest/globals';
import type { Project, ProjectCoverage } from '@/lib/projects/types';
import {
  composeGoldStandardVerificationReport,
  composeUnfcccVerificationReport,
  composeVerificationReport,
  composeVerraVerificationReport,
} from '@/lib/projects/verificationReport';

const FORMAL_UNFCCC_SECTION_ORDER = [
  'REPORT STATUS',
  'PROJECT AND METHODOLOGY IDENTIFICATION',
  'VERIFICATION SCOPE',
  'MEANS OF VERIFICATION',
  'FINDINGS SUMMARY',
  'REQUIREMENT FINDINGS',
  'EVIDENCE APPENDIX',
  'LIMITATIONS',
  'PROVENANCE',
];

const UNSUPPORTED_CERTIFICATION_PHRASES = [
  'certified emission reductions are approved',
  'verification opinion: positive',
  'VCUs issued',
  'registry approved',
  'validated successfully',
  'verified successfully',
];

function reportText(report: ReturnType<typeof composeVerificationReport>): string {
  return [
    report.title,
    report.subtitle,
    ...report.summaryItems,
    ...report.sections.flatMap((section) => [section.title, ...section.lines]),
    ...report.provenance.flat(),
    report.limitation,
  ].join('\n');
}

function makeCoverage(overrides: Partial<ProjectCoverage> = {}): ProjectCoverage {
  return {
    total: 3,
    verified: 1,
    gap: 1,
    notStarted: 1,
    notApplicable: 0,
    inProgress: 0,
    percentComplete: 67,
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj_123',
    name: 'Demo Forestry Project',
    methodCode: 'AR-ACM0003',
    methodVersion: 'v02-0',
    registry: 'UNFCCC',
    status: 'locked',
    createdAt: '2026-04-23T00:00:00.000Z',
    reviews: [
      {
        ruleId: 'R-1',
        ruleTitle: 'Submit a monitoring report.',
        sectionId: 'S-1',
        status: 'verified',
        evidenceIds: ['evidence-1'],
        note: 'Monitoring report reviewed.',
      },
      {
        ruleId: 'R-2',
        ruleTitle: 'Provide baseline calculations.',
        sectionId: 'S-2',
        status: 'gap',
        evidenceIds: [],
        note: 'Baseline workbook missing.',
      },
      {
        ruleId: 'R-3',
        ruleTitle: 'Maintain project boundary records.',
        sectionId: 'S-3',
        status: 'not-started',
        evidenceIds: [],
      },
    ],
    ...overrides,
  };
}

describe('verification report composition', () => {
  it('routes UNFCCC projects to the formal full renderer path', () => {
    const report = composeVerificationReport(makeProject(), makeCoverage());

    expect(report.registry).toBe('UNFCCC');
    expect(report.status).toBe('ready');
    expect(report.title).toBe('UNFCCC VERIFICATION REPORT');
    expect(report.sections.map((section) => section.title)).toEqual(FORMAL_UNFCCC_SECTION_ORDER);
    expect(report.findings.map((finding) => finding.code)).toEqual(['OK', 'NC', 'PENDING']);
  });

  it('emits deterministic finding summary counts for UNFCCC reports', () => {
    const report = composeVerificationReport(makeProject(), makeCoverage());
    const summary = report.sections.find((section) => section.title === 'FINDINGS SUMMARY')?.lines.join(' ');

    expect(summary).toContain('OK: 1');
    expect(summary).toContain('NC: 1');
    expect(summary).toContain('PENDING: 1');
    expect(summary).toContain('CL: 0');
    expect(summary).toContain('NA: 0');
    expect(summary).toContain('FAR: 0');
  });

  it('returns an insufficient-source fallback for UNFCCC when no completed reviews exist', () => {
    const project = makeProject({
      reviews: makeProject().reviews.map((review) => ({ ...review, status: 'not-started', note: undefined })),
    });
    const coverage = makeCoverage({ verified: 0, gap: 0, notStarted: 3, percentComplete: 0 });

    const report = composeUnfcccVerificationReport(project, coverage);

    expect(report.status).toBe('insufficient_source_content');
    expect(report.sections.map((section) => section.title)).toEqual(FORMAL_UNFCCC_SECTION_ORDER);
    expect(report.findings.every((finding) => finding.code === 'PENDING')).toBe(true);
  });

  it('routes Verra through a registry-specific fallback path', () => {
    const report = composeVerraVerificationReport(
      makeProject({ methodCode: 'VM0007', registry: 'Verra' }),
      makeCoverage(),
    );

    expect(report.registry).toBe('Verra');
    expect(report.status).toBe('registry_not_fully_supported');
    expect(report.title).toBe('VERRA VERIFICATION REPORT');
    expect(report.sections[0]?.lines.join(' ')).toMatch(/not yet implemented/i);
  });

  it('routes Gold Standard through a registry-specific fallback path', () => {
    const report = composeGoldStandardVerificationReport(
      makeProject({ methodCode: 'GS TPDDTEC', registry: 'Gold Standard' }),
      makeCoverage(),
    );

    expect(report.registry).toBe('Gold Standard');
    expect(report.status).toBe('registry_not_fully_supported');
    expect(report.title).toBe('GOLD STANDARD VERIFICATION REPORT');
    expect(report.sections[0]?.lines.join(' ')).toMatch(/fallback/i);
  });

  it('does not masquerade registry fallback as a successful full render', () => {
    const report = composeVerificationReport(
      makeProject({ methodCode: 'VM0047', registry: 'Verra' }),
      makeCoverage(),
    );

    expect(report.status).not.toBe('ready');
    expect(report.findings).toEqual([]);
    expect(report.limitation).toMatch(/not a full Verra verification report/i);
  });

  it('keeps Verra and Gold Standard on truthful fallback paths without full report sections', () => {
    const verra = composeVerificationReport(makeProject({ methodCode: 'VM0007', registry: 'Verra' }), makeCoverage());
    const gold = composeVerificationReport(makeProject({ methodCode: 'GS TPDDTEC', registry: 'Gold Standard' }), makeCoverage());

    expect(verra.status).toBe('registry_not_fully_supported');
    expect(gold.status).toBe('registry_not_fully_supported');
    expect(verra.sections.map((section) => section.title)).not.toContain('REQUIREMENT FINDINGS');
    expect(gold.sections.map((section) => section.title)).not.toContain('REQUIREMENT FINDINGS');
    expect(verra.findings).toEqual([]);
    expect(gold.findings).toEqual([]);
  });

  it('does not emit unsupported certification or issuance phrases', () => {
    const report = composeVerificationReport(makeProject(), makeCoverage());
    const text = reportText(report);

    for (const phrase of UNSUPPORTED_CERTIFICATION_PHRASES) {
      expect(text).not.toContain(phrase);
    }
  });
});
