import {
  isReportPresentationObject,
  PRESENTATION_CONTRACT_VERSION,
  type ReportPresentationObject,
} from "@/lib/evidence/reportPresentationObject";
import type { EvidenceMapMethodologyIdentity } from "@/lib/evidence/evidenceMapDependencyContract";

export type PresentationGateBlockCategory =
  | "empty_report"
  | "invalid_presentation_object"
  | "finalization_identity_missing"
  | "review_history_missing"
  | "applicability_inconsistent"
  | "conflicting_applicability"
  | "conformance_applicability_inconsistent"
  | "evidence_insufficient_for_conformance"
  | "search_coverage_incomplete"
  | "provenance_incomplete"
  | "methodology_version_unresolved"
  | "methodology_version_mismatch"
  | "unsupported_contract_version"
  | "review_state_not_current"
  | "review_pending"
  | "duplicate_row_identity"
  | "conflicting_requirement_conclusion"
  | "inconsistent_methodology_identity"
  | "cross_row_evidence_conflict"
  | "contradictory_shared_fact"
  | "contradictory_assumption";

export type PresentationGateBlock = Readonly<{
  category: PresentationGateBlockCategory;
  evidenceMapRowId: string | null;
  detail?: string;
}>;

export type CrossRowOutcome = "PASS" | "WARNING" | "BLOCKED" | "NOT_EVALUATED";
export type PresentationReleaseState =
  | "PRE_VALIDATION_RELEASE_READY"
  | "INTERNAL_REVIEW_ONLY"
  | "BLOCKED";

export type PresentationGateResult =
  | Readonly<{
      releaseReady: true;
      releaseState: "PRE_VALIDATION_RELEASE_READY";
      crossRowOutcome: CrossRowOutcome;
      presentations: readonly ReportPresentationObject[];
    }>
  | Readonly<{
      releaseReady: false;
      releaseState: "INTERNAL_REVIEW_ONLY";
      crossRowOutcome: "WARNING";
      presentations: readonly ReportPresentationObject[];
      warnings: readonly PresentationGateBlock[];
    }>
  | Readonly<{
      releaseReady: false;
      releaseState: "BLOCKED";
      crossRowOutcome: "BLOCKED" | "NOT_EVALUATED";
      presentations: readonly ReportPresentationObject[];
      blockedBy: readonly PresentationGateBlock[];
    }>;

const supportedContractVersions = {
  evidenceMap: new Set(["v1", "evidence-map-contract-1"]),
  reviewPolicy: new Set(["v1", "policy-v1", "review-policy-1"]),
};
const unresolvedVersion = /^(?:unknown|unresolved|unsupported|n\/a)$/i;
const mismatchedVersion = /^mismatch(?:ed)?$/i;
const nonCurrentReviewState = /^(?:reopened|superseded|stale)$/i;
const unreliableReason = /\b(?:unreliable|not reliable|cannot be relied upon)\b/i;

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function block(category: PresentationGateBlockCategory, evidenceMapRowId: string | null, detail?: string): PresentationGateBlock {
  return Object.freeze(detail === undefined ? { category, evidenceMapRowId } : { category, evidenceMapRowId, detail });
}

function cloneAndFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const clone = Array.isArray(value)
    ? value.map((entry) => cloneAndFreeze(entry))
    : Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, cloneAndFreeze(entry)]));
  return Object.freeze(clone) as T;
}

function immutableResult(result: PresentationGateResult): PresentationGateResult {
  const presentations = Object.freeze(result.presentations.map((presentation) => cloneAndFreeze(presentation)));
  if (result.releaseState === "PRE_VALIDATION_RELEASE_READY") return Object.freeze({ ...result, presentations });
  if (result.releaseState === "INTERNAL_REVIEW_ONLY") {
    return Object.freeze({ ...result, presentations, warnings: Object.freeze([...result.warnings]) });
  }
  return Object.freeze({ ...result, presentations, blockedBy: Object.freeze([...result.blockedBy]) });
}

function methodologyKey(methodology: EvidenceMapMethodologyIdentity | null): string {
  return methodology === null ? "none" : methodology.methodologyId + "@" + methodology.rulebookVersion;
}

