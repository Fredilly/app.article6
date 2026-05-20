/** @jest-environment jsdom */

import { afterEach, describe, expect, it } from '@jest/globals';
import { buildSnapshot, buildSnapshotExport, buildSnapshotState, computeSnapshotDiff, verifySnapshotFingerprint } from '@/lib/snapshot';
import type { Project } from '@/lib/projects/types';
import { saveAoi, savePins, saveVerificationRuns } from '@/lib/proofMap/storage';
import type { AOI, EvidencePin, VerificationRun } from '@/lib/proofMap/types';

const METHOD_CODE = 'AR-ACM0003';
const METHOD_VERSION = 'v02-0';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-phase7',
    name: 'Phase 7 Review',
    reviewMode: 'methodology-linked',
    methodCode: METHOD_CODE,
    methodVersion: METHOD_VERSION,
    methodCategory: 'Afforestation',
    registry: 'UNFCCC',
    status: 'in-progress',
    createdAt: '2026-05-01T00:00:00.000Z',
    lockedAt: undefined,
    aoiLabel: 'Demo AOI',
    description: 'Snapshot comparison test project',
    reviews: [
      {
        ruleId: 'R-1',
        ruleTitle: 'Boundary evidence',
        sectionId: 'S-1',
        status: 'in-progress',
        outcome: 'partial',
        note: 'Reviewer is still reconciling the boundary worksheet.',
        evidenceIds: ['doc-1'],
        reviewedAt: '2026-05-03T10:00:00.000Z',
      },
    ],
    documents: [
      {
        id: 'doc-1',
        fileName: 'boundary-note.txt',
        mimeType: 'text/plain',
        sizeBytes: 256,
        uploadedAt: '2026-05-02T08:00:00.000Z',
        contentSha256: 'a'.repeat(64),
        extractedText: 'Project boundary is supported by the field map and the workbook cross-check.',
        manualFindingExtractionStatus: 'extracted',
        manualFindingExtractionMessage: '1 draft extracted',
        manualFindingExtractionTrace: 'trace-1',
        extractionRunId: 'extract-1',
      },
    ],
    manualFindings: [
      {
        id: 'finding-1',
        findingId: 'F-1',
        findingType: 'CAR',
        requirement: 'Boundary map',
        description: 'Boundary map needs one more waypoint check.',
        sourceDocumentId: 'doc-1',
        sourcePageRange: '1-2',
        evidenceExcerpt: 'Boundary excerpt',
        projectResponse: 'Team uploaded a revised map.',
        documentationSubmitted: 'Map v2',
        auditTeamEvaluation: 'Reviewer needs one more pass.',
        closureStatus: 'in-review',
        reviewerNote: 'Pending final waypoint cross-check.',
        createdAt: '2026-05-03T09:00:00.000Z',
        updatedAt: '2026-05-03T11:00:00.000Z',
      },
    ],
    extractedManualFindingDrafts: [
      {
        id: 'draft-1',
        findingId: 'F-1',
        findingType: 'CAR',
        requirement: 'Boundary map',
        description: 'Draft finding from extraction.',
        sourceDocumentId: 'doc-1',
        sourcePageRange: '1-2',
        evidenceExcerpt: 'Boundary excerpt',
        projectResponse: 'Draft response',
        documentationSubmitted: 'Draft doc set',
        auditTeamEvaluation: 'Draft review',
        closureStatus: 'in-review',
        reviewerNote: 'Needs manual check.',
        extractionStatus: 'needs-review',
        extractionMessage: 'Inspect before approval.',
        createdAt: '2026-05-03T09:30:00.000Z',
        updatedAt: '2026-05-03T10:30:00.000Z',
      },
    ],
    learningCases: [
      {
        case_id: 'lc-1',
        created_at: '2026-05-03T12:00:00.000Z',
        trigger: 'export_generated',
        review_mode: 'methodology-linked',
        trust_level: 'user_entered_unverified',
        training_eligible: false,
        requires_human_review: true,
        promotion_status: 'not_promoted',
        poisoning_boundary: 'not_allowed_to_update_rules_models_evals_or_scores',
        registry_or_standard: 'UNFCCC',
        document_type: 'text/plain',
        source_document_count: 1,
        finding_count: 1,
        finding_type_counts: { CAR: 1, CL: 0, FAR: 0, other: 0 },
        closure_counts: { open: 0, 'in-review': 1, closed: 0 },
        fields_present: { description: 1 },
        fields_missing: { location: 1 },
        reviewer_correction_summary: {
          extracted_draft_count: 1,
          draft_findings_ready_count: 0,
          draft_findings_needing_review_count: 1,
          reviewer_note_count: 1,
        },
        export_quality_flags: ['needs-follow-up'],
        truth_rules_triggered: ['manual-review'],
        eval_candidate_signals: ['boundary'],
        source_retention_policy: 'local-only',
        dedup_key: 'lc-dedup-1',
      },
    ],
    ...overrides,
  };
}

