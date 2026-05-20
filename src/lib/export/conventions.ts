import type { Project } from '@/lib/projects/types';
import type { EvidenceSnapshot } from '@/lib/snapshot/types_v2';

export const EXPORT_TIMESTAMP_FALLBACK = '1970-01-01T00:00:00.000Z';

export const CANONICAL_EXPORT_TERMINOLOGY = {
  evidenceFragment: 'evidence fragment',
  extractedFact: 'extracted fact',
  candidateLink: 'candidate link',
  evidenceInventory: 'evidence inventory',
  coverageStatus: 'coverage status',
  reviewerDecision: 'reviewer decision',
  provenance: 'provenance',
  exportTimestamp: 'export timestamp',
  projectLockedAt: 'project locked at',
  evidenceFragmentReference: 'evidence fragment reference',
} as const;

export type ExportSurface =
  | 'standard_pdf'
  | 'premium_export'
  | 'evidence_snapshot'
  | 'verification_pack'
  | 'client_readiness'
  | 'vvb_workpaper';

const EXPORT_SCHEMA_VERSION: Partial<Record<ExportSurface, string>> = {
  premium_export: 'premium_export.v1',
  evidence_snapshot: 'evidence_snapshot.v2',
  verification_pack: 'article6.proof_audit_pack.v1',
  client_readiness: 'client_readiness.v1',
  vvb_workpaper: 'vvb_workpaper.v1',
};

const EXPORT_SECTION_ORDER: Record<ExportSurface, string[]> = {
  standard_pdf: [
    'report-status',
    'project-information',
    'scope-and-methodology-basis',
    'evidence-reviewed',
    'findings-summary',
    'requirement-review',
    'evidence-appendix',
    'limitations',
    'provenance-and-export-metadata',
  ],
  premium_export: [
    'executive-summary',
    'project-information',
    'methodology-source-sections',
    'evidence-inventory',
    'extracted-facts',
    'candidate-links',
    'coverage-matrix',
    'reviewer-decisions',
    'limitations-and-disclaimers',
    'provenance-and-export-metadata',
  ],
  evidence_snapshot: [
    'project-information',
    'coverage-summary',
    'reviews',
    'documents',
    'manual-findings',
    'extracted-drafts',
    'learning-cases',
    'source-documents',
    'evidence-inventory',
    'evidence-fragments',
    'extracted-facts',
    'candidate-links',
    'coverage-matrix',
    'reviewer-decisions',
    'evidence-pins',
    'verification-runs',
    'aoi-data',
    'provenance-and-export-metadata',
  ],
  verification_pack: [
    'project-information',
    'evidence-inventory',
    'evidence-fragments',
    'extracted-facts',
    'candidate-links',
    'coverage-matrix',
    'reviewer-decisions',
    'traceability-and-audit-trail',
    'provenance-and-export-metadata',
  ],
  client_readiness: [
    'executive-summary',
    'scope-and-criteria',
    'project-and-methodology-context',
    'documents-reviewed',
    'missing-documents',
    'readiness-assessment-approach',
    'rule-findings-matrix',
    'evidence-checklist',
    'limitations-and-disclaimers',
    'technical-appendix',
  ],
  vvb_workpaper: [
    'project-and-run-context',
    'registry-and-program-context',
    'executive-summary',
    'rule-review-workpaper',
    'readiness-and-gap-status',
    'reviewer-artifact-state',
    'evidence-and-provenance-references',
    'limitations-and-non-claims',
    'technical-appendix',
  ],
};

export function resolveProjectExportTimestamp(
  project: Pick<Project, 'lockedAt' | 'createdAt'>,
  exportTime?: string,
): string {
  return exportTime ?? project.lockedAt ?? project.createdAt ?? EXPORT_TIMESTAMP_FALLBACK;
}

export function resolveSnapshotExportTimestamp(
  snapshot: Pick<EvidenceSnapshot, 'capturedAt' | 'createdAt'>,
  exportTime?: string,
): string {
  return exportTime ?? snapshot.capturedAt ?? snapshot.createdAt ?? EXPORT_TIMESTAMP_FALLBACK;
}

export function exportSchemaVersion(surface: ExportSurface): string | undefined {
  return EXPORT_SCHEMA_VERSION[surface];
}

export function exportSectionOrder(surface: ExportSurface): string[] {
  return [...EXPORT_SECTION_ORDER[surface]];
}

export function buildExportConventions(surface: ExportSurface) {
  return {
    surface,
    schemaVersion: exportSchemaVersion(surface),
    sectionOrder: exportSectionOrder(surface),
    terminology: { ...CANONICAL_EXPORT_TERMINOLOGY },
  };
}
