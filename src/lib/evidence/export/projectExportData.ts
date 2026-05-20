import { canonicalJsonStringify } from '@/lib/export/canonicalJson';
import { sha256Text } from '@/lib/proof/hash';
import type { EvidenceInventoryItem } from '@/lib/evidence/inventory';
import type { ReviewerDecision, DecisionRun } from '@/lib/evidence/decisions/types';
import { computeDecisionProvenance, computeDecisionSetFingerprint } from '@/lib/evidence/decisions/engine';
import type { ReconciliationItem, ReconciliationRun, CoverageGap, ReconciliationStatus } from '@/lib/evidence/reconciliation/types';
import { computeGapFingerprint, computeItemFingerprint, reconcileEvidence } from '@/lib/evidence/reconciliation/reconciler';
import { runExtraction } from '@/lib/evidence/extraction/pipeline';
import type { CandidateLink, DocumentFragment, SourceDocument, ExtractedFact } from '@/lib/evidence/extraction/types';
import type { PremiumExportInput, SourceArtifact } from './types';
import type { Project, ProjectCoverage, ProjectDocument, RuleReview, ManualFinding } from '@/lib/projects/types';

function sortByString<T>(items: T[], select: (item: T) => string): T[] {
  return [...items].sort((a, b) => select(a).localeCompare(select(b)));
}

function sanitizeId(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return normalized || 'item';
}

async function sha256OrFallback(value: string): Promise<string> {
  if (!value) return sha256Text('');
  return sha256Text(value);
}

function resolveSourceKind(document: ProjectDocument): SourceDocument['kind'] {
  const lower = document.fileName.toLowerCase();
  if (document.mimeType === 'application/pdf' || lower.endsWith('.pdf')) return 'pdd';
  if (
    document.mimeType.includes('spreadsheet') ||
    document.mimeType.includes('csv') ||
    lower.endsWith('.xlsx') ||
    lower.endsWith('.csv')
  ) return 'workbook';
  if (lower.includes('monitor') || document.mimeType.includes('word')) return 'monitoring-report';
  return 'other';
}

function resolveExportTime(project: Project, requested?: string): string {
  return requested
    ?? project.lockedAt
    ?? project.reviews.map((review) => review.reviewedAt).filter(Boolean).sort().at(-1)
    ?? project.manualFindings.map((finding) => finding.updatedAt).sort().at(-1)
    ?? project.createdAt
    ?? '1970-01-01T00:00:00.000Z';
}

