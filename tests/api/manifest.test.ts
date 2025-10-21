import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { NextRequest } from 'next/server';

const loadManifestAllMock = jest.fn();

jest.mock('@/lib/manifestSource', () => ({
  loadManifestAll: (...args: unknown[]) => loadManifestAllMock(...args),
}));

import { GET as ManifestGET } from '@/app/api/manifest/route';
import { loadManifestAll } from '@/lib/manifestSource';

beforeEach(() => {
  loadManifestAllMock.mockReset();
  loadManifestAllMock.mockResolvedValue(
    Array.from({ length: 123 }, (_value, index) => ({ id: `mock-${index + 1}` })),
  );
});

describe('manifest source helper', () => {
  test('manifest source returns non-empty array', async () => {
    const data = await loadManifestAll();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });
});

describe('GET /api/manifest', () => {
  test('returns populated payload for ?all=1', async () => {
    loadManifestAllMock.mockResolvedValueOnce([{ id: 'demo-entry' }]);
    const res = await ManifestGET(new NextRequest('http://localhost/api/manifest?all=1'));
    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBeGreaterThan(0);
  });
});
