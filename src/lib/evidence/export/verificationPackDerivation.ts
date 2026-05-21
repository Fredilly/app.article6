import { canonicalStringify, sha256Hex } from '@/integrity/artifacts';
import { buildEvidenceInventory, coalesceEvidencePins } from '@/lib/evidence/inventory';
import type { DecisionRun, ReviewerDecision } from '@/lib/evidence/decisions/types';
import type { CandidateLink, DocumentFragment, ExtractedFact, FactType } from '@/lib/evidence/extraction/types';
import type { ReconciliationItem, ReconciliationRun, CoverageGap, ReconciliationStatus } from '@/lib/evidence/reconciliation/types';
import type { EvidencePin } from '@/lib/proofMap/types';
import type { RuleReview } from '@/lib/verify/reviewStore';
import type { TraceIndex } from '@/lib/trace/traceIndex';
import type { CurrentMethodReviewExportInput, FinalizedAuditPackReviewInput } from '@/exports/verificationPackContract';
import type { EvidenceIntelligenceData } from './verificationPackIntegration';

type ContractRule = {
  id: string;
  text: string;
};

function sortByString<T>(items: T[], select: (item: T) => string): T[] {
  return [...items].sort((a, b) => select(a).localeCompare(select(b)));
}

function sanitizeId(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return normalized || 'item';
}

function normalizeText(value: string | null | undefined): string {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
}

function sha256String(value: string): string {
  return sha256Hex(Buffer.from(value, 'utf8'));
}

function stableHash(value: unknown): string {
  return sha256Hex(Buffer.from(canonicalStringify(JSON.parse(JSON.stringify(value))), 'utf8'));
}

