import {
  validateEvidenceMapDependency,
  type EvidenceMapDependencyBlockReason,
} from "@/lib/evidence/evidenceMapDependencyContract";
import { isConformanceConclusionResult } from "@/lib/evidence/conformanceConclusionContract";

export type DraftFindingType = "NIR_CANDIDATE" | "NCR_CANDIDATE" | "OFI_CANDIDATE" | null;

export type DraftFindingAssessmentInput = Readonly<{
  draftFindingType: DraftFindingType;
  findingBasis: string | null;
  reviewerAssessment: string | null;
}>;

export type DraftFindingRecord = Readonly<{
  findingId: string;
  profile: "GENERIC_PRE_VALIDATION";
  evidenceMapRowId: string;
  requirementId: string;
  conformanceConclusion: "ACTION_REQUIRED";
  draftFindingType: Exclude<DraftFindingType, null>;
  findingBasis: string;
  clientResponse: null;
  reviewerAssessment: string;
  closingRemarks: null;
}>;

export type DraftFindingBlockCategory =
  | "evidence_map_dependency_blocked"
  | "invalid_conformance_result"
  | "conformance_row_id_mismatch"
  | "invalid_draft_finding_assessment"
  | "classification_not_explicit"
  | "classification_not_allowed_for_conclusion"
  | "finding_basis_missing"
  | "reviewer_assessment_missing"
  | "formal_authority_language";

export type DraftFindingBlock =
  | Readonly<{
      category: "evidence_map_dependency_blocked";
      reason: EvidenceMapDependencyBlockReason;
    }>
  | Readonly<{
      category: Exclude<DraftFindingBlockCategory, "evidence_map_dependency_blocked">;
    }>;

export type DraftFindingResult =
  | Readonly<{
      draftFindingType: null;
      draftFindingRecord: null;
      blockedBy?: readonly DraftFindingBlock[];
    }>
  | Readonly<{
      draftFindingType: Exclude<DraftFindingType, null>;
      draftFindingRecord: DraftFindingRecord;
    }>;

