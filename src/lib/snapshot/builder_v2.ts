import type { ReviewerDecision, DecisionRun } from '@/lib/evidence/decisions/types';
import type { CandidateLink, DocumentFragment, ExtractedFact, SourceDocument } from '@/lib/evidence/extraction/types';
import type { EvidenceInventoryItem } from '@/lib/evidence/inventory';
import type { AOI, EvidenceAttachment, EvidencePin, PddFragmentLink, VerificationRun } from '@/lib/proofMap/types';
import { loadAoi, loadPins, loadVerificationRuns } from '@/lib/proofMap/storage';
import type { Project } from '@/lib/projects/types';
import { getProjectCoverage } from '@/lib/projects/storage';
import { canonicalJsonStringify as snapshotCanonicalJson, sha256Hex } from './canonical';
import type { EvidenceSnapshot, EvidenceSnapshotState, SnapshotProjectMeta } from './types_v2';

const EPOCH = '1970-01-01T00:00:00.000Z';

type LoadedProofMapState = {
  aoiData: AOI | null;
  evidencePins: EvidencePin[];
  verificationRuns: VerificationRun[];
};

function uniqSorted(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]))
    .sort((a, b) => a.localeCompare(b));
}

function sortByString<T>(items: T[], select: (item: T) => string): T[] {
  return [...items].sort((a, b) => select(a).localeCompare(select(b)));
}

function latestTimestamp(values: Array<string | undefined | null>): string {
  const ordered = values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => a.localeCompare(b));
  return ordered.at(-1) ?? EPOCH;
}

function normalizeProjectMeta(project: Project): SnapshotProjectMeta {
  return {
    id: project.id,
    name: project.name,
    reviewMode: project.reviewMode,
    methodCode: project.methodCode,
    methodVersion: project.methodVersion,
    methodCategory: project.methodCategory,
    registry: project.registry,
    status: project.status,
    createdAt: project.createdAt,
    lockedAt: project.lockedAt,
    aoiLabel: project.aoiLabel,
    description: project.description,
  };
}

function normalizeProject(project: Project): Project {
  return {
    ...project,
    reviews: sortByString(
      project.reviews.map((review) => ({
        ...review,
        evidenceIds: uniqSorted(review.evidenceIds),
      })),
      (review) => review.ruleId,
    ),
    documents: sortByString(project.documents.map((document) => ({ ...document })), (document) => document.id),
    manualFindings: sortByString(project.manualFindings.map((finding) => ({ ...finding })), (finding) => finding.id),
    extractedManualFindingDrafts: sortByString(
      project.extractedManualFindingDrafts.map((draft) => ({ ...draft })),
      (draft) => draft.id,
    ),
    learningCases: sortByString(
      project.learningCases.map((learningCase) => ({ ...learningCase })),
      (learningCase) => learningCase.case_id,
    ),
  };
}

function resolveSourceKind(document: Project['documents'][number]): SourceDocument['kind'] {
  const lower = document.fileName.toLowerCase();
  if (document.mimeType === 'application/pdf' || lower.endsWith('.pdf')) return 'pdd';
  if (
    document.mimeType.includes('spreadsheet')
    || document.mimeType.includes('csv')
    || lower.endsWith('.xlsx')
    || lower.endsWith('.csv')
  ) return 'workbook';
  if (lower.includes('monitor') || document.mimeType.includes('word')) return 'monitoring-report';
  return 'other';
}

function buildSources(project: Project): SourceDocument[] {
  return project.documents.map((document) => ({
    id: document.id,
    fileName: document.fileName,
    mime: document.mimeType,
    kind: resolveSourceKind(document),
    sizeBytes: document.sizeBytes,
    contentSha256: document.contentSha256 ?? `${document.id}_missing_sha`,
  }));
}

