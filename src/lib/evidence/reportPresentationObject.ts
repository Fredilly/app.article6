import {
  validateEvidenceMapDependency,
  type EvidenceMapDependencyBlockReason,
  type EvidenceMapRow,
} from "@/lib/evidence/evidenceMapDependencyContract";
import {
  isApplicabilityResult,
  type ApplicabilityContractBlock,
  type ApplicabilityResult,
} from "@/lib/evidence/applicabilityContract";
import {
  isConformanceConclusionResult,
  type ConformanceConclusionBlock,
  type ConformanceConclusionResult,
} from "@/lib/evidence/conformanceConclusionContract";
import { isDraftFindingResult, type DraftFindingBlock, type DraftFindingResult } from "@/lib/evidence/draftFindingContract";

export const PRESENTATION_CONTRACT_VERSION = "v1" as const;

export type MachineProposalTraceability = Readonly<{
  source: "EVIDENCE_MAP";
  evidenceMapRowId: string;
}>;

export type ReportPresentationObject = Readonly<{
  profile: "GENERIC_PRE_VALIDATION";
  evidenceMapRowId: string;
  requirement: EvidenceMapRow["requirement"];
  methodology: EvidenceMapRow["methodology"];
  upstreamStatus: string;
  applicabilityResult: ApplicabilityResult;
  conformanceConclusion: ConformanceConclusionResult;
  draftFindingResult: DraftFindingResult;
  acceptedEvidence: EvidenceMapRow["acceptedEvidence"];
  rejectedEvidence: EvidenceMapRow["rejectedEvidence"];
  assessmentReason: string;
  clientAction: string | null;
  searchCoverage: EvidenceMapRow["searchCoverage"];
  sourceDocument: EvidenceMapRow["sourceDocument"];
  evidenceProvenance: EvidenceMapRow["evidenceProvenance"];
  finalizationActorRef: string;
  finalizedAt: string;
  finalizationBasis: string;
  reviewHistoryRef: string;
  evidenceMapContractVersion: string;
  reviewPolicyVersion: string;
  presentationContractVersion: typeof PRESENTATION_CONTRACT_VERSION;
  machineProposalTraceability: MachineProposalTraceability | null;
  reviewState?: "current" | "pending_review" | "reopened" | "superseded" | "stale";
  sharedProjectFacts?: Readonly<Record<string, string | number | boolean | null>>;
  assumptions?: readonly string[];
}>;

export type ReportPresentationBlock =
  | Readonly<{ category: "evidence_map_dependency_blocked"; reason: EvidenceMapDependencyBlockReason }>
  | Readonly<{ category: "applicability_blocked"; reason: ApplicabilityContractBlock }>
  | Readonly<{ category: "conformance_blocked"; reason: ConformanceConclusionBlock }>
  | Readonly<{ category: "draft_finding_blocked"; reason: DraftFindingBlock }>
  | Readonly<{
      category:
        | "invalid_applicability_result"
        | "applicability_row_id_mismatch"
        | "applicability_row_state_mismatch"
        | "invalid_conformance_result"
        | "conformance_row_id_mismatch"
        | "conformance_applicability_mismatch"
        | "invalid_draft_finding_result"
        | "draft_finding_row_id_mismatch"
        | "draft_finding_requirement_id_mismatch"
        | "draft_finding_id_mismatch"
        | "draft_finding_conclusion_mismatch";
    }>;

export type ReportPresentationResult =
  | Readonly<{ ready: true; presentation: ReportPresentationObject }>
  | Readonly<{
      ready: false;
      conclusion: "NOT_ASSESSED";
      evidenceMapRowId: string | null;
      blockedBy: readonly ReportPresentationBlock[];
    }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
}

function hasAllowedKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isEvidenceProvenance(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ["docId", "page", "sectionPath", "spanId", "sectionHeading", "sourceType"])) {
    return false;
  }
  return (
    hasText(value.docId) &&
    (value.page === null || (typeof value.page === "number" && Number.isFinite(value.page))) &&
    Array.isArray(value.sectionPath) &&
    value.sectionPath.every((entry) => typeof entry === "string") &&
    hasText(value.spanId) &&
    (value.sectionHeading === null || hasText(value.sectionHeading)) &&
    (value.sourceType === null || hasText(value.sourceType))
  );
}

function isStrictEvidenceMapFields(value: Record<string, unknown>): boolean {
  if (!isRecord(value.requirement) || !hasOnlyKeys(value.requirement, ["requirementId", "requirementReference", "requirementText"]) ||
      !hasText(value.requirement.requirementId) || !hasText(value.requirement.requirementReference) || !hasText(value.requirement.requirementText)) return false;
  if (value.methodology !== null &&
      (!isRecord(value.methodology) || !hasOnlyKeys(value.methodology, ["methodologyId", "rulebookVersion"]) ||
       !hasText(value.methodology.methodologyId) || !hasText(value.methodology.rulebookVersion))) return false;
  if (!isRecord(value.searchCoverage) || !hasOnlyKeys(value.searchCoverage, ["searched", "searchedDocumentIds", "notes"]) ||
      typeof value.searchCoverage.searched !== "boolean" || !Array.isArray(value.searchCoverage.searchedDocumentIds) ||
      !value.searchCoverage.searchedDocumentIds.every((entry) => hasText(entry)) ||
      (value.searchCoverage.notes !== null && !hasText(value.searchCoverage.notes))) return false;
  if (!isRecord(value.sourceDocument) || !hasOnlyKeys(value.sourceDocument, ["documentId", "documentName", "contentSha256"]) ||
      !hasText(value.sourceDocument.documentId) ||
      (value.sourceDocument.documentName !== null && !hasText(value.sourceDocument.documentName)) ||
      (value.sourceDocument.contentSha256 !== null && !hasText(value.sourceDocument.contentSha256))) return false;
  if (!Array.isArray(value.evidenceProvenance) || !value.evidenceProvenance.every(isEvidenceProvenance)) return false;
  if (!Array.isArray(value.acceptedEvidence) || !value.acceptedEvidence.every((item) =>
    isRecord(item) && hasOnlyKeys(item, ["evidenceId", "quote", "provenance"]) && hasText(item.evidenceId) && hasText(item.quote) && isEvidenceProvenance(item.provenance))) return false;
  if (!Array.isArray(value.rejectedEvidence) || !value.rejectedEvidence.every((item) =>
    isRecord(item) && hasOnlyKeys(item, ["evidenceId", "quote", "rejectionReason", "provenance"]) && hasText(item.evidenceId) &&
    hasText(item.quote) && hasText(item.rejectionReason) && isEvidenceProvenance(item.provenance))) return false;
  return true;
}

