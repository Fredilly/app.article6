import type { EvidenceSpan } from "@/lib/quickCheck/evidence/evidenceTypes";

/**
 * Phase 2 dependency contract for the future presentation layer.
 *
 * This module checks only that a finalized Evidence Map row carries the
 * upstream dependencies required by downstream presentation. It does not
 * judge evidence sufficiency, applicability, search quality, or status.
 */

export type EvidenceMapFinalizationState = "draft" | "finalized" | "unknown";

export type EvidenceMapApplicabilityState =
  | "APPLICABLE"
  | "NOT_APPLICABLE"
  | "UNKNOWN";

export type EvidenceMapMethodologyIdentity = Readonly<{
  methodologyId: string;
  rulebookVersion: string;
}>;

export type EvidenceMapRequirementIdentity = Readonly<{
  requirementId: string;
  requirementReference: string;
  requirementText: string;
}>;

export type EvidenceMapSourceDocumentIdentity = Readonly<{
  documentId: string;
  documentName: string | null;
  contentSha256: string | null;
}>;

export type EvidenceMapSearchCoverage = Readonly<{
  searched: boolean;
  searchedDocumentIds: readonly string[];
  notes: string | null;
}>;

/** Provenance reuses the canonical EvidenceSpan coordinates and span ID. */
export type EvidenceMapEvidenceProvenance = Readonly<
  Pick<EvidenceSpan, "docId" | "page" | "sectionPath" | "spanId">
> & {
  sectionHeading: string | null;
  sourceType: string | null;
};

export type EvidenceMapAcceptedEvidence = Readonly<{
  evidenceId: string;
  quote: string;
  provenance: EvidenceMapEvidenceProvenance;
}>;

export type EvidenceMapRejectedEvidence = Readonly<{
  evidenceId: string;
  quote: string;
  rejectionReason: string;
  provenance: EvidenceMapEvidenceProvenance;
}>;

export type EvidenceMapRow = Readonly<{
  rowId: string;
  requirement: EvidenceMapRequirementIdentity;
  methodology: EvidenceMapMethodologyIdentity | null;
  upstreamStatus: string;
  applicabilityState: EvidenceMapApplicabilityState;
  acceptedEvidence: readonly EvidenceMapAcceptedEvidence[];
  rejectedEvidence: readonly EvidenceMapRejectedEvidence[];
  assessmentReason: string;
  clientAction: string | null;
  searchCoverage: EvidenceMapSearchCoverage;
  sourceDocument: EvidenceMapSourceDocumentIdentity;
  evidenceProvenance: readonly EvidenceMapEvidenceProvenance[];
  finalizationState: EvidenceMapFinalizationState;
  finalizationActorRef: string;
  finalizedAt: string;
  finalizationBasis: string;
  reviewHistoryRef: string;
  evidenceMapContractVersion: string;
  reviewPolicyVersion: string;
}>;

export type EvidenceMapDependencyBlockReason =
  | "row_not_finalized"
  | "missing_row_identity"
  | "missing_requirement_identity"
  | "missing_methodology_identity"
  | "missing_methodology_version"
  | "missing_upstream_status"
  | "missing_applicability_state"
  | "missing_accepted_evidence_field"
  | "missing_rejected_evidence_field"
  | "missing_assessment_reason"
  | "missing_client_action_field"
  | "missing_search_coverage_field"
  | "missing_source_document_identity"
  | "missing_provenance"
  | "missing_finalization_actor_ref"
  | "missing_finalized_at"
  | "missing_finalization_basis"
  | "missing_review_history_ref"
  | "missing_evidence_map_contract_version"
  | "missing_review_policy_version";

export type EvidenceMapDependencyValidationResult =
  | Readonly<{
      ready: true;
      row: EvidenceMapRow;
    }>
  | Readonly<{
      ready: false;
      blockedBy: readonly EvidenceMapDependencyBlockReason[];
    }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasNullableText(value: unknown): value is string | null {
  return value === null || hasText(value);
}

function isEvidenceProvenance(value: unknown): value is EvidenceMapEvidenceProvenance {
  if (!isRecord(value)) return false;
  return (
    hasText(value.docId) &&
    (value.page === null || (typeof value.page === "number" && Number.isFinite(value.page))) &&
    Array.isArray(value.sectionPath) &&
    value.sectionPath.every((entry) => typeof entry === "string") &&
    hasText(value.spanId) &&
    hasNullableText(value.sectionHeading) &&
    hasNullableText(value.sourceType)
  );
}

function areAcceptedEvidenceItems(value: unknown): value is readonly EvidenceMapAcceptedEvidence[] {
  return Array.isArray(value) && value.every((item) => {
    if (!isRecord(item)) return false;
    return hasText(item.evidenceId) && hasText(item.quote) && isEvidenceProvenance(item.provenance);
  });
}

