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
      decisionBasis: string;
    }>
  | Readonly<{
      applicability: "NOT_APPLICABLE";
      evidenceMapRowId: string;
      basis: "explicit_not_applicable_decision";
      decisionBasis: string;
    }>
  | Readonly<{
      applicability: "NOT_ASSESSED";
      evidenceMapRowId: string | null;
      blockedBy: readonly ApplicabilityContractBlock[];
    }>;

const decisions: readonly ApplicabilityDecision[] = ["APPLICABLE", "NOT_APPLICABLE", "NOT_EVALUATED"];
const applicabilityBlockCategories: readonly ApplicabilityContractBlockCategory[] = [
  "evidence_map_dependency_blocked",
  "invalid_applicability_assessment",
  "applicability_decision_not_evaluated",
  "applicability_basis_missing",
  "applicability_row_state_unknown",
  "applicability_row_state_mismatch",
];
const dependencyBlockReasons: readonly EvidenceMapDependencyBlockReason[] = [
  "row_not_finalized", "missing_row_identity", "missing_requirement_identity", "missing_methodology_identity",
  "missing_methodology_version", "missing_upstream_status", "missing_applicability_state",
  "missing_accepted_evidence_field", "missing_rejected_evidence_field", "missing_assessment_reason",
  "missing_client_action_field", "missing_search_coverage_field", "missing_source_document_identity",
  "missing_provenance", "missing_finalization_actor_ref", "missing_finalized_at", "missing_finalization_basis",
  "missing_review_history_ref", "missing_evidence_map_contract_version", "missing_review_policy_version",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

/** Validate an applicability result at runtime, including all nested blocker values. */
export function isApplicabilityResult(value: unknown): value is ApplicabilityResult {
  if (!isRecord(value) || typeof value.applicability !== "string") return false;
  if (value.applicability === "APPLICABLE") {
    return (
      hasOnlyKeys(value, ["applicability", "evidenceMapRowId", "basis", "decisionBasis"]) &&
      hasText(value.evidenceMapRowId) &&
      value.basis === "explicit_applicable_decision" &&
      hasText(value.decisionBasis)
    );
  }
  if (value.applicability === "NOT_APPLICABLE") {
    return (
      hasOnlyKeys(value, ["applicability", "evidenceMapRowId", "basis", "decisionBasis"]) &&
      hasText(value.evidenceMapRowId) &&
      value.basis === "explicit_not_applicable_decision" &&
      hasText(value.decisionBasis)
    );
  }
  if (value.applicability !== "NOT_ASSESSED" || !hasOnlyKeys(value, ["applicability", "evidenceMapRowId", "blockedBy"])) return false;
  if (value.evidenceMapRowId !== null && !hasText(value.evidenceMapRowId)) return false;
  if (!Array.isArray(value.blockedBy) || value.blockedBy.length === 0) return false;
  return value.blockedBy.every((blocker) => {
    if (!isRecord(blocker) || typeof blocker.category !== "string" || !applicabilityBlockCategories.includes(blocker.category as ApplicabilityContractBlockCategory)) return false;
    if (blocker.category === "evidence_map_dependency_blocked") {
      return hasOnlyKeys(blocker, ["category", "reason"]) && typeof blocker.reason === "string" && dependencyBlockReasons.includes(blocker.reason as EvidenceMapDependencyBlockReason);
    }
    return hasOnlyKeys(blocker, ["category"]);
  });
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

  const decisionBasis = hasText(assessment.decisionBasis) ? assessment.decisionBasis.trim() : null;
  if (assessment.decision === "APPLICABLE" && decisionBasis !== null) {
    return { applicability: "APPLICABLE", evidenceMapRowId: row.rowId, basis: "explicit_applicable_decision", decisionBasis };
  }
  if (assessment.decision === "NOT_APPLICABLE" && decisionBasis !== null) {
    return { applicability: "NOT_APPLICABLE", evidenceMapRowId: row.rowId, basis: "explicit_not_applicable_decision", decisionBasis };
  }
  return notAssessed(row.rowId, [{ category: "applicability_decision_not_evaluated" }]);
}

export const validateApplicability = deriveApplicability;
export const evaluateApplicability = deriveApplicability;
