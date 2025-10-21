import { describe, expect, test } from '@jest/globals';
import { NextRequest } from 'next/server';

jest.mock('@/lib/manifestSource');

import { GET as HealthGET } from '@/app/api/manifest/health/route';

describe('GET /api/manifest/health', () => {
  test('GET /api/manifest/health reports count', async () => {
    const req = new NextRequest('http://localhost/api/manifest/health');
    const res = await HealthGET(req);
    const json = await res.json();
    expect(json.count).toBeGreaterThan(0);
    expect(typeof json.updatedAt).toBe('string');
  });
});
