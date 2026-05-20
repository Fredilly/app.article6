export type DecisionStatus = "approved" | "rejected" | "needs-review";

export type ReviewerDecision = {
  decisionId: string;
  ruleId: string;
  ruleTitle: string;
  sectionId: string;
  status: DecisionStatus;
  rationale: string;
  reviewerId: string;
  reviewedAt: string;
  updatedAt: string;
  evidenceInventoryIds: string[];
  reconciliationRunId?: string;
  provenanceHash: string;
};

export type DecisionInput = {
  ruleId: string;
  ruleTitle: string;
  sectionId: string;
  status: DecisionStatus;
  rationale: string;
  reviewerId: string;
  evidenceInventoryIds: string[];
  reconciliationRunId?: string;
};

export type DecisionRun = {
  runId: string;
  projectId: string;
  createdAt: string;
  decisions: ReviewerDecision[];
  decisionSetFingerprint: string;
  reconciliationRunId?: string;
};

export type DecisionWarning =
  | { type: "missing-evidence"; ruleId: string; message: string }
  | { type: "reconciliation-failed"; ruleId: string; message: string }
  | { type: "evidence-unlinked"; ruleId: string; evidenceId: string; message: string };