function buildProjectFragments(project: Project, pins: EvidencePin[]): DocumentFragment[] {
  const documentFragments = project.documents
    .filter((document) => document.extractedText?.trim())
    .map((document) => ({
      fragmentId: `fragment_${document.id.replace(/[^a-zA-Z0-9]+/g, '_')}_001`,
      documentId: document.id,
      kind: resolveSourceKind(document),
      index: 0,
      label: 'Extracted source text',
      text: document.extractedText!.trim(),
      contentSha256: document.contentSha256 ?? `${document.id}_missing_sha`,
    }));

  const pinFragments = pins.flatMap((pin) =>
    (pin.pdd_fragments ?? []).map((fragment, index) => ({
      fragmentId: fragment.fragment_id,
      documentId: pin.pdd_document?.evidence_id ?? pin.id,
      kind: 'pdd' as const,
      index,
      label: fragment.label ?? fragment.section_heading ?? 'Pinned fragment',
      text: fragment.excerpt ?? '',
      contentSha256: pin.pdd_document?.sha256 ?? pin.attachments?.[0]?.sha256 ?? pin.id,
      pageStart: fragment.page_start,
      pageEnd: fragment.page_end,
    })),
  );

  return sortByString([...documentFragments, ...pinFragments], (fragment) => fragment.fragmentId);
}

async function buildFacts(fragments: DocumentFragment[]): Promise<ExtractedFact[]> {
  const facts: ExtractedFact[] = [];
  for (const fragment of fragments) {
    const summary = fragment.text.replace(/\s+/g, ' ').trim().slice(0, 160);
    if (!summary) continue;
    facts.push({
      factId: `${fragment.fragmentId}__fact_001`,
      fragmentId: fragment.fragmentId,
      documentId: fragment.documentId,
      factType: 'other',
      value: summary,
      context: fragment.label,
      contentSha256: await sha256Hex(`${fragment.fragmentId}:${summary}`),
    });
  }
  return facts;
}

async function buildCandidateLinks(project: Project, pins: EvidencePin[], facts: ExtractedFact[]): Promise<CandidateLink[]> {
  const factsByFragmentId = new Map(facts.map((fact) => [fact.fragmentId, fact]));
  const links: CandidateLink[] = [];

  for (const review of project.reviews) {
    for (const fact of facts) {
      if (!review.evidenceIds.includes(fact.documentId) && !review.evidenceIds.includes(fact.fragmentId)) continue;
      const contentSha256 = await sha256Hex(`${fact.factId}:${review.ruleId}:review-link`);
      links.push({
        linkId: `link_${fact.factId}_${review.ruleId}`,
        factId: fact.factId,
        ruleId: review.ruleId,
        ruleTitle: review.ruleTitle,
        sectionId: review.sectionId,
        matchType: 'exact-evidence-id',
        matchReason: 'Reviewer linked this evidence to the rule.',
        confidence: 1,
        contentSha256,
      });
    }
  }

  for (const pin of pins) {
    for (const link of pin.pdd_fragment_links ?? []) {
      const fact = factsByFragmentId.get(link.fragment_id);
      if (!fact) continue;
      const contentSha256 = await sha256Hex(`${fact.factId}:${link.rule_id}:fragment-link`);
      links.push({
        linkId: `link_${fact.factId}_${link.rule_id}`,
        factId: fact.factId,
        ruleId: link.rule_id,
        ruleTitle: link.rule_id,
        sectionId: 'Evidence Pins',
        matchType: 'exact-evidence-id',
        matchReason: 'Pinned fragment linked to the rule.',
        confidence: 1,
        contentSha256,
      });
    }
  }

  return sortByString(links, (link) => link.linkId);
}

function buildInventory(project: Project, sources: SourceDocument[]): EvidenceInventoryItem[] {
  return sources.map((source) => {
    const linkedRequirementIds = uniqSorted([
      ...project.reviews.filter((review) => review.evidenceIds.includes(source.id)).map((review) => review.ruleId),
      ...project.manualFindings.filter((finding) => finding.sourceDocumentId === source.id).map((finding) => finding.findingId),
    ]);

    return {
      evidence_id: source.id,
      dedupe_key: source.contentSha256,
      display_name: source.fileName,
      kind: source.kind === 'other' ? 'upload' : source.kind === 'monitoring-report' ? 'document' : source.kind,
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
    } satisfies EvidenceInventoryItem;
  });
}

