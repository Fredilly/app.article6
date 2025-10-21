import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { NextRequest } from 'next/server';

const loadManifestAllMock = jest.fn();

jest.mock('@/lib/manifestSource', () => ({
  loadManifestAll: (...args: unknown[]) => loadManifestAllMock(...args),
}));

import { GET as HealthGET } from '@/app/api/manifest/health/route';

beforeEach(() => {
  loadManifestAllMock.mockReset();
  loadManifestAllMock.mockResolvedValue([{ id: 'manifest-entry' }]);
});

describe('GET /api/manifest/health', () => {
  test('GET /api/manifest/health reports count', async () => {
    const req = new NextRequest('http://localhost/api/manifest/health');
    const res = await HealthGET(req);
    const json = await res.json();
    expect(json.count).toBeGreaterThan(0);
    expect(typeof json.updatedAt).toBe('string');
    expect(typeof json.engineUrl).toBe('string');
  });
});
