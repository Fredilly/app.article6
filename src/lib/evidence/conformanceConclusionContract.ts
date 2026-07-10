import {
  validateEvidenceMapDependency,
  type EvidenceMapDependencyBlockReason,
  type EvidenceMapRow,
} from "@/lib/evidence/evidenceMapDependencyContract";
import type {
  ApplicabilityContractBlock,
} from "@/lib/evidence/applicabilityContract";
import { isApplicabilityContractBlock, isApplicabilityResult } from "@/lib/evidence/applicabilityContract";

export type ConformanceConclusion =
  | "CONFORMS"
  | "ACTION_REQUIRED"
  | "NOT_APPLICABLE"
  | "NOT_ASSESSED";

export type ConformanceAssessmentInput = Readonly<{
  requirementSupport: "SUPPORTED" | "NOT_SUPPORTED" | "NOT_EVALUATED";
  searchCoverageAssessment:
    | "ADEQUATE"
    | "INADEQUATE"
    | "NOT_REQUIRED"
    | "NOT_EVALUATED";
  provenanceAssessment: "COMPLETE" | "INCOMPLETE" | "NOT_EVALUATED";
  versionIdentityAssessment:
    | "MATCHED"
    | "NOT_REQUIRED"
    | "MISMATCHED"
    | "UNRESOLVED";
  contradictionAssessment: "NONE" | "BLOCKING" | "NOT_EVALUATED";
}>;

export type ConformanceConclusionBlockCategory =
  | "evidence_map_dependency_blocked"
  | "applicability_blocked"
  | "applicability_result_invalid"
  | "applicability_row_id_mismatch"
  | "applicability_row_state_mismatch"
  | "invalid_assessment_input"
  | "unsupported_upstream_status"
  | "applicability_unknown"
  | "requirement_support_not_evaluated"
  | "upstream_status_conflicts_with_support"
  | "search_coverage_inadequate"
  | "search_coverage_not_evaluated"
  | "provenance_incomplete"
  | "provenance_not_evaluated"
  | "version_identity_not_required_for_methodology"
  | "version_identity_matched_without_methodology"
  | "version_identity_mismatch"
  | "version_identity_unresolved"
  | "blocking_contradiction"
  | "contradiction_not_evaluated";

export type ConformanceConclusionBlock =
  | Readonly<{
      category: "evidence_map_dependency_blocked";
      reason: EvidenceMapDependencyBlockReason;
    }>
  | Readonly<{
      category: Exclude<ConformanceConclusionBlockCategory, "evidence_map_dependency_blocked" | "applicability_blocked">;
    }>
  | Readonly<{
      category: "applicability_blocked";
      reason: ApplicabilityContractBlock;
    }>;

export type ConformanceConclusionResult =
  | Readonly<{
      conclusion: "CONFORMS";
      evidenceMapRowId: string;
      basis: "supported_applicable_requirement";
    }>
  | Readonly<{
      conclusion: "ACTION_REQUIRED";
      evidenceMapRowId: string;
      basis: "applicable_requirement_not_supported";
    }>
  | Readonly<{
      conclusion: "NOT_APPLICABLE";
      evidenceMapRowId: string;
      basis: "explicit_upstream_not_applicable";
    }>
  | Readonly<{
      conclusion: "NOT_ASSESSED";
      evidenceMapRowId: string | null;
      blockedBy: readonly ConformanceConclusionBlock[];
    }>;