async function buildReconciliationRun(
  project: Project,
  fragments: DocumentFragment[],
  candidateLinks: CandidateLink[],
  capturedAt: string,
) {
  const items = fragments.map((fragment) => {
    const linked = candidateLinks.some((link) => link.factId.startsWith(`${fragment.fragmentId}__`) || link.matchReason.includes(fragment.fragmentId));
    const primaryLink = candidateLinks.find((link) => link.factId.startsWith(`${fragment.fragmentId}__`));
    return {
      id: `rec_${fragment.fragmentId}`,
      fragmentId: fragment.fragmentId,
      ruleId: linked ? primaryLink?.ruleId : undefined,
      ruleTitle: linked ? primaryLink?.ruleTitle : undefined,
      sectionId: linked ? primaryLink?.sectionId : undefined,
      status: linked ? ('linked' as const) : ('unmatched' as const),
      matchType: linked ? 'manual-link' : undefined,
      confidence: linked ? 1 : undefined,
      isManualOverride: linked,
      contentSha256: fragment.contentSha256,
    };
  });

  const gaps = project.reviews
    .filter((review) => review.status !== 'verified' && review.status !== 'not-applicable')
    .map((review) => ({
      ruleId: review.ruleId,
      ruleTitle: review.ruleTitle,
      sectionId: review.sectionId,
      expectedEvidenceIds: [...review.evidenceIds],
      matchedEvidenceIds: review.status === 'gap' ? [] : [...review.evidenceIds],
    }));

  const itemFingerprint = await sha256Hex(snapshotCanonicalJson(items));
  const gapFingerprint = await sha256Hex(snapshotCanonicalJson(gaps));
  const reconciliationFingerprint = await sha256Hex(snapshotCanonicalJson({
    projectId: project.id,
    itemFingerprint,
    gapFingerprint,
  }));

  const status: 'complete' | 'no-rules' = project.reviews.length > 0 ? 'complete' : 'no-rules';

  return {
    runId: reconciliationFingerprint,
    createdAt: capturedAt,
    projectId: project.id,
    status,
    items,
    gaps,
    itemFingerprint,
    gapFingerprint,
    reconciliationFingerprint,
  };
}

async function buildDecisionRun(project: Project, capturedAt: string): Promise<DecisionRun> {
  const decisions: ReviewerDecision[] = project.reviews
    .filter((review) => review.status !== 'not-started' || review.note?.trim() || review.evidenceIds.length > 0)
    .map((review) => ({
      decisionId: `dec_${review.ruleId}_${project.id}`,
      ruleId: review.ruleId,
      ruleTitle: review.ruleTitle,
      sectionId: review.sectionId,
      status: review.status === 'verified' ? 'approved' : review.status === 'gap' ? 'rejected' : 'needs-review',
      rationale: review.note?.trim() || 'Reviewer decision derived from linked project evidence.',
      reviewerId: 'project-reviewer',
      reviewedAt: review.reviewedAt ?? capturedAt,
      updatedAt: review.reviewedAt ?? capturedAt,
      evidenceInventoryIds: [...review.evidenceIds],
      provenanceHash: '',
    }));

  for (const decision of decisions) {
    decision.provenanceHash = await sha256Hex(snapshotCanonicalJson(decision));
  }

  const decisionSetFingerprint = await sha256Hex(snapshotCanonicalJson(decisions));
  const runId = await sha256Hex(snapshotCanonicalJson({
    projectId: project.id,
    decisionSetFingerprint,
  }));

  return {
    runId,
    projectId: project.id,
    createdAt: capturedAt,
    decisions,
    decisionSetFingerprint,
  };
}