function makePins(): EvidencePin[] {
  return [
    {
      id: 'pin-1',
      kind: 'pdd',
      title: 'Boundary package',
      ts: '2026-05-03T08:45:00.000Z',
      ruleId: 'R-1',
      itemId: 'item-1',
      note: 'Pinned for reviewer comparison.',
      aoi_id: 'aoi-1',
      aoi_fingerprint: 'fp-aoi-1',
      cited_ids: ['R-1', 'doc-1'],
      location: { lng: 11.2, lat: -7.4 },
      attachments: [
        {
          id: 'att-1',
          pin_id: 'pin-1',
          filename: 'boundary.xlsx',
          mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: 1024,
          sha256: 'b'.repeat(64),
          created_at: '2026-05-03T08:30:00.000Z',
          workbook_asset: {
            workbook_id: 'wb-1',
            file_kind: 'xlsx',
            file_name: 'boundary.xlsx',
            file_sha256: 'c'.repeat(64),
            sheet_count: 1,
            sheets: [
              {
                sheet_name: 'Data',
                sheet_index: 0,
                row_count: 2,
                column_count: 2,
                bounds_ref: 'A1:B2',
                header_row_ref: 1,
                header_columns: ['Parameter', 'Value'],
                warnings: ['check formula'],
              },
            ],
            record_groups: [
              {
                group_id: 'group-1',
                group_type: 'parameter_source_table',
                display_name: 'Boundary data',
                workbook_id: 'wb-1',
                workbook_filename: 'boundary.xlsx',
                source_sheet: 'Data',
                source_range: 'A1:B2',
                row_count: 1,
                column_names: ['Parameter', 'Value'],
                rows: [{ Parameter: 'Area', Value: '10 ha' }],
                provenance_summary: 'Workbook provenance',
              },
            ],
            warnings: ['verify formulas'],
          },
        },
      ],
      pdd_document: {
        evidence_id: 'pin-1',
        attachment_id: 'att-1',
        file_name: 'boundary.pdf',
        mime: 'application/pdf',
        added_at: '2026-05-03T08:40:00.000Z',
        sha256: 'd'.repeat(64),
      },
      pdd_fragments: [
        {
          fragment_id: 'frag-1',
          evidence_id: 'pin-1',
          label: 'Boundary paragraph',
          page_start: 2,
          page_end: 2,
          section_label: 'Boundary',
          section_heading: 'Boundary evidence',
          excerpt: 'The project boundary is defined in the map appendix.',
          bbox_hint: { page: 2, x: 10, y: 20, width: 100, height: 50 },
        },
      ],
      pdd_fragment_links: [
        {
          fragment_id: 'frag-1',
          rule_id: 'R-1',
          linked_at: '2026-05-03T08:50:00.000Z',
        },
      ],
      stac_item_ids: ['stac-2', 'stac-1'],
      stac_run_id: 'run-1',
      created_at: '2026-05-03T08:00:00.000Z',
    },
  ];
}

function makeRuns(): VerificationRun[] {
  return [
    {
      id: 'run-1',
      method: { code: METHOD_CODE, version: METHOD_VERSION },
      aoi_id: 'aoi-1',
      aoi_snapshot: {
        name: 'Demo AOI',
        bbox: [10, -8, 12, -7],
        area_km2: 12.34,
        aoi_source_type: 'Feature',
        aoi_source_feature_count: 1,
        aoi_policy: 'reject_multi',
      },
      aoi_fingerprint: 'fp-aoi-1',
      input_fingerprint: 'input-fp-1',
      pin_id: 'pin-1',
      cited_ids: ['doc-1', 'R-1'],
      cited_ids_count: 2,
      attachment_sha256: ['b'.repeat(64)],
      attachment_count: 1,
      provider: 'stac',
      status: 'ok',
      summary: 'Boundary matches AOI.',
      result_json: { score: 0.98, matched: true },
      created_at: '2026-05-03T09:15:00.000Z',
      ended_at: '2026-05-03T09:16:00.000Z',
    },
  ];
}

function makeAoi(): AOI {
  return {
    id: 'aoi-1',
    name: 'Demo AOI',
    geojson: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[[10, -8], [12, -8], [12, -7], [10, -7], [10, -8]]],
      },
    },
    bbox: [10, -8, 12, -7],
    area_km2: 12.34,
    aoi_source_type: 'Feature',
    aoi_source_feature_count: 1,
    aoi_policy: 'reject_multi',
    aoi_fingerprint: 'fp-aoi-1',
    created_at: '2026-05-03T08:10:00.000Z',
  };
}

function seedProofMapState(pins: EvidencePin[] = makePins(), runs: VerificationRun[] = makeRuns(), aoi: AOI = makeAoi()) {
  savePins(METHOD_CODE, METHOD_VERSION, pins);
  saveVerificationRuns(METHOD_CODE, METHOD_VERSION, runs);
  saveAoi(METHOD_CODE, METHOD_VERSION, aoi);
}

