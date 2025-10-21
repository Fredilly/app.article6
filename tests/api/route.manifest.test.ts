import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { NextRequest } from 'next/server';

const loadManifestAllMock = jest.fn();

jest.mock('@/lib/manifestSource', () => ({
  loadManifestAll: (...args: unknown[]) => loadManifestAllMock(...args),
}));

import { GET as ManifestGET } from '@/app/api/manifest/route';

beforeEach(() => {
  loadManifestAllMock.mockReset();
  loadManifestAllMock.mockResolvedValue([{ id: 'manifest-entry' }]);
});

describe('GET /api/manifest', () => {
  test('GET /api/manifest?all=1 returns populated array', async () => {
    const req = new NextRequest('http://localhost/api/manifest?all=1');
    const res = await ManifestGET(req);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBeGreaterThan(0);
  });
});