function normalizeAttachment(attachment: EvidenceAttachment): EvidenceAttachment {
  return {
    ...attachment,
    workbook_asset: attachment.workbook_asset
      ? {
          ...attachment.workbook_asset,
          sheets: sortByString(
            attachment.workbook_asset.sheets.map((sheet) => ({
              ...sheet,
              header_columns: [...sheet.header_columns],
              warnings: [...sheet.warnings].sort((a, b) => a.localeCompare(b)),
            })),
            (sheet) => `${String(sheet.sheet_index).padStart(6, '0')}:${sheet.sheet_name}`,
          ),
          record_groups: sortByString(
            attachment.workbook_asset.record_groups.map((group) => ({
              ...group,
              column_names: [...group.column_names],
              rows: group.rows.map((row) =>
                Object.fromEntries(Object.entries(row).sort(([left], [right]) => left.localeCompare(right))),
              ),
            })),
            (group) => group.group_id,
          ),
          warnings: [...attachment.workbook_asset.warnings].sort((a, b) => a.localeCompare(b)),
        }
      : attachment.workbook_asset,
  };
}

function normalizeFragmentLinks(fragmentLinks: PddFragmentLink[] | undefined, fallbackTimestamp: string): PddFragmentLink[] | undefined {
  if (!fragmentLinks?.length) return undefined;
  const normalized = sortByString(
    fragmentLinks.map((link) => ({
      ...link,
      linked_at: link.linked_at ?? fallbackTimestamp,
    })),
    (link) => `${link.fragment_id}:${link.rule_id}:${link.linked_at ?? fallbackTimestamp}`,
  );
  return normalized.length ? normalized : undefined;
}

function normalizePins(pins: EvidencePin[]): EvidencePin[] {
  return sortByString(
    pins.map((pin) => ({
      ...pin,
      cited_ids: uniqSorted(pin.cited_ids),
      attachments: pin.attachments
        ? sortByString(pin.attachments.map(normalizeAttachment), (attachment) => `${attachment.created_at}:${attachment.id}`)
        : undefined,
      pdd_fragments: pin.pdd_fragments
        ? sortByString(pin.pdd_fragments.map((fragment) => ({ ...fragment })), (fragment) => fragment.fragment_id)
        : undefined,
      pdd_fragment_links: normalizeFragmentLinks(pin.pdd_fragment_links, pin.created_at),
      stac_item_ids: uniqSorted(pin.stac_item_ids ?? []),
    })),
    (pin) => pin.id,
  );
}

function normalizeVerificationRuns(runs: VerificationRun[]): VerificationRun[] {
  return sortByString(
    runs.map((run) => ({
      ...run,
      cited_ids: uniqSorted(run.cited_ids),
      attachment_sha256: uniqSorted(run.attachment_sha256),
    })),
    (run) => run.id,
  );
}

function normalizeAoi(aoi: AOI | null): AOI | null {
  if (!aoi) return null;
  return {
    ...aoi,
    bbox: [...aoi.bbox] as AOI['bbox'],
    geojson: aoi.geojson ? structuredClone(aoi.geojson) : null,
    feature_collection: aoi.feature_collection ? structuredClone(aoi.feature_collection) : undefined,
    features: aoi.features
      ? aoi.features.map((feature) => ({
          ...feature,
          bbox: feature.bbox ? [...feature.bbox] as [number, number, number, number] : null,
          geojson: structuredClone(feature.geojson),
        }))
      : undefined,
  };
}

function resolveCapturedAt(project: Project, proofMap: LoadedProofMapState): string {
  const pinTimestamps = proofMap.evidencePins.flatMap((pin) => [
    pin.created_at,
    pin.pdd_document?.added_at,
    ...(pin.attachments ?? []).map((attachment) => attachment.created_at),
    ...(pin.pdd_fragment_links ?? []).map((link) => link.linked_at),
  ]);
  const runTimestamps = proofMap.verificationRuns.flatMap((run) => [run.created_at, run.ended_at]);

  return latestTimestamp([
    project.createdAt,
    project.lockedAt,
    ...project.reviews.map((review) => review.reviewedAt),
    ...project.documents.map((document) => document.uploadedAt),
    ...project.manualFindings.flatMap((finding) => [finding.createdAt, finding.updatedAt]),
    ...project.extractedManualFindingDrafts.flatMap((draft) => [draft.createdAt, draft.updatedAt]),
    ...project.learningCases.map((learningCase) => learningCase.created_at),
    ...pinTimestamps,
    ...runTimestamps,
    proofMap.aoiData?.created_at,
  ]);
}

