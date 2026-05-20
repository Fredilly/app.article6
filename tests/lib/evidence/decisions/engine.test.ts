import { describe, expect, it } from '@jest/globals';
import { createDecision, updateDecision, buildDecisionRun } from '@/lib/evidence/decisions';
import type { DecisionInput, ReviewerDecision } from '@/lib/evidence/decisions';

const baseInput: DecisionInput = {
  ruleId: 'R-1-0001',
  ruleTitle: 'Forest definition threshold',
  sectionId: 'S-1',
  status: 'approved',
  rationale: 'Methodology defines forest as >1ha with >30% canopy cover, which is satisfied.',
  reviewerId: 'reviewer_abc',
  evidenceInventoryIds: ['EV-000001', 'EV-000002'],
  reconciliationRunId: 'rec_run_123',
};

function makeInput(overrides?: Partial<DecisionInput>): DecisionInput {
  return { ...baseInput, ...overrides };
}

describe('Reviewer Decisions', () => {
  it('creates a decision with provenance hash', async () => {
    const { decision, warnings } = await createDecision(makeInput());

    expect(decision.decisionId).toMatch(/^dec_R-1-0001_reviewer_abc_/);
    expect(decision.status).toBe('approved');
    expect(decision.rationale).toContain('canopy cover');
    expect(decision.provenanceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(decision.reviewerId).toBe('reviewer_abc');
    expect(decision.evidenceInventoryIds).toEqual(['EV-000001', 'EV-000002']);
    expect(warnings).toEqual([]);
  });

  it('creates a needs-review decision', async () => {
    const { decision } = await createDecision(makeInput({ status: 'needs-review' }));

    expect(decision.status).toBe('needs-review');
  });

  it('creates a rejected decision', async () => {
    const { decision } = await createDecision(makeInput({ status: 'rejected' }));

    expect(decision.status).toBe('rejected');
  });

  it('warns when approving with no linked evidence', async () => {
    const { decision, warnings } = await createDecision(
      makeInput({ evidenceInventoryIds: [] }),
    );

    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0].type).toBe('missing-evidence');
    expect(warnings[0].message).toContain('no linked evidence');
    expect(decision.status).toBe('approved');
  });

  it('warns when no reconciliation run is linked', async () => {
    const { decision, warnings } = await createDecision(
      makeInput({ reconciliationRunId: undefined }),
    );

    expect(warnings.some((w) => w.type === 'reconciliation-failed')).toBe(true);
  });

  it('updates a decision and preserves provenance', async () => {
    const { decision: original } = await createDecision(makeInput());

    const { decision: updated, warnings } = await updateDecision(original, {
      status: 'needs-review',
      rationale: 'Need more data on canopy cover threshold.',
    });

    expect(updated.decisionId).toBe(original.decisionId);
    expect(updated.decisionId).toBe(original.decisionId);
    expect(updated.status).toBe('needs-review');
    expect(updated.rationale).toContain('Need more data');
    expect(updated.updatedAt).toBeTruthy();
    expect(updated.provenanceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(updated.provenanceHash).not.toBe(original.provenanceHash);
  });

  it('builds a deterministic decision run', async () => {
    const { decision } = await createDecision(makeInput());
    const decisions = [decision];

    const run1 = await buildDecisionRun('proj_test', decisions, 'rec_run_123');
    const run2 = await buildDecisionRun('proj_test', decisions, 'rec_run_123');

    expect(run1.runId).toBe(run2.runId);
    expect(run1.decisionSetFingerprint).toBe(run2.decisionSetFingerprint);
    expect(run1.decisions.length).toBe(run2.decisions.length);
    expect(run1.decisions[0].provenanceHash).toBe(run2.decisions[0].provenanceHash);
  });

  it('produces different fingerprints for different decisions', async () => {
    const d1 = (await createDecision(makeInput())).decision;
    const d2 = (await createDecision(makeInput({ status: 'rejected' }))).decision;

    const run1 = await buildDecisionRun('proj_test', [d1]);
    const run2 = await buildDecisionRun('proj_test', [d2]);

    expect(run1.decisionSetFingerprint).not.toBe(run2.decisionSetFingerprint);
    expect(run1.runId).not.toBe(run2.runId);
  });

  it('merges decisions via createDecision: replaces old decision for same rule', async () => {
    const input = makeInput({ status: 'needs-review', rationale: 'First review' });
    const { decision: first } = await createDecision(input);

    const secondInput: DecisionInput = {
      ...input,
      status: 'approved',
      rationale: 'Second review — now approved.',
    };
    const { decision: second } = await createDecision(secondInput, [first]);

    expect(second.decisionId).toBeTruthy();
    expect(first.decisionId).toBeTruthy();
    expect(second.status).toBe('approved');
    expect(second.rationale).toContain('Second review');
  });

  it('merges decisions: latest per rule wins', async () => {
    const input = makeInput({ status: 'needs-review', rationale: 'First review' });
    const { decision: first } = await createDecision(input);

    const secondInput: DecisionInput = {
      ...input,
      status: 'approved',
      rationale: 'Second review — now approved.',
    };
    const { decision: second } = await createDecision(secondInput, [first]);

    const run = await buildDecisionRun('proj_test', [second]);

    const rulesForRule = run.decisions.filter((d) => d.ruleId === 'R-1-0001');
    expect(rulesForRule.length).toBe(1);
    expect(rulesForRule[0].status).toBe('approved');
    expect(rulesForRule[0].rationale).toContain('Second review');
  });

  it('has timestamps in ISO format', async () => {
    const { decision } = await createDecision(makeInput());

    expect(new Date(decision.reviewedAt).toISOString()).toBe(decision.reviewedAt);
    expect(new Date(decision.updatedAt).toISOString()).toBe(decision.updatedAt);
  });

  it('includes runId, projectId, createdAt in DecisionRun', async () => {
    const { decision } = await createDecision(makeInput());
    const run = await buildDecisionRun('proj_test', [decision], 'rec_run_123');

    expect(run.runId).toBeTruthy();
    expect(run.projectId).toBe('proj_test');
    expect(run.createdAt).toBeTruthy();
    expect(run.reconciliationRunId).toBe('rec_run_123');
    expect(new Date(run.createdAt).toISOString()).toBe(run.createdAt);
  });
});
