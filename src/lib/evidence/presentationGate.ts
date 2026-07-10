import {
  isReportPresentationObject,
  PRESENTATION_CONTRACT_VERSION,
  type ReportPresentationObject,
} from "@/lib/evidence/reportPresentationObject";
import type { EvidenceMapMethodologyIdentity } from "@/lib/evidence/evidenceMapDependencyContract";

export type PresentationGateBlockCategory =
  | "invalid_presentation_object"
  | "finalization_identity_missing"
  | "review_history_missing"
  | "applicability_inconsistent"
  | "conformance_applicability_inconsistent"
  | "evidence_insufficient_for_conformance"
  | "search_coverage_incomplete"
  | "provenance_incomplete"
  | "methodology_version_unresolved"
  | "methodology_version_mismatch"
  | "unsupported_contract_version"
  | "review_state_not_current"
  | "duplicate_row_identity"
  | "conflicting_requirement_conclusion"
  | "inconsistent_methodology_identity";

export type PresentationGateBlock = Readonly<{
  category: PresentationGateBlockCategory;
  evidenceMapRowId: string | null;
  detail?: string;
}>;

export type PresentationGateResult =
  | Readonly<{
      releaseReady: true;
      releaseState: "PRE_VALIDATION_RELEASE_READY";
      presentations: readonly ReportPresentationObject[];
    }>
  | Readonly<{
      releaseReady: false;
      releaseState: "BLOCKED";
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

function block(category: PresentationGateBlockCategory, evidenceMapRowId: string | null, detail?: string): PresentationGateBlock {
  return Object.freeze(detail === undefined ? { category, evidenceMapRowId } : { category, evidenceMapRowId, detail });
}

function immutableResult(result: PresentationGateResult): PresentationGateResult {
  if (result.releaseReady) return Object.freeze({ ...result, presentations: Object.freeze([...result.presentations]) });
  return Object.freeze({ ...result, presentations: Object.freeze([...result.presentations]), blockedBy: Object.freeze([...result.blockedBy]) });
}

function methodologyKey(methodology: EvidenceMapMethodologyIdentity | null): string {
  return methodology === null ? "none" : `${methodology.methodologyId}@${methodology.rulebookVersion}`;
}

function evaluatePresentation(presentation: unknown): readonly PresentationGateBlock[] {
  if (!isReportPresentationObject(presentation)) return [block("invalid_presentation_object", null)];
  const rowId = presentation.evidenceMapRowId;
  const blockers: PresentationGateBlock[] = [];
  if (!rowId || !presentation.finalizationActorRef || !presentation.finalizedAt || !presentation.finalizationBasis) {
    blockers.push(block("finalization_identity_missing", rowId));
  }
  if (!presentation.reviewHistoryRef.trim()) blockers.push(block("review_history_missing", rowId));

  const applicability = presentation.applicabilityResult;
  const conclusion = presentation.conformanceConclusion;
  if ((applicability.applicability === "APPLICABLE" && conclusion.conclusion === "NOT_APPLICABLE") ||
      (applicability.applicability === "NOT_APPLICABLE" && conclusion.conclusion !== "NOT_APPLICABLE")) {
    blockers.push(block("conformance_applicability_inconsistent", rowId));
  }
  if (applicability.evidenceMapRowId !== rowId ||
      (applicability.applicability === "APPLICABLE" && presentation.upstreamStatus === "UNKNOWN")) {
    blockers.push(block("applicability_inconsistent", rowId));
  }
  if (presentation.reviewState !== undefined && nonCurrentReviewState.test(presentation.reviewState)) {
    blockers.push(block("review_state_not_current", rowId, presentation.reviewState));
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
    if (presentation.methodology.methodologyId.trim() === "" || presentation.methodology.rulebookVersion.trim() === "") {
      blockers.push(block("methodology_version_mismatch", rowId));
    }
  }
  if (!supportedContractVersions.evidenceMap.has(presentation.evidenceMapContractVersion) ||
      !supportedContractVersions.reviewPolicy.has(presentation.reviewPolicyVersion) ||
      presentation.presentationContractVersion !== PRESENTATION_CONTRACT_VERSION) {
    blockers.push(block("unsupported_contract_version", rowId));
  }
  return blockers;
}

/** Evaluate one immutable Phase 6 object without deriving any upstream judgment. */
export function evaluatePresentationGate(presentation: unknown): PresentationGateResult {
  const blockers = evaluatePresentation(presentation);
  const presentations = isReportPresentationObject(presentation) ? [presentation] : [];
  return immutableResult(blockers.length === 0
    ? { releaseReady: true, releaseState: "PRE_VALIDATION_RELEASE_READY", presentations }
    : { releaseReady: false, releaseState: "BLOCKED", presentations, blockedBy: blockers });
}

/** Evaluate a report-level package for duplicate identities and generic cross-row contradictions. */
export function evaluatePresentationReportGate(presentationsInput: unknown): PresentationGateResult {
  const input = Array.isArray(presentationsInput) ? presentationsInput : [];
  const presentations = input.filter(isReportPresentationObject);
  const blockers: PresentationGateBlock[] = [];
  if (!Array.isArray(presentationsInput) || presentations.length !== input.length) {
    blockers.push(block("invalid_presentation_object", null));
  }
  presentations.forEach((presentation) => blockers.push(...evaluatePresentation(presentation)));
  const rowIds = new Set<string>();
  const requirementConclusions = new Map<string, string>();
  const methodologyIdentities = new Set<string>();
  presentations.forEach((presentation) => {
    if (rowIds.has(presentation.evidenceMapRowId)) blockers.push(block("duplicate_row_identity", presentation.evidenceMapRowId));
    rowIds.add(presentation.evidenceMapRowId);
    const requirementKey = presentation.requirement.requirementId;
    const priorConclusion = requirementConclusions.get(requirementKey);
    if (priorConclusion !== undefined && priorConclusion !== presentation.conformanceConclusion.conclusion) {
      blockers.push(block("conflicting_requirement_conclusion", presentation.evidenceMapRowId, requirementKey));
    }
    requirementConclusions.set(requirementKey, presentation.conformanceConclusion.conclusion);
    methodologyIdentities.add(methodologyKey(presentation.methodology));
  });
  if (methodologyIdentities.size > 1) blockers.push(block("inconsistent_methodology_identity", null));
  return immutableResult(blockers.length === 0
    ? { releaseReady: true, releaseState: "PRE_VALIDATION_RELEASE_READY", presentations }
    : { releaseReady: false, releaseState: "BLOCKED", presentations, blockedBy: blockers });
}

export const evaluatePresentationGates = evaluatePresentationReportGate;
