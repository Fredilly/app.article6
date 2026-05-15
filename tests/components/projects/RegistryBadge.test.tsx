/**
 * @jest-environment jsdom
 */
import { describe, expect, it } from '@jest/globals';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { ProjectRegistry } from '@/lib/projects/types';
import { RegistryBadge } from '@/components/projects/ProjectDetail';

function renderBadge(registry: ProjectRegistry): HTMLElement {
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => root.render(<RegistryBadge registry={registry} />));
  const el = container.firstElementChild as HTMLElement;
  act(() => root.unmount());
  return el;
}

describe('RegistryBadge', () => {
  it('renders UNFCCC badge', () => {
    const el = renderBadge('UNFCCC');
    expect(el.tagName).toBe('SPAN');
    expect(el.textContent).toBe('UNFCCC');
    expect(el.className).toContain('bg-slate-100');
  });

  it('renders Verra badge', () => {
    const el = renderBadge('Verra');
    expect(el.textContent).toBe('Verra');
    expect(el.className).toContain('bg-blue-100');
  });

  it('renders Gold Standard badge', () => {
    const el = renderBadge('Gold Standard');
    expect(el.textContent).toBe('Gold Standard');
    expect(el.className).toContain('bg-amber-100');
  });

  it('renders Unknown badge', () => {
    const el = renderBadge('Unknown');
    expect(el.textContent).toBe('Unknown');
    expect(el.className).toContain('bg-red-100');
  });
});