/** Strict runtime validator for the immutable Phase 6 boundary. */
export function isReportPresentationObject(value: unknown): value is ReportPresentationObject {
  if (!isRecord(value) || !hasAllowedKeys(value, [
    "profile", "evidenceMapRowId", "requirement", "methodology", "upstreamStatus", "applicabilityResult",
    "conformanceConclusion", "draftFindingResult", "acceptedEvidence", "rejectedEvidence", "assessmentReason",
    "clientAction", "searchCoverage", "sourceDocument", "evidenceProvenance", "finalizationActorRef", "finalizedAt",
    "finalizationBasis", "reviewHistoryRef", "evidenceMapContractVersion", "reviewPolicyVersion", "presentationContractVersion",
    "machineProposalTraceability", "reviewState", "sharedProjectFacts", "assumptions",
  ])) return false;
  if (value.profile !== "GENERIC_PRE_VALIDATION" || !hasText(value.evidenceMapRowId) || !hasText(value.upstreamStatus) ||
      !hasText(value.assessmentReason) || (value.clientAction !== null && !hasText(value.clientAction)) ||
      (value.finalizationActorRef !== undefined && typeof value.finalizationActorRef !== "string") ||
      (value.finalizedAt !== undefined && typeof value.finalizedAt !== "string") ||
      (value.finalizationBasis !== undefined && typeof value.finalizationBasis !== "string") ||
      (value.reviewHistoryRef !== undefined && typeof value.reviewHistoryRef !== "string") ||
      !hasText(value.evidenceMapContractVersion) || !hasText(value.reviewPolicyVersion) ||
      value.presentationContractVersion !== PRESENTATION_CONTRACT_VERSION ||
      (value.reviewState !== undefined && value.reviewState !== "current" && value.reviewState !== "pending_review" && value.reviewState !== "reopened" && value.reviewState !== "superseded" && value.reviewState !== "stale") ||
      (value.assumptions !== undefined && (!Array.isArray(value.assumptions) || !value.assumptions.every((entry) => hasText(entry)))) ||
      (value.sharedProjectFacts !== undefined && (!isRecord(value.sharedProjectFacts) || Object.values(value.sharedProjectFacts).some((entry) =>
        entry !== null && typeof entry !== "string" && typeof entry !== "number" && typeof entry !== "boolean"))) ||
      !isStrictEvidenceMapFields(value) || !isApplicabilityResult(value.applicabilityResult) ||
      !isConformanceConclusionResult(value.conformanceConclusion) || !isDraftFindingResult(value.draftFindingResult)) return false;
  if (value.machineProposalTraceability !== null &&
      (!isRecord(value.machineProposalTraceability) || !hasOnlyKeys(value.machineProposalTraceability, ["source", "evidenceMapRowId"]) ||
       value.machineProposalTraceability.source !== "EVIDENCE_MAP" || value.machineProposalTraceability.evidenceMapRowId !== value.evidenceMapRowId)) return false;
  return value.applicabilityResult.applicability !== "NOT_ASSESSED" &&
    value.conformanceConclusion.conclusion !== "NOT_ASSESSED";
}

function rowIdFrom(candidate: unknown): string | null {
  return isRecord(candidate) && hasText(candidate.rowId) ? candidate.rowId : null;
}

function blocked(
  evidenceMapRowId: string | null,
  blockedBy: readonly ReportPresentationBlock[],
): ReportPresentationResult {
  return { ready: false, conclusion: "NOT_ASSESSED", evidenceMapRowId, blockedBy };
}

function cloneAndFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const clone = Array.isArray(value)
    ? value.map((entry) => cloneAndFreeze(entry))
    : Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, cloneAndFreeze(entry)]));
  return Object.freeze(clone) as T;
}

