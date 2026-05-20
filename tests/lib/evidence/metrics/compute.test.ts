import { describe, expect, it } from '@jest/globals';
import { computeMetrics } from '@/lib/evidence/metrics/compute';
import type { EvidenceInventoryItem } from '@/lib/evidence/inventory';
import type { RuleReview } from '@/lib/projects/types';

function makeInventoryItem(overrides: Partial<EvidenceInventoryItem> & { evidence_id: string }): EvidenceInventoryItem {
  return {
    dedupe_key: overrides.evidence_id,
    display_name: overrides.display_name ?? 'Test Evidence',
    kind: 'document',
    type: 'pdf',
    source_summary: 'Test source',
    provenance_summary: overrides.provenance_summary ?? 'Test provenance',
    added_at: '2026-01-01T00:00:00Z',
    link_state: 'unlinked',
    linked_requirement_ids: [],
    ...overrides,
  };
}

function makeReview(overrides: Partial<RuleReview> & { ruleId: string }): RuleReview {
  return {
    ruleTitle: 'Test rule',
    sectionId: 'section-1',
    status: 'not-started',
    evidenceIds: [],
    ...overrides,
  };
}

describe('computeMetrics', () => {
  describe('fragment qualities', () => {
    it('returns empty qualities for empty inventory', () => {
      const result = computeMetrics({ inventoryItems: [] });
      expect(result.fragmentQualities).toEqual([]);
      expect(result.fragmentCount).toBe(0);
    });

    it('computes grade D for a bare item with no quality signals', () => {
      const item = makeInventoryItem({ evidence_id: 'ev-1' });
      const result = computeMetrics({ inventoryItems: [item] });
      expect(result.fragmentQualities).toHaveLength(1);
      expect(result.fragmentQualities[0].grade).toBe('D');
      expect(result.fragmentQualities[0].score).toBe(0.1);
    });

    it('assigns grade A for a high-quality item', () => {
      const item = makeInventoryItem({
        evidence_id: 'ev-1',
        provenance_summary: 'Full provenance chain: uploaded PDD',
        pdd_fragments: [
          {
            fragment_id: 'frag-1',
            evidence_id: 'ev-1',
            page_start: 5,
            page_end: 7,
            excerpt: 'This is a substantial excerpt text that is well over twenty characters long to demonstrate text content.',
          },
        ],
        linked_requirement_ids: ['rule-1', 'rule-2'],
        reconciliation_status: 'linked',
      });
      const result = computeMetrics({ inventoryItems: [item] });
      const q = result.fragmentQualities[0];
      expect(q.grade).toBe('A');
      expect(q.score).toBeGreaterThanOrEqual(0.8);
      expect(q.hasPageRef).toBe(true);
      expect(q.linkedRequirementCount).toBe(2);
      expect(q.isReconciled).toBe(true);
    });

    it('assigns grade B for moderate quality', () => {
      const item = makeInventoryItem({
        evidence_id: 'ev-1',
        workbook_record_groups: [
          {
            group_id: 'g-1',
            group_type: 'parameter',
            display_name: 'params',
            workbook_id: 'wb-1',
            workbook_filename: 'wb.xlsx',
            source_sheet: 'Sheet1',
            source_range: 'A1:B10',
            row_count: 5,
            column_names: ['a', 'b'],
            rows: [],
            provenance_summary: 'Workbook data',
          },
        ],
        linked_requirement_ids: ['rule-1'],
        reconciliation_status: 'linked',
        provenance_summary: 'Has provenance',
      });
      const result = computeMetrics({ inventoryItems: [item] });
      const q = result.fragmentQualities[0];
      expect(q.grade).toBe('B');
      expect(q.score).toBeGreaterThanOrEqual(0.6);
      expect(q.score).toBeLessThan(0.8);
      expect(q.hasSheetRef).toBe(true);
      expect(q.linkedRequirementCount).toBe(1);
    });

    it('assigns grade C for low quality', () => {
      const item = makeInventoryItem({
        evidence_id: 'ev-1',
        linked_requirement_ids: ['rule-1'],
        pdd_fragments: [{ fragment_id: 'f-1', evidence_id: 'ev-1', page_start: 1, excerpt: 'This excerpt is long enough to pass the text content threshold.' }],
        provenance_summary: '',
      });
      const result = computeMetrics({ inventoryItems: [item] });
      const q = result.fragmentQualities[0];
      expect(q.grade).toBe('C');
      expect(q.score).toBeGreaterThanOrEqual(0.4);
      expect(q.score).toBeLessThan(0.6);
    });

    it('recognizes page references in PDD fragments', () => {
      const noPage = makeInventoryItem({
        evidence_id: 'ev-1',
        pdd_fragments: [{ fragment_id: 'f-1', evidence_id: 'ev-1' }],
      });
      const withPage = makeInventoryItem({
        evidence_id: 'ev-2',
        pdd_fragments: [{ fragment_id: 'f-2', evidence_id: 'ev-2', page_start: 10 }],
      });
      const result1 = computeMetrics({ inventoryItems: [noPage] });
      const result2 = computeMetrics({ inventoryItems: [withPage] });
      expect(result1.fragmentQualities[0].hasPageRef).toBe(false);
      expect(result2.fragmentQualities[0].hasPageRef).toBe(true);
      expect(result2.fragmentQualities[0].score).toBeGreaterThan(result1.fragmentQualities[0].score);
    });

    it('recognizes sheet references in workbook record groups', () => {
      const withSheet = makeInventoryItem({
        evidence_id: 'ev-1',
        workbook_record_groups: [
          {
            group_id: 'g-1',
            group_type: 'parameter',
            display_name: 'params',
            workbook_id: 'wb-1',
            workbook_filename: 'wb.xlsx',
            source_sheet: 'Inputs',
            source_range: 'A1:B10',
            row_count: 5,
            column_names: ['a', 'b'],
            rows: [],
            provenance_summary: 'data',
          },
        ],
      });
      const withoutSheet = makeInventoryItem({ evidence_id: 'ev-2' });
      const result1 = computeMetrics({ inventoryItems: [withSheet] });
      const result2 = computeMetrics({ inventoryItems: [withoutSheet] });
      expect(result1.fragmentQualities[0].hasSheetRef).toBe(true);
      expect(result2.fragmentQualities[0].hasSheetRef).toBe(false);
    });
  });

  describe('section coverages', () => {
    it('returns empty coverages when no reviews provided', () => {
      const result = computeMetrics({ inventoryItems: [] });
      expect(result.sectionCoverages).toEqual([]);
    });

    it('computes per-section coverage from reviews', () => {
      const reviews: RuleReview[] = [
        makeReview({ ruleId: 'r1', sectionId: 's1', evidenceIds: ['ev-1'] }),
        makeReview({ ruleId: 'r2', sectionId: 's1', evidenceIds: [] }),
        makeReview({ ruleId: 'r3', sectionId: 's1', evidenceIds: ['ev-2'], status: 'verified' }),
        makeReview({ ruleId: 'r4', sectionId: 's2', evidenceIds: [] }),
      ];
      const result = computeMetrics({ inventoryItems: [], reviews });
      expect(result.sectionCoverages).toHaveLength(2);

      const s1 = result.sectionCoverages.find((s) => s.sectionId === 's1');
      const s2 = result.sectionCoverages.find((s) => s.sectionId === 's2');
      expect(s1).toBeDefined();
      expect(s2).toBeDefined();
      expect(s1!.totalRules).toBe(3);
      expect(s1!.rulesWithLinkedEvidence).toBe(2);
      expect(s1!.coverageFraction).toBeCloseTo(2 / 3);
      expect(s1!.rulesWithDecisions).toBe(1);
      expect(s2!.totalRules).toBe(1);
      expect(s2!.rulesWithLinkedEvidence).toBe(0);
      expect(s2!.coverageFraction).toBe(0);
    });

    it('groups reviews by sectionId', () => {
      const reviews: RuleReview[] = [
        makeReview({ ruleId: 'r1', sectionId: 'sec-A', evidenceIds: ['ev-1'] }),
        makeReview({ ruleId: 'r2', sectionId: 'sec-A', evidenceIds: ['ev-2'] }),
        makeReview({ ruleId: 'r3', sectionId: 'sec-B', evidenceIds: [] }),
      ];
      const result = computeMetrics({ inventoryItems: [], reviews });
      expect(result.sectionCoverages).toHaveLength(2);
      const secA = result.sectionCoverages.find((s) => s.sectionId === 'sec-A');
      expect(secA!.coverageFraction).toBe(1);
      expect(secA!.totalRules).toBe(2);
    });

    it('sorts sections by sectionId', () => {
      const reviews: RuleReview[] = [
        makeReview({ ruleId: 'r1', sectionId: 'z-last', evidenceIds: [] }),
        makeReview({ ruleId: 'r2', sectionId: 'a-first', evidenceIds: [] }),
      ];
      const result = computeMetrics({ inventoryItems: [], reviews });
      expect(result.sectionCoverages[0].sectionId).toBe('a-first');
      expect(result.sectionCoverages[1].sectionId).toBe('z-last');
    });
  });

  describe('overall metrics', () => {
    it('computes overallCoverage as fraction of fragments linked to requirements', () => {
      const items: EvidenceInventoryItem[] = [
        makeInventoryItem({ evidence_id: 'ev-1', linked_requirement_ids: ['r1'] }),
        makeInventoryItem({ evidence_id: 'ev-2', linked_requirement_ids: ['r2', 'r3'] }),
        makeInventoryItem({ evidence_id: 'ev-3' }),
      ];
      const result = computeMetrics({ inventoryItems: items });
      expect(result.overallCoverage).toBeCloseTo(2 / 3);
    });

    it('computes averageQuality as mean of fragment scores', () => {
      const items: EvidenceInventoryItem[] = [
        makeInventoryItem({
          evidence_id: 'ev-1',
          linked_requirement_ids: ['r1'],
          pdd_fragments: [{ fragment_id: 'f-1', evidence_id: 'ev-1', page_start: 1 }],
          reconciliation_status: 'linked',
          provenance_summary: 'Has provenance',
        }),
        makeInventoryItem({ evidence_id: 'ev-2' }),
      ];
      const result = computeMetrics({ inventoryItems: items });
      expect(result.averageQuality).toBeGreaterThan(0);
      expect(result.averageQuality).toBeLessThanOrEqual(1);
      expect(result.fingerprint).toBeTruthy();
    });

    it('produces deterministic fingerprint for same input', () => {
      const items: EvidenceInventoryItem[] = [
        makeInventoryItem({ evidence_id: 'ev-1', linked_requirement_ids: ['r1'] }),
      ];
      const result1 = computeMetrics({ inventoryItems: items });
      const result2 = computeMetrics({ inventoryItems: items });
      expect(result1.fingerprint).toBe(result2.fingerprint);
    });

    it('produces different fingerprints for different input', () => {
      const items1: EvidenceInventoryItem[] = [
        makeInventoryItem({ evidence_id: 'ev-1', linked_requirement_ids: ['r1'] }),
      ];
      const items2: EvidenceInventoryItem[] = [
        makeInventoryItem({ evidence_id: 'ev-2', linked_requirement_ids: ['r2'] }),
      ];
      const result1 = computeMetrics({ inventoryItems: items1 });
      const result2 = computeMetrics({ inventoryItems: items2 });
      expect(result1.fingerprint).not.toBe(result2.fingerprint);
    });
  });

  describe('overallCoverage', () => {
    it('returns 0 when no inventory items', () => {
      const result = computeMetrics({ inventoryItems: [] });
      expect(result.overallCoverage).toBe(0);
    });
  });
});
