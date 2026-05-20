import type { Project } from '@/lib/projects/types';
import { getProjectCoverage } from '@/lib/projects/storage';
import type { EvidencePin, VerificationRun } from '@/lib/proofMap/types';
import { loadPins, loadVerificationRuns, loadAoi } from '@/lib/proofMap/storage';
import { canonicalJsonStringify as snapshotCanonicalJson, sha256Hex } from './canonical';
import type {
  EvidenceSnapshot,
  EvidenceSnapshotState,
  SnapshotAoiData,
  SnapshotCoverage,
  SnapshotDecision,
  SnapshotDocument,
  SnapshotExtractedDraft,
  SnapshotFinding,
  SnapshotLearningCase,
  SnapshotPin,
  SnapshotProjectMeta,
  SnapshotReview,
  SnapshotVerificationRun,
} from './types';

function buildProjectMeta(project: Project): SnapshotProjectMeta {
  return {
    name: project.name,
    reviewMode: project.reviewMode,
    methodCode: project.methodCode,
    methodVersion: project.methodVersion,
    status: project.status,
    lockedAt: project.lockedAt,
    aoiLabel: project.aoiLabel,
    description: project.description,
  };
}

function buildReviews(reviews: Project['reviews']): SnapshotReview[] {
  return reviews.map((r) => ({
    ruleId: r.ruleId,
    ruleTitle: r.ruleTitle,
    sectionId: r.sectionId,
    status: r.status,
    outcome: r.outcome,
    note: r.note,
    evidenceIds: [...r.evidenceIds].sort(),
    reviewedAt: r.reviewedAt,
  }));
}

function buildDocuments(documents: Project['documents']): SnapshotDocument[] {
  return documents.map((d) => ({
    id: d.id,
    fileName: d.fileName,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    uploadedAt: d.uploadedAt,
    contentSha256: d.contentSha256,
  }));
}

function buildFindings(findings: Project['manualFindings']): SnapshotFinding[] {
  return findings.map((f) => ({
    id: f.id,
    findingId: f.findingId,
    findingType: f.findingType,
    requirement: f.requirement,
    sourceDocumentId: f.sourceDocumentId,
    closureStatus: f.closureStatus,
    createdAt: f.createdAt,
  }));
}

function buildExtractedDrafts(drafts: Project['extractedManualFindingDrafts']): SnapshotExtractedDraft[] {
  return drafts.map((d) => ({
    id: d.id,
    findingId: d.findingId,
    findingType: d.findingType,
    requirement: d.requirement,
    description: d.description,
    sourceDocumentId: d.sourceDocumentId,
    sourcePageRange: d.sourcePageRange,
    evidenceExcerpt: d.evidenceExcerpt,
    closureStatus: d.closureStatus,
    extractionStatus: d.extractionStatus,
    extractionMessage: d.extractionMessage,
    createdAt: d.createdAt,
  }));
}

function buildLearningCases(cases: Project['learningCases']): SnapshotLearningCase[] {
  return cases.map((c) => ({
    caseId: c.case_id,
    trigger: c.trigger,
    createdAt: c.created_at,
  }));
}

function buildDecisions(
  project: Project,
  reviews: SnapshotReview[],
  findings: SnapshotFinding[],
  exportTime: string,
): SnapshotDecision[] {
  const decisions: SnapshotDecision[] = [];

  if (project.reviewMode === 'manual') {
    for (const finding of findings) {
      decisions.push({
        decisionId: `dec_${finding.findingId}_${project.id.replace(/[^a-zA-Z0-9]/g, '_')}`,
        ruleId: finding.findingId,
        ruleTitle: finding.findingType,
        sectionId: 'Manual Findings',
        status: finding.closureStatus === 'closed' ? 'approved' : finding.closureStatus === 'open' ? 'rejected' : 'needs-review',
        rationale: '',
        reviewedAt: exportTime,
        evidenceIds: finding.sourceDocumentId ? [finding.sourceDocumentId] : [],
      });
    }
  } else {
    for (const review of reviews) {
      if (review.status === 'not-started' && !review.note && review.evidenceIds.length === 0) continue;
      decisions.push({
        decisionId: `dec_${review.ruleId}_${project.id.replace(/[^a-zA-Z0-9]/g, '_')}`,
        ruleId: review.ruleId,
        ruleTitle: review.ruleTitle,
        sectionId: review.sectionId,
        status: review.status === 'verified' ? 'approved' : review.status === 'gap' ? 'rejected' : 'needs-review',
        rationale: review.note ?? '',
        reviewedAt: review.reviewedAt ?? exportTime,
        evidenceIds: [...review.evidenceIds].sort(),
      });
    }
  }

  return decisions.sort((a, b) => a.decisionId.localeCompare(b.decisionId));
}

