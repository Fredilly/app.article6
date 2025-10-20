import { describe, expect, test, vi } from 'vitest';
import * as manifestMock from '../../__mocks__/lib/manifestSource';

vi.mock('@/lib/manifestSource', () => manifestMock);
import { loadManifestAll } from '@/lib/manifestSource';

describe('manifest source helper', () => {
  test('manifest source returns non-empty array', async () => {
    const data = await loadManifestAll();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });
});