/** Package validated upstream outputs without deriving or rewriting any judgment. */
export function createReportPresentationObject(
  candidate: unknown,
  applicabilityResultInput: unknown,
  conformanceConclusionInput: unknown,
  draftFindingResultInput: unknown,
): ReportPresentationResult {
  const dependency = validateEvidenceMapDependency(candidate);
  if (!dependency.ready) {
    return blocked(
      rowIdFrom(candidate),
      dependency.blockedBy.map((reason) => ({ category: "evidence_map_dependency_blocked" as const, reason })),
    );
  }

  const row = dependency.row;
  if (!isApplicabilityResult(applicabilityResultInput)) {
    return blocked(row.rowId, [{ category: "invalid_applicability_result" }]);
  }
  const applicabilityResult = applicabilityResultInput;
  if (applicabilityResult.applicability === "NOT_ASSESSED") {
    return blocked(row.rowId, applicabilityResult.blockedBy.map((reason) => ({ category: "applicability_blocked" as const, reason })));
  }
  if (applicabilityResult.evidenceMapRowId !== row.rowId) {
    return blocked(row.rowId, [{ category: "applicability_row_id_mismatch" }]);
  }
  if (applicabilityResult.applicability !== row.applicabilityState) {
    return blocked(row.rowId, [{ category: "applicability_row_state_mismatch" }]);
  }

  if (!isConformanceConclusionResult(conformanceConclusionInput)) {
    return blocked(row.rowId, [{ category: "invalid_conformance_result" }]);
  }
  const conformanceConclusion = conformanceConclusionInput;
  if (conformanceConclusion.conclusion === "NOT_ASSESSED") {
    return blocked(row.rowId, conformanceConclusion.blockedBy.map((reason) => ({ category: "conformance_blocked" as const, reason })));
  }
  if (conformanceConclusion.evidenceMapRowId !== row.rowId) {
    return blocked(row.rowId, [{ category: "conformance_row_id_mismatch" }]);
  }
  if (
    (applicabilityResult.applicability === "APPLICABLE" && conformanceConclusion.conclusion === "NOT_APPLICABLE") ||
    (applicabilityResult.applicability === "NOT_APPLICABLE" && conformanceConclusion.conclusion !== "NOT_APPLICABLE")
  ) {
    return blocked(row.rowId, [{ category: "conformance_applicability_mismatch" }]);
  }

  if (!isDraftFindingResult(draftFindingResultInput)) {
    return blocked(row.rowId, [{ category: "invalid_draft_finding_result" }]);
  }
  const draftFindingResult = draftFindingResultInput;
  const draftFindingBlockers = "blockedBy" in draftFindingResult ? draftFindingResult.blockedBy : undefined;
  if (draftFindingResult.draftFindingType === null && draftFindingBlockers !== undefined && draftFindingBlockers.length > 0) {
    return blocked(row.rowId, draftFindingBlockers.map((reason) => ({ category: "draft_finding_blocked" as const, reason })));
  }
  if (draftFindingResult.draftFindingRecord !== null && draftFindingResult.draftFindingRecord.evidenceMapRowId !== row.rowId) {
    return blocked(row.rowId, [{ category: "draft_finding_row_id_mismatch" }]);
  }
  if (draftFindingResult.draftFindingRecord !== null && draftFindingResult.draftFindingRecord.requirementId !== row.requirement.requirementId) {
    return blocked(row.rowId, [{ category: "draft_finding_requirement_id_mismatch" }]);
  }
  if (draftFindingResult.draftFindingRecord !== null && draftFindingResult.draftFindingRecord.findingId !== `draft:${row.rowId}`) {
    return blocked(row.rowId, [{ category: "draft_finding_id_mismatch" }]);
  }
  if (
    (draftFindingResult.draftFindingRecord !== null && conformanceConclusion.conclusion !== "ACTION_REQUIRED") ||
    (draftFindingResult.draftFindingRecord === null && draftFindingResult.draftFindingType !== null)
  ) {
    return blocked(row.rowId, [{ category: "draft_finding_conclusion_mismatch" }]);
  }

  const presentation: ReportPresentationObject = {
    profile: "GENERIC_PRE_VALIDATION",
    evidenceMapRowId: row.rowId,
    requirement: row.requirement,
    methodology: row.methodology,
    upstreamStatus: row.upstreamStatus,
    applicabilityResult,
    conformanceConclusion,
    draftFindingResult,
    acceptedEvidence: row.acceptedEvidence,
    rejectedEvidence: row.rejectedEvidence,
    assessmentReason: row.assessmentReason,
    clientAction: row.clientAction,
    searchCoverage: row.searchCoverage,
    sourceDocument: row.sourceDocument,
    evidenceProvenance: row.evidenceProvenance,
    finalizationActorRef: row.finalizationActorRef,
    finalizedAt: row.finalizedAt,
    finalizationBasis: row.finalizationBasis,
    reviewHistoryRef: row.reviewHistoryRef,
    evidenceMapContractVersion: row.evidenceMapContractVersion,
    reviewPolicyVersion: row.reviewPolicyVersion,
    presentationContractVersion: PRESENTATION_CONTRACT_VERSION,
    machineProposalTraceability: null,
  };
  return { ready: true, presentation: cloneAndFreeze(presentation) };
}

export const deriveReportPresentationObject = createReportPresentationObject;
