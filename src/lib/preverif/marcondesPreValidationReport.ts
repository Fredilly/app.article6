import fs from "node:fs";
import path from "node:path";

export type MarcondesReadinessRule = {
  ruleId: string;
  displayTitle: string;
  displayRequirement: string;
  requirement: string;
  reviewerOutcome: string;
  evidenceState: string;
  acceptedEvidence: unknown[];
  rejectedEvidence: unknown[];
  rationale: string;
  recommendedAction: string | null;
};

export type MarcondesPreValidationReadinessReport = {
  title: string;
  project: "Marcondes REDD+";
  methodology: "VM0007 v1.8";
  status: "Internal Release Candidate";
  releaseStatus: string;
  executiveSummary: {
    rulesReviewed: number;
    evidenceStateCounts: Record<string, number>;
    reviewerOutcomeCounts: Record<string, number>;
    readinessSummary: string;
    keyLimitations: string[];
  };
  methodologyReview: {
    page61Reference: string;
    declarations: string;
    classification: string;
    explanation: string;
    blocker: string;
  };
  priorityGaps: Array<{ ruleId: string; displayRuleId: string; title: string; action: string | null; state: string; outcome: string; whyItMatters: string }>;
  rules: MarcondesReadinessRule[];
  limitations: string[];
};

const fixtureDir = path.join(process.cwd(), "tests/fixtures/preverif/marcondes-vm0007-v18-evidence-map");
// The frozen JSON artifacts are intentionally consumed without transforming their truth fields.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FrozenRow = Record<string, any>;
const readJson = (name: string) => JSON.parse(fs.readFileSync(path.join(fixtureDir, name), "utf8")) as FrozenRow;

function displayTitle(ruleId: string, requirement: string): string {
  if (ruleId.endsWith("R-1-0012")) return "CIW tidal wetland conservation activities";
  return requirement.split(/(?<=\.)\s+/)[0].replace(/\.$/, "") || "Requirement review";
}

export function buildMarcondesPreValidationReadinessReport(): MarcondesPreValidationReadinessReport {
  const gold = readJson("gold.json");
  const metadata = readJson("metadata.json");
  const release = readJson("release-status.json");
  const rows = (gold.rows as FrozenRow[]).map((row) => ({
    ruleId: row.ruleId,
    displayTitle: displayTitle(row.ruleReference, row.requirement ?? row.machineProposal?.requirementText ?? "Requirement text not recorded"),
    displayRequirement: row.requirement ?? row.machineProposal?.requirementText ?? "Requirement text not recorded in the frozen Evidence Map.",
    requirement: row.requirement ?? row.machineProposal?.requirementText ?? "Requirement text not recorded in the frozen Evidence Map.",
    reviewerOutcome: row.reviewerOutcome,
    evidenceState: row.finalEvidenceState,
    acceptedEvidence: row.acceptedEvidence,
    rejectedEvidence: row.rejectedEvidence,
    rationale: row.rationale ?? row.reviewerCorrection?.correction ?? "No separate rationale recorded in the frozen Evidence Map.",
    recommendedAction: row.clientAction ?? null,
  }));

  return {
    title: "Marcondes VM0007 v1.8 Pre-Validation Readiness Report",
    project: "Marcondes REDD+",
    methodology: "VM0007 v1.8",
    status: "Internal Release Candidate",
    releaseStatus: release.reportReleaseState,
    executiveSummary: {
      rulesReviewed: metadata.review.reviewedRowCount,
      evidenceStateCounts: metadata.review.evidenceStateCounts,
      reviewerOutcomeCounts: metadata.review.reviewerOutcomes,
      readinessSummary: "The Evidence Map is complete and reviewed rule-by-rule, but client release remains blocked pending explicit methodology version reconciliation.",
      keyLimitations: ["Independent pre-validation readiness review; source-document inconsistency remains unresolved."],
    },
    methodologyReview: {
      page61Reference: metadata.methodology.page61Wording,
      declarations: "Tables 30 and 31 declare VM0007 v1.8.",
      classification: release.methodologyVersionConflict.classification,
      explanation: release.methodologyVersionConflict.conclusion,
      blocker: release.reportReleaseBlocker,
    },
    priorityGaps: rows.filter((row: MarcondesReadinessRule) => row.reviewerOutcome === "ACTION_REQUIRED").map((row: MarcondesReadinessRule) => ({
      ruleId: row.ruleId,
      displayRuleId: row.ruleId.split(".").at(-1) ?? row.ruleId,
      title: row.displayTitle,
      action: row.recommendedAction,
      state: row.evidenceState,
      outcome: row.reviewerOutcome,
      whyItMatters: row.rationale,
    })),
    rules: rows,
    limitations: ["This is an independent pre-validation readiness review.", "It is not validation, verification, certification, Verra approval, or VVB approval."],
  };
}