function buildDefaultLabel(capturedAt: string): string {
  return `Snapshot ${capturedAt.slice(0, 19).replace('T', ' ')}`;
}

async function loadProofMapState(project: Project): Promise<LoadedProofMapState> {
  if (!project.methodCode || !project.methodVersion) {
    return { aoiData: null, evidencePins: [], verificationRuns: [] };
  }

  return {
    aoiData: normalizeAoi(loadAoi(project.methodCode, project.methodVersion)),
    evidencePins: normalizePins(loadPins(project.methodCode, project.methodVersion)),
    verificationRuns: normalizeVerificationRuns(loadVerificationRuns(project.methodCode, project.methodVersion)),
  };
}

export async function buildSnapshotState(project: Project): Promise<EvidenceSnapshotState> {
  const normalizedProject = normalizeProject(project);
  const proofMap = await loadProofMapState(normalizedProject);
  const coverage = getProjectCoverage(normalizedProject);
  const capturedAt = resolveCapturedAt(normalizedProject, proofMap);
  const sources = buildSources(normalizedProject);
  const fragments = buildProjectFragments(normalizedProject, proofMap.evidencePins);
  const facts = await buildFacts(fragments);
  const candidateLinks = await buildCandidateLinks(normalizedProject, proofMap.evidencePins, facts);
  const reconciliationRun = await buildReconciliationRun(normalizedProject, fragments, candidateLinks, capturedAt);
  const decisionRun = await buildDecisionRun(normalizedProject, capturedAt);

  return {
    project: normalizeProjectMeta(normalizedProject),
    coverage,
    reviews: normalizedProject.reviews,
    documents: normalizedProject.documents,
    manualFindings: normalizedProject.manualFindings,
    extractedDrafts: normalizedProject.extractedManualFindingDrafts,
    learningCases: normalizedProject.learningCases,
    sources,
    inventory: buildInventory(normalizedProject, sources),
    fragments,
    facts,
    candidateLinks,
    reconciliationRun,
    decisionRun,
    evidencePins: proofMap.evidencePins,
    verificationRuns: proofMap.verificationRuns,
    aoiData: proofMap.aoiData,
  };
}

export async function buildSnapshot(project: Project, label?: string, description?: string): Promise<EvidenceSnapshot> {
  const state = await buildSnapshotState(project);
  const capturedAt = resolveCapturedAt(project, {
    aoiData: state.aoiData,
    evidencePins: state.evidencePins,
    verificationRuns: state.verificationRuns,
  });
  const canonicalJson = snapshotCanonicalJson(state);
  const fingerprint = await sha256Hex(canonicalJson);
  const snapshotId = `snap_${(await sha256Hex(`${project.id}:${capturedAt}:${fingerprint}`)).slice(0, 24)}`;
  const trimmedLabel = label?.trim();
  const trimmedDescription = description?.trim();

  return {
    schemaVersion: 'evidence_snapshot.v2',
    snapshotId,
    projectId: project.id,
    label: trimmedLabel || buildDefaultLabel(capturedAt),
    description: trimmedDescription || undefined,
    capturedAt,
    createdAt: capturedAt,
    fingerprint,
    state,
  };
}

export async function verifySnapshotFingerprint(snapshot: EvidenceSnapshot): Promise<boolean> {
  const stateJson = snapshotCanonicalJson(snapshot.state);
  const expected = await sha256Hex(stateJson);
  return expected === snapshot.fingerprint;
}
