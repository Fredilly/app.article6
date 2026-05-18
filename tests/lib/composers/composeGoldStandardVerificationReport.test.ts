import { describe, expect, it } from '@jest/globals';
import type { Project, ProjectCoverage } from '@/lib/projects/types';
import { composeGoldStandardVerificationReport } from '@/lib/composers/composeGoldStandardVerificationReport';

function makeCoverage(overrides: Partial<ProjectCoverage> = {}): ProjectCoverage {
  return {
    total: 8,
    verified: 4,
    gap: 2,
    notStarted: 2,
    notApplicable: 0,
    inProgress: 0,
    percentComplete: 75,
    ...overrides,
  };
}

function makeGSProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'gs-proj-001',
    name: 'Clean Cookstoves Uganda',
    reviewMode: 'methodology-linked',
    methodCode: 'GS-00XX',
    methodVersion: 'v1-0',
    methodCategory: 'AFOLU',
    registry: 'Gold Standard',
    status: 'locked',
    createdAt: '2026-05-01T00:00:00.000Z',
    aoiLabel: 'Kampala District',
    documents: [],
    manualFindings: [],
    extractedManualFindingDrafts: [],
    learningCases: [],
    reviews: [
      { ruleId: 'R-1', ruleTitle: 'Project design document', sectionId: 'S-1', status: 'verified', evidenceIds: ['ev-1'], note: 'PDD reviewed.' },
      { ruleId: 'R-2', ruleTitle: 'Baseline determination', sectionId: 'S-2', status: 'verified', evidenceIds: ['ev-2'], note: 'Baseline confirmed.' },
      { ruleId: 'R-3', ruleTitle: 'Additionality test', sectionId: 'S-3', status: 'gap', evidenceIds: [], note: 'Investment analysis pending.' },
    ],
    ...overrides,
  };
}

describe('composeGoldStandardVerificationReport', () => {
  it('produces a Gold Standard readiness report', () => {
    const report = composeGoldStandardVerificationReport(makeGSProject(), makeCoverage());

    expect(report.registry).toBe('Gold Standard');
    expect(report.title).toBe('GOLD STANDARD READINESS REPORT');
    expect(report.status).toBe('ready');
  });

  it('produces GS4GG-specific section order', () => {
    const report = composeGoldStandardVerificationReport(makeGSProject(), makeCoverage());

    const sectionTitles = report.sections.map((s) => s.title);
    expect(sectionTitles).toContain('REPORT STATUS');
    expect(sectionTitles).toContain('METHODOLOGY SOURCE SECTIONS');
    expect(sectionTitles).toContain('PROJECT DESIGN');
    expect(sectionTitles).toContain('BASELINE SCENARIO');
    expect(sectionTitles).toContain('ADDITIONALITY');
    expect(sectionTitles).toContain('MONITORING');
    expect(sectionTitles).toContain('SAFEGUARDS');
    expect(sectionTitles).toContain('EVIDENCE REVIEWED');
    expect(sectionTitles).toContain('REQUIREMENT FINDINGS');
    expect(sectionTitles).toContain('LIMITATIONS');
    expect(sectionTitles).toContain('PROVENANCE');
  });

  it('loads canonical Gold Standard metadata from the methodology pack', () => {
    const report = composeGoldStandardVerificationReport(makeGSProject(), makeCoverage());
    const overview = report.sections.find((section) => section.title === 'METHODOLOGY SOURCE SECTIONS');
    const projectDesign = report.sections.find((section) => section.title === 'PROJECT DESIGN');
    const monitoring = report.sections.find((section) => section.title === 'MONITORING');

    expect(overview?.lines.join(' ')).toContain('GS LUF Activity Requirements v1.2.1');
    expect(projectDesign?.lines).toContain('- Scope and Applicability (S-1)');
    expect(monitoring?.lines).toContain('- Uncertainty of LUF Parameters (S-5)');
  });

  it('includes standard disclaimer language', () => {
    const report = composeGoldStandardVerificationReport(makeGSProject(), makeCoverage());

    const text = report.sections.flatMap((s) => s.lines).join(' ');
    expect(text).not.toContain('registry_not_fully_supported');
    expect(text).not.toMatch(/fallback|stub|not yet implemented/i);
  });

  it('does not claim official GS certification', () => {
    const report = composeGoldStandardVerificationReport(makeGSProject(), makeCoverage());

    const text = report.sections.flatMap((s) => s.lines).join(' ');
    const forbidden = [
      'verification opinion: positive',
      'validated successfully',
      'registry approved',
      'gs certified emission reductions are approved',
    ];
    for (const phrase of forbidden) {
      expect(text.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
    const limitations = report.sections.find((s) => s.title === 'LIMITATIONS');
    expect(limitations).toBeDefined();
    expect(limitations!.lines.join(' ')).toContain('not a formal');
    expect(limitations!.lines.join(' ')).toContain('Gold Standard');
  });

  it('falls back gracefully when metadata is not available', () => {
    const project = makeGSProject({ methodCategory: 'NonExistent', methodCode: 'UNKNOWN' });
    const report = composeGoldStandardVerificationReport(project, makeCoverage());

    expect(report.registry).toBe('Gold Standard');
    expect(report.title).toBe('GOLD STANDARD READINESS REPORT');
    expect(report.sections.length).toBeGreaterThan(0);
  });

  it('includes provenance in the report', () => {
    const report = composeGoldStandardVerificationReport(makeGSProject(), makeCoverage());

    expect(report.provenance.some(([label]) => label === 'Registry')).toBe(true);
    expect(report.provenance.some(([label]) => label === 'Report status')).toBe(true);
  });

  it('produces deterministic output', () => {
    const project = makeGSProject();
    const coverage = makeCoverage();
    const report1 = composeGoldStandardVerificationReport(project, coverage);
    const report2 = composeGoldStandardVerificationReport(project, coverage);

    expect(report1.sections.length).toBe(report2.sections.length);
    expect(report1.sections.map((s) => s.title)).toEqual(report2.sections.map((s) => s.title));
  });
});
