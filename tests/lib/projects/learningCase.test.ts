/** @jest-environment jsdom */

import { describe, expect, it } from '@jest/globals';
import { buildManualReviewLearningCase } from '@/lib/projects/learningCase';
import { recordManualReviewLearningCase } from '@/lib/projects/storage';
import type { Project } from '@/lib/projects/types';

function makeManualProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-manual-learning',
    name: 'Verra Reconstruction Workspace',
    reviewMode: 'manual',
    registry: 'Unknown',
    status: 'locked',
    createdAt: '2026-05-07T00:00:00.000Z',
    reviews: [],
    documents: [
      {
        id: 'doc-1',
        fileName: 'CCB_VERIF_REP_ENG_1530_01AUG2011_12DEC2020.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        uploadedAt: '2026-05-07T00:00:00.000Z',
        extractedText: 'VCS CCB raw extracted appendix unique string that must not be retained in the learning case',
        manualFindingExtractionStatus: 'extracted',
        manualFindingExtractionMessage: '17 draft finding sections detected. Review before accepting.',
        manualFindingExtractionTrace: 'bundled-pdf-parse',
      },
    ],
    manualFindings: [
      {
        id: 'finding-1',
        findingId: 'CAR01',
        findingType: 'CAR',
        sourceDocumentId: 'doc-1',
        sourcePageRange: '40-41',
        requirement: 'CCB V3.1: G1.10',
        description: 'Missing appendix cross-reference.',
        evidenceExcerpt: 'full excerpt text unique 123 that must not be retained in the learning case',
        projectResponse: 'Updated appendix references submitted.',
        documentationSubmitted: 'Revised appendix set',
        auditTeamEvaluation: 'Closure supported in revised report.',
        closureStatus: 'closed',
        reviewerNote: 'Accepted after cross-check.',
        createdAt: '2026-05-07T00:00:00.000Z',
        updatedAt: '2026-05-07T00:00:00.000Z',
      },
      {
        id: 'finding-2',
        findingId: 'CL01',
        findingType: 'CL',
        sourceDocumentId: 'doc-1',
        description: 'Clarification text still ambiguous.',
        projectResponse: 'Clarification memo added.',
        closureStatus: 'in-review',
        createdAt: '2026-05-07T00:00:00.000Z',
        updatedAt: '2026-05-07T00:00:00.000Z',
      },
      {
        id: 'finding-3',
        findingId: 'FAR01',
        findingType: 'FAR',
        sourceDocumentId: 'doc-1',
        sourcePageRange: '55-56',
        requirement: 'CCB V3.1: CM1.1',
        description: 'Forward action remains open.',
        closureStatus: 'open',
        createdAt: '2026-05-07T00:00:00.000Z',
        updatedAt: '2026-05-07T00:00:00.000Z',
      },
    ],
    extractedManualFindingDrafts: [
      {
        id: 'draft-1',
        findingId: 'CAR07',
        findingType: 'CAR',
        sourceDocumentId: 'doc-1',
        extractionStatus: 'draft',
        extractionMessage: 'draft',
        createdAt: '2026-05-07T00:00:00.000Z',
        updatedAt: '2026-05-07T00:00:00.000Z',
      },
      {
        id: 'draft-2',
        findingId: '',
        sourceDocumentId: 'doc-1',
        extractionStatus: 'needs-review',
        extractionMessage: 'needs review',
        createdAt: '2026-05-07T00:00:00.000Z',
        updatedAt: '2026-05-07T00:00:00.000Z',
      },
    ],
    learningCases: [],
    ...overrides,
  };
}

describe('manual review learning cases', () => {
  it('captures structured Manual Review signals without copying raw source content', () => {
    const learningCase = buildManualReviewLearningCase(
      makeManualProject(),
      'export_generated',
      '2026-05-07T12:00:00.000Z',
    );
    const serialized = JSON.stringify(learningCase);

    expect(learningCase.trigger).toBe('export_generated');
    expect(learningCase.review_mode).toBe('manual');
    expect(learningCase.registry_or_standard).toBe('Verra / VCS + CCB');
    expect(learningCase.document_type).toBe('Published verification report PDF');
    expect(learningCase.source_document_count).toBe(1);
    expect(learningCase.finding_count).toBe(3);
    expect(learningCase.finding_type_counts).toEqual({ CAR: 1, CL: 1, FAR: 1, other: 0 });
    expect(learningCase.closure_counts).toEqual({ open: 1, 'in-review': 1, closed: 1 });
    expect(learningCase.fields_present.documentation_submitted).toBe(1);
    expect(learningCase.fields_missing.documentation_submitted).toBe(2);
    expect(learningCase.fields_missing.project_area).toBe(1);
    expect(learningCase.fields_missing.project_description).toBe(1);
    expect(learningCase.reviewer_correction_summary).toEqual({
      extracted_draft_count: 2,
      draft_findings_ready_count: 1,
      draft_findings_needing_review_count: 1,
      reviewer_note_count: 1,
    });
    expect(learningCase.export_quality_flags).toEqual(expect.arrayContaining([
      'draft_findings_pending_review',
      'metadata_missing_methodology_reference',
      'metadata_missing_project_area',
      'metadata_missing_project_description',
    ]));
    expect(learningCase.truth_rules_triggered).toEqual(expect.arrayContaining([
      'manual_review_reconstruction_only',
      'no_independent_verification_opinion',
      'no_validation_statement',
      'no_methodology_compliance_determination',
    ]));
    expect(learningCase.recommended_evals).toEqual(expect.arrayContaining([
      'manual-review-finding-type-summary',
      'manual-review-closure-counts',
      'manual-review-field-coverage',
      'manual-review-truthfulness-language',
      'manual-review-source-retention',
    ]));
    expect(learningCase.source_retention_policy).toContain('No raw document text');
    expect(serialized).not.toContain('full excerpt text unique 123');
    expect(serialized).not.toContain('VCS CCB raw extracted appendix unique string');
  });

  it('persists a redacted learning case into the project record for manual export or lock flows', () => {
    window.localStorage.setItem('article6_projects', JSON.stringify([makeManualProject()]));

    const updated = recordManualReviewLearningCase('proj-manual-learning', 'project_locked');
    const stored = JSON.parse(window.localStorage.getItem('article6_projects') || '[]') as Project[];
    const learningCase = stored[0]?.learningCases[0];

    expect(updated?.learningCases).toHaveLength(1);
    expect(learningCase?.trigger).toBe('project_locked');
    expect(learningCase?.finding_type_counts).toEqual({ CAR: 1, CL: 1, FAR: 1, other: 0 });
    expect(learningCase?.closure_counts).toEqual({ open: 1, 'in-review': 1, closed: 1 });
    expect(JSON.stringify(learningCase)).not.toContain('full excerpt text unique 123');
    expect(JSON.stringify(learningCase)).not.toContain('VCS CCB raw extracted appendix unique string');
  });
});
