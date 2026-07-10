import {
  isReportPresentationObject,
  PRESENTATION_CONTRACT_VERSION,
  type ReportPresentationObject,
} from "@/lib/evidence/reportPresentationObject";

export type PresentationReviewState = "CURRENT" | "PENDING_REVIEW" | "REOPENED" | "SUPERSEDED" | "STALE";
export type PresentationGateInput = Readonly<{ presentation: ReportPresentationObject; reviewState?: PresentationReviewState }>;
export type CrossRowOutcome = "PASS" | "WARNING" | "BLOCKED" | "NOT_EVALUATED";
export type PresentationReleaseState = "PRE_VALIDATION_RELEASE_READY" | "INTERNAL_REVIEW_ONLY" | "BLOCKED";

export type PresentationGateBlockCategory =
  | "invalid_report_input" | "empty_report" | "invalid_presentation_object"
  | "finalization_identity_missing" | "finalized_at_invalid" | "review_history_missing"
  | "applicability_inconsistent" | "conclusion_invariant_violation"
  | "unsupported_upstream_status" | "unsupported_contract_version"
  | "accepted_evidence_missing_provenance" | "evidence_provenance_not_linked"
  | "evidence_document_not_searched" | "duplicate_row_identity"
  | "conflicting_methodology_version" | "conflicting_requirement_conclusion"
  | "review_state_not_current";
export type PresentationGateBlock = Readonly<{ category: PresentationGateBlockCategory; evidenceMapRowId: string | null; detail?: string }>;
export type PresentationGateResult =
  | Readonly<{ releaseReady: true; releaseState: "PRE_VALIDATION_RELEASE_READY"; crossRowOutcome: CrossRowOutcome; presentations: readonly ReportPresentationObject[] }>
  | Readonly<{ releaseReady: false; releaseState: "INTERNAL_REVIEW_ONLY"; crossRowOutcome: "WARNING"; presentations: readonly ReportPresentationObject[]; warnings: readonly PresentationGateBlock[] }>
  | Readonly<{ releaseReady: false; releaseState: "BLOCKED"; crossRowOutcome: CrossRowOutcome; presentations: readonly ReportPresentationObject[]; blockedBy: readonly PresentationGateBlock[] }>;