function buildPins(pins: EvidencePin[]): SnapshotPin[] {
  return pins.map((p) => ({
    id: p.id,
    kind: p.kind,
    title: p.title,
    ruleId: p.ruleId,
    citedIds: [...(p.cited_ids ?? [])].sort(),
    attachmentCount: (p.attachments ?? []).length,
    stacItemCount: (p.stac_item_ids ?? []).length,
    createdAt: p.created_at,
  }));
}

function buildVerificationRuns(runs: VerificationRun[]): SnapshotVerificationRun[] {
  return runs.map((r) => ({
    id: r.id,
    status: r.status,
    citedIdsCount: r.cited_ids_count,
    attachmentCount: r.attachment_count,
    createdAt: r.created_at,
  }));
}

function buildCoverage(project: Project): SnapshotCoverage {
  const c = getProjectCoverage(project);
  return { ...c };
}

export function buildSnapshotState(project: Project): EvidenceSnapshotState {
  const reviews = buildReviews(project.reviews);
  const documents = buildDocuments(project.documents);
  const manualFindings = buildFindings(project.manualFindings);

  const exportTime = project.lockedAt
    ?? project.reviews.map((r) => r.reviewedAt).filter(Boolean).sort().at(-1)
    ?? project.manualFindings.map((f) => f.updatedAt).sort().at(-1)
    ?? project.createdAt
    ?? new Date().toISOString();

  const decisions = buildDecisions(project, reviews, manualFindings, exportTime);

  let evidencePins: SnapshotPin[] = [];
  let verificationRuns: SnapshotVerificationRun[] = [];
  let aoiData: SnapshotAoiData | null = null;

  if (project.methodCode && project.methodVersion) {
    try {
      const rawPins = loadPins(project.methodCode, project.methodVersion);
      evidencePins = buildPins(rawPins);
    } catch { /* not available */ }

    try {
      const rawRuns = loadVerificationRuns(project.methodCode, project.methodVersion);
      verificationRuns = buildVerificationRuns(rawRuns);
    } catch { /* not available */ }

    try {
      const rawAoi = loadAoi(project.methodCode, project.methodVersion);
      if (rawAoi) {
        aoiData = {
          id: rawAoi.id,
          name: rawAoi.name,
          areaKm2: rawAoi.area_km2,
          createdAt: rawAoi.created_at,
        };
      }
    } catch { /* not available */ }
  }

  return {
    project: buildProjectMeta(project),
    reviews,
    documents,
    manualFindings,
    extractedDrafts: buildExtractedDrafts(project.extractedManualFindingDrafts),
    learningCases: buildLearningCases(project.learningCases),
    decisions,
    evidencePins,
    verificationRuns,
    aoiData,
    coverage: buildCoverage(project),
  };
}

function generateSnapshotId(projectId: string): string {
  const prefix = projectId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toLowerCase();
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `snap_${prefix}_${ts}_${rand}`;
}

export async function buildSnapshot(project: Project, label: string, description?: string): Promise<EvidenceSnapshot> {
  const state = buildSnapshotState(project);
  const canonicalJson = snapshotCanonicalJson(state);
  const fingerprint = await sha256Hex(canonicalJson);

  return {
    snapshotId: generateSnapshotId(project.id),
    projectId: project.id,
    label: label.trim() || `Snapshot ${new Date().toLocaleDateString()}`,
    description: description?.trim(),
    createdAt: new Date().toISOString(),
    fingerprint,
    state,
  };
}

export async function verifySnapshotFingerprint(snapshot: EvidenceSnapshot): Promise<boolean> {
  const stateJson = snapshotCanonicalJson(snapshot.state);
  const expected = await sha256Hex(stateJson);
  return expected === snapshot.fingerprint;
}
