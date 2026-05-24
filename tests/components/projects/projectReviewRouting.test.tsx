/**
 * @jest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import ProjectsList from '@/components/projects/ProjectsList';
import type { Project } from '@/lib/projects/types';
import type { ReviewWorkspace } from '@/lib/reviewWorkspaces/types';

function writeProjects(projects: Project[]) {
  window.localStorage.setItem('article6_projects', JSON.stringify(projects));
}

function writeWorkspaces(workspaces: ReviewWorkspace[]) {
  window.localStorage.setItem('article6_review_workspaces', JSON.stringify(workspaces));
}

describe('project review routing', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

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
    window.sessionStorage.clear();
  });

  it('uses the project methodology workspace for Start review and does not show 0% when imported rule reviews already exist', async () => {
    writeProjects([
      {
        id: 'proj-vm0007',
        name: 'PLUM Project Review',
        projectCode: 'VCS-1530',
        reviewMode: 'methodology-linked',
        methodCode: 'VM0007',
        methodVersion: 'v1-8',
        registry: 'Verra',
        status: 'in-progress',
        createdAt: '2026-05-24T00:00:00.000Z',
        lastWorkspaceId: 'ws-vm0007',
        reviews: [
          {
            ruleId: 'R-1-0001',
            ruleTitle: 'Boundary must be documented',
            sectionId: 'S-1',
            status: 'verified',
            evidenceIds: ['pin-boundary'],
            reviewedAt: '2026-05-24T00:02:00.000Z',
          },
          {
            ruleId: 'R-1-0002',
            ruleTitle: 'Monitoring must be described',
            sectionId: 'S-2',
            status: 'not-started',
            evidenceIds: [],
          },
        ],
        documents: [],
        manualFindings: [],
        extractedManualFindingDrafts: [],
        learningCases: [],
      },
    ]);
    writeWorkspaces([
      {
        id: 'ws-vm0007',
        name: 'PLUM Project Review · VM0007 v1-8 review',
        projectId: 'proj-vm0007',
        methodCode: 'VM0007',
        methodVersion: 'v1-8',
        status: 'draft',
        createdAt: '2026-05-24T00:00:00.000Z',
        updatedAt: '2026-05-24T00:00:00.000Z',
      },
    ]);

    await act(async () => {
      root.render(<ProjectsList />);
    });

    const percentageDisplay = Array.from(container.querySelectorAll('div')).find((node) => node.textContent?.trim() === '50%');
    expect(percentageDisplay).toBeTruthy();

    const anchors = Array.from(container.querySelectorAll('a'));
    const startReview = anchors.find((anchor) => anchor.textContent?.trim() === 'Start review');
    expect(startReview?.getAttribute('href')).toBe('/m/VM0007/v/v1-8?projectId=proj-vm0007&workspaceId=ws-vm0007&tab=verify');
    expect(startReview?.getAttribute('href')).not.toContain('ACM0010');
    expect(startReview?.getAttribute('href')).not.toBe('/m?projectId=proj-vm0007');
  });
});