function evaluatePresentation(presentation: unknown): {
  blockers: readonly PresentationGateBlock[];
  warnings: readonly PresentationGateBlock[];
} {
  if (!isReportPresentationObject(presentation)) {
    return { blockers: [block("invalid_presentation_object", null)], warnings: [] };
  }
  const rowId = hasText(presentation.evidenceMapRowId) ? presentation.evidenceMapRowId : null;
  const blockers: PresentationGateBlock[] = [];
  const warnings: PresentationGateBlock[] = [];
  if (!hasText(presentation.evidenceMapRowId)) blockers.push(block("invalid_presentation_object", null));
  if (!hasText(presentation.finalizationActorRef) || !hasText(presentation.finalizedAt) || !hasText(presentation.finalizationBasis)) {
    blockers.push(block("finalization_identity_missing", rowId));
  }
  if (!hasText(presentation.reviewHistoryRef)) blockers.push(block("review_history_missing", rowId));

  const applicability = presentation.applicabilityResult;
  const conclusion = presentation.conformanceConclusion;
  if (applicability.evidenceMapRowId !== presentation.evidenceMapRowId) {
    blockers.push(block("applicability_inconsistent", rowId));
  }
  if ((applicability.applicability === "APPLICABLE" && conclusion.conclusion === "NOT_APPLICABLE") ||
      (applicability.applicability === "NOT_APPLICABLE" && conclusion.conclusion !== "NOT_APPLICABLE")) {
    blockers.push(block("conformance_applicability_inconsistent", rowId));
  }
  if (conclusion.evidenceMapRowId !== presentation.evidenceMapRowId) {
    blockers.push(block("conformance_applicability_inconsistent", rowId));
  }
  const draftRecord = presentation.draftFindingResult.draftFindingRecord;
  if (draftRecord !== null &&
      (draftRecord.evidenceMapRowId !== presentation.evidenceMapRowId ||
        draftRecord.requirementId !== presentation.requirement.requirementId ||
        draftRecord.findingId !== "draft:" + presentation.evidenceMapRowId)) {
    blockers.push(block("applicability_inconsistent", rowId, "draft-finding identity mismatch"));
  }
  if (presentation.reviewState !== undefined) {
    if (nonCurrentReviewState.test(presentation.reviewState)) {
      blockers.push(block("review_state_not_current", rowId, presentation.reviewState));
    } else if (presentation.reviewState === "pending_review") {
      warnings.push(block("review_pending", rowId));
    }
  }
  if (conclusion.conclusion === "CONFORMS" && presentation.acceptedEvidence.length === 0) {
    blockers.push(block("evidence_insufficient_for_conformance", rowId));
  }
  if (applicability.applicability === "APPLICABLE" &&
      (!presentation.searchCoverage.searched || presentation.searchCoverage.searchedDocumentIds.length === 0 ||
        (presentation.searchCoverage.notes !== null && /^(?:unknown|unresolved|incomplete)$/i.test(presentation.searchCoverage.notes.trim())))) {
    blockers.push(block("search_coverage_incomplete", rowId));
  }
  if (presentation.evidenceProvenance.length === 0 ||
      presentation.acceptedEvidence.some((evidence) => evidence.provenance.spanId.length === 0) ||
      presentation.rejectedEvidence.some((evidence) => evidence.provenance.spanId.length === 0)) {
    blockers.push(block("provenance_incomplete", rowId));
  }
  if (presentation.methodology !== null) {
    if (mismatchedVersion.test(presentation.methodology.rulebookVersion)) {
      blockers.push(block("methodology_version_mismatch", rowId));
    } else if (unresolvedVersion.test(presentation.methodology.rulebookVersion)) {
      blockers.push(block("methodology_version_unresolved", rowId));
    }
  }
  if (!supportedContractVersions.evidenceMap.has(presentation.evidenceMapContractVersion) ||
      !supportedContractVersions.reviewPolicy.has(presentation.reviewPolicyVersion) ||
      presentation.presentationContractVersion !== PRESENTATION_CONTRACT_VERSION) {
    blockers.push(block("unsupported_contract_version", rowId));
  }
  return { blockers, warnings };
}

function resultFor(
  presentations: readonly ReportPresentationObject[],
  blockers: readonly PresentationGateBlock[],
  warnings: readonly PresentationGateBlock[],
  crossRowOutcome: CrossRowOutcome,
): PresentationGateResult {
  if (blockers.length > 0) {
    return immutableResult({
      releaseReady: false,
      releaseState: "BLOCKED",
      crossRowOutcome: blockers.some((entry) => entry.category === "empty_report") ? "NOT_EVALUATED" : crossRowOutcome === "NOT_EVALUATED" ? "NOT_EVALUATED" : "BLOCKED",
      presentations,
      blockedBy: blockers,
    });
  }
  if (warnings.length > 0) {
    return immutableResult({
      releaseReady: false,
      releaseState: "INTERNAL_REVIEW_ONLY",
      crossRowOutcome: "WARNING",
      presentations,
      warnings,
    });
  }
  return immutableResult({
    releaseReady: true,
    releaseState: "PRE_VALIDATION_RELEASE_READY",
    crossRowOutcome,
    presentations,
  });
}

