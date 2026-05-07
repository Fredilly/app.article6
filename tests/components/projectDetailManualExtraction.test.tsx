/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import ProjectDetail from '@/components/projects/ProjectDetail';
import type { Project } from '@/lib/projects/types';

function writeProjects(projects: Project[]) {
  window.localStorage.setItem('article6_projects', JSON.stringify(projects));
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-manual',
    name: 'Manual Review Workspace',
    reviewMode: 'manual',
    registry: 'Unknown',
    status: 'in-progress',
    createdAt: '2026-05-07T00:00:00.000Z',
    aoiLabel: 'Sample Area',
    description: 'Restored manual review extraction workflow',
    reviews: [],
    documents: [],
    manualFindings: [],
    extractedManualFindingDrafts: [],
    ...overrides,
  };
}

describe('ProjectDetail manual extraction workflow', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const originalFetch = global.fetch;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    window.localStorage.clear();
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      delete (global as { fetch?: typeof fetch }).fetch;
    }
    jest.clearAllMocks();
  });

  it('renders stored extraction messages, trace, and extracted drafts', async () => {
    writeProjects([
      makeProject({
        documents: [
          {
            id: 'doc-1',
            fileName: 'CCB_VERIF_REP_ENG_1530_01AUG2011_12DEC2020.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 2048,
            uploadedAt: '2026-05-07T00:00:00.000Z',
            extractedText: 'Appendix 1 CAR01 Requirement: Monitoring report shall reconcile totals.',
            manualFindingExtractionStatus: 'extracted',
            manualFindingExtractionMessage: '3 draft finding sections detected. Review before accepting.',
            manualFindingExtractionTrace: 'bundled-pdf-parse',
          },
        ],
        extractedManualFindingDrafts: [
          {
            id: 'draft-1',
            findingId: 'CAR01',
            findingType: 'CAR',
            requirement: 'Monitoring report shall reconcile totals.',
            description: 'Workbook totals do not reconcile.',
            sourceDocumentId: 'doc-1',
            sourcePageRange: '118-119',
            evidenceExcerpt: 'CAR01 Requirement: Monitoring report shall reconcile totals.',
            projectResponse: 'Revised workbook submitted.',
            documentationSubmitted: 'Workbook extract',
            auditTeamEvaluation: 'Cross-reference still missing.',
            closureStatus: 'open',
            extractionStatus: 'draft',
            extractionMessage: 'draft',
            createdAt: '2026-05-07T00:00:00.000Z',
            updatedAt: '2026-05-07T00:00:00.000Z',
          },
        ],
      }),
    ]);

    await act(async () => {
      root.render(<ProjectDetail projectId="proj-manual" />);
    });

    expect(container.textContent).toContain('Extraction Review');
    expect(container.textContent).toContain('3 draft finding sections detected. Review before accepting.');
    expect(container.textContent).toContain('Trace: bundled-pdf-parse');
    expect(container.textContent).toContain('CAR01');
    expect(container.textContent).toContain('Manual Findings');
  });

  it('calls the manual review extraction route on upload and keeps manual entry available on failure', async () => {
    writeProjects([makeProject()]);

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/projects/manual-review/extract-findings') {
        return new Response(JSON.stringify({
          text: '',
          drafts: [],
          message: 'Could not extract findings from this PDF. You can still add findings manually.',
          diagnosticSummary: 'likely scanned/image-only',
          extractionFailed: true,
        }), { status: 200 });
      }
      throw new Error(`Unhandled fetch ${url}`);
    }) as typeof fetch;

    await act(async () => {
      root.render(<ProjectDetail projectId="proj-manual" />);
    });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    const file = new File([new Uint8Array([37, 80, 68, 70])], 'CCB_VERIF_REP_ENG_1530_01AUG2011_12DEC2020.pdf', {
      type: 'application/pdf',
    });
    Object.defineProperty(file, 'arrayBuffer', {
      configurable: true,
      value: async () => new Uint8Array([37, 80, 68, 70]).buffer,
    });

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    });

    await act(async () => {
      input?.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/projects/manual-review/extract-findings',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/pdf',
        }),
      }),
    );
    expect(container.textContent).toContain('Could not extract findings from this PDF. You can still add findings manually. Reason: likely scanned/image-only.');
    expect(container.textContent).toContain('Add Review Item');

    const storedProjects = JSON.parse(window.localStorage.getItem('article6_projects') || '[]') as Project[];
    expect(storedProjects[0]?.documents[0]?.manualFindingExtractionStatus).toBe('extraction-failed');
  });
});
