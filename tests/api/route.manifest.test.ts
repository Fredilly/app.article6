import { describe, expect, test } from '@jest/globals';
import { NextRequest } from 'next/server';

jest.mock('@/lib/manifestSource');

import { GET as ManifestGET } from '@/app/api/manifest/route';

describe('GET /api/manifest', () => {
  test('GET /api/manifest?all=1 returns populated array', async () => {
    const req = new NextRequest('http://localhost/api/manifest?all=1');
    const res = await ManifestGET(req);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBeGreaterThan(0);
  });
});