function decodeBase64ToArrayBuffer(contentBase64: string): ArrayBuffer {
  const buffer = Buffer.from(contentBase64, 'base64');
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function buildSourceArtifacts(project: Project): SourceArtifact[] {
  return sortByString(
    project.documents
      .filter((document) => document.contentBase64 && document.contentSha256)
      .map((document) => ({
        documentId: document.id,
        fileName: document.fileName,
        mime: document.mimeType,
        sizeBytes: document.sizeBytes,
        contentSha256: document.contentSha256 as string,
        contentBase64: document.contentBase64 as string,
      })),
    (artifact) => artifact.documentId,
  );
}

function buildSources(project: Project, sourceArtifacts: SourceArtifact[]): SourceDocument[] {
  const shaById = new Map(sourceArtifacts.map((artifact) => [artifact.documentId, artifact.contentSha256]));
  return sortByString(project.documents.map((document) => ({
    id: document.id,
    fileName: document.fileName,
    mime: document.mimeType,
    kind: resolveSourceKind(document),
    sizeBytes: document.sizeBytes,
    contentSha256: document.contentSha256 ?? shaById.get(document.id) ?? `${document.id}_missing_sha`,
  })), (document) => document.id);
}

async function buildFallbackFragments(project: Project, sources: SourceDocument[]): Promise<DocumentFragment[]> {
  const fragments: DocumentFragment[] = [];
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  for (const document of sortByString(project.documents, (item) => item.id)) {
    if (!document.extractedText?.trim()) continue;
    const source = sourceById.get(document.id);
    if (!source) continue;
    const text = document.extractedText.trim();
    fragments.push({
      fragmentId: `fragment_${sanitizeId(document.id)}_001`,
      documentId: document.id,
      kind: source.kind,
      index: 0,
      label: 'Extracted source text',
      text,
      contentSha256: await sha256OrFallback(`${document.id}:${text}`),
    });
  }
  return fragments;
}

async function buildFallbackFacts(fragments: DocumentFragment[]): Promise<ExtractedFact[]> {
  const facts: ExtractedFact[] = [];
  for (const fragment of sortByString(fragments, (item) => item.fragmentId)) {
    const summary = fragment.text.replace(/\s+/g, ' ').trim().slice(0, 160);
    if (!summary) continue;
    facts.push({
      factId: `${fragment.fragmentId}__fact_001`,
      fragmentId: fragment.fragmentId,
      documentId: fragment.documentId,
      factType: 'other',
      value: summary,
      context: fragment.label,
      contentSha256: await sha256OrFallback(`${fragment.fragmentId}:${summary}`),
    });
  }
  return facts;
}

function extractLinkedRequirementIds(project: Project, documentId: string, fragmentIds: string[]): string[] {
  const linked = new Set<string>();
  const fragmentIdSet = new Set(fragmentIds);
  for (const review of project.reviews) {
    if (review.evidenceIds.includes(documentId) || review.evidenceIds.some((item) => fragmentIdSet.has(item))) {
      linked.add(review.ruleId);
    }
  }
  for (const finding of project.manualFindings) {
    if (finding.sourceDocumentId === documentId) {
      linked.add(finding.findingId);
    }
  }
  return Array.from(linked).sort((a, b) => a.localeCompare(b));
}

function buildInventory(
  project: Project,
  sources: SourceDocument[],
  fragments: DocumentFragment[],
  reconciliationRun?: ReconciliationRun,
): EvidenceInventoryItem[] {
  const fragmentsByDocument = new Map<string, DocumentFragment[]>();
  for (const fragment of fragments) {
    const existing = fragmentsByDocument.get(fragment.documentId) ?? [];
    existing.push(fragment);
    fragmentsByDocument.set(fragment.documentId, existing);
  }

  const statusesByDocument = new Map<string, EvidenceInventoryItem['reconciliation_status']>();
  for (const item of reconciliationRun?.items ?? []) {
    if (!item.fragmentId) continue;
    const fragment = fragments.find((candidate) => candidate.fragmentId === item.fragmentId);
    if (!fragment) continue;
    if (item.status === 'linked') {
      statusesByDocument.set(fragment.documentId, 'linked');
    } else if (!statusesByDocument.has(fragment.documentId)) {
      statusesByDocument.set(fragment.documentId, 'unmatched');
    }
  }

  return sortByString(sources.map((source) => {
    const documentFragments = sortByString(fragmentsByDocument.get(source.id) ?? [], (fragment) => fragment.fragmentId);
    const linkedRequirementIds = extractLinkedRequirementIds(
      project,
      source.id,
      documentFragments.map((fragment) => fragment.fragmentId),
    );
    const inventoryKind = source.kind === 'monitoring-report'
      ? 'document'
      : source.kind === 'other'
        ? 'upload'
        : source.kind;
    return {
      evidence_id: source.id,
      dedupe_key: source.contentSha256,
      display_name: source.fileName,
      kind: inventoryKind,
      type: source.kind === 'pdd'
        ? 'PDD'
        : source.kind === 'workbook'
          ? 'Workbook'
          : source.kind === 'monitoring-report'
            ? 'Monitoring report'
            : 'Document',
      source_summary: 'Project source document',
      provenance_summary: `${source.fileName} · sha256 ${source.contentSha256}`,
      added_at: project.documents.find((document) => document.id === source.id)?.uploadedAt ?? project.createdAt,
      link_state: linkedRequirementIds.length > 0 ? 'linked' : 'unlinked',
      linked_requirement_ids: linkedRequirementIds,
      reconciliation_status: statusesByDocument.get(source.id),
      pdd_fragments: source.kind === 'pdd'
        ? documentFragments.map((fragment) => ({
            fragment_id: fragment.fragmentId,
            evidence_id: source.id,
            label: fragment.label,
            page_start: fragment.pageStart,
            page_end: fragment.pageEnd ?? fragment.pageStart,
            section_label: fragment.sheetName,
            section_heading: fragment.label,
            excerpt: fragment.text.slice(0, 240),
            bbox_hint: null,
          }))
        : undefined,
    } satisfies EvidenceInventoryItem;
  }), (item) => item.evidence_id);
}

function buildFallbackReconciliationGaps(project: Project): CoverageGap[] {
  return sortByString(
    project.reviews
      .filter((review) => review.status !== 'verified' && review.status !== 'not-applicable')
      .map((review) => ({
        ruleId: review.ruleId,
        ruleTitle: review.ruleTitle,
        sectionId: review.sectionId,
        expectedEvidenceIds: [...review.evidenceIds].sort((a, b) => a.localeCompare(b)),
        matchedEvidenceIds: review.status === 'gap' ? [] : [...review.evidenceIds].sort((a, b) => a.localeCompare(b)),
      })),
    (gap) => gap.ruleId,
  );
}

async function buildFallbackReconciliationRun(
  project: Project,
  fragments: DocumentFragment[],
  candidateLinks: CandidateLink[],
  exportTime: string,
): Promise<ReconciliationRun> {
  const items: ReconciliationItem[] = [];
  for (const fragment of sortByString(fragments, (item) => item.fragmentId)) {
    const linkedReview = project.reviews.find(
      (review) => review.evidenceIds.includes(fragment.documentId) || review.evidenceIds.includes(fragment.fragmentId),
    );
    items.push({
      id: `rec_${fragment.fragmentId}`,
      fragmentId: fragment.fragmentId,
      ruleId: linkedReview?.ruleId,
      ruleTitle: linkedReview?.ruleTitle,
      sectionId: linkedReview?.sectionId,
      status: linkedReview ? 'linked' : 'unmatched',
      matchType: linkedReview ? 'manual-link' : undefined,
      confidence: linkedReview ? 1 : undefined,
      isManualOverride: Boolean(linkedReview),
      contentSha256: fragment.contentSha256,
    });
  }

  const gaps = buildFallbackReconciliationGaps(project);
  const itemFingerprint = await computeItemFingerprint(items);
  const gapFingerprint = await computeGapFingerprint(gaps);
  const reconciliationFingerprint = await sha256Text(canonicalJsonStringify({
    projectId: project.id,
    itemFingerprint,
    gapFingerprint,
  }));

  const status: ReconciliationStatus = project.reviews.length > 0 ? 'complete' : 'no-rules';
  return {
    runId: reconciliationFingerprint,
    createdAt: exportTime,
    projectId: project.id,
    status,
    items,
    gaps,
    itemFingerprint,
    gapFingerprint,
    reconciliationFingerprint,
  };
}

function mapReviewStatusToDecisionStatus(review: RuleReview): ReviewerDecision['status'] {
  if (review.status === 'verified') return 'approved';
  if (review.status === 'gap') return 'rejected';
  return 'needs-review';
}

function mapFindingStatusToDecisionStatus(finding: ManualFinding): ReviewerDecision['status'] {
  if (finding.closureStatus === 'closed') return 'approved';
  if (finding.closureStatus === 'open') return 'rejected';
  return 'needs-review';
}

function reviewRationale(review: RuleReview): string {
  if (review.note?.trim()) return review.note.trim();
  if (review.status === 'verified') return 'Reviewer marked this requirement as verified from the linked evidence set.';
  if (review.status === 'gap') return 'Reviewer marked this requirement as a gap due to insufficient supporting evidence.';
  if (review.status === 'not-applicable') return 'Reviewer marked this requirement as not applicable for the current project scope.';
  return 'Reviewer has not finalized this requirement and additional evidence review is still pending.';
}

function findingRationale(finding: ManualFinding): string {
  return (
    finding.reviewerNote?.trim()
    || finding.auditTeamEvaluation?.trim()
    || finding.projectResponse?.trim()
    || finding.evidenceExcerpt?.trim()
    || 'Reviewer decision derived from the manual findings register.'
  );
}

async function buildDecisionRunFromProject(
  project: Project,
  exportTime: string,
  reconciliationRun?: ReconciliationRun,
): Promise<DecisionRun> {
  const decisions: ReviewerDecision[] = [];

  if (project.reviewMode === 'manual') {
    for (const finding of sortByString(project.manualFindings, (item) => item.findingId)) {
      const reviewedAt = finding.updatedAt || finding.createdAt || exportTime;
      const decision: ReviewerDecision = {
        decisionId: `dec_${sanitizeId(finding.findingId)}_${sanitizeId(project.id)}`,
        ruleId: finding.findingId,
        ruleTitle: finding.requirement || finding.description || finding.findingType,
        sectionId: 'Manual Findings',
        status: mapFindingStatusToDecisionStatus(finding),
        rationale: findingRationale(finding),
        reviewerId: 'project-reviewer',
        reviewedAt,
        updatedAt: reviewedAt,
        evidenceInventoryIds: finding.sourceDocumentId ? [finding.sourceDocumentId] : [],
        reconciliationRunId: reconciliationRun?.runId,
        provenanceHash: '',
      };
      decision.provenanceHash = await computeDecisionProvenance(decision);
      decisions.push(decision);
    }
  } else {
    for (const review of sortByString(project.reviews, (item) => item.ruleId)) {
      if (review.status === 'not-started' && !review.note?.trim() && review.evidenceIds.length === 0) continue;
      const reviewedAt = review.reviewedAt || project.lockedAt || exportTime;
      const decision: ReviewerDecision = {
        decisionId: `dec_${sanitizeId(review.ruleId)}_${sanitizeId(project.id)}`,
        ruleId: review.ruleId,
        ruleTitle: review.ruleTitle,
        sectionId: review.sectionId,
        status: mapReviewStatusToDecisionStatus(review),
        rationale: reviewRationale(review),
        reviewerId: 'project-reviewer',
        reviewedAt,
        updatedAt: reviewedAt,
        evidenceInventoryIds: [...review.evidenceIds].sort((a, b) => a.localeCompare(b)),
        reconciliationRunId: reconciliationRun?.runId,
        provenanceHash: '',
      };
      decision.provenanceHash = await computeDecisionProvenance(decision);
      decisions.push(decision);
    }
  }

  const sortedDecisions = sortByString(decisions, (decision) => decision.decisionId);
  const decisionSetFingerprint = await computeDecisionSetFingerprint(sortedDecisions);
  const runId = await sha256Text(canonicalJsonStringify({
    projectId: project.id,
    decisionSetFingerprint,
    reconciliationRunId: reconciliationRun?.runId,
  }));

  return {
    runId,
    projectId: project.id,
    createdAt: exportTime,
    decisions: sortedDecisions,
    decisionSetFingerprint,
    reconciliationRunId: reconciliationRun?.runId,
  };
}

export async function buildPremiumExportInputFromProject(params: {
  project: Project;
  coverage?: ProjectCoverage;
  exportTime?: string;
  pipelineVersion?: string;
}): Promise<PremiumExportInput> {
  const { project } = params;
  const coverage = params.coverage ?? {
    total: project.reviews.length,
    verified: project.reviews.filter((review) => review.status === 'verified').length,
    gap: project.reviews.filter((review) => review.status === 'gap').length,
    notStarted: project.reviews.filter((review) => review.status === 'not-started').length,
    notApplicable: project.reviews.filter((review) => review.status === 'not-applicable').length,
    inProgress: project.reviews.filter((review) => review.status === 'in-progress').length,
    percentComplete: Math.round(
      (project.reviews.filter((review) => review.status === 'verified' || review.status === 'gap').length / Math.max(1, project.reviews.length - project.reviews.filter((review) => review.status === 'not-applicable').length)) * 100,
    ),
  };
  const exportTime = resolveExportTime(project, params.exportTime);
  const pipelineVersion = params.pipelineVersion ?? '1.0.0';
  const sourceArtifacts = buildSourceArtifacts(project);
  const sources = buildSources(project, sourceArtifacts);

  let fragments: DocumentFragment[] = [];
  let facts: ExtractedFact[] = [];
  let candidateLinks: CandidateLink[] = [];

  if (project.reviewMode === 'methodology-linked' && project.methodCode && project.methodVersion && sourceArtifacts.length > 0) {
    const extractionRun = await runExtraction({
      projectId: project.id,
      documents: sortByString(sourceArtifacts, (artifact) => artifact.documentId).map((artifact) => ({
        doc: sources.find((source) => source.id === artifact.documentId)!,
        buffer: decodeBase64ToArrayBuffer(artifact.contentBase64),
      })),
      methodCode: project.methodCode,
      methodVersion: project.methodVersion,
    });
    fragments = sortByString(extractionRun.fragments, (fragment) => fragment.fragmentId);
    facts = sortByString(extractionRun.facts, (fact) => fact.factId);
    candidateLinks = sortByString(extractionRun.candidateLinks, (link) => link.linkId);
  } else {
    fragments = await buildFallbackFragments(project, sources);
    facts = await buildFallbackFacts(fragments);
  }

  let reconciliationRun: ReconciliationRun | undefined;
  if (project.reviewMode === 'methodology-linked' && project.methodCode && project.methodVersion) {
    try {
      reconciliationRun = await reconcileEvidence({
        fragments,
        facts,
        candidateLinks,
        methodCode: project.methodCode,
        methodVersion: project.methodVersion,
        projectId: project.id,
      });
      if (reconciliationRun.status !== 'complete') {
        reconciliationRun = await buildFallbackReconciliationRun(project, fragments, candidateLinks, exportTime);
      } else {
        reconciliationRun = {
          ...reconciliationRun,
          createdAt: exportTime,
        };
      }
    } catch {
      reconciliationRun = await buildFallbackReconciliationRun(project, fragments, candidateLinks, exportTime);
    }
  } else {
    reconciliationRun = await buildFallbackReconciliationRun(project, fragments, candidateLinks, exportTime);
  }

  const inventory = buildInventory(project, sources, fragments, reconciliationRun);
  const decisionRun = await buildDecisionRunFromProject(project, exportTime, reconciliationRun);

  return {
    project,
    coverage,
    inventory,
    sources,
    sourceArtifacts,
    fragments,
    facts,
    candidateLinks,
    reconciliationRun,
    decisionRun,
    exportTime,
    pipelineVersion,
  };
}