const draftFindingTypes = ["NIR_CANDIDATE", "NCR_CANDIDATE", "OFI_CANDIDATE"] as const;
const authorityLanguage = /\b(?:issued|formally\s+issued|validated|verified|approved\s+by\s+(?:a\s+)?vvb|closed\s+(?:a\s+)?finding|formal\s+finding)\b/i;
const draftFindingBlockCategories: readonly DraftFindingBlockCategory[] = [
  "evidence_map_dependency_blocked", "invalid_conformance_result", "conformance_row_id_mismatch",
  "invalid_draft_finding_assessment", "classification_not_explicit", "classification_not_allowed_for_conclusion",
  "finding_basis_missing", "reviewer_assessment_missing", "formal_authority_language",
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

function isDraftFindingType(value: unknown): value is DraftFindingType {
  return value === null || (typeof value === "string" && draftFindingTypes.includes(value as (typeof draftFindingTypes)[number]));
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isDraftFindingBlock(value: unknown): value is DraftFindingBlock {
  if (!isRecord(value) || typeof value.category !== "string" || !draftFindingBlockCategories.includes(value.category as DraftFindingBlockCategory)) return false;
  if (value.category === "evidence_map_dependency_blocked") {
    return hasOnlyKeys(value, ["category", "reason"]) && typeof value.reason === "string" && dependencyBlockReasons.includes(value.reason as EvidenceMapDependencyBlockReason);
  }
  return hasOnlyKeys(value, ["category"]);
}

function isAssessment(value: unknown): value is DraftFindingAssessmentInput {
  if (!isRecord(value) || !Object.prototype.hasOwnProperty.call(value, "draftFindingType")) return false;
  return (
    isDraftFindingType(value.draftFindingType) &&
    (value.findingBasis === null || typeof value.findingBasis === "string") &&
    (value.reviewerAssessment === null || typeof value.reviewerAssessment === "string")
  );
}

function block(category: Exclude<DraftFindingBlockCategory, "evidence_map_dependency_blocked">): DraftFindingBlock {
  return { category };
}

function nullFinding(blockedBy?: readonly DraftFindingBlock[]): DraftFindingResult {
  return blockedBy === undefined
    ? { draftFindingType: null, draftFindingRecord: null }
    : { draftFindingType: null, draftFindingRecord: null, blockedBy };
}

function nonEmptyText(value: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Validate the complete Phase 4 result shape before presentation packaging. */
export function isDraftFindingResult(value: unknown): value is DraftFindingResult {
  if (!isRecord(value) || !hasOnlyKeys(value, ["draftFindingType", "draftFindingRecord", "blockedBy"])) return false;
  if (value.draftFindingType === null) {
    if (value.draftFindingRecord !== null) return false;
    if (!Object.prototype.hasOwnProperty.call(value, "blockedBy")) return Object.keys(value).length === 2;
    return Array.isArray(value.blockedBy) && value.blockedBy.length > 0 && value.blockedBy.every(isDraftFindingBlock);
  }
  if (!isDraftFindingType(value.draftFindingType) || value.draftFindingRecord === null || !isRecord(value.draftFindingRecord) || Object.keys(value).length !== 2) return false;
  const record = value.draftFindingRecord;
  return (
    hasOnlyKeys(record, ["findingId", "profile", "evidenceMapRowId", "requirementId", "conformanceConclusion", "draftFindingType", "findingBasis", "clientResponse", "reviewerAssessment", "closingRemarks"]) &&
    typeof record.findingId === "string" && nonEmptyText(record.findingId) &&
    record.profile === "GENERIC_PRE_VALIDATION" &&
    typeof record.evidenceMapRowId === "string" && nonEmptyText(record.evidenceMapRowId) &&
    typeof record.requirementId === "string" && nonEmptyText(record.requirementId) &&
    record.conformanceConclusion === "ACTION_REQUIRED" &&
    record.draftFindingType === value.draftFindingType &&
    typeof record.findingBasis === "string" && nonEmptyText(record.findingBasis) &&
    !authorityLanguage.test(record.findingBasis) &&
    record.clientResponse === null &&
    typeof record.reviewerAssessment === "string" && nonEmptyText(record.reviewerAssessment) &&
    !authorityLanguage.test(record.reviewerAssessment) &&
    record.closingRemarks === null
  );
}

/** Map an explicit Phase 4 classification to a generic draft candidate. */
export function deriveDraftFinding(
  candidate: unknown,
  conformanceResult: unknown,
  assessmentInput: unknown,
): DraftFindingResult {
  const dependency = validateEvidenceMapDependency(candidate);
  if (!dependency.ready) {
    return nullFinding(
      dependency.blockedBy.map((reason) => ({
        category: "evidence_map_dependency_blocked" as const,
        reason,
      })),
    );
  }

  const row = dependency.row;
  const blockedBy: DraftFindingBlock[] = [];
  if (!isConformanceConclusionResult(conformanceResult)) {
    blockedBy.push(block("invalid_conformance_result"));
  } else if (conformanceResult.evidenceMapRowId !== null && conformanceResult.evidenceMapRowId !== row.rowId) {
    blockedBy.push(block("conformance_row_id_mismatch"));
  }

  if (!isAssessment(assessmentInput)) {
    blockedBy.push(block("invalid_draft_finding_assessment"));
  } else {
    if (assessmentInput.draftFindingType === null) {
      if (assessmentInput.findingBasis !== null || assessmentInput.reviewerAssessment !== null) {
        blockedBy.push(block("classification_not_explicit"));
      }
    } else {
      if (!nonEmptyText(assessmentInput.findingBasis)) blockedBy.push(block("finding_basis_missing"));
      if (!nonEmptyText(assessmentInput.reviewerAssessment)) blockedBy.push(block("reviewer_assessment_missing"));
      if (nonEmptyText(assessmentInput.findingBasis) && authorityLanguage.test(assessmentInput.findingBasis)) {
        blockedBy.push(block("formal_authority_language"));
      }
      if (nonEmptyText(assessmentInput.reviewerAssessment) && authorityLanguage.test(assessmentInput.reviewerAssessment)) {
        blockedBy.push(block("formal_authority_language"));
      }
    }
  }

  const conclusion = isConformanceConclusionResult(conformanceResult) ? conformanceResult.conclusion : null;
  if (conclusion !== "ACTION_REQUIRED" && isAssessment(assessmentInput) && assessmentInput.draftFindingType !== null) {
    blockedBy.push(block("classification_not_allowed_for_conclusion"));
  }

  if (blockedBy.length > 0) return nullFinding(blockedBy);
  if (!isConformanceConclusionResult(conformanceResult) || !isAssessment(assessmentInput)) return nullFinding();
  if (conformanceResult.conclusion !== "ACTION_REQUIRED" || assessmentInput.draftFindingType === null) return nullFinding();

  const findingBasis = assessmentInput.findingBasis as string;
  const reviewerAssessment = assessmentInput.reviewerAssessment as string;
  const record: DraftFindingRecord = {
    findingId: `draft:${row.rowId}`,
    profile: "GENERIC_PRE_VALIDATION",
    evidenceMapRowId: row.rowId,
    requirementId: row.requirement.requirementId,
    conformanceConclusion: "ACTION_REQUIRED",
    draftFindingType: assessmentInput.draftFindingType,
    findingBasis,
    clientResponse: null,
    reviewerAssessment,
    closingRemarks: null,
  };
  return { draftFindingType: assessmentInput.draftFindingType, draftFindingRecord: record };
}

export const evaluateDraftFinding = deriveDraftFinding;
