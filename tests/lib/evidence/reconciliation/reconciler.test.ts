import { describe, expect, it } from '@jest/globals';
import { reconcileEvidence } from '@/lib/evidence/reconciliation';
import type { ReconciliationInput } from '@/lib/evidence/reconciliation';

function makeInput(overrides?: Partial<ReconciliationInput>): ReconciliationInput {
  return {
    fragments: [
      {
        fragmentId: 'frag_0',
        documentId: 'doc_1',
        text: 'Baseline Scenario: continuation of current land use practices.',
        contentSha256: 'hash_frag_0',
        label: 'Page 1',
        pageStart: 1,
        pageEnd: 1,
      },
      {
        fragmentId: 'frag_1',
        documentId: 'doc_1',
        text: 'Carbon stocks estimated at 12.5 tC/ha.',
        contentSha256: 'hash_frag_1',
        label: 'Page 2',
        pageStart: 2,
        pageEnd: 2,
      },
    ],
    facts: [
      {
        factId: 'fact_0',
        fragmentId: 'frag_0',
        factType: 'baseline-scenario',
        value: 'Baseline Scenario',
        context: 'continuation of current land use practices',
        contentSha256: 'hash_fact_0',
      },
    ],
    candidateLinks: [
      {
        linkId: 'link_0',
        factId: 'fact_0',
        ruleId: 'R-1-0001',
        ruleTitle: 'Forest definition threshold',
        sectionId: 'S-1',
        matchType: 'keyword-overlap',
        matchReason: 'keyword match on baseline',
        confidence: 0.85,
        contentSha256: 'hash_link_0',
      },
    ],
    methodCode: 'VM0047',
    methodVersion: 'v1-0',
    projectId: 'proj_test',
    ...overrides,
  };
}

describe('Evidence Reconciliation', () => {
  it('marks linked fragments as linked', async () => {
    const result = await reconcileEvidence(makeInput());

    const frag0 = result.items.find((i) => i.fragmentId === 'frag_0');
    expect(frag0).toBeDefined();
    expect(frag0!.status).toBe('linked');
    expect(frag0!.ruleId).toBe('R-1-0001');
    expect(frag0!.confidence).toBe(0.85);
  });

  it('marks unmatched fragments as unmatched', async () => {
    const result = await reconcileEvidence(makeInput());

    const frag1 = result.items.find((i) => i.fragmentId === 'frag_1');
    expect(frag1).toBeDefined();
    expect(frag1!.status).toBe('unmatched');
    expect(frag1!.ruleId).toBeUndefined();
  });

  it('detects coverage gaps for rules with no linked evidence', async () => {
    const result = await reconcileEvidence(makeInput());

    expect(result.gaps.length).toBeGreaterThan(0);
    const gapRuleIds = result.gaps.map((g) => g.ruleId);
    expect(gapRuleIds).not.toContain('R-1-0001');
  });

  it('produces deterministic output for same input', async () => {
    const input = makeInput();
    const run1 = await reconcileEvidence(input);
    const run2 = await reconcileEvidence(input);

    expect(run1.reconciliationFingerprint).toBe(run2.reconciliationFingerprint);
    expect(run1.itemFingerprint).toBe(run2.itemFingerprint);
    expect(run1.gapFingerprint).toBe(run2.gapFingerprint);
    expect(run1.items.length).toBe(run2.items.length);
    expect(run1.gaps.length).toBe(run2.gaps.length);
  });

  it('produces different fingerprints for different inputs', async () => {
    const input1 = makeInput();
    const input2 = makeInput({
      fragments: [
        {
          fragmentId: 'frag_0',
          documentId: 'doc_1',
          text: 'Different project description text.',
          contentSha256: 'hash_diff',
          label: 'Page 1',
          pageStart: 1,
          pageEnd: 1,
        },
      ],
    });

    const run1 = await reconcileEvidence(input1);
    const run2 = await reconcileEvidence(input2);

    expect(run1.reconciliationFingerprint).not.toBe(run2.reconciliationFingerprint);
  });

  it('returns SHA-256 fingerprints', async () => {
    const result = await reconcileEvidence(makeInput());

    expect(result.reconciliationFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.itemFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.gapFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('includes runId, projectId, and createdAt', async () => {
    const result = await reconcileEvidence(makeInput());

    expect(result.runId).toBeTruthy();
    expect(result.projectId).toBe('proj_test');
    expect(result.createdAt).toBeTruthy();
    expect(new Date(result.createdAt).toISOString()).toBe(result.createdAt);
  });

  it('returns status: complete for a normal run', async () => {
    const result = await reconcileEvidence(makeInput());
    expect(result.status).toBe('complete');
    expect(result.loadError).toBeUndefined();
  });

  it('returns missing-manifest for a non-existent methodology', async () => {
    const result = await reconcileEvidence(
      makeInput({ methodCode: 'NONEXISTENT', methodVersion: 'v9-9' }),
    );

    expect(result.status).toBe('missing-manifest');
    expect(result.loadError).toContain('not found in manifest');
    expect(result.items).toEqual([]);
    expect(result.gaps).toEqual([]);
    expect(result.reconciliationFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns missing-manifest for a valid methodology with bogus version', async () => {
    const result = await reconcileEvidence(
      makeInput({ methodCode: 'VM0047', methodVersion: 'v9-9' }),
    );

    expect(result.status).toBe('missing-manifest');
    expect(result.loadError).toContain('not found in manifest');
    expect(result.items).toEqual([]);
    expect(result.gaps).toEqual([]);
  });

  it('handles empty fragments gracefully', async () => {
    const result = await reconcileEvidence(makeInput({ fragments: [], facts: [], candidateLinks: [] }));

    expect(result.status).toBe('complete');
    expect(result.items).toEqual([]);
    expect(result.gaps.length).toBeGreaterThan(0);
    expect(result.reconciliationFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('handles unmatched candidate links (links with no matching fact)', async () => {
    const result = await reconcileEvidence(
      makeInput({
        facts: [],
        candidateLinks: [
          {
            linkId: 'orphan_link',
            factId: 'nonexistent_fact',
            ruleId: 'R-1-0001',
            ruleTitle: 'Forest definition threshold',
            sectionId: 'S-1',
            matchType: 'keyword-overlap',
            matchReason: 'orphan',
            confidence: 0.5,
            contentSha256: 'orphan_hash',
          },
        ],
      }),
    );

    expect(result.status).toBe('complete');
    expect(result.items.every((i) => i.status === 'unmatched')).toBe(true);
    expect(result.gaps.length).toBeGreaterThan(0);
  });

  it('is deterministic for missing-manifest errors', async () => {
    const input = makeInput({ methodCode: 'NONEXISTENT', methodVersion: 'v9-9' });
    const run1 = await reconcileEvidence(input);
    const run2 = await reconcileEvidence(input);

    expect(run1.status).toBe('missing-manifest');
    expect(run2.status).toBe('missing-manifest');
    expect(run1.reconciliationFingerprint).toBe(run2.reconciliationFingerprint);
    expect(run1.loadError).toBe(run2.loadError);
  });

  it('is deterministic for empty fragments', async () => {
    const input = makeInput({ fragments: [], facts: [], candidateLinks: [] });
    const run1 = await reconcileEvidence(input);
    const run2 = await reconcileEvidence(input);

    expect(run1.reconciliationFingerprint).toBe(run2.reconciliationFingerprint);
    expect(run1.items).toEqual(run2.items);
    expect(run1.gaps).toEqual(run2.gaps);
  });
});
