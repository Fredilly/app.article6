import { canonicalJsonStringify } from './canonical';
import type {
  EvidenceSnapshot,
  EvidenceSnapshotDiff,
  SnapshotDiffItem,
  SnapshotReview,
  SnapshotDocument,
  SnapshotFinding,
  SnapshotExtractedDraft,
  SnapshotDecision,
  SnapshotPin,
} from './types';

function normalizeForDiff(value: Record<string, unknown>): string {
  return canonicalJsonStringify(value);
}

function diffArray<T extends Record<string, unknown>>(
  left: T[],
  right: T[],
  idKey: keyof T,
  labelKey: keyof T,
  compareKeys?: (keyof T)[],
): SnapshotDiffItem[] {
  const result: SnapshotDiffItem[] = [];
  const leftMap = new Map<string, T>();
  const rightMap = new Map<string, T>();

  for (const item of left) {
    const id = String(item[idKey] ?? '');
    leftMap.set(id, item);
  }
  for (const item of right) {
    const id = String(item[idKey] ?? '');
    rightMap.set(id, item);
  }

  const allIds = new Set([...leftMap.keys(), ...rightMap.keys()]);

  for (const id of allIds) {
    const l = leftMap.get(id);
    const r = rightMap.get(id);
    const label = String((r ?? l)?.[labelKey] ?? id);

    if (!l && r) {
      result.push({ kind: 'added', id, label, right: r as Record<string, unknown> });
    } else if (l && !r) {
      result.push({ kind: 'removed', id, label, left: l as Record<string, unknown> });
    } else if (l && r) {
      if (compareKeys) {
        const lNorm = normalizeForDiff(pickKeys(l, compareKeys));
        const rNorm = normalizeForDiff(pickKeys(r, compareKeys));
        if (lNorm !== rNorm) {
          result.push({ kind: 'changed', id, label, left: l as Record<string, unknown>, right: r as Record<string, unknown> });
        }
      } else {
        const lNorm = normalizeForDiff(l as Record<string, unknown>);
        const rNorm = normalizeForDiff(r as Record<string, unknown>);
        if (lNorm !== rNorm) {
          result.push({ kind: 'changed', id, label, left: l as Record<string, unknown>, right: r as Record<string, unknown> });
        }
      }
    }
  }

  return result;
}

function pickKeys<T extends Record<string, unknown>>(obj: T, keys: (keyof T)[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    out[String(key)] = obj[key];
  }
  return out;
}

const REVIEW_COMPARE_KEYS: (keyof SnapshotReview)[] = ['status', 'outcome', 'note', 'evidenceIds'];
const DOCUMENT_COMPARE_KEYS: (keyof SnapshotDocument)[] = ['fileName', 'sizeBytes', 'contentSha256'];
const FINDING_COMPARE_KEYS: (keyof SnapshotFinding)[] = ['findingType', 'requirement', 'closureStatus'];
const EXTRACTED_DRAFT_COMPARE_KEYS: (keyof SnapshotExtractedDraft)[] = ['findingType', 'requirement', 'closureStatus', 'extractionStatus', 'evidenceExcerpt'];
const DECISION_COMPARE_KEYS: (keyof SnapshotDecision)[] = ['status', 'rationale', 'evidenceIds'];
const PIN_COMPARE_KEYS: (keyof SnapshotPin)[] = ['kind', 'ruleId', 'citedIds', 'attachmentCount', 'stacItemCount'];

export function computeSnapshotDiff(
  left: EvidenceSnapshot,
  right: EvidenceSnapshot,
): EvidenceSnapshotDiff {
  const reviews = diffArray(left.state.reviews, right.state.reviews, 'ruleId', 'ruleTitle', REVIEW_COMPARE_KEYS);
  const documents = diffArray(left.state.documents, right.state.documents, 'id', 'fileName', DOCUMENT_COMPARE_KEYS);
  const findings = diffArray(left.state.manualFindings, right.state.manualFindings, 'id', 'findingId', FINDING_COMPARE_KEYS);
  const extractedDrafts = diffArray(left.state.extractedDrafts, right.state.extractedDrafts, 'id', 'findingId', EXTRACTED_DRAFT_COMPARE_KEYS);
  const decisions = diffArray(left.state.decisions, right.state.decisions, 'decisionId', 'ruleTitle', DECISION_COMPARE_KEYS);
  const evidencePins = diffArray(left.state.evidencePins, right.state.evidencePins, 'id', 'title', PIN_COMPARE_KEYS);
  const verificationRuns = diffArray(left.state.verificationRuns, right.state.verificationRuns, 'id', 'id');

  const countByKind = (items: SnapshotDiffItem[], kind: string) =>
    items.filter((i) => i.kind === kind).length;

  return {
    leftSnapshotId: left.snapshotId,
    rightSnapshotId: right.snapshotId,
    leftLabel: left.label,
    rightLabel: right.label,
    computedAt: new Date().toISOString(),
    summary: {
      reviewsAdded: countByKind(reviews, 'added'),
      reviewsRemoved: countByKind(reviews, 'removed'),
      reviewsChanged: countByKind(reviews, 'changed'),
      documentsAdded: countByKind(documents, 'added'),
      documentsRemoved: countByKind(documents, 'removed'),
      findingsAdded: countByKind(findings, 'added'),
      findingsRemoved: countByKind(findings, 'removed'),
      findingsChanged: countByKind(findings, 'changed'),
      extractedDraftsAdded: countByKind(extractedDrafts, 'added'),
      extractedDraftsRemoved: countByKind(extractedDrafts, 'removed'),
      extractedDraftsChanged: countByKind(extractedDrafts, 'changed'),
      decisionsChanged: countByKind(decisions, 'changed') + countByKind(decisions, 'added') + countByKind(decisions, 'removed'),
      evidencePinsAdded: countByKind(evidencePins, 'added'),
      evidencePinsRemoved: countByKind(evidencePins, 'removed'),
      verificationRunsAdded: countByKind(verificationRuns, 'added'),
      verificationRunsRemoved: countByKind(verificationRuns, 'removed'),
      coverageChange: {
        leftPercent: left.state.coverage.percentComplete,
        rightPercent: right.state.coverage.percentComplete,
      },
    },
    details: { reviews, documents, findings, extractedDrafts, decisions, evidencePins, verificationRuns },
  };
}
