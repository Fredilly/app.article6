import { describe, expect, test, vi } from 'vitest';
import * as manifestMock from '../../__mocks__/lib/manifestSource';

vi.mock('@/lib/manifestSource', () => manifestMock);
import { NextRequest } from 'next/server';

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