const assessmentValues = {
  requirementSupport: ["SUPPORTED", "NOT_SUPPORTED", "NOT_EVALUATED"],
  searchCoverageAssessment: ["ADEQUATE", "INADEQUATE", "NOT_REQUIRED", "NOT_EVALUATED"],
  provenanceAssessment: ["COMPLETE", "INCOMPLETE", "NOT_EVALUATED"],
  versionIdentityAssessment: ["MATCHED", "NOT_REQUIRED", "MISMATCHED", "UNRESOLVED"],
  contradictionAssessment: ["NONE", "BLOCKING", "NOT_EVALUATED"],
} as const;
const conformanceBlockCategories: readonly ConformanceConclusionBlockCategory[] = [
  "evidence_map_dependency_blocked", "applicability_blocked", "applicability_result_invalid", "applicability_row_id_mismatch",
  "applicability_row_state_mismatch", "invalid_assessment_input", "unsupported_upstream_status", "applicability_unknown",
  "requirement_support_not_evaluated", "upstream_status_conflicts_with_support", "search_coverage_inadequate",
  "search_coverage_not_evaluated", "provenance_incomplete", "provenance_not_evaluated",
  "version_identity_not_required_for_methodology", "version_identity_matched_without_methodology", "version_identity_mismatch",
  "version_identity_unresolved", "blocking_contradiction", "contradiction_not_evaluated",
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

function isAssessment(value: unknown): value is ConformanceAssessmentInput {
  if (!isRecord(value)) return false;
  return (Object.keys(assessmentValues) as (keyof ConformanceAssessmentInput)[]).every((key) =>
    (assessmentValues[key] as readonly unknown[]).includes(value[key]),
  );
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isConformanceBlock(value: unknown): value is ConformanceConclusionBlock {
  if (!isRecord(value) || typeof value.category !== "string" || !conformanceBlockCategories.includes(value.category as ConformanceConclusionBlockCategory)) return false;
  if (value.category === "evidence_map_dependency_blocked") {
    return hasOnlyKeys(value, ["category", "reason"]) && typeof value.reason === "string" && dependencyBlockReasons.includes(value.reason as EvidenceMapDependencyBlockReason);
  }
  if (value.category === "applicability_blocked") {
    return hasOnlyKeys(value, ["category", "reason"]) && isApplicabilityContractBlock(value.reason);
  }
  return hasOnlyKeys(value, ["category"]);
}

function block(category: Exclude<ConformanceConclusionBlockCategory, "evidence_map_dependency_blocked" | "applicability_blocked">): ConformanceConclusionBlock {
  return { category };
}

function notAssessed(
  row: EvidenceMapRow | null,
  blockedBy: readonly ConformanceConclusionBlock[],
): ConformanceConclusionResult {
  return { conclusion: "NOT_ASSESSED", evidenceMapRowId: row?.rowId ?? null, blockedBy };
}

/** Validate a conformance result supplied by a downstream packaging contract. */
export function isConformanceConclusionResult(value: unknown): value is ConformanceConclusionResult {
  if (!isRecord(value) || typeof value.conclusion !== "string") return false;
  if (value.conclusion === "NOT_ASSESSED") {
    return (
      hasOnlyKeys(value, ["conclusion", "evidenceMapRowId", "blockedBy"]) &&
      (value.evidenceMapRowId === null || (typeof value.evidenceMapRowId === "string" && value.evidenceMapRowId.trim().length > 0)) &&
      Array.isArray(value.blockedBy) &&
      value.blockedBy.length > 0 &&
      value.blockedBy.every(isConformanceBlock)
    );
  }
  const basis = value.conclusion === "CONFORMS"
    ? "supported_applicable_requirement"
    : value.conclusion === "ACTION_REQUIRED"
      ? "applicable_requirement_not_supported"
      : value.conclusion === "NOT_APPLICABLE"
        ? "explicit_upstream_not_applicable"
        : null;
  return (
    hasOnlyKeys(value, ["conclusion", "evidenceMapRowId", "basis"]) &&
    basis !== null &&
    typeof value.evidenceMapRowId === "string" &&
    value.evidenceMapRowId.trim().length > 0 &&
    value.basis === basis
  );
}


const supportedUpstreamStatuses = new Set(["FOUND", "answered"]);
const unsupportedUpstreamStatuses = new Set(["UNCLEAR", "MISSING", "unclear", "no_evidence"]);

/** Derive a conclusion from a finalized Evidence Map row and explicit assessments. */
export function deriveConformanceConclusion(
  candidate: unknown,
  applicabilityResultInput: unknown,
  assessmentInput: unknown,
): ConformanceConclusionResult {
  const dependency = validateEvidenceMapDependency(candidate);
  if (!dependency.ready) {
    return notAssessed(
      isRecord(candidate) && typeof candidate.rowId === "string" && candidate.rowId.trim()
        ? (candidate as EvidenceMapRow)
        : null,
      dependency.blockedBy.map((reason) => ({
        category: "evidence_map_dependency_blocked" as const,
        reason,
      })),
    );
  }

  const row = dependency.row;
  if (!isApplicabilityResult(applicabilityResultInput)) {
    return notAssessed(row, [block("applicability_result_invalid")]);
  }
  const applicabilityResult = applicabilityResultInput;
  if (applicabilityResult.applicability === "NOT_ASSESSED") {
    return notAssessed(
      row,
      applicabilityResult.blockedBy.map((reason) => ({ category: "applicability_blocked" as const, reason })),
    );
  }
  if (applicabilityResult.evidenceMapRowId !== row.rowId) {
    return notAssessed(row, [block("applicability_row_id_mismatch")]);
  }
  if (applicabilityResult.applicability !== row.applicabilityState) {
    return notAssessed(row, [block("applicability_row_state_mismatch")]);
  }
  if (!isAssessment(assessmentInput)) return notAssessed(row, [block("invalid_assessment_input")]);

  const assessment = assessmentInput;
  const blockedBy: ConformanceConclusionBlock[] = [];

  if (!supportedUpstreamStatuses.has(row.upstreamStatus) && !unsupportedUpstreamStatuses.has(row.upstreamStatus)) {
    blockedBy.push(block("unsupported_upstream_status"));
  }
  if (assessment.requirementSupport === "NOT_EVALUATED") {
    blockedBy.push(block("requirement_support_not_evaluated"));
  }
  if (assessment.requirementSupport === "SUPPORTED" && unsupportedUpstreamStatuses.has(row.upstreamStatus)) {
    blockedBy.push(block("upstream_status_conflicts_with_support"));
  }
  if (row.methodology !== null && assessment.versionIdentityAssessment === "NOT_REQUIRED") {
    blockAndPush(blockedBy, "version_identity_not_required_for_methodology");
  }
  if (row.methodology === null && assessment.versionIdentityAssessment === "MATCHED") {
    blockAndPush(blockedBy, "version_identity_matched_without_methodology");
  }
  if (assessment.versionIdentityAssessment === "MISMATCHED") blockAndPush(blockedBy, "version_identity_mismatch");
  if (assessment.versionIdentityAssessment === "UNRESOLVED") blockAndPush(blockedBy, "version_identity_unresolved");
  if (assessment.provenanceAssessment === "INCOMPLETE") blockAndPush(blockedBy, "provenance_incomplete");
  if (assessment.provenanceAssessment === "NOT_EVALUATED") blockAndPush(blockedBy, "provenance_not_evaluated");
  if (assessment.contradictionAssessment === "BLOCKING") blockAndPush(blockedBy, "blocking_contradiction");
  if (assessment.contradictionAssessment === "NOT_EVALUATED") blockAndPush(blockedBy, "contradiction_not_evaluated");
  if (applicabilityResult.applicability === "APPLICABLE") {
    if (assessment.searchCoverageAssessment === "INADEQUATE") blockAndPush(blockedBy, "search_coverage_inadequate");
    if (assessment.searchCoverageAssessment === "NOT_EVALUATED") blockAndPush(blockedBy, "search_coverage_not_evaluated");
  }

  if (blockedBy.length > 0) return notAssessed(row, blockedBy);

  const safeVersion = assessment.versionIdentityAssessment === "MATCHED" || assessment.versionIdentityAssessment === "NOT_REQUIRED";
  const safeProvenance = assessment.provenanceAssessment === "COMPLETE";
  const safeContradiction = assessment.contradictionAssessment === "NONE";
  if (applicabilityResult.applicability === "NOT_APPLICABLE" && safeVersion && safeProvenance && safeContradiction) {
    return { conclusion: "NOT_APPLICABLE", evidenceMapRowId: row.rowId, basis: "explicit_upstream_not_applicable" };
  }

  const adequateSearch = assessment.searchCoverageAssessment === "ADEQUATE" || assessment.searchCoverageAssessment === "NOT_REQUIRED";
  if (applicabilityResult.applicability !== "APPLICABLE" || !adequateSearch || !safeVersion || !safeProvenance || !safeContradiction) {
    return notAssessed(row, [block("invalid_assessment_input")]);
  }
  if (assessment.requirementSupport === "SUPPORTED") {
    return { conclusion: "CONFORMS", evidenceMapRowId: row.rowId, basis: "supported_applicable_requirement" };
  }
  return { conclusion: "ACTION_REQUIRED", evidenceMapRowId: row.rowId, basis: "applicable_requirement_not_supported" };
}

function blockAndPush(
  blockedBy: ConformanceConclusionBlock[],
  category: Exclude<ConformanceConclusionBlockCategory, "evidence_map_dependency_blocked" | "applicability_blocked">,
): void {
  blockedBy.push(block(category));
}

export const evaluateConformanceConclusion = deriveConformanceConclusion;
