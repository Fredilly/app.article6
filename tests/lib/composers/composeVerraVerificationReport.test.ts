import { describe, expect, it } from '@jest/globals';
import type { Project, ProjectCoverage } from '@/lib/projects/types';
import { composeVerraVerificationReport } from '@/lib/composers/composeVerraVerificationReport';

function makeCoverage(overrides: Partial<ProjectCoverage> = {}): ProjectCoverage {
  return {
    total: 11,
    verified: 5,
    gap: 3,
    notStarted: 3,
    notApplicable: 0,
    inProgress: 0,
    percentComplete: 73,
    ...overrides,
  };
}

function makeVerraProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'verra-proj-001',
    name: 'ARR Malawi Project',
    reviewMode: 'methodology-linked',
    methodCode: 'VM0047',
    methodVersion: 'v1-0',
    methodCategory: 'AFOLU',
    registry: 'Verra',
    status: 'locked',
    createdAt: '2026-05-01T00:00:00.000Z',
    aoiLabel: 'Machinga District',
    documents: [],
    manualFindings: [],
    extractedManualFindingDrafts: [],
    learningCases: [],
    reviews: [
      { ruleId: 'R-1-0001', ruleTitle: 'Forest definition threshold', sectionId: 'S-1', status: 'verified', evidenceIds: ['ev-1'], note: 'Verified.' },
      { ruleId: 'R-4-0001', ruleTitle: 'ARR applicability land eligibility', sectionId: 'S-4', status: 'verified', evidenceIds: ['ev-2'], note: 'Confirmed.' },
      { ruleId: 'R-7-0001', ruleTitle: 'Project boundary', sectionId: 'S-5', status: 'gap', evidenceIds: [], note: 'Boundary map pending.' },
      { ruleId: 'R-8-0001', ruleTitle: 'Baseline quantification', sectionId: 'S-8-1', status: 'verified', evidenceIds: ['ev-3'], note: 'Calculations reviewed.' },
    ],
    ...overrides,
  };
}

describe('composeVerraVerificationReport', () => {
  it('uses the canonical methodology metadata when available', () => {
    const report = composeVerraVerificationReport(makeVerraProject(), makeCoverage());

    expect(report.registry).toBe('Verra');
    expect(report.title).toBe('VERRA READINESS REPORT');
    expect(report.status).toBe('ready');
  });

  it('produces VCS-specific section order from metadata', () => {
    const report = composeVerraVerificationReport(makeVerraProject(), makeCoverage());

    const sectionTitles = report.sections.map((s) => s.title);
    expect(sectionTitles).toContain('REPORT STATUS');
    expect(sectionTitles).toContain('METHODOLOGY SOURCE SECTIONS');
    expect(sectionTitles).toContain('APPLICABILITY CONDITIONS');
    expect(sectionTitles).toContain('PROJECT BOUNDARY');
    expect(sectionTitles).toContain('BASELINE SCENARIO');
    expect(sectionTitles).toContain('ADDITIONALITY');
    expect(sectionTitles).toContain('QUANTIFICATION OF REMOVALS');
    expect(sectionTitles).toContain('MONITORING');
    expect(sectionTitles).toContain('EVIDENCE REVIEWED');
    expect(sectionTitles).toContain('REQUIREMENT FINDINGS');
    expect(sectionTitles).toContain('LIMITATIONS');
    expect(sectionTitles).toContain('PROVENANCE');
  });

  it('includes VCS disclaimer language', () => {
    const report = composeVerraVerificationReport(makeVerraProject(), makeCoverage());

    const text = report.sections.flatMap((s) => s.lines).join(' ');
    expect(text).toMatch(/VCS|Verified Carbon Standard/);
    expect(text).not.toContain('registry_not_fully_supported');
    expect(text).not.toMatch(/fallback|stub|not yet implemented/i);
  });

  it('lists methodology sections from pack metadata', () => {
    const report = composeVerraVerificationReport(makeVerraProject(), makeCoverage());

    const overviewSection = report.sections.find((s) => s.title === 'METHODOLOGY SOURCE SECTIONS');
    expect(overviewSection).toBeDefined();
    const text = overviewSection!.lines.join(' ');
    expect(text).toContain('VM0047');
    expect(text).toContain('VCS');
    expect(text).toContain('AFOLU');
  });

  it('groups sections into applicability, boundary, baseline, additionality, quantification, monitoring', () => {
    const report = composeVerraVerificationReport(makeVerraProject(), makeCoverage());

    const applicabilitySection = report.sections.find((s) => s.title === 'APPLICABILITY CONDITIONS');
    const boundarySection = report.sections.find((s) => s.title === 'PROJECT BOUNDARY');
    const baselineSection = report.sections.find((s) => s.title === 'BASELINE SCENARIO');
    const additionalitySection = report.sections.find((s) => s.title === 'ADDITIONALITY');
    const quantificationSection = report.sections.find((s) => s.title === 'QUANTIFICATION OF REMOVALS');
    const monitoringSection = report.sections.find((s) => s.title === 'MONITORING');

    expect(applicabilitySection).toBeDefined();
    expect(boundarySection).toBeDefined();
    expect(baselineSection).toBeDefined();
    expect(additionalitySection).toBeDefined();
    expect(quantificationSection).toBeDefined();
    expect(monitoringSection).toBeDefined();
  });

  it('does not claim official VCS verification', () => {
    const report = composeVerraVerificationReport(makeVerraProject(), makeCoverage());

    const text = report.sections.flatMap((s) => s.lines).join(' ');
    const forbidden = [
      'VCUs issued',
      'verified successfully',
      'certification opinion: positive',
      'registry approved',
    ];
    for (const phrase of forbidden) {
      expect(text.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });

  it('falls back to generic composer when metadata cannot be loaded', () => {
    const project = makeVerraProject({ methodCategory: 'NonExistent', methodCode: 'UNKNOWN' });
    const report = composeVerraVerificationReport(project, makeCoverage());

    expect(report.registry).toBe('Verra');
    expect(report.title).toBe('VERRA READINESS REPORT');
    expect(report.sections.length).toBeGreaterThan(0);
  });

  it('includes provenance metadata', () => {
    const report = composeVerraVerificationReport(makeVerraProject(), makeCoverage());

    expect(report.provenance.some(([label]) => label === 'Registry')).toBe(true);
    expect(report.provenance.some(([label]) => label === 'Report status')).toBe(true);
    expect(report.provenance.some(([label]) => label === 'Project ID')).toBe(true);
  });

  it('produces deterministic output', () => {
    const project = makeVerraProject();
    const coverage = makeCoverage();
    const report1 = composeVerraVerificationReport(project, coverage);
    const report2 = composeVerraVerificationReport(project, coverage);

    expect(report1.sections.length).toBe(report2.sections.length);
    expect(report1.sections.map((s) => s.title)).toEqual(report2.sections.map((s) => s.title));
    for (let i = 0; i < report1.sections.length; i++) {
      expect(report1.sections[i].lines).toEqual(report2.sections[i].lines);
    }
  });
});
