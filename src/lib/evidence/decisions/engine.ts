import { sha256Text } from '@/lib/proof/hash';
import { canonicalJsonStringify } from '@/lib/export/canonicalJson';
import type {
  ReviewerDecision,
  DecisionInput,
  DecisionRun,
  DecisionWarning,
} from './types';

function generateDecisionId(ruleId: string, reviewerId: string, timestamp: string): string {
  return `dec_${ruleId}_${reviewerId}_${timestamp.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`;
}

export async function createDecision(
  input: DecisionInput,
  existingDecisions?: ReviewerDecision[],
): Promise<{ decision: ReviewerDecision; warnings: DecisionWarning[] }> {
  const now = new Date().toISOString();
  const decisionId = generateDecisionId(input.ruleId, input.reviewerId, now);

  const decision: ReviewerDecision = {
    decisionId,
    ruleId: input.ruleId,
    ruleTitle: input.ruleTitle,
    sectionId: input.sectionId,
    status: input.status,
    rationale: input.rationale,
    reviewerId: input.reviewerId,
    reviewedAt: now,
    updatedAt: now,
    evidenceInventoryIds: input.evidenceInventoryIds,
    reconciliationRunId: input.reconciliationRunId,
    provenanceHash: '',
  };

  decision.provenanceHash = await computeDecisionProvenance(decision);

  const warnings = await checkDecisionWarnings(
    decision,
    input.evidenceInventoryIds,
    input.reconciliationRunId,
  );

  const merged = mergeDecisions(existingDecisions ?? [], decision);

  const updated = merged.find((d) => d.decisionId === decision.decisionId) ?? decision;

  return { decision: updated, warnings };
}

export async function updateDecision(
  existing: ReviewerDecision,
  updates: Partial<DecisionInput>,
): Promise<{ decision: ReviewerDecision; warnings: DecisionWarning[] }> {
  const now = new Date().toISOString();

  const updated: ReviewerDecision = {
    ...existing,
    status: updates.status ?? existing.status,
    rationale: updates.rationale ?? existing.rationale,
    evidenceInventoryIds: updates.evidenceInventoryIds ?? existing.evidenceInventoryIds,
    reconciliationRunId: updates.reconciliationRunId ?? existing.reconciliationRunId,
    updatedAt: now,
  };

  updated.provenanceHash = await computeDecisionProvenance(updated);

  const warnings = await checkDecisionWarnings(
    updated,
    updated.evidenceInventoryIds,
    updated.reconciliationRunId,
  );

  return { decision: updated, warnings };
}

function mergeDecisions(
  existing: ReviewerDecision[],
  incoming: ReviewerDecision,
): ReviewerDecision[] {
  const map = new Map<string, ReviewerDecision>();
  for (const d of existing) {
    map.set(d.decisionId, d);
  }
  const existingForRule = Array.from(map.values()).filter((d) => d.ruleId === incoming.ruleId);
  for (const d of existingForRule) {
    map.delete(d.decisionId);
  }
  map.set(incoming.decisionId, incoming);
  return Array.from(map.values()).sort((a, b) => a.ruleId.localeCompare(b.ruleId) || a.updatedAt.localeCompare(b.updatedAt));
}

export async function buildDecisionRun(
  projectId: string,
  decisions: ReviewerDecision[],
  reconciliationRunId?: string,
): Promise<DecisionRun> {
  const stable = decisions.map((d) => ({
    decisionId: d.decisionId,
    ruleId: d.ruleId,
    status: d.status,
    provenanceHash: d.provenanceHash,
  }));
  stable.sort((a, b) => a.decisionId.localeCompare(b.decisionId));
  const decisionSetFingerprint = await sha256Text(canonicalJsonStringify(stable));

  const runPayload = canonicalJsonStringify({
    projectId,
    decisionSetFingerprint,
    reconciliationRunId,
  });
  const runId = await sha256Text(runPayload);

  return {
    runId,
    projectId,
    createdAt: new Date().toISOString(),
    decisions,
    decisionSetFingerprint,
    reconciliationRunId,
  };
}

export async function computeDecisionProvenance(decision: ReviewerDecision): Promise<string> {
  const stable = {
    decisionId: decision.decisionId,
    ruleId: decision.ruleId,
    status: decision.status,
    rationale: decision.rationale,
    reviewerId: decision.reviewerId,
    reviewedAt: decision.reviewedAt,
    evidenceInventoryIds: [...decision.evidenceInventoryIds].sort(),
    reconciliationRunId: decision.reconciliationRunId,
  };
  return sha256Text(canonicalJsonStringify(stable));
}

export async function computeDecisionSetFingerprint(decisions: ReviewerDecision[]): Promise<string> {
  const stable = decisions.map((d) => ({
    decisionId: d.decisionId,
    status: d.status,
    provenanceHash: d.provenanceHash,
  }));
  stable.sort((a, b) => a.decisionId.localeCompare(b.decisionId));
  return sha256Text(canonicalJsonStringify(stable));
}

export async function checkDecisionWarnings(
  decision: ReviewerDecision,
  evidenceInventoryIds: string[],
  reconciliationRunId?: string,
): Promise<DecisionWarning[]> {
  const warnings: DecisionWarning[] = [];

  if (decision.status === "approved" && evidenceInventoryIds.length === 0) {
    warnings.push({
      type: "missing-evidence",
      ruleId: decision.ruleId,
      message: `Approving "${decision.ruleTitle}" with no linked evidence — reviewer should verify coverage manually.`,
    });
  }

  if (!reconciliationRunId) {
    warnings.push({
      type: "reconciliation-failed",
      ruleId: decision.ruleId,
      message: `No reconciliation run linked to decision for "${decision.ruleTitle}" — coverage may be incomplete.`,
    });
  }

  return warnings;
}
