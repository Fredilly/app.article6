import { describe, expect, it } from '@jest/globals';
import path from 'node:path';
import {
  loadEvidenceTaxonomy,
  loadAdoptionStatus,
  isReviewGrade,
  loadExpectedEvidence,
  loadExportMetadata,
  loadReviewGradeContract,
} from '@/lib/evidence/reviewGrade';

const VM0047_DIR = path.join(process.cwd(), 'public', 'methodologies', 'Verra', 'AFOLU', 'VM0047', 'v1-0');
const GS_DIR = path.join(process.cwd(), 'public', 'methodologies', 'GoldStandard', 'LUF', 'GS-00XX', 'v1-0');

describe('loadEvidenceTaxonomy', () => {
  it('returns an empty array when config/evidence-taxonomy.json does not exist', () => {
    const taxonomy = loadEvidenceTaxonomy();
    expect(Array.isArray(taxonomy)).toBe(true);
  });
});

describe('loadAdoptionStatus', () => {
  it('loads adoption status for VM0047 (review_grade)', () => {
    const status = loadAdoptionStatus(VM0047_DIR);
    expect(status).not.toBeNull();
    expect(status!.adoption_status).toBe('review_grade');
    expect(status!.version).toBe('review_contract_v1');
  });

  it('returns null when META.json is missing', () => {
    const status = loadAdoptionStatus('/tmp/non-existent-dir');
    expect(status).toBeNull();
  });
});

describe('isReviewGrade', () => {
  it('returns true when adoption_status is review_grade', () => {
    expect(isReviewGrade({ adoption_status: 'review_grade' })).toBe(true);
  });

  it('returns false for grade_a', () => {
    expect(isReviewGrade({ adoption_status: 'grade_a' })).toBe(false);
  });

  it('returns false for null input', () => {
    expect(isReviewGrade(null)).toBe(false);
  });

  it('returns false for empty status', () => {
    expect(isReviewGrade({ adoption_status: '' })).toBe(false);
  });
});

describe('loadExpectedEvidence', () => {
  it('loads expected evidence for VM0047', () => {
    const evidence = loadExpectedEvidence(VM0047_DIR);
    expect(evidence.length).toBeGreaterThan(0);
    for (const rule of evidence) {
      expect(rule.ruleId).toBeTruthy();
      expect(rule.expectedEvidence.length).toBeGreaterThan(0);
      for (const ee of rule.expectedEvidence) {
        expect(ee.label).toBeTruthy();
        expect(typeof ee.required).toBe('boolean');
      }
    }
  });

  it('loads expected evidence for GS-00XX', () => {
    const evidence = loadExpectedEvidence(GS_DIR);
    expect(evidence.length).toBeGreaterThan(0);
    for (const rule of evidence) {
      expect(rule.ruleId).toBeTruthy();
      for (const ee of rule.expectedEvidence) {
        expect(ee.label).toBeTruthy();
        expect(typeof ee.required).toBe('boolean');
      }
    }
  });

  it('returns empty array when rules.rich.json is missing', () => {
    const evidence = loadExpectedEvidence('/tmp/non-existent-dir');
    expect(evidence).toEqual([]);
  });
});

describe('loadExportMetadata', () => {
  it('loads Verra export metadata with section taxonomy', () => {
    const meta = loadExportMetadata('Verra');
    expect(meta).not.toBeNull();
    expect(meta!.standard).toBe('Verra');
    expect(meta!.section_taxonomy.length).toBeGreaterThan(0);
    for (const section of meta!.section_taxonomy) {
      expect(section.id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(Array.isArray(section.evidence_categories)).toBe(true);
    }
  });

  it('loads Gold Standard export metadata with section taxonomy', () => {
    const meta = loadExportMetadata('Gold Standard');
    expect(meta).not.toBeNull();
    expect(meta!.standard).toBe('Gold Standard');
    expect(meta!.section_taxonomy.length).toBeGreaterThan(0);
    for (const section of meta!.section_taxonomy) {
      expect(section.id).toBeTruthy();
      expect(section.evidence_categories).toBeDefined();
    }
  });

  it('returns null for unknown provider', () => {
    const meta = loadExportMetadata('NonExistentProvider');
    expect(meta).toBeNull();
  });
});

describe('loadReviewGradeContract', () => {
  it('loads full contract for VM0047', () => {
    const contract = loadReviewGradeContract('Verra', 'AFOLU', 'VM0047', 'v1-0');
    expect(contract).not.toBeNull();
    expect(contract!.provider).toBe('Verra');
    expect(contract!.methodCode).toBe('VM0047');
    expect(contract!.version).toBe('v1-0');
    expect(contract!.isReviewGrade).toBe(true);
    expect(contract!.adoptionStatus?.adoption_status).toBe('review_grade');
    expect(contract!.expectedEvidence.length).toBeGreaterThan(0);
    expect(contract!.exportMetadata).not.toBeNull();
    expect(contract!.exportMetadata!.standard).toBe('Verra');
  });

  it('loads full contract for GS-00XX via manifest-resolved path when category differs from filesystem', () => {
    const contract = loadReviewGradeContract('Gold Standard', 'AFOLU', 'GS-00XX', 'v1-0');
    expect(contract).not.toBeNull();
    expect(contract!.provider).toBe('Gold Standard');
    expect(contract!.methodCode).toBe('GS-00XX');
    expect(contract!.category).toBe('AFOLU');
    expect(contract!.expectedEvidence.length).toBeGreaterThan(0);
    expect(contract!.exportMetadata).not.toBeNull();
    expect(contract!.exportMetadata!.standard).toBe('Gold Standard');
  });

  it('still loads GS-00XX when category matches filesystem path segment', () => {
    const contract = loadReviewGradeContract('Gold Standard', 'LUF', 'GS-00XX', 'v1-0');
    expect(contract).not.toBeNull();
    expect(contract!.provider).toBe('Gold Standard');
    expect(contract!.methodCode).toBe('GS-00XX');
    expect(contract!.expectedEvidence.length).toBeGreaterThan(0);
    expect(contract!.exportMetadata).not.toBeNull();
    expect(contract!.exportMetadata!.standard).toBe('Gold Standard');
  });

  it('returns null when method directory does not exist', () => {
    const contract = loadReviewGradeContract('Verra', 'NonExistent', 'UNKNOWN', 'v0-0');
    expect(contract).toBeNull();
  });

  it('taxonomy is always an array (may be empty if pack config missing)', () => {
    const contract = loadReviewGradeContract('Verra', 'AFOLU', 'VM0047', 'v1-0');
    expect(Array.isArray(contract!.taxonomy)).toBe(true);
  });
});