function areRejectedEvidenceItems(value: unknown): value is readonly EvidenceMapRejectedEvidence[] {
  return Array.isArray(value) && value.every((item) => {
    if (!isRecord(item)) return false;
    return (
      hasText(item.evidenceId) &&
      hasText(item.quote) &&
      hasText(item.rejectionReason) &&
      isEvidenceProvenance(item.provenance)
    );
  });
}

function isRequirementIdentity(value: unknown): value is EvidenceMapRequirementIdentity {
  if (!isRecord(value)) return false;
  return hasText(value.requirementId) && hasText(value.requirementReference) && hasText(value.requirementText);
}

function isMethodologyIdentity(value: unknown): value is EvidenceMapMethodologyIdentity {
  if (!isRecord(value)) return false;
  return hasText(value.methodologyId) && hasText(value.rulebookVersion);
}

function isSearchCoverage(value: unknown): value is EvidenceMapSearchCoverage {
  if (!isRecord(value)) return false;
  return (
    typeof value.searched === "boolean" &&
    Array.isArray(value.searchedDocumentIds) &&
    value.searchedDocumentIds.every((entry) => hasText(entry)) &&
    hasNullableText(value.notes)
  );
}

function isSourceDocumentIdentity(value: unknown): value is EvidenceMapSourceDocumentIdentity {
  if (!isRecord(value)) return false;
  return hasText(value.documentId) && hasNullableText(value.documentName) && hasNullableText(value.contentSha256);
}

function isApplicabilityState(value: unknown): value is EvidenceMapApplicabilityState {
  return value === "APPLICABLE" || value === "NOT_APPLICABLE" || value === "UNKNOWN";
}

/**
 * Validate dependency completeness without changing or copying the candidate.
 * Explicit empty arrays and null values are retained as valid representations
 * of absence where the contract permits them.
 */
export function validateEvidenceMapDependency(
  candidate: unknown,
): EvidenceMapDependencyValidationResult {
  const blockedBy: EvidenceMapDependencyBlockReason[] = [];

  if (!isRecord(candidate) || candidate.finalizationState !== "finalized") {
    blockedBy.push("row_not_finalized");
  }

  if (!isRecord(candidate)) {
    return { ready: false, blockedBy };
  }

  if (!hasText(candidate.rowId)) blockedBy.push("missing_row_identity");

  if (!isRequirementIdentity(candidate.requirement)) {
    blockedBy.push("missing_requirement_identity");
  }

  if (candidate.methodology === undefined) {
    blockedBy.push("missing_methodology_identity");
  } else if (candidate.methodology !== null && !isMethodologyIdentity(candidate.methodology)) {
    blockedBy.push(
      isRecord(candidate.methodology) && !hasText(candidate.methodology.methodologyId)
        ? "missing_methodology_identity"
        : "missing_methodology_version",
    );
  }

  if (!hasText(candidate.upstreamStatus)) blockedBy.push("missing_upstream_status");
  if (!isApplicabilityState(candidate.applicabilityState)) blockedBy.push("missing_applicability_state");

  if (!hasOwn(candidate, "acceptedEvidence") || !areAcceptedEvidenceItems(candidate.acceptedEvidence)) {
    blockedBy.push("missing_accepted_evidence_field");
  }

  if (!hasOwn(candidate, "rejectedEvidence") || !areRejectedEvidenceItems(candidate.rejectedEvidence)) {
    blockedBy.push("missing_rejected_evidence_field");
  }

  if (!hasText(candidate.assessmentReason)) blockedBy.push("missing_assessment_reason");

  if (!hasOwn(candidate, "clientAction") || !hasNullableText(candidate.clientAction)) {
    blockedBy.push("missing_client_action_field");
  }

  if (!isSearchCoverage(candidate.searchCoverage)) blockedBy.push("missing_search_coverage_field");
  if (!isSourceDocumentIdentity(candidate.sourceDocument)) {
    blockedBy.push("missing_source_document_identity");
  }
  if (
    !Array.isArray(candidate.evidenceProvenance) ||
    !candidate.evidenceProvenance.every((item) => isEvidenceProvenance(item))
  ) {
    blockedBy.push("missing_provenance");
  }

  if (!hasText(candidate.finalizationActorRef)) blockedBy.push("missing_finalization_actor_ref");
  if (!hasText(candidate.finalizedAt)) blockedBy.push("missing_finalized_at");
  if (!hasText(candidate.finalizationBasis)) blockedBy.push("missing_finalization_basis");
  if (!hasText(candidate.reviewHistoryRef)) blockedBy.push("missing_review_history_ref");
  if (!hasText(candidate.evidenceMapContractVersion)) {
    blockedBy.push("missing_evidence_map_contract_version");
  }
  if (!hasText(candidate.reviewPolicyVersion)) blockedBy.push("missing_review_policy_version");

  if (blockedBy.length > 0) return { ready: false, blockedBy };
  return { ready: true, row: candidate as EvidenceMapRow };
}
