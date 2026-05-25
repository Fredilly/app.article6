/**
 * @jest-environment jsdom
 */
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createRoot } from 'react-dom/client';
import { listProjects } from '@/lib/projects/storage';

const pushMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  useSearchParams: () => new URLSearchParams('handoff=quick-check-document'),
}));

const NewProjectForm = require('@/components/projects/NewProjectForm').default as typeof import('@/components/projects/NewProjectForm').default;

describe('NewProjectForm quick-check handoff', () => {
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
    window.localStorage.setItem('article6:pending-quick-check-project-handoff', JSON.stringify({
      projectName: 'Kasigau Monitoring Report',
      methodCode: 'VM0007',
      methodVersion: 'v1-8',
      description: 'Monitoring report uploaded through Quick Check.',
      sourceDocument: {
        fileName: 'kasigau-monitoring-report.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        contentSha256: 'sha-123',
        contentBase64: 'cGRm',
      },
      createdAt: '2026-05-25T00:00:00.000Z',
    }));

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

  it('creates a project draft from the staged document handoff and attaches the source file', async () => {
    await act(async () => {
      root.render(<NewProjectForm />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Create project draft from document');
    expect(container.textContent).toContain('kasigau-monitoring-report.pdf will be attached to this project');

    const submitButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Create Project Review'),
    ) as HTMLButtonElement | undefined;

    expect(submitButton).toBeDefined();
    await act(async () => {
      submitButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(pushMock).toHaveBeenCalledTimes(1);
    const projects = listProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0]?.documents).toHaveLength(1);
    expect(projects[0]?.documents[0]?.fileName).toBe('kasigau-monitoring-report.pdf');
  });
});