afterEach(() => {
  window.localStorage.clear();
});

describe('snapshot builder', () => {
  it('captures full evidence state including fragments, facts, links, coverage, and decisions', async () => {
    seedProofMapState();
    const state = await buildSnapshotState(makeProject());

    expect(state.documents[0]?.extractedText).toContain('Project boundary');
    expect(state.manualFindings[0]?.projectResponse).toBe('Team uploaded a revised map.');
    expect(state.extractedDrafts[0]?.reviewerNote).toBe('Needs manual check.');
    expect(state.learningCases[0]?.dedup_key).toBe('lc-dedup-1');
    expect(state.coverage.percentComplete).toBe(0);
    expect(state.fragments.map((fragment) => fragment.fragmentId)).toEqual(['frag-1', 'fragment_doc_1_001']);
    expect(state.facts.map((fact) => fact.factId)).toContain('fragment_doc_1_001__fact_001');
    expect(state.inventory[0]?.linked_requirement_ids).toEqual(['F-1', 'R-1']);
    expect(state.decisionRun?.decisions[0]?.ruleId).toBe('R-1');
    expect(state.evidencePins[0]?.pdd_fragment_links?.[0]?.rule_id).toBe('R-1');
    expect(state.verificationRuns[0]?.result_json).toEqual({ score: 0.98, matched: true });
    expect(state.aoiData?.geojson.geometry.type).toBe('Polygon');
  });

  it('is deterministic for identical project state and produces deterministic exports', async () => {
    seedProofMapState();
    const project = makeProject();

    const first = await buildSnapshot(project);
    const second = await buildSnapshot(project);

    expect(first).toEqual(second);
    expect(first.snapshotId).toBe(second.snapshotId);
    expect(first.capturedAt).toBe('2026-05-03T12:00:00.000Z');
    expect(await verifySnapshotFingerprint(first)).toBe(true);

    const firstExport = await buildSnapshotExport(first);
    const secondExport = await buildSnapshotExport(second);

    expect(firstExport).toEqual(secondExport);
    expect(firstExport.exportedAt).toBe(first.capturedAt);
    expect(firstExport.schema_version).toBe('evidence_snapshot.v2');
  });

  it('computes added, removed, and changed evidence across snapshots', async () => {
    const leftProject = makeProject();
    seedProofMapState();
    const left = await buildSnapshot(leftProject, 'Before');

    const rightProject = makeProject({
      reviews: [
        {
          ...leftProject.reviews[0]!,
          status: 'verified',
          outcome: 'pass',
          note: 'Boundary evidence fully verified.',
          evidenceIds: ['doc-1', 'doc-2'],
          reviewedAt: '2026-05-04T09:00:00.000Z',
        },
      ],
      documents: [
        ...leftProject.documents,
        {
          id: 'doc-2',
          fileName: 'worksheet.txt',
          mimeType: 'text/plain',
          sizeBytes: 128,
          uploadedAt: '2026-05-04T08:00:00.000Z',
          contentSha256: 'e'.repeat(64),
          extractedText: 'Workbook area value is 10 ha and matches the map appendix.',
        },
      ],
    });

    seedProofMapState(
      [
        {
          ...makePins()[0]!,
          title: 'Boundary package v2',
          cited_ids: ['R-1', 'doc-1', 'doc-2'],
          pdd_fragment_links: [
            ...(makePins()[0]?.pdd_fragment_links ?? []),
            { fragment_id: 'frag-1', rule_id: 'R-2', linked_at: '2026-05-04T08:10:00.000Z' },
          ],
        },
      ],
      [
        {
          ...makeRuns()[0]!,
          cited_ids: ['doc-1', 'doc-2', 'R-1'],
          cited_ids_count: 3,
          summary: 'Boundary and workbook both match AOI.',
          result_json: { score: 0.99, matched: true },
          created_at: '2026-05-04T08:15:00.000Z',
          ended_at: '2026-05-04T08:16:00.000Z',
        },
      ],
    );
    const right = await buildSnapshot(rightProject, 'After');

    const diff = computeSnapshotDiff(left, right);

    expect(diff.summary.added).toBeGreaterThan(0);
    expect(diff.summary.changed).toBeGreaterThan(0);
    expect(diff.summary.sectionCounts.documents.added).toBe(1);
    expect(diff.summary.sectionCounts.fragments.added).toBeGreaterThan(0);
    expect(diff.summary.sectionCounts.facts.added).toBeGreaterThan(0);
    expect(diff.summary.sectionCounts.reviewerDecisions.changed).toBeGreaterThan(0);
    expect(diff.summary.sectionCounts.evidencePins.changed).toBeGreaterThan(0);
    expect(diff.summary.coverageChange.changed).toBe(true);
  });
});
