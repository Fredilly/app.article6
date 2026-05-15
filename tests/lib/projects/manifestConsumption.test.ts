import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { projectRegistryFromMethodProgram, normalizeRegistry, resolveProjectRegistry } from '@/lib/projects/verificationReport';

const manifestPath = path.join(process.cwd(), 'public', 'manifest', 'index.json');

type ManifestEntry = {
  id: string;
  methodology: string;
  version: string;
  rule: string;
  provider?: string;
  category?: string;
  path?: string;
  sectionId?: string;
};

function loadManifest(): ManifestEntry[] {
  const raw = readFileSync(manifestPath, 'utf8');
  return JSON.parse(raw);
}

describe('manifest consumption — phase 1 audit', () => {
  const manifest = loadManifest();

  it('loads manifest entries', () => {
    expect(Array.isArray(manifest)).toBe(true);
    expect(manifest.length).toBeGreaterThan(0);
  });

  it('all entries have a known provider', () => {
    const providers = new Set(manifest.map((e) => e.provider));
    for (const p of providers) {
      expect(['UNFCCC', 'Verra', 'Gold Standard', undefined]).toContain(p);
    }
  });

  it('all entries have methodology, version, and id', () => {
    for (const entry of manifest) {
      expect(entry.methodology).toBeTruthy();
      expect(entry.version).toBeTruthy();
      expect(entry.id).toBeTruthy();
    }
  });

  it('all entries have a valid program derived from provider/category', () => {
    for (const entry of manifest) {
      const program = `${entry.provider || ''}/${entry.category || ''}`.replace(/^\//, '') || 'Unknown';
      expect(program).toBeTruthy();
      if (entry.provider) {
        expect(program.startsWith(entry.provider)).toBe(true);
      }
    }
  });

  it('all entries have a path pointing to rules artifact', () => {
    for (const entry of manifest) {
      expect(entry.path).toBeTruthy();
      expect(typeof entry.path).toBe('string');
      expect(entry.path).toContain(entry.methodology);
      expect(entry.path).toContain(entry.version);
    }
  });

  it('program format is {provider}/{category} for all entries', () => {
    for (const entry of manifest) {
      const program = `${entry.provider || ''}/${entry.category || ''}`.replace(/^\//, '') || 'Unknown';
      expect(program.split('/').length).toBeGreaterThanOrEqual(1);
      expect(program.split('/')[0]).toBe(entry.provider || 'Unknown');
    }
  });

  it('normalizeRegistry resolves provider correctly for all entries', () => {
    for (const entry of manifest) {
      if (!entry.provider) continue;
      const registry = normalizeRegistry(entry.provider);
      expect(registry).not.toBe('Unknown');
      expect(['UNFCCC', 'Verra', 'Gold Standard']).toContain(registry);
    }
  });

  it('currently only UNFCCC entries exist (no Verra/Gold Standard)', () => {
    const providers = new Set(manifest.map((e) => e.provider));
    expect(providers).toEqual(new Set(['UNFCCC']));
  });

  it('from now on, any new provider must resolve via normalizeRegistry', () => {
    for (const entry of manifest) {
      if (!entry.provider) continue;
      const registry = normalizeRegistry(entry.provider);
      expect(registry).not.toBe('Unknown');
    }
  });
});

describe('program-derived registry inference', () => {
  it('projectRegistryFromMethodProgram parses UNFCCC/Forestry', () => {
    expect(projectRegistryFromMethodProgram('UNFCCC/Forestry')).toBe('UNFCCC');
  });

  it('projectRegistryFromMethodProgram parses Verra/Forestry', () => {
    expect(projectRegistryFromMethodProgram('Verra/Forestry')).toBe('Verra');
  });

  it('projectRegistryFromMethodProgram parses Gold Standard/Energy', () => {
    expect(projectRegistryFromMethodProgram('Gold Standard/Energy')).toBe('Gold Standard');
  });

  it('projectRegistryFromMethodProgram returns Unknown for empty', () => {
    expect(projectRegistryFromMethodProgram(undefined)).toBe('Unknown');
    expect(projectRegistryFromMethodProgram('')).toBe('Unknown');
  });
});

describe('resolveProjectRegistry method-code fallback', () => {
  it('VM prefix resolves to Verra', () => {
    expect(resolveProjectRegistry({ methodCode: 'VM0007' })).toBe('Verra');
  });

  it('VMR prefix resolves to Verra', () => {
    expect(resolveProjectRegistry({ methodCode: 'VMR001' })).toBe('Verra');
  });

  it('GS prefix resolves to Gold Standard', () => {
    expect(resolveProjectRegistry({ methodCode: 'GS-VER1' })).toBe('Gold Standard');
  });

  it('AR/AM/ACM/SSC/TOOL resolve to UNFCCC', () => {
    expect(resolveProjectRegistry({ methodCode: 'AR-ACM0003' })).toBe('UNFCCC');
    expect(resolveProjectRegistry({ methodCode: 'AM0001' })).toBe('UNFCCC');
    expect(resolveProjectRegistry({ methodCode: 'ACM0001' })).toBe('UNFCCC');
    expect(resolveProjectRegistry({ methodCode: 'SSC-001' })).toBe('UNFCCC');
    expect(resolveProjectRegistry({ methodCode: 'TOOL01' })).toBe('UNFCCC');
  });

  it('UNFCCC. prefix resolves to UNFCCC', () => {
    expect(resolveProjectRegistry({ methodCode: 'UNFCCC.AR-ACM0003' })).toBe('UNFCCC');
  });

  it('explicit registry takes priority over method-code fallback', () => {
    expect(resolveProjectRegistry({ methodCode: 'VM0007', registry: 'UNFCCC' })).toBe('UNFCCC');
    expect(resolveProjectRegistry({ methodCode: 'AR-ACM0003', registry: 'Verra' })).toBe('Verra');
  });

  it('empty methodCode resolves to Unknown', () => {
    expect(resolveProjectRegistry({ methodCode: '' })).toBe('Unknown');
    expect(resolveProjectRegistry({ methodCode: undefined })).toBe('Unknown');
  });
});

describe('normalizeRegistry edge cases', () => {
  it('handles various UNFCCC inputs', () => {
    expect(normalizeRegistry('UNFCCC')).toBe('UNFCCC');
    expect(normalizeRegistry('unfccc')).toBe('UNFCCC');
    expect(normalizeRegistry('Unfccc')).toBe('UNFCCC');
    expect(normalizeRegistry('CDM')).toBe('UNFCCC');
    expect(normalizeRegistry('cdm')).toBe('UNFCCC');
  });

  it('handles various Verra inputs', () => {
    expect(normalizeRegistry('Verra')).toBe('Verra');
    expect(normalizeRegistry('verra')).toBe('Verra');
    expect(normalizeRegistry('Verified Carbon Standard')).toBe('Verra');
    expect(normalizeRegistry('verified carbon standard')).toBe('Verra');
    expect(normalizeRegistry('VCS')).toBe('Verra');
    expect(normalizeRegistry('vcs')).toBe('Verra');
  });

  it('handles various Gold Standard inputs', () => {
    expect(normalizeRegistry('Gold Standard')).toBe('Gold Standard');
    expect(normalizeRegistry('gold standard')).toBe('Gold Standard');
    expect(normalizeRegistry('gold-standard')).toBe('Gold Standard');
    expect(normalizeRegistry('GS')).toBe('Gold Standard');
    expect(normalizeRegistry('gs')).toBe('Gold Standard');
  });

  it('returns Unknown for unrecognized inputs', () => {
    expect(normalizeRegistry('')).toBe('Unknown');
    expect(normalizeRegistry(undefined)).toBe('Unknown');
    expect(normalizeRegistry('Some Other Registry')).toBe('Unknown');
    expect(normalizeRegistry('ACR')).toBe('Unknown');
    expect(normalizeRegistry('CAR')).toBe('Unknown');
  });
});
