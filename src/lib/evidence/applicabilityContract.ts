import {
  validateEvidenceMapDependency,
  type EvidenceMapDependencyBlockReason,
} from "@/lib/evidence/evidenceMapDependencyContract";

export type ApplicabilityDecision = "APPLICABLE" | "NOT_APPLICABLE" | "NOT_EVALUATED";

export type ApplicabilityAssessmentInput = Readonly<{
  decision: ApplicabilityDecision;
  decisionBasis: string | null;
}>;

export type ApplicabilityContractBlockCategory =
  | "evidence_map_dependency_blocked"
  | "invalid_applicability_assessment"
  | "applicability_decision_not_evaluated"
  | "applicability_basis_missing"
  | "applicability_row_state_unknown"
  | "applicability_row_state_mismatch";

export type ApplicabilityContractBlock =
  | Readonly<{
      category: "evidence_map_dependency_blocked";
      reason: EvidenceMapDependencyBlockReason;
    }>
  | Readonly<{
      category: Exclude<ApplicabilityContractBlockCategory, "evidence_map_dependency_blocked">;
    }>;

export type ApplicabilityResult =
  | Readonly<{
      applicability: "APPLICABLE";
      evidenceMapRowId: string;
      basis: "explicit_applicable_decision";
    }>
  | Readonly<{
      applicability: "NOT_APPLICABLE";
      evidenceMapRowId: string;
      basis: "explicit_not_applicable_decision";
    }>
  | Readonly<{
      applicability: "NOT_ASSESSED";
      evidenceMapRowId: string | null;
      blockedBy: readonly ApplicabilityContractBlock[];
    }>;

const decisions: readonly ApplicabilityDecision[] = ["APPLICABLE", "NOT_APPLICABLE", "NOT_EVALUATED"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function rowIdFrom(candidate: unknown): string | null {
  return isRecord(candidate) && hasText(candidate.rowId) ? candidate.rowId : null;
}

function notAssessed(
  evidenceMapRowId: string | null,
  blockedBy: readonly ApplicabilityContractBlock[],
): ApplicabilityResult {
  return { applicability: "NOT_ASSESSED", evidenceMapRowId, blockedBy };
}

/** Validate an explicit applicability decision against a finalized Evidence Map row. */
export function deriveApplicability(
  candidate: unknown,
  assessmentInput: unknown,
): ApplicabilityResult {
  const dependency = validateEvidenceMapDependency(candidate);
  if (!dependency.ready) {
    return notAssessed(
      rowIdFrom(candidate),
      dependency.blockedBy.map((reason) => ({
        category: "evidence_map_dependency_blocked" as const,
        reason,
      })),
    );
  }

  const row = dependency.row;
  if (!isRecord(assessmentInput) || !decisions.includes(assessmentInput.decision as ApplicabilityDecision)) {
    return notAssessed(row.rowId, [{ category: "invalid_applicability_assessment" }]);
  }

  const assessment = assessmentInput as ApplicabilityAssessmentInput;
  const blockedBy: ApplicabilityContractBlock[] = [];
  if (assessment.decision === "NOT_EVALUATED") {
    blockedBy.push({ category: "applicability_decision_not_evaluated" });
  }
  if ((assessment.decision === "APPLICABLE" || assessment.decision === "NOT_APPLICABLE") && !hasText(assessment.decisionBasis)) {
    blockedBy.push({ category: "applicability_basis_missing" });
  }
  if (row.applicabilityState === "UNKNOWN") {
    blockedBy.push({ category: "applicability_row_state_unknown" });
  }
  if (
    (assessment.decision === "APPLICABLE" || assessment.decision === "NOT_APPLICABLE") &&
    assessment.decision !== row.applicabilityState
  ) {
    blockedBy.push({ category: "applicability_row_state_mismatch" });
  }
  if (blockedBy.length > 0) return notAssessed(row.rowId, blockedBy);

  if (assessment.decision === "APPLICABLE") {
    return { applicability: "APPLICABLE", evidenceMapRowId: row.rowId, basis: "explicit_applicable_decision" };
  }
  if (assessment.decision === "NOT_APPLICABLE") {
    return { applicability: "NOT_APPLICABLE", evidenceMapRowId: row.rowId, basis: "explicit_not_applicable_decision" };
  }
  return notAssessed(row.rowId, [{ category: "applicability_decision_not_evaluated" }]);
}

export const validateApplicability = deriveApplicability;
export const evaluateApplicability = deriveApplicability;
