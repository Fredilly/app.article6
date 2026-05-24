/**
 * @jest-environment jsdom
 */
import { beforeEach, describe, expect, it } from '@jest/globals';
import { getProject, getProjectCoverage } from '@/lib/projects/storage';
import {
  importMethodologyReviewIntoProject,
  readPendingProjectReviewHandoff,
  stagePendingProjectReviewHandoff,
} from '@/lib/projects/reviewHandoff';
import { savePins } from '@/lib/proofMap/storage';
import type { EvidencePin } from '@/lib/proofMap/types';
import { saveReview } from '@/lib/verify/reviewStore';
import {
  createReviewerArtifactContext,
  persistLinkedRuleIds,
  persistReviewerArtifactState,
  persistVerifierRunBundle,
  readReviewerArtifactState,
  readVerifierRunBundle,
  buildLinkedRulesKey,
} from '@/lib/verify/runState';

describe('project review handoff', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('imports existing VM0007 methodology review work into the created project workspace', () => {
    const methodCode = 'VM0007';
    const methodVersion = 'v1-8';
    const sourceBundle = readVerifierRunBundle(methodCode, methodVersion);
    const sourceContext = createReviewerArtifactContext({
      methodCode,
      version: methodVersion,
      ruleId: 'R-1-0001',
      runId: sourceBundle.runContext.runId,
    });
    const sourcePins: EvidencePin[] = [
      {
        id: 'pin-boundary',
        kind: 'pdd',
        title: 'PLUM boundary evidence',
        cited_ids: ['R-1-0001'],
        created_at: '2026-05-24T00:00:00.000Z',
        pdd_fragment_links: [
          {
            fragment_id: 'frag-boundary',
            rule_id: 'R-1-0001',
            linked_at: '2026-05-24T00:01:00.000Z',
          },
        ],
      },
    ];

    savePins(methodCode, methodVersion, sourcePins);
    persistLinkedRuleIds(buildLinkedRulesKey(methodCode, methodVersion), ['R-1-0001']);
    persistVerifierRunBundle(
      methodCode,
      methodVersion,
      {
        ...sourceBundle,
        draftMinutes: 'Saved reviewer minutes for VM0007 before project creation.',
        draftOutcomeNote: 'Verified with caveats before project creation.',
        minutes: 'Saved reviewer minutes for VM0007 before project creation.',
        outcomeNote: 'Verified with caveats before project creation.',
        savedReviewerArtifactAt: '2026-05-24T00:04:00.000Z',
        savedReviewerArtifactContext: sourceContext,
        reviewerContext: sourceContext,
      },
    );
    persistReviewerArtifactState({
      context: sourceContext,
      savedReviewerArtifactAt: '2026-05-24T00:04:00.000Z',
      minutes: 'Saved reviewer minutes for VM0007 before project creation.',
      outcomeNote: 'Verified with caveats before project creation.',
      draftMinutes: 'Saved reviewer minutes for VM0007 before project creation.',
      draftOutcomeNote: 'Verified with caveats before project creation.',
    });
    saveReview({
      ruleId: 'R-1-0001',
      methodology: methodCode,
      version: methodVersion,
      runId: sourceBundle.runContext.runId,
      status: 'verified',
      rationale: 'Document evidence supports the boundary claim.',
      supportReference: 'PDD boundary map fragment',
      evidenceAttachments: [],
      reviewedBy: 'reviewer@app.article6',
      reviewedAt: '2026-05-24T00:03:00.000Z',
      updatedAt: '2026-05-24T00:03:00.000Z',
      reviewerArtifactSavedAt: '2026-05-24T00:04:00.000Z',
      reviewerMinutes: 'Saved reviewer minutes for VM0007 before project creation.',
      reviewerOutcomeNote: 'Verified with caveats before project creation.',
    });

    const staged = stagePendingProjectReviewHandoff({ methodCode, methodVersion });
    expect(staged).not.toBeNull();
    expect(readPendingProjectReviewHandoff()?.source.methodCode).toBe('VM0007');

    const result = importMethodologyReviewIntoProject({
      handoff: staged!,
      projectFields: {
        name: 'PLUM Project Review',
        projectCode: 'VCS-1530',
        reportingPeriod: '2024',
        registry: 'Verra',
      },
      rules: [
        { id: 'R-1-0001', title: 'Boundary must be documented', sectionId: 'S-1' },
        { id: 'R-1-0002', title: 'Monitoring must be described', sectionId: 'S-2' },
      ],
    });

    expect(result.href).toContain('/m/VM0007/v/v1-8?');
    expect(result.href).toContain(`projectId=${encodeURIComponent(result.project.id)}`);
    expect(result.href).toContain(`workspaceId=${encodeURIComponent(result.workspace.id)}`);
    expect(result.href).toContain('tab=verify');

    const importedProject = getProject(result.project.id);
    expect(importedProject).toBeDefined();
    const coverage = getProjectCoverage(importedProject!);
    expect(coverage.percentComplete).toBeGreaterThan(0);
    expect(importedProject?.reviews.find((review) => review.ruleId === 'R-1-0001')?.status).toBe('verified');

    const importedBundle = readVerifierRunBundle(methodCode, methodVersion, result.workspace.id);
    expect(importedBundle.draftMinutes).toBe('Saved reviewer minutes for VM0007 before project creation.');
    expect(importedBundle.draftOutcomeNote).toBe('Verified with caveats before project creation.');

    const importedArtifact = readReviewerArtifactState({
      ...sourceContext,
      workspaceId: result.workspace.id,
    });
    expect(importedArtifact?.minutes).toBe('Saved reviewer minutes for VM0007 before project creation.');
    expect(importedArtifact?.outcomeNote).toBe('Verified with caveats before project creation.');
  });
});
