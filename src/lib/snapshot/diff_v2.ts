import { canonicalJsonStringify } from './canonical';
import type {
  EvidenceSnapshot,
  EvidenceSnapshotDiff,
  SnapshotDiffItem,
  SnapshotDiffSectionKey,
  SnapshotDiffSectionSummary,
} from './types_v2';

function normalizeForDiff(value: Record<string, unknown>): string {
  return canonicalJsonStringify(value);
}

function diffArray<T extends Record<string, unknown>>(
  left: T[],
  right: T[],
  idSelector: (item: T) => string,
  labelSelector: (item: T) => string,
): SnapshotDiffItem[] {
  const result: SnapshotDiffItem[] = [];
  const leftMap = new Map<string, T>();
  const rightMap = new Map<string, T>();

  for (const item of left) leftMap.set(idSelector(item), item);
  for (const item of right) rightMap.set(idSelector(item), item);

  const allIds = Array.from(new Set([...leftMap.keys(), ...rightMap.keys()])).sort((a, b) => a.localeCompare(b));
  for (const id of allIds) {
    const leftItem = leftMap.get(id);
    const rightItem = rightMap.get(id);
    const label = labelSelector((rightItem ?? leftItem ?? { id }) as T);

    if (!leftItem && rightItem) {
      result.push({ kind: 'added', id, label, right: rightItem as Record<string, unknown> });
      continue;
    }
    if (leftItem && !rightItem) {
      result.push({ kind: 'removed', id, label, left: leftItem as Record<string, unknown> });
      continue;
    }
    if (leftItem && rightItem) {
      const leftNormalized = normalizeForDiff(leftItem as Record<string, unknown>);
      const rightNormalized = normalizeForDiff(rightItem as Record<string, unknown>);
      if (leftNormalized !== rightNormalized) {
        result.push({
          kind: 'changed',
          id,
          label,
          left: leftItem as Record<string, unknown>,
          right: rightItem as Record<string, unknown>,
        });
      }
    }
  }

  return result;
}

function countSection(items: SnapshotDiffItem[]): SnapshotDiffSectionSummary {
  return {
    added: items.filter((item) => item.kind === 'added').length,
    removed: items.filter((item) => item.kind === 'removed').length,
    changed: items.filter((item) => item.kind === 'changed').length,
  };
}

const SECTION_BUILDERS: Record<
  SnapshotDiffSectionKey,
  (snapshot: EvidenceSnapshot) => Array<Record<string, unknown>>
> = {
  project: (snapshot) => [snapshot.state.project as Record<string, unknown>],
  coverage: (snapshot) => [{ id: 'coverage', label: 'Coverage', ...snapshot.state.coverage }],
  reviews: (snapshot) => snapshot.state.reviews as Array<Record<string, unknown>>,
  documents: (snapshot) => snapshot.state.documents as Array<Record<string, unknown>>,
  manualFindings: (snapshot) => snapshot.state.manualFindings as Array<Record<string, unknown>>,
  extractedDrafts: (snapshot) => snapshot.state.extractedDrafts as Array<Record<string, unknown>>,
  learningCases: (snapshot) => snapshot.state.learningCases as Array<Record<string, unknown>>,
  sources: (snapshot) => snapshot.state.sources as Array<Record<string, unknown>>,
  inventory: (snapshot) => snapshot.state.inventory as Array<Record<string, unknown>>,
  fragments: (snapshot) => snapshot.state.fragments as Array<Record<string, unknown>>,
  facts: (snapshot) => snapshot.state.facts as Array<Record<string, unknown>>,
  candidateLinks: (snapshot) => snapshot.state.candidateLinks as Array<Record<string, unknown>>,
  reconciliationItems: (snapshot) => (snapshot.state.reconciliationRun?.items ?? []) as Array<Record<string, unknown>>,
  reconciliationGaps: (snapshot) => (snapshot.state.reconciliationRun?.gaps ?? []) as Array<Record<string, unknown>>,
  reviewerDecisions: (snapshot) => (snapshot.state.decisionRun?.decisions ?? []) as Array<Record<string, unknown>>,
  evidencePins: (snapshot) => snapshot.state.evidencePins as Array<Record<string, unknown>>,
  verificationRuns: (snapshot) => snapshot.state.verificationRuns as Array<Record<string, unknown>>,
  aoiData: (snapshot) => (snapshot.state.aoiData ? [snapshot.state.aoiData as Record<string, unknown>] : []),
};

const SECTION_SELECTORS: Record<
  SnapshotDiffSectionKey,
  {
    id: (item: Record<string, unknown>) => string;
    label: (item: Record<string, unknown>) => string;
  }
