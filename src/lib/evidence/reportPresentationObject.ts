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
import type { DraftFindingBlock, DraftFindingResult } from "@/lib/evidence/draftFindingContract";

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
  if (Object.isFrozen(value)) return value;
  const clone = Array.isArray(value)
    ? value.map((entry) => cloneAndFreeze(entry))
    : Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, cloneAndFreeze(entry)]));
  return Object.freeze(clone) as T;
}

function isDraftFindingResult(value: unknown): value is DraftFindingResult {
  if (!isRecord(value) || !("draftFindingType" in value) || !("draftFindingRecord" in value)) return false;
  const type = value.draftFindingType;
  if (type === null) {
    return value.draftFindingRecord === null &&
      (!Object.prototype.hasOwnProperty.call(value, "blockedBy") || (Array.isArray(value.blockedBy) && value.blockedBy.length > 0));
  }
  if (type !== "NIR_CANDIDATE" && type !== "NCR_CANDIDATE" && type !== "OFI_CANDIDATE") return false;
  const record = value.draftFindingRecord;
  if (!isRecord(record)) return false;
  return (
    record.profile === "GENERIC_PRE_VALIDATION" &&
    hasText(record.findingId) &&
    hasText(record.evidenceMapRowId) &&
    hasText(record.requirementId) &&
    record.conformanceConclusion === "ACTION_REQUIRED" &&
    record.draftFindingType === type &&
    hasText(record.findingBasis) &&
    record.clientResponse === null &&
    hasText(record.reviewerAssessment) &&
    record.closingRemarks === null
  );
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
