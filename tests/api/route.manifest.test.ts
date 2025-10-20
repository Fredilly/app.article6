import { describe, expect, test, vi } from 'vitest';
import * as manifestMock from '../../__mocks__/lib/manifestSource';

vi.mock('@/lib/manifestSource', () => manifestMock);
import { NextRequest } from 'next/server';

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