function parseRules(rulesJson: unknown): ContractRule[] {
  const items = Array.isArray(rulesJson)
    ? rulesJson
    : rulesJson && typeof rulesJson === 'object' && Array.isArray((rulesJson as { rules?: unknown[] }).rules)
      ? ((rulesJson as { rules: unknown[] }).rules ?? [])
      : [];

  return items
    .flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const record = item as Record<string, unknown>;
      const id =
        typeof record.id === 'string' ? record.id.trim()
        : typeof record.rule_id === 'string' ? record.rule_id.trim()
        : typeof record.ruleId === 'string' ? record.ruleId.trim()
        : typeof record.key === 'string' ? record.key.trim()
        : '';
      if (!id) return [];
      const text = typeof record.text === 'string' ? record.text.trim() : '';
      return [{ id, text }];
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function pickSectionId(ruleId: string, trace: TraceIndex): string {
  return trace.rule_to_sections[ruleId]?.[0]?.section_id ?? 'Unknown';
}

function buildRuleTitleMap(rulesJson: unknown, currentReview?: CurrentMethodReviewExportInput | null): Map<string, string> {
  const map = new Map(parseRules(rulesJson).map((rule) => [rule.id, rule.text || rule.id]));
  for (const review of currentReview?.reviews ?? []) {
    if (!map.has(review.ruleId)) map.set(review.ruleId, review.ruleId);
  }
  return map;
}

function linkedRuleIdsForPin(pin: EvidencePin): string[] {
  const ids = new Set<string>();
  if (pin.ruleId?.trim()) ids.add(pin.ruleId.trim());
  for (const cited of pin.cited_ids ?? []) {
    const trimmed = cited.trim();
    if (trimmed) ids.add(trimmed);
  }
  for (const link of pin.pdd_fragment_links ?? []) {
    const trimmed = link.rule_id?.trim();
    if (trimmed) ids.add(trimmed);
  }
  return Array.from(ids).sort((a, b) => a.localeCompare(b));
}

function inferFactType(fragment: DocumentFragment): FactType {
  const haystack = `${fragment.label} ${fragment.text}`.toLowerCase();
  if (haystack.includes('baseline')) return 'baseline-scenario';
  if (haystack.includes('monitor')) return 'monitoring-period';
  if (haystack.includes('location') || haystack.includes('aoi')) return 'location';
  if (haystack.includes('method')) return 'methodology-reference';
  if (/\b\d+(?:\.\d+)?\b/.test(haystack)) return 'quantity';
  return 'other';
}

function summarizeWorkbookRows(rows: Array<Record<string, string>>): string {
  if (!rows.length) return 'Workbook record group';
  return rows
    .slice(0, 3)
    .map((row) =>
      Object.entries(row)
        .slice(0, 4)
        .map(([key, value]) => `${key}: ${value}`)
        .join('; '),
    )
    .join(' | ');
}

function buildFragments(pins: EvidencePin[]): DocumentFragment[] {
  const inventory = buildEvidenceInventory(pins);
  const fragments: DocumentFragment[] = [];

  for (const item of sortByString(inventory, (candidate) => candidate.evidence_id)) {
    const itemKind = item.kind === 'pdd'
      ? 'pdd'
      : item.kind === 'workbook'
        ? 'workbook'
        : item.kind === 'document'
          ? 'monitoring-report'
          : 'other';

    if (item.pdd_fragments?.length) {
      const ordered = sortByString(item.pdd_fragments, (fragment) => fragment.fragment_id);
      ordered.forEach((fragment, index) => {
        const text = normalizeText(fragment.excerpt)
          || normalizeText(fragment.section_heading)
          || normalizeText(fragment.section_label)
          || normalizeText(item.provenance_summary)
          || 'PDD fragment';
        fragments.push({
          fragmentId: fragment.fragment_id,
          documentId: item.evidence_id,
          kind: 'pdd',
          index,
          label: normalizeText(fragment.label) || normalizeText(fragment.section_heading) || `Fragment ${index + 1}`,
          text,
          contentSha256: item.pdd_document?.sha256?.trim() || sha256String(`${fragment.fragment_id}:${text}`),
          pageStart: fragment.page_start,
          pageEnd: fragment.page_end,
          sheetName: normalizeText(fragment.section_label) || undefined,
        });
      });
    }

    if (item.workbook_record_groups?.length) {
      const orderedGroups = sortByString(item.workbook_record_groups, (group) => group.group_id);
      orderedGroups.forEach((group, index) => {
        const text = normalizeText(group.provenance_summary) || summarizeWorkbookRows(group.rows);
        fragments.push({
          fragmentId: `${item.evidence_id}__${sanitizeId(group.group_id)}`,
          documentId: item.evidence_id,
          kind: 'workbook',
          index,
          label: normalizeText(group.display_name) || `Workbook group ${index + 1}`,
          text,
          contentSha256: sha256String(`${group.group_id}:${text}`),
          sheetName: normalizeText(group.source_sheet) || undefined,
        });
      });
    }

    if (!item.pdd_fragments?.length && !item.workbook_record_groups?.length) {
      const text = normalizeText(item.provenance_summary) || normalizeText(item.source_summary) || normalizeText(item.display_name);
      if (!text) continue;
      fragments.push({
        fragmentId: `${item.evidence_id}__summary`,
        documentId: item.evidence_id,
        kind: itemKind,
        index: 0,
        label: normalizeText(item.display_name) || item.evidence_id,
        text,
        contentSha256: item.pdd_document?.sha256?.trim() || sha256String(`${item.evidence_id}:${text}`),
      });
    }
  }

  return sortByString(fragments, (fragment) => fragment.fragmentId);
}

function buildFacts(fragments: DocumentFragment[]): ExtractedFact[] {
  return fragments
    .filter((fragment) => normalizeText(fragment.text))
    .map((fragment) => ({
      factId: `${fragment.fragmentId}__fact_001`,
      fragmentId: fragment.fragmentId,
      documentId: fragment.documentId,
      factType: inferFactType(fragment),
      value: normalizeText(fragment.text).slice(0, 240),
      context: fragment.label,
      pageRef: fragment.pageStart ? `${fragment.pageStart}${fragment.pageEnd && fragment.pageEnd !== fragment.pageStart ? `-${fragment.pageEnd}` : ''}` : undefined,
      sheetRef: fragment.sheetName,
      contentSha256: sha256String(`${fragment.fragmentId}:${normalizeText(fragment.text).slice(0, 240)}`),
    }));
}

function buildFragmentRefMap(
  pins: EvidencePin[],
  fragments: DocumentFragment[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();

  const add = (key: string | null | undefined, fragmentId: string) => {
    const trimmed = key?.trim();
    if (!trimmed) return;
    const current = map.get(trimmed) ?? [];
    if (!current.includes(fragmentId)) current.push(fragmentId);
    map.set(trimmed, current.sort((a, b) => a.localeCompare(b)));
  };

  const byDoc = new Map<string, string[]>(fragments.reduce<Array<[string, string[]]>>((acc, fragment) => {
    const current = acc.find(([id]) => id === fragment.documentId);
    if (current) current[1].push(fragment.fragmentId);
    else acc.push([fragment.documentId, [fragment.fragmentId]]);
    return acc;
  }, []).map(([id, fragmentIds]) => [id, fragmentIds.sort((a, b) => a.localeCompare(b))]));

  for (const pin of coalesceEvidencePins(pins)) {
    const fragmentIds = byDoc.get(pin.id) ?? [];
    for (const fragmentId of fragmentIds) {
      add(pin.id, fragmentId);
      add(pin.itemId, fragmentId);
      add(pin.title, fragmentId);
      for (const cited of pin.cited_ids ?? []) add(cited, fragmentId);
      for (const stacId of pin.stac_item_ids ?? []) add(stacId, fragmentId);
      add(pin.pdd_document?.evidence_id, fragmentId);
    }
    for (const fragment of pin.pdd_fragments ?? []) {
      add(fragment.fragment_id, fragment.fragment_id);
    }
  }

  return map;
}

function uniqueEvidenceRefs(review: RuleReview): string[] {
  const refs = new Set<string>();
  const add = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    if (trimmed) refs.add(trimmed);
  };
  add(review.supportReference);
  add(review.evidenceLink);
  for (const attachment of review.evidenceAttachments) {
    add(attachment.label);
    add(attachment.id);
  }
  return Array.from(refs).sort((a, b) => a.localeCompare(b));
}

function addLink(
  candidateLinks: CandidateLink[],
  keySet: Set<string>,
  input: {
    factId: string;
    ruleId: string;
    ruleTitle: string;
    sectionId: string;
    matchType: CandidateLink['matchType'];
    matchReason: string;
    confidence: number;
  },
): void {
  const dedupeKey = `${input.factId}::${input.ruleId}`;
  if (keySet.has(dedupeKey)) return;
  keySet.add(dedupeKey);
  candidateLinks.push({
    linkId: `link_${sanitizeId(input.factId)}_${sanitizeId(input.ruleId)}`,
    factId: input.factId,
    ruleId: input.ruleId,
    ruleTitle: input.ruleTitle,
    sectionId: input.sectionId,
    matchType: input.matchType,
    matchReason: input.matchReason,
    confidence: input.confidence,
    contentSha256: sha256String(canonicalStringify({
      factId: input.factId,
      ruleId: input.ruleId,
      matchType: input.matchType,
      matchReason: input.matchReason,
      confidence: input.confidence,
    })),
  });
}

function buildCandidateLinks(params: {
  pins: EvidencePin[];
  currentReview?: CurrentMethodReviewExportInput | null;
  finalizedReview?: FinalizedAuditPackReviewInput | null;
  fragments: DocumentFragment[];
  facts: ExtractedFact[];
  rulesJson: unknown;
  trace: TraceIndex;
}): CandidateLink[] {
  const candidateLinks: CandidateLink[] = [];
  const keySet = new Set<string>();
  const factByFragmentId = new Map(params.facts.map((fact) => [fact.fragmentId, fact]));
  const ruleTitles = buildRuleTitleMap(params.rulesJson, params.currentReview);
  const fragmentRefs = buildFragmentRefMap(params.pins, params.fragments);
  const pins = coalesceEvidencePins(params.pins);

  for (const pin of pins) {
    const explicitRuleIds = linkedRuleIdsForPin(pin);
    const fallbackFragmentIds = (fragmentRefs.get(pin.id) ?? []).slice().sort((a, b) => a.localeCompare(b));

    for (const fragmentLink of sortByString(pin.pdd_fragment_links ?? [], (link) => `${link.fragment_id}:${link.rule_id}`)) {
      const fact = factByFragmentId.get(fragmentLink.fragment_id);
      if (!fact) continue;
      addLink(candidateLinks, keySet, {
        factId: fact.factId,
        ruleId: fragmentLink.rule_id,
        ruleTitle: ruleTitles.get(fragmentLink.rule_id) ?? fragmentLink.rule_id,
        sectionId: pickSectionId(fragmentLink.rule_id, params.trace),
        matchType: 'exact-evidence-id',
        matchReason: 'PDD fragment was explicitly linked to the requirement in review state.',
        confidence: 1,
      });
    }

    if (explicitRuleIds.length === 0) continue;
    for (const fragmentId of fallbackFragmentIds) {
      const fact = factByFragmentId.get(fragmentId);
      if (!fact) continue;
      for (const ruleId of explicitRuleIds) {
        addLink(candidateLinks, keySet, {
          factId: fact.factId,
          ruleId,
          ruleTitle: ruleTitles.get(ruleId) ?? ruleId,
          sectionId: pickSectionId(ruleId, params.trace),
          matchType: 'evidence-label-match',
          matchReason: 'Evidence pin is linked to the requirement in saved review state.',
          confidence: 0.95,
        });
      }
    }
  }

  for (const review of sortByString(params.currentReview?.reviews ?? [], (item) => item.ruleId)) {
    const refs = uniqueEvidenceRefs(review);
    for (const ref of refs) {
      for (const fragmentId of fragmentRefs.get(ref) ?? []) {
        const fact = factByFragmentId.get(fragmentId);
        if (!fact) continue;
        addLink(candidateLinks, keySet, {
          factId: fact.factId,
          ruleId: review.ruleId,
          ruleTitle: ruleTitles.get(review.ruleId) ?? review.ruleId,
          sectionId: pickSectionId(review.ruleId, params.trace),
          matchType: 'exact-evidence-id',
          matchReason: 'Reviewer cited this evidence directly in the current Method Review record.',
          confidence: 1,
        });
      }
    }
  }

  const artifact = params.finalizedReview?.artifact;
  const selectedRuleId =
    artifact?.summary?.ruleId?.trim()
    || artifact?.outcome?.linkage.selectedRuleId?.trim()
    || artifact?.outcome?.linkage.linkedRuleIds?.[0]?.trim()
    || null;
  const selectedEvidenceId =
    artifact?.summary?.selectedEvidenceId?.trim()
    || artifact?.selected?.id?.trim()
    || artifact?.selected?.item?.id?.trim()
    || null;
  if (selectedRuleId && selectedEvidenceId) {
    for (const fragmentId of fragmentRefs.get(selectedEvidenceId) ?? []) {
      const fact = factByFragmentId.get(fragmentId);
      if (!fact) continue;
      addLink(candidateLinks, keySet, {
        factId: fact.factId,
        ruleId: selectedRuleId,
        ruleTitle: ruleTitles.get(selectedRuleId) ?? selectedRuleId,
        sectionId: pickSectionId(selectedRuleId, params.trace),
        matchType: 'exact-evidence-id',
        matchReason: 'Finalized review selected this evidence item for the requirement.',
        confidence: 1,
      });
    }
  }

  return sortByString(candidateLinks, (link) => link.linkId);
}

function mapReviewStatusToDecisionStatus(status: RuleReview['status']): ReviewerDecision['status'] {
  if (status === 'verified') return 'approved';
  if (status === 'not_verified') return 'rejected';
  return 'needs-review';
}

function computeDecisionProvenanceHash(decision: ReviewerDecision): string {
  return stableHash({
    decisionId: decision.decisionId,
    ruleId: decision.ruleId,
    status: decision.status,
    rationale: decision.rationale,
    reviewerId: decision.reviewerId,
    reviewedAt: decision.reviewedAt,
    evidenceInventoryIds: [...decision.evidenceInventoryIds].sort((a, b) => a.localeCompare(b)),
    reconciliationRunId: decision.reconciliationRunId ?? null,
  });
}

function computeDecisionSetFingerprint(decisions: ReviewerDecision[]): string {
  return stableHash(
    sortByString(
      decisions.map((decision) => ({
        decisionId: decision.decisionId,
        status: decision.status,
        provenanceHash: decision.provenanceHash,
      })),
      (decision) => decision.decisionId,
    ),
  );
}

function buildDecisionRun(params: {
  currentReview?: CurrentMethodReviewExportInput | null;
  finalizedReview?: FinalizedAuditPackReviewInput | null;
  generatedAt: string;
  reconciliationRunId?: string;
}): DecisionRun | undefined {
  const decisions: ReviewerDecision[] = [];

  for (const review of sortByString(params.currentReview?.reviews ?? [], (item) => item.ruleId)) {
    const decision: ReviewerDecision = {
      decisionId: `dec_${sanitizeId(review.ruleId)}_${sanitizeId(review.reviewedBy || 'reviewer')}`,
      ruleId: review.ruleId,
      ruleTitle: review.ruleId,
      sectionId: 'Unknown',
      status: mapReviewStatusToDecisionStatus(review.status),
      rationale: normalizeText(review.rationale) || 'Reviewer decision exported from current Method Review state.',
      reviewerId: normalizeText(review.reviewedBy) || 'local-reviewer',
      reviewedAt: review.reviewedAt || review.updatedAt || params.generatedAt,
      updatedAt: review.updatedAt || review.reviewedAt || params.generatedAt,
      evidenceInventoryIds: uniqueEvidenceRefs(review),
      reconciliationRunId: params.reconciliationRunId,
      provenanceHash: '',
    };
    decision.provenanceHash = computeDecisionProvenanceHash(decision);
    decisions.push(decision);
  }

  const artifact = params.finalizedReview?.artifact;
  const finalizedRuleId =
    artifact?.summary?.ruleId?.trim()
    || artifact?.outcome?.linkage.selectedRuleId?.trim()
    || artifact?.outcome?.linkage.linkedRuleIds?.[0]?.trim()
    || null;
  if (artifact && finalizedRuleId) {
    const statusText = `${artifact.summary?.reviewState ?? ''} ${artifact.summary?.reconciliationStatus ?? ''}`.toLowerCase();
    const status: ReviewerDecision['status'] =
      /not supported|reject|fail|gap/.test(statusText) ? 'rejected'
      : /supported|verified|complete|approved|finalized|ready/.test(statusText) ? 'approved'
      : 'needs-review';
    const evidenceIds = [
      artifact.summary?.selectedEvidenceId,
      artifact.selected?.id,
      artifact.selected?.item?.id,
    ].map((value) => value?.trim()).filter((value): value is string => Boolean(value));
    const decision: ReviewerDecision = {
      decisionId: `dec_${sanitizeId(finalizedRuleId)}_${sanitizeId(artifact.verifier?.runId ?? 'finalized')}`,
      ruleId: finalizedRuleId,
      ruleTitle: artifact.summary?.ruleText?.trim() || finalizedRuleId,
      sectionId: artifact.summary?.ruleSection?.trim() || 'Unknown',
      status,
      rationale:
        normalizeText(artifact.summary?.narrative)
        || normalizeText(artifact.summary?.reconciliationReason)
        || normalizeText(artifact.summary?.outcomeNote)
        || normalizeText(artifact.verifier?.outcomeNote)
        || 'Reviewer decision exported from finalized review artifact.',
      reviewerId: 'local-reviewer',
      reviewedAt: artifact.verifier?.finalizedAt?.trim() || params.generatedAt,
      updatedAt: artifact.verifier?.finalizedAt?.trim() || params.generatedAt,
      evidenceInventoryIds: Array.from(new Set(evidenceIds)).sort((a, b) => a.localeCompare(b)),
      reconciliationRunId: params.reconciliationRunId,
      provenanceHash: '',
    };
    decision.provenanceHash = computeDecisionProvenanceHash(decision);
    decisions.push(decision);
  }

  if (decisions.length === 0) return undefined;
  const sortedDecisions = sortByString(decisions, (decision) => decision.decisionId);
  const decisionSetFingerprint = computeDecisionSetFingerprint(sortedDecisions);
  const runId = stableHash({
    generatedAt: params.generatedAt,
    reconciliationRunId: params.reconciliationRunId ?? null,
    decisionSetFingerprint,
  });
  return {
    runId,
    projectId:
      params.finalizedReview?.projectContext?.projectCode?.trim()
      || params.finalizedReview?.projectContext?.projectId?.trim()
      || params.currentReview?.projectContext?.projectCode?.trim()
      || params.currentReview?.projectContext?.projectId?.trim()
      || params.finalizedReview?.artifact?.verifier?.runId
      || params.currentReview?.verifierBundle?.runContext?.runId
      || 'method-review-export',
    createdAt: params.generatedAt,
    decisions: sortedDecisions,
    decisionSetFingerprint,
    reconciliationRunId: params.reconciliationRunId,
  };
}

function buildReconciliationRun(params: {
  currentReview?: CurrentMethodReviewExportInput | null;
  finalizedReview?: FinalizedAuditPackReviewInput | null;
  fragments: DocumentFragment[];
  candidateLinks: CandidateLink[];
  generatedAt: string;
  trace: TraceIndex;
  rulesJson: unknown;
}): ReconciliationRun | undefined {
  const factIdByFragmentId = new Map<string, string>(params.fragments.map((fragment) => [fragment.fragmentId, `${fragment.fragmentId}__fact_001`]));
  const linksByFragment = new Map<string, CandidateLink[]>();
  for (const link of params.candidateLinks) {
    const fragmentId = link.factId.replace(/__fact_001$/, '');
    const current = linksByFragment.get(fragmentId) ?? [];
    current.push(link);
    linksByFragment.set(fragmentId, current);
  }

  const items: ReconciliationItem[] = [];
  for (const fragment of params.fragments) {
    const links = sortByString(linksByFragment.get(fragment.fragmentId) ?? [], (link) => link.ruleId);
    if (links.length === 0) {
      items.push({
        id: `rec_${sanitizeId(fragment.fragmentId)}`,
        fragmentId: fragment.fragmentId,
        factId: factIdByFragmentId.get(fragment.fragmentId),
        status: 'unmatched',
        isManualOverride: false,
        contentSha256: fragment.contentSha256,
      });
      continue;
    }
    for (const link of links) {
      items.push({
        id: `rec_${sanitizeId(fragment.fragmentId)}_${sanitizeId(link.ruleId)}`,
        fragmentId: fragment.fragmentId,
        factId: link.factId,
        ruleId: link.ruleId,
        ruleTitle: link.ruleTitle,
        sectionId: link.sectionId,
        status: 'linked',
        matchType: link.matchType,
        confidence: link.confidence,
        isManualOverride: link.confidence >= 0.95,
        contentSha256: fragment.contentSha256,
      });
    }
  }

  const ruleTitles = buildRuleTitleMap(params.rulesJson, params.currentReview);
  const ruleIds = new Set<string>();
  for (const review of params.currentReview?.reviews ?? []) ruleIds.add(review.ruleId);
  for (const link of params.candidateLinks) ruleIds.add(link.ruleId);
  const finalizedRuleId =
    params.finalizedReview?.artifact?.summary?.ruleId?.trim()
    || params.finalizedReview?.artifact?.outcome?.linkage.selectedRuleId?.trim()
    || params.finalizedReview?.artifact?.outcome?.linkage.linkedRuleIds?.[0]?.trim()
    || null;
  if (finalizedRuleId) ruleIds.add(finalizedRuleId);

  const linksByRule = new Map<string, CandidateLink[]>();
  for (const link of params.candidateLinks) {
    const current = linksByRule.get(link.ruleId) ?? [];
    current.push(link);
    linksByRule.set(link.ruleId, current);
  }

  const reviewByRule = new Map((params.currentReview?.reviews ?? []).map((review) => [review.ruleId, review]));
  const gaps: CoverageGap[] = [];
  for (const ruleId of Array.from(ruleIds).sort((a, b) => a.localeCompare(b))) {
    const review = reviewByRule.get(ruleId) ?? null;
    const matchedEvidenceIds = Array.from(
      new Set((linksByRule.get(ruleId) ?? []).map((link) => {
        const fragmentId = link.factId.replace(/__fact_001$/, '');
        return params.fragments.find((fragment) => fragment.fragmentId === fragmentId)?.documentId ?? fragmentId;
      })),
    ).sort((a, b) => a.localeCompare(b));
    const expectedEvidenceIds = review ? uniqueEvidenceRefs(review) : [...matchedEvidenceIds];
    const isSatisfied = review?.status === 'verified' && matchedEvidenceIds.length > 0;
    if (!isSatisfied) {
      gaps.push({
        ruleId,
        ruleTitle: ruleTitles.get(ruleId) ?? ruleId,
        sectionId: pickSectionId(ruleId, params.trace),
        expectedEvidenceIds,
        matchedEvidenceIds,
      });
    }
  }

  const itemFingerprint = stableHash(sortByString(items, (item) => item.id));
  const gapFingerprint = stableHash(sortByString(gaps, (gap) => gap.ruleId));
  const reconciliationFingerprint = stableHash({ itemFingerprint, gapFingerprint });
  const status: ReconciliationStatus =
    items.length > 0 || gaps.length > 0 || (params.currentReview?.reviews?.length ?? 0) > 0 || finalizedRuleId
      ? 'complete'
      : 'no-rules';

  return {
    runId: reconciliationFingerprint,
    createdAt: params.generatedAt,
    projectId:
      params.finalizedReview?.projectContext?.projectCode?.trim()
      || params.finalizedReview?.projectContext?.projectId?.trim()
      || params.currentReview?.projectContext?.projectCode?.trim()
      || params.currentReview?.projectContext?.projectId?.trim()
      || params.finalizedReview?.artifact?.verifier?.runId
      || params.currentReview?.verifierBundle?.runContext?.runId
      || 'method-review-export',
    status,
    items: sortByString(items, (item) => item.id),
    gaps: sortByString(gaps, (gap) => gap.ruleId),
    itemFingerprint,
    gapFingerprint,
    reconciliationFingerprint,
  };
}

export function buildVerificationPackEvidenceIntelligence(params: {
  generatedAt: string;
  rulesJson: unknown;
  trace: TraceIndex;
  currentReview?: CurrentMethodReviewExportInput | null;
  finalizedReview?: FinalizedAuditPackReviewInput | null;
}): EvidenceIntelligenceData | null {
  const pins = coalesceEvidencePins([
    ...(params.currentReview?.evidencePins ?? []),
    ...(params.finalizedReview?.evidencePins ?? []),
  ]);
  if (pins.length === 0 && (params.currentReview?.reviews?.length ?? 0) === 0 && !params.finalizedReview?.artifact) {
    return null;
  }

  const fragments = buildFragments(pins);
  const facts = buildFacts(fragments);
  const candidateLinks = buildCandidateLinks({
    pins,
    currentReview: params.currentReview,
    finalizedReview: params.finalizedReview,
    fragments,
    facts,
    rulesJson: params.rulesJson,
    trace: params.trace,
  });
  const reconciliationRun = buildReconciliationRun({
    currentReview: params.currentReview,
    finalizedReview: params.finalizedReview,
    fragments,
    candidateLinks,
    generatedAt: params.generatedAt,
    trace: params.trace,
    rulesJson: params.rulesJson,
  });
  const decisionRun = buildDecisionRun({
    currentReview: params.currentReview,
    finalizedReview: params.finalizedReview,
    generatedAt: params.generatedAt,
    reconciliationRunId: reconciliationRun?.runId,
  });

  if (fragments.length === 0 && facts.length === 0 && candidateLinks.length === 0 && !reconciliationRun && !decisionRun) {
    return null;
  }

  return {
    fragments,
    facts,
    candidateLinks,
    reconciliationRun,
    decisionRun,
  };
}
