import {
  validateEvidenceMapDependency,
  type EvidenceMapDependencyBlockReason,
  type EvidenceMapRow,
} from "@/lib/evidence/evidenceMapDependencyContract";

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
  | "invalid_assessment_input"
  | "unsupported_upstream_status"
  | "applicability_unknown"
  | "requirement_support_not_evaluated"
  | "upstream_status_conflicts_with_support"
  | "search_coverage_inadequate"
  | "search_coverage_not_evaluated"
  | "provenance_incomplete"
  | "provenance_not_evaluated"
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
      category: Exclude<ConformanceConclusionBlockCategory, "evidence_map_dependency_blocked">;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAssessment(value: unknown): value is ConformanceAssessmentInput {
  if (!isRecord(value)) return false;
  return (Object.keys(assessmentValues) as (keyof ConformanceAssessmentInput)[]).every((key) =>
    (assessmentValues[key] as readonly unknown[]).includes(value[key]),
  );
}

function block(category: Exclude<ConformanceConclusionBlockCategory, "evidence_map_dependency_blocked">): ConformanceConclusionBlock {
  return { category };
}

function notAssessed(
  row: EvidenceMapRow | null,
  blockedBy: readonly ConformanceConclusionBlock[],
): ConformanceConclusionResult {
  return { conclusion: "NOT_ASSESSED", evidenceMapRowId: row?.rowId ?? null, blockedBy };
}

const supportedUpstreamStatuses = new Set(["FOUND", "answered"]);
const unsupportedUpstreamStatuses = new Set(["UNCLEAR", "MISSING", "unclear", "no_evidence"]);

/** Derive a conclusion from a finalized Evidence Map row and explicit assessments. */
export function deriveConformanceConclusion(
  candidate: unknown,
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
  if (!isAssessment(assessmentInput)) return notAssessed(row, [block("invalid_assessment_input")]);

  const assessment = assessmentInput;
  const blockedBy: ConformanceConclusionBlock[] = [];

  if (!supportedUpstreamStatuses.has(row.upstreamStatus) && !unsupportedUpstreamStatuses.has(row.upstreamStatus)) {
    blockedBy.push(block("unsupported_upstream_status"));
  }
  if (row.applicabilityState === "UNKNOWN") blockedBy.push(block("applicability_unknown"));
  if (assessment.requirementSupport === "NOT_EVALUATED") {
    blockedBy.push(block("requirement_support_not_evaluated"));
  }
  if (assessment.requirementSupport === "SUPPORTED" && unsupportedUpstreamStatuses.has(row.upstreamStatus)) {
    blockedBy.push(block("upstream_status_conflicts_with_support"));
  }
  if (assessment.versionIdentityAssessment === "MISMATCHED") blockAndPush(blockedBy, "version_identity_mismatch");
  if (assessment.versionIdentityAssessment === "UNRESOLVED") blockAndPush(blockedBy, "version_identity_unresolved");
  if (assessment.provenanceAssessment === "INCOMPLETE") blockAndPush(blockedBy, "provenance_incomplete");
  if (assessment.provenanceAssessment === "NOT_EVALUATED") blockAndPush(blockedBy, "provenance_not_evaluated");
  if (assessment.contradictionAssessment === "BLOCKING") blockAndPush(blockedBy, "blocking_contradiction");
  if (assessment.contradictionAssessment === "NOT_EVALUATED") blockAndPush(blockedBy, "contradiction_not_evaluated");
  if (row.applicabilityState === "APPLICABLE") {
    if (assessment.searchCoverageAssessment === "INADEQUATE") blockAndPush(blockedBy, "search_coverage_inadequate");
    if (assessment.searchCoverageAssessment === "NOT_EVALUATED") blockAndPush(blockedBy, "search_coverage_not_evaluated");
  }

  if (blockedBy.length > 0) return notAssessed(row, blockedBy);

  const safeVersion = assessment.versionIdentityAssessment === "MATCHED" || assessment.versionIdentityAssessment === "NOT_REQUIRED";
  const safeProvenance = assessment.provenanceAssessment === "COMPLETE";
  const safeContradiction = assessment.contradictionAssessment === "NONE";
  if (row.applicabilityState === "NOT_APPLICABLE" && safeVersion && safeProvenance && safeContradiction) {
    return { conclusion: "NOT_APPLICABLE", evidenceMapRowId: row.rowId, basis: "explicit_upstream_not_applicable" };
  }

  const adequateSearch = assessment.searchCoverageAssessment === "ADEQUATE" || assessment.searchCoverageAssessment === "NOT_REQUIRED";
  if (row.applicabilityState !== "APPLICABLE" || !adequateSearch || !safeVersion || !safeProvenance || !safeContradiction) {
    return notAssessed(row, [block("invalid_assessment_input")]);
  }
  if (assessment.requirementSupport === "SUPPORTED") {
    return { conclusion: "CONFORMS", evidenceMapRowId: row.rowId, basis: "supported_applicable_requirement" };
  }
  return { conclusion: "ACTION_REQUIRED", evidenceMapRowId: row.rowId, basis: "applicable_requirement_not_supported" };
}

function blockAndPush(
  blockedBy: ConformanceConclusionBlock[],
  category: Exclude<ConformanceConclusionBlockCategory, "evidence_map_dependency_blocked">,
): void {
  blockedBy.push(block(category));
}

export const evaluateConformanceConclusion = deriveConformanceConclusion;
