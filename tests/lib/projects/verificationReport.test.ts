import { describe, expect, it } from '@jest/globals';
import type { Project, ProjectCoverage } from '@/lib/projects/types';
import {
  composeManualVerificationReport,
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
    reviewMode: 'methodology-linked',
    methodCode: 'AR-ACM0003',
    methodVersion: 'v02-0',
    registry: 'UNFCCC',
    status: 'locked',
    createdAt: '2026-04-23T00:00:00.000Z',
    documents: [],
    manualFindings: [],
    extractedManualFindingDrafts: [],
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

  it('renders support limitations for verified findings without evidence or rationale', () => {
    const project = makeProject({
      reviews: [
        {
          ruleId: 'R-weak',
          ruleTitle: 'Confirm monitoring evidence exists.',
          sectionId: 'S-3',
          status: 'verified',
          evidenceIds: [],
        },
      ],
    });
    const report = composeVerificationReport(project, makeCoverage({
      total: 1,
      verified: 1,
      gap: 0,
      notStarted: 0,
      percentComplete: 100,
    }));
    const requirementFindings = report.sections.find((section) => section.title === 'REQUIREMENT FINDINGS')?.lines.join(' ');

    expect(report.findings[0]?.code).toBe('OK');
    expect(requirementFindings).toContain('no reviewer rationale or linked evidence reference');
    expect(requirementFindings).toContain('Draft OK is support-limited');
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

  it('renders manual reviews without methodology framing', () => {
    const report = composeManualVerificationReport(
      makeProject({
        reviewMode: 'manual',
        methodCode: undefined,
        methodVersion: undefined,
        registry: 'Unknown',
        documents: [
          {
            id: 'doc-1',
            fileName: 'CCB_VERIF_REP_ENG_1530_01AUG2011_12DEC2020.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 1024,
            uploadedAt: '2026-04-23T00:00:00.000Z',
            extractedText: 'Monitoring report excerpt',
          },
        ],
        manualFindings: [
          {
            id: 'finding-1',
            findingId: 'CAR01',
            findingType: 'CAR',
            sourceDocumentId: 'doc-1',
            sourcePageRange: '40-41',
            requirement: 'CCB V3.1: G1.10',
            description: 'Environmental safeguards evidence is incomplete.',
            evidenceExcerpt: 'Environmental safeguards evidence is incomplete.',
            projectResponse: 'Updated workbook to include the factor.',
            documentationSubmitted: 'EPCAP requirements',
            auditTeamEvaluation: 'Supports now demonstrate compliance.',
            closureStatus: 'open',
            reviewerNote: 'Needs revised attachment set.',
            createdAt: '2026-04-23T00:00:00.000Z',
            updatedAt: '2026-04-23T00:00:00.000Z',
          },
        ],
        extractedManualFindingDrafts: [],
        reviews: [],
      }),
      makeCoverage({ total: 1, verified: 0, gap: 1, notStarted: 0, notApplicable: 0, inProgress: 0, percentComplete: 0 }),
    );

    expect(report.title).toBe('VVB FINDINGS RECONSTRUCTION');
    expect(report.summaryItems).toContain('Manual review report');
    expect(report.sections.map((section) => section.title)).toContain('FINDING DETAILS');
    expect(reportText(report)).not.toContain('UNFCCC VERIFICATION REPORT');
    expect(reportText(report)).toContain('This report reconstructs findings from uploaded source documents.');
    expect(reportText(report)).toContain('CAR: 1. CL: 0. FAR: 0.');
    expect(reportText(report)).toContain('Finding ID: CAR01.');
    expect(reportText(report)).toContain('Source page/range: 40-41.');
    expect(reportText(report)).toContain('Documentation submitted: EPCAP requirements.');
    expect(reportText(report)).toContain('Audit team evaluation: Supports now demonstrate compliance.');
  });

  it('summarizes 1530-style manual findings with CAR/CL/FAR and closed/open counts', () => {
    const manualFindings: Project['manualFindings'] = [
      ...Array.from({ length: 7 }, (_, index) => ({
        id: `car-${index + 1}`,
        findingId: `CAR0${index + 1}`,
        findingType: 'CAR' as const,
        closureStatus: 'closed' as const,
        createdAt: '2026-04-23T00:00:00.000Z',
        updatedAt: '2026-04-23T00:00:00.000Z',
      })),
      ...Array.from({ length: 6 }, (_, index) => ({
        id: `cl-${index + 1}`,
        findingId: `CL0${index + 1}`,
        findingType: 'CL' as const,
        closureStatus: 'closed' as const,
        createdAt: '2026-04-23T00:00:00.000Z',
        updatedAt: '2026-04-23T00:00:00.000Z',
      })),
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `far-${index + 1}`,
        findingId: `FAR0${index + 1}`,
        findingType: 'FAR' as const,
        closureStatus: 'open' as const,
        createdAt: '2026-04-23T00:00:00.000Z',
        updatedAt: '2026-04-23T00:00:00.000Z',
      })),
    ];

    const report = composeManualVerificationReport(
      makeProject({
        reviewMode: 'manual',
        methodCode: undefined,
        methodVersion: undefined,
        registry: 'Verra',
        documents: [{
          id: 'doc-1',
          fileName: 'CCB_VERIF_REP_ENG_1530_01AUG2011_12DEC2020.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          uploadedAt: '2026-04-23T00:00:00.000Z',
        }],
        manualFindings,
        extractedManualFindingDrafts: [],
        reviews: [],
      }),
      makeCoverage({ total: 17, verified: 13, gap: 4, notStarted: 0, percentComplete: 100 }),
    );

    const text = reportText(report);
    expect(text).toContain('17 VVB finding sections were reconstructed');
    expect(text).toContain('13 closed findings, 4 open findings, and 0 findings still marked in review');
    expect(text).toContain('CAR: 7. CL: 6. FAR: 4.');
  });
});
