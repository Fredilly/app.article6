/**
 * @jest-environment jsdom
 */
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createRoot } from 'react-dom/client';
import { saveReview } from '@/lib/verify/reviewStore';
import { persistVerifierRunBundle, readVerifierRunBundle } from '@/lib/verify/runState';
import { stagePendingProjectReviewHandoff } from '@/lib/projects/reviewHandoff';

const pushMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  useSearchParams: () => new URLSearchParams('handoff=active-review'),
}));

const NewProjectForm = require('@/components/projects/NewProjectForm').default as typeof import('@/components/projects/NewProjectForm').default;

describe('NewProjectForm handoff', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const originalFetch = global.fetch;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    pushMock.mockReset();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    window.localStorage.clear();
    window.sessionStorage.clear();
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      delete (global as { fetch?: typeof fetch }).fetch;
    }
  });

  it('creates a project from an active methodology review and routes directly back to the VM0007 verify workspace', async () => {
    const methodCode = 'VM0007';
    const methodVersion = 'v1-8';
    const bundle = readVerifierRunBundle(methodCode, methodVersion);
    persistVerifierRunBundle(methodCode, methodVersion, {
      ...bundle,
      draftMinutes: 'Draft reviewer minutes carried into the project.',
      draftOutcomeNote: 'Outcome note carried into the project.',
    });
    saveReview({
      ruleId: 'R-1-0001',
      methodology: methodCode,
      version: methodVersion,
      runId: bundle.runContext.runId,
      status: 'verified',
      rationale: 'Boundary evidence already reviewed.',
      supportReference: 'Boundary map',
      evidenceAttachments: [],
      reviewedBy: 'reviewer@app.article6',
      reviewedAt: '2026-05-24T00:03:00.000Z',
      updatedAt: '2026-05-24T00:03:00.000Z',
      reviewerArtifactSavedAt: '2026-05-24T00:04:00.000Z',
      reviewerMinutes: 'Draft reviewer minutes carried into the project.',
      reviewerOutcomeNote: 'Outcome note carried into the project.',
    });
    stagePendingProjectReviewHandoff({ methodCode, methodVersion });

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/projects/methods') {
        return new Response(JSON.stringify({
          methods: [
            { code: 'VM0007', program: 'Verra/Forestry', version: 'v1-8', ruleCount: 2 },
          ],
        }), { status: 200 });
      }
      if (url === '/api/projects/method-rules?code=VM0007&version=v1-8') {
        return new Response(JSON.stringify({
          rules: [
            { id: 'R-1-0001', title: 'Boundary must be documented', sectionId: 'S-1' },
            { id: 'R-1-0002', title: 'Monitoring must be described', sectionId: 'S-2' },
          ],
        }), { status: 200 });
      }
      throw new Error(`Unhandled fetch ${url}`);
    }) as typeof fetch;

    await act(async () => {
      root.render(<NewProjectForm />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const nameInput = container.querySelector('input[required]') as HTMLInputElement | null;
    expect(nameInput).not.toBeNull();
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setValue?.call(nameInput!, 'PLUM Project Review');
      nameInput!.dispatchEvent(new Event('change', { bubbles: true }));
      nameInput!.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const submitButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Create Project Review'),
    ) as HTMLButtonElement | undefined;
    expect(submitButton).toBeDefined();
    expect(submitButton?.disabled).toBe(false);

    await act(async () => {
      submitButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(pushMock).toHaveBeenCalledTimes(1);
    const href = pushMock.mock.calls[0]?.[0] ?? '';
    expect(href).toContain('/m/VM0007/v/v1-8?');
    expect(href).toContain('projectId=');
    expect(href).toContain('workspaceId=');
    expect(href).toContain('tab=verify');
    expect(href).not.toContain('ACM0010');
    expect(href).not.toBe('/m');
  });
});
