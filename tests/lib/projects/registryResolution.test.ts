import { describe, expect, it } from '@jest/globals';
import {
  normalizeRegistry,
  resolveProjectRegistry,
  projectRegistryFromMethodProgram,
} from '@/lib/projects/verificationReport';
import type { Project } from '@/lib/projects/types';

describe('normalizeRegistry — Gold Standard detection', () => {
  it('returns Gold Standard for "gold standard" verbatim', () => {
    expect(normalizeRegistry('gold standard')).toBe('Gold Standard');
  });

  it('returns Gold Standard for uppercase "Gold Standard"', () => {
    expect(normalizeRegistry('Gold Standard')).toBe('Gold Standard');
  });

  it('returns Gold Standard for mixed case "GOLD STANDARD"', () => {
    expect(normalizeRegistry('GOLD STANDARD')).toBe('Gold Standard');
  });

  it('returns Gold Standard for hyphenated "gold-standard"', () => {
    expect(normalizeRegistry('gold-standard')).toBe('Gold Standard');
  });

  it('returns Gold Standard for abbreviation "gs"', () => {
    expect(normalizeRegistry('gs')).toBe('Gold Standard');
  });

  it('returns Gold Standard for uppercase "GS"', () => {
    expect(normalizeRegistry('GS')).toBe('Gold Standard');
  });

  it('returns Gold Standard for "Gold Standard/LUF" (provider/category format)', () => {
    expect(normalizeRegistry('Gold Standard')).toBe('Gold Standard');
  });

  it('returns Unknown for empty input', () => {
    expect(normalizeRegistry('')).toBe('Unknown');
  });

  it('returns Unknown for undefined input', () => {
    expect(normalizeRegistry(undefined)).toBe('Unknown');
  });

  it('returns Unknown for unrelated values', () => {
    expect(normalizeRegistry('Other')).toBe('Unknown');
  });

  it('does not confuse "verra" with "gold standard"', () => {
    expect(normalizeRegistry('verra')).toBe('Verra');
    expect(normalizeRegistry('Verra')).toBe('Verra');
  });

  it('does not confuse "unfccc" / "cdm" with gold standard', () => {
    expect(normalizeRegistry('UNFCCC')).toBe('UNFCCC');
    expect(normalizeRegistry('cdm')).toBe('UNFCCC');
  });
});

describe('resolveProjectRegistry — Gold Standard detection', () => {
  function makeProject(overrides: Partial<Pick<Project, 'methodCode' | 'registry'>> = {}): Pick<Project, 'methodCode' | 'registry'> {
    return {
      methodCode: 'GS-VER1',
      registry: 'Gold Standard',
      ...overrides,
    };
  }

  it('uses explicit registry when set to Gold Standard', () => {
    expect(resolveProjectRegistry(makeProject({ registry: 'Gold Standard' }))).toBe('Gold Standard');
  });

  it('detects Gold Standard from GS- prefixed method codes', () => {
    expect(resolveProjectRegistry(makeProject({ registry: 'Unknown', methodCode: 'GS-VER1' }))).toBe('Gold Standard');
  });

  it('detects Gold Standard from GS prefix without hyphen', () => {
    expect(resolveProjectRegistry(makeProject({ registry: 'Unknown', methodCode: 'GS0001' }))).toBe('Gold Standard');
  });

  it('detects Gold Standard from method code containing GOLD STANDARD', () => {
    expect(resolveProjectRegistry(makeProject({ registry: 'Unknown', methodCode: 'GOLD STANDARD TPDDTEC' }))).toBe('Gold Standard');
  });

  it('does not confuse VM prefix (Verra) with GS', () => {
    expect(resolveProjectRegistry(makeProject({ registry: 'Unknown', methodCode: 'VM0007' }))).toBe('Verra');
  });

  it('does not confuse UNFCCC AR prefix with GS', () => {
    expect(resolveProjectRegistry(makeProject({ registry: 'Unknown', methodCode: 'AR-ACM0003' }))).toBe('UNFCCC');
  });

  it('returns Unknown when code does not match any known pattern', () => {
    expect(resolveProjectRegistry(makeProject({ registry: 'Unknown', methodCode: 'OTHER-XYZ' }))).toBe('Unknown');
  });

  it('handles empty methodCode without crashing', () => {
    expect(resolveProjectRegistry(makeProject({ registry: 'Unknown', methodCode: '' }))).toBe('Unknown');
  });
});

describe('projectRegistryFromMethodProgram — Gold Standard', () => {
  it('maps "Gold Standard/LUF" to Gold Standard', () => {
    expect(projectRegistryFromMethodProgram('Gold Standard/LUF')).toBe('Gold Standard');
  });

  it('maps "GS/Energy" to Gold Standard', () => {
    expect(projectRegistryFromMethodProgram('GS/Energy')).toBe('Gold Standard');
  });

  it('maps "gold-standard/Agriculture" to Gold Standard', () => {
    expect(projectRegistryFromMethodProgram('gold-standard/Agriculture')).toBe('Gold Standard');
  });

  it('maps "Gold Standard" (no category) to Gold Standard', () => {
    expect(projectRegistryFromMethodProgram('Gold Standard')).toBe('Gold Standard');
  });

  it('maps "GS" alone to Gold Standard', () => {
    expect(projectRegistryFromMethodProgram('GS')).toBe('Gold Standard');
  });

  it('maps "Verra/AFOLU" to Verra (not GS)', () => {
    expect(projectRegistryFromMethodProgram('Verra/AFOLU')).toBe('Verra');
  });

  it('maps "UNFCCC/Forestry" to UNFCCC (not GS)', () => {
    expect(projectRegistryFromMethodProgram('UNFCCC/Forestry')).toBe('UNFCCC');
  });

  it('returns Unknown for undefined program', () => {
    expect(projectRegistryFromMethodProgram(undefined)).toBe('Unknown');
  });

  it('returns Unknown for empty program', () => {
    expect(projectRegistryFromMethodProgram('')).toBe('Unknown');
  });
});
