/**
 * @jest-environment jsdom
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import MethodLibraryPanel from '@/app/m/_components/MethodLibraryPanel';
import type { MethodInventoryItem } from '@/app/m/_lib/methodInventory';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    prefetch: jest.fn(),
  }),
}));

jest.mock('@/app/m/_components/MethodCard', () => ({
  __esModule: true,
  default: ({ method }: { method: MethodInventoryItem }) => <div data-method-card={method.code}>{method.code}</div>,
}));

function method(overrides: Partial<MethodInventoryItem>): MethodInventoryItem {
  return {
    code: overrides.code ?? 'UNKNOWN',
    program: overrides.program ?? 'UNFCCC',
    sector: overrides.sector ?? 'Forestry',
    versions: overrides.versions ?? ['v1-0'],
    manifestPathByVersion: overrides.manifestPathByVersion ?? { 'v1-0': 'methodologies/UNFCCC/Forestry/UNKNOWN/v1-0/rules.json' },
    latestVersion: overrides.latestVersion ?? 'v1-0',
    versionCount: overrides.versionCount ?? 1,
    ruleCountByVersion: overrides.ruleCountByVersion ?? { 'v1-0': 3 },
    hasRich: overrides.hasRich ?? false,
    hasPrevious: overrides.hasPrevious ?? false,
    versionAuditHashes: overrides.versionAuditHashes ?? {},
  };
}

describe('MethodLibraryPanel', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    global.fetch = jest.fn(async () => ({ ok: false })) as typeof global.fetch;
  });

  it('renders the Gold Standard filter with gold styling when active', () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(
        <MethodLibraryPanel
          selectedCode={null}
          methods={[
            method({
              code: 'GS-00XX',
              program: 'GoldStandard',
              sector: 'AFOLU',
              manifestPathByVersion: {
                'v1-0': 'methodologies/GoldStandard/LUF/GS-00XX/v1-0/rules.json',
              },
            }),
            method({ code: 'VM0007', program: 'Verra', sector: 'AFOLU' }),
          ]}
        />,
      );
    });

    const goldButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Gold Standard');
    expect(goldButton).toBeTruthy();

    act(() => {
      goldButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(goldButton!.className).toContain('bg-amber-100');
    expect(goldButton!.className).toContain('text-amber-900');
    expect(container.querySelector('[data-method-card="GS-00XX"]')).toBeTruthy();
    expect(container.querySelector('[data-method-card="VM0007"]')).toBeNull();

    act(() => root.unmount());
  });
});