const allowedGateInputKeys = ["presentation", "reviewState"] as const;
const allowedReviewStates: readonly PresentationReviewState[] = ["CURRENT", "PENDING_REVIEW", "REOPENED", "SUPERSEDED", "STALE"];
const supportedStatuses = new Set(["FOUND", "answered", "UNCLEAR", "MISSING", "unclear", "no_evidence"]);
const supportedContractVersions = { evidenceMap: new Set(["v1", "evidence-map-contract-1"]), reviewPolicy: new Set(["v1", "policy-v1", "review-policy-1"]) };

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function hasText(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function block(category: PresentationGateBlockCategory, evidenceMapRowId: string | null, detail?: string): PresentationGateBlock { return Object.freeze(detail === undefined ? { category, evidenceMapRowId } : { category, evidenceMapRowId, detail }); }
function cloneAndFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const clone = Array.isArray(value) ? value.map(cloneAndFreeze) : Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, cloneAndFreeze(entry)]));
  return Object.freeze(clone) as T;
}
function canonicalProvenance(value: { docId: string; spanId: string; page: number | null; sectionPath: readonly string[] }): string {
  return JSON.stringify([value.docId, value.spanId, value.page, value.sectionPath]);
}
function isIsoTimestamp(value: unknown): value is string {
  return hasText(value) && /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value));
}
function isGateInput(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && Object.keys(value).every((key) => allowedGateInputKeys.includes(key as typeof allowedGateInputKeys[number])) &&
    Object.prototype.hasOwnProperty.call(value, "presentation") &&
    (value.reviewState === undefined || allowedReviewStates.includes(value.reviewState as PresentationReviewState));
}
function rowId(value: unknown): string | null {
  return isRecord(value) && hasText(value.evidenceMapRowId) ? value.evidenceMapRowId : null;
}
function presentationShapeBlockers(candidate: unknown): readonly PresentationGateBlock[] {
  const id = rowId(candidate);
  if (!isRecord(candidate)) return [block("invalid_presentation_object", null)];
  const blockers: PresentationGateBlock[] = [];
  if (!hasText(candidate.finalizationActorRef) || !hasText(candidate.finalizationBasis)) blockers.push(block("finalization_identity_missing", id));
  if (!isIsoTimestamp(candidate.finalizedAt)) blockers.push(block("finalized_at_invalid", id));
  if (!hasText(candidate.reviewHistoryRef)) blockers.push(block("review_history_missing", id));
  return blockers;
}
function rowBlockers(presentation: ReportPresentationObject): readonly PresentationGateBlock[] {
  const blockers: PresentationGateBlock[] = [];
  const id = presentation.evidenceMapRowId;
  const conclusion = presentation.conformanceConclusion;
  const draft = presentation.draftFindingResult;
  if (!supportedStatuses.has(presentation.upstreamStatus)) blockers.push(block("unsupported_upstream_status", id));
  if (conclusion.conclusion === "CONFORMS" && !["FOUND", "answered"].includes(presentation.upstreamStatus)) blockers.push(block("conclusion_invariant_violation", id, "CONFORMS requires FOUND or answered"));
  if ((conclusion.conclusion === "CONFORMS" || conclusion.conclusion === "NOT_APPLICABLE") && draft.draftFindingType !== null) blockers.push(block("conclusion_invariant_violation", id));
  if (draft.draftFindingType !== null && conclusion.conclusion !== "ACTION_REQUIRED") blockers.push(block("conclusion_invariant_violation", id));
  if (draft.draftFindingRecord !== null && draft.draftFindingRecord.conformanceConclusion !== conclusion.conclusion) blockers.push(block("conclusion_invariant_violation", id));
  if (!supportedContractVersions.evidenceMap.has(presentation.evidenceMapContractVersion) || !supportedContractVersions.reviewPolicy.has(presentation.reviewPolicyVersion) || presentation.presentationContractVersion !== PRESENTATION_CONTRACT_VERSION) blockers.push(block("unsupported_contract_version", id));
  const provenance = new Set(presentation.evidenceProvenance.map(canonicalProvenance));
  const evidence = [...presentation.acceptedEvidence, ...presentation.rejectedEvidence];
  evidence.forEach((item) => {
    const key = canonicalProvenance(item.provenance);
    if (!provenance.has(key)) blockers.push(block("evidence_provenance_not_linked", id));
    if (presentation.applicabilityResult.applicability === "APPLICABLE" && !presentation.searchCoverage.searchedDocumentIds.includes(item.provenance.docId)) blockers.push(block("evidence_document_not_searched", id, item.provenance.docId));
  });
  if (conclusion.conclusion === "CONFORMS" && presentation.acceptedEvidence.length === 0) blockers.push(block("accepted_evidence_missing_provenance", id));
  return blockers;
}
function finish(presentations: readonly ReportPresentationObject[], blockers: readonly PresentationGateBlock[], warnings: readonly PresentationGateBlock[], crossRowOutcome: CrossRowOutcome): PresentationGateResult {
  const frozen = Object.freeze(presentations.map(cloneAndFreeze));
  if (blockers.length > 0) return Object.freeze({ releaseReady: false, releaseState: "BLOCKED", crossRowOutcome, presentations: frozen, blockedBy: Object.freeze([...blockers]) });
  if (warnings.length > 0) return Object.freeze({ releaseReady: false, releaseState: "INTERNAL_REVIEW_ONLY", crossRowOutcome: "WARNING", presentations: frozen, warnings: Object.freeze([...warnings]) });
  return Object.freeze({ releaseReady: true, releaseState: "PRE_VALIDATION_RELEASE_READY", crossRowOutcome, presentations: frozen });
}
function evaluateInputs(input: unknown): { presentations: readonly ReportPresentationObject[]; blockers: readonly PresentationGateBlock[]; warnings: readonly PresentationGateBlock[]; validInputs: readonly PresentationGateInput[] } {
  const raw = Array.isArray(input) ? input : [];
  const blockers: PresentationGateBlock[] = [];
  const warnings: PresentationGateBlock[] = [];
  const validInputs: PresentationGateInput[] = [];
  raw.forEach((entry) => {
    if (!isGateInput(entry)) { blockers.push(block("invalid_report_input", null)); return; }
    const presentation = entry.presentation;
    const metadata = presentationShapeBlockers(presentation);
    if (metadata.length > 0) { blockers.push(...metadata); return; }
    if (!isReportPresentationObject(presentation)) { blockers.push(block("invalid_presentation_object", rowId(presentation))); return; }
    if (entry.reviewState === "REOPENED" || entry.reviewState === "SUPERSEDED" || entry.reviewState === "STALE") blockers.push(block("review_state_not_current", presentation.evidenceMapRowId, entry.reviewState));
    if (entry.reviewState === "PENDING_REVIEW") warnings.push(block("review_state_not_current", presentation.evidenceMapRowId, entry.reviewState));
    blockers.push(...rowBlockers(presentation));
    validInputs.push(entry as PresentationGateInput);
  });
  return { presentations: validInputs.map((entry) => entry.presentation), blockers, warnings, validInputs };
}
export function evaluatePresentationGate(input: unknown): PresentationGateResult {
  if (!isGateInput(input)) return finish([], [block("invalid_report_input", null)], [], "NOT_EVALUATED");
  return evaluatePresentationReportGate([input]);
}
export function evaluatePresentationReportGate(input: unknown): PresentationGateResult {
  if (!Array.isArray(input)) return finish([], [block("invalid_report_input", null)], [], "NOT_EVALUATED");
  if (input.length === 0) return finish([], [block("empty_report", null)], [], "NOT_EVALUATED");
  const evaluated = evaluateInputs(input);
  const blockers = [...evaluated.blockers];
  const methodologies = new Map<string, string>();
  const requirements = new Map<string, string>();
  const rowIds = new Set<string>();
  let comparisons = 0;
  evaluated.validInputs.forEach(({ presentation }) => {
    const id = presentation.evidenceMapRowId;
    if (rowIds.has(id)) blockers.push(block("duplicate_row_identity", id));
    rowIds.add(id);
    const method = presentation.methodology === null ? "null-methodology" : presentation.methodology.methodologyId;
    const version = presentation.methodology === null ? "null" : presentation.methodology.rulebookVersion;
    const priorVersion = methodologies.get(method);
    if (priorVersion !== undefined) { comparisons += 1; if (priorVersion !== version) blockers.push(block("conflicting_methodology_version", id, method)); }
    methodologies.set(method, version);
    const key = method + "@" + version + ":" + presentation.requirement.requirementId;
    const priorConclusion = requirements.get(key);
    if (priorConclusion !== undefined) { comparisons += 1; if (priorConclusion !== presentation.conformanceConclusion.conclusion) blockers.push(block("conflicting_requirement_conclusion", id, key)); }
    requirements.set(key, presentation.conformanceConclusion.conclusion);
  });
  const crossRowOutcome: CrossRowOutcome = blockers.some((entry) => ["duplicate_row_identity", "conflicting_methodology_version", "conflicting_requirement_conclusion"].includes(entry.category)) ? "BLOCKED" : comparisons > 0 ? "PASS" : "NOT_EVALUATED";
  return finish(evaluated.presentations, blockers, evaluated.warnings, crossRowOutcome);
}
export const evaluatePresentationGates = evaluatePresentationReportGate;