/** Evaluate one Phase 6 object without deriving any upstream judgment. */
export function evaluatePresentationGate(presentation: unknown): PresentationGateResult {
  const evaluation = evaluatePresentation(presentation);
  const presentations = isReportPresentationObject(presentation) ? [presentation] : [];
  return resultFor(presentations, evaluation.blockers, evaluation.warnings, "NOT_EVALUATED");
}

/** Evaluate a report-level package for generic cross-row consistency. */
export function evaluatePresentationReportGate(presentationsInput: unknown): PresentationGateResult {
  if (!Array.isArray(presentationsInput) || presentationsInput.length === 0) {
    return resultFor([], [block("empty_report", null)], [], "NOT_EVALUATED");
  }
  const presentations = presentationsInput.filter(isReportPresentationObject);
  const blockers: PresentationGateBlock[] = [];
  const warnings: PresentationGateBlock[] = [];
  if (presentations.length !== presentationsInput.length) blockers.push(block("invalid_presentation_object", null));
  presentations.forEach((presentation) => {
    const evaluation = evaluatePresentation(presentation);
    blockers.push(...evaluation.blockers);
    warnings.push(...evaluation.warnings);
  });

  const rowIds = new Set<string>();
  const requirementApplicability = new Map<string, string>();
  const requirementConclusions = new Map<string, string>();
  const methodologyIdentities = new Set<string>();
  const acceptedEvidence = new Map<string, string>();
  const rejectedEvidence = new Map<string, string>();
  const sharedFacts = new Map<string, string>();
  const assumptions = new Map<string, string>();
  presentations.forEach((presentation) => {
    const rowId = presentation.evidenceMapRowId;
    if (rowIds.has(rowId)) blockers.push(block("duplicate_row_identity", rowId));
    rowIds.add(rowId);
    const requirementKey = presentation.requirement.requirementId;
    const priorApplicability = requirementApplicability.get(requirementKey);
    if (priorApplicability !== undefined && priorApplicability !== presentation.applicabilityResult.applicability) {
      blockers.push(block("conflicting_applicability", rowId, requirementKey));
    }
    requirementApplicability.set(requirementKey, presentation.applicabilityResult.applicability);
    const priorConclusion = requirementConclusions.get(requirementKey);
    if (priorConclusion !== undefined && priorConclusion !== presentation.conformanceConclusion.conclusion) {
      blockers.push(block("conflicting_requirement_conclusion", rowId, requirementKey));
    }
    requirementConclusions.set(requirementKey, presentation.conformanceConclusion.conclusion);
    methodologyIdentities.add(methodologyKey(presentation.methodology));
    presentation.acceptedEvidence.forEach((evidence) => acceptedEvidence.set(evidence.evidenceId, rowId));
    presentation.rejectedEvidence.forEach((evidence) => rejectedEvidence.set(evidence.evidenceId, evidence.rejectionReason));
    if (presentation.sharedProjectFacts !== undefined) {
      Object.entries(presentation.sharedProjectFacts).forEach(([key, value]) => {
        const normalized = JSON.stringify(value);
        const prior = sharedFacts.get(key);
        if (prior !== undefined && prior !== normalized) blockers.push(block("contradictory_shared_fact", rowId, key));
        sharedFacts.set(key, normalized);
      });
    }
    presentation.assumptions?.forEach((assumption) => {
      const key = assumption.trim().toLowerCase();
      const prior = assumptions.get(key);
      if (prior !== undefined && prior !== assumption) blockers.push(block("contradictory_assumption", rowId, key));
      assumptions.set(key, assumption);
    });
  });
  if (methodologyIdentities.size > 1) blockers.push(block("inconsistent_methodology_identity", null));
  acceptedEvidence.forEach((_rowId, evidenceId) => {
    if (rejectedEvidence.has(evidenceId) && unreliableReason.test(rejectedEvidence.get(evidenceId) ?? "")) {
      blockers.push(block("cross_row_evidence_conflict", null, evidenceId));
    }
  });
  const crossRowOutcome: CrossRowOutcome = blockers.length > 0
    ? "BLOCKED"
    : warnings.length > 0
      ? "WARNING"
      : presentations.some((presentation) => presentation.sharedProjectFacts !== undefined || presentation.assumptions !== undefined)
        ? "PASS"
        : "NOT_EVALUATED";
  return resultFor(presentations, blockers, warnings, crossRowOutcome);
}

export const evaluatePresentationGates = evaluatePresentationReportGate;
