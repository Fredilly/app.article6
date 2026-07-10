import {
  validateEvidenceMapDependency,
  type EvidenceMapDependencyBlockReason,
} from "@/lib/evidence/evidenceMapDependencyContract";
import type {
  ConformanceConclusion,
  ConformanceConclusionResult,
} from "@/lib/evidence/conformanceConclusionContract";

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
const conclusions: readonly ConformanceConclusion[] = [
  "CONFORMS",
  "ACTION_REQUIRED",
  "NOT_APPLICABLE",
  "NOT_ASSESSED",
];
const authorityLanguage = /\b(?:issued|formally\s+issued|validated|verified|approved\s+by\s+(?:a\s+)?vvb|closed\s+(?:a\s+)?finding|formal\s+finding)\b/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDraftFindingType(value: unknown): value is DraftFindingType {
  return value === null || (typeof value === "string" && draftFindingTypes.includes(value as (typeof draftFindingTypes)[number]));
}

function isConformanceResult(value: unknown): value is ConformanceConclusionResult {
  if (!isRecord(value) || !conclusions.includes(value.conclusion as ConformanceConclusion)) return false;
  if (value.conclusion === "NOT_ASSESSED") {
    return (value.evidenceMapRowId === null || typeof value.evidenceMapRowId === "string") && Array.isArray(value.blockedBy);
  }
  const basis = value.conclusion === "CONFORMS"
    ? "supported_applicable_requirement"
    : value.conclusion === "ACTION_REQUIRED"
      ? "applicable_requirement_not_supported"
      : "explicit_upstream_not_applicable";
  return typeof value.evidenceMapRowId === "string" && value.basis === basis;
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
  if (!isConformanceResult(conformanceResult)) {
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

  const conclusion = isConformanceResult(conformanceResult) ? conformanceResult.conclusion : null;
  if (conclusion !== "ACTION_REQUIRED" && isAssessment(assessmentInput) && assessmentInput.draftFindingType !== null) {
    blockedBy.push(block("classification_not_allowed_for_conclusion"));
  }

  if (blockedBy.length > 0) return nullFinding(blockedBy);
  if (!isConformanceResult(conformanceResult) || !isAssessment(assessmentInput)) return nullFinding();
  if (conformanceResult.conclusion !== "ACTION_REQUIRED" || assessmentInput.draftFindingType === null) return nullFinding();

  const findingBasis = assessmentInput.findingBasis as string;
  const reviewerAssessment = assessmentInput.reviewerAssessment as string;
  const record: DraftFindingRecord = {
    findingId: `draft:${row.rowId}:${assessmentInput.draftFindingType}`,
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