> = {
  project: {
    id: (item) => String(item.id ?? 'project'),
    label: (item) => String(item.name ?? 'Project'),
  },
  coverage: {
    id: () => 'coverage',
    label: () => 'Coverage',
  },
  reviews: {
    id: (item) => String(item.ruleId ?? ''),
    label: (item) => String(item.ruleTitle ?? item.ruleId ?? 'Review'),
  },
  documents: {
    id: (item) => String(item.id ?? ''),
    label: (item) => String(item.fileName ?? item.id ?? 'Document'),
  },
  manualFindings: {
    id: (item) => String(item.id ?? ''),
    label: (item) => String(item.findingId ?? item.id ?? 'Finding'),
  },
  extractedDrafts: {
    id: (item) => String(item.id ?? ''),
    label: (item) => String(item.findingId ?? item.id ?? 'Draft'),
  },
  learningCases: {
    id: (item) => String(item.case_id ?? ''),
    label: (item) => String(item.trigger ?? item.case_id ?? 'Learning case'),
  },
  sources: {
    id: (item) => String(item.id ?? ''),
    label: (item) => String(item.fileName ?? item.id ?? 'Source'),
  },
  inventory: {
    id: (item) => String(item.evidence_id ?? ''),
    label: (item) => String(item.display_name ?? item.evidence_id ?? 'Inventory item'),
  },
  fragments: {
    id: (item) => String(item.fragmentId ?? ''),
    label: (item) => String(item.label ?? item.fragmentId ?? 'Fragment'),
  },
  facts: {
    id: (item) => String(item.factId ?? ''),
    label: (item) => String(item.factType ?? item.factId ?? 'Fact'),
  },
  candidateLinks: {
    id: (item) => String(item.linkId ?? ''),
    label: (item) => String(item.ruleTitle ?? item.linkId ?? 'Candidate link'),
  },
  reconciliationItems: {
    id: (item) => String(item.id ?? ''),
    label: (item) => String(item.ruleTitle ?? item.fragmentId ?? item.id ?? 'Reconciliation item'),
  },
  reconciliationGaps: {
    id: (item) => String(item.ruleId ?? ''),
    label: (item) => String(item.ruleTitle ?? item.ruleId ?? 'Coverage gap'),
  },
  reviewerDecisions: {
    id: (item) => String(item.decisionId ?? ''),
    label: (item) => String(item.ruleTitle ?? item.decisionId ?? 'Reviewer decision'),
  },
  evidencePins: {
    id: (item) => String(item.id ?? ''),
    label: (item) => String(item.title ?? item.id ?? 'Evidence pin'),
  },
  verificationRuns: {
    id: (item) => String(item.id ?? ''),
    label: (item) => String(item.id ?? 'Verification run'),
  },
  aoiData: {
    id: (item) => String(item.id ?? 'aoi'),
    label: (item) => String(item.name ?? 'AOI'),
  },
};

export function computeSnapshotDiff(left: EvidenceSnapshot, right: EvidenceSnapshot): EvidenceSnapshotDiff {
  const details = {} as EvidenceSnapshotDiff['details'];
  const sectionCounts = {} as EvidenceSnapshotDiff['summary']['sectionCounts'];

  for (const sectionKey of Object.keys(SECTION_BUILDERS) as SnapshotDiffSectionKey[]) {
    const leftItems = SECTION_BUILDERS[sectionKey](left);
    const rightItems = SECTION_BUILDERS[sectionKey](right);
    const selectors = SECTION_SELECTORS[sectionKey];
    const items = diffArray(leftItems, rightItems, selectors.id, selectors.label);
    details[sectionKey] = items;
    sectionCounts[sectionKey] = countSection(items);
  }

  const added = Object.values(sectionCounts).reduce((sum, section) => sum + section.added, 0);
  const removed = Object.values(sectionCounts).reduce((sum, section) => sum + section.removed, 0);
  const changed = Object.values(sectionCounts).reduce((sum, section) => sum + section.changed, 0);

  return {
    leftSnapshotId: left.snapshotId,
    rightSnapshotId: right.snapshotId,
    leftLabel: left.label,
    rightLabel: right.label,
    computedAt: right.capturedAt,
    summary: {
      added,
      removed,
      changed,
      coverageChange: {
        leftPercent: left.state.coverage.percentComplete,
        rightPercent: right.state.coverage.percentComplete,
        changed: left.state.coverage.percentComplete !== right.state.coverage.percentComplete,
      },
      sectionCounts,
    },
    details,
  };
}
