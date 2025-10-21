import { describe, expect, test } from '@jest/globals';

jest.mock('@/lib/manifestSource');

import { loadManifestAll } from '@/lib/manifestSource';

describe('manifest source helper', () => {
  test('manifest source returns non-empty array', async () => {
    const data = await loadManifestAll();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });
});
