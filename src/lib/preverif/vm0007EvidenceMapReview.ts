import {
  reviewerWorkflowActions,
  transitionReviewerWorkflow,
  validateReviewerWorkflowEvent,
  type ReviewerWorkflowEvent,
  type ReviewerWorkflowState,
} from "@/lib/evidence/readinessReport";
import { PRESENTATION_CONTRACT_VERSION } from "@/lib/evidence/reportPresentationObject";
import type { EvidenceMapRow } from "@/lib/evidence/evidenceMapDependencyContract";
import { finalizeQuickCheckEvidenceMapForReadiness } from "@/lib/evidence/quickCheckReadinessProductionPipeline";
import { clearQuickCheckReadinessPayload } from "@/lib/evidence/quickCheckReadinessPayload";
import { validateProjectEvidenceMapAssessment, type ProjectReadinessPipelineResult } from "@/lib/evidence/projectReadinessProductionPipeline";
import {
  loadVm0007EvidenceMapDraft,
  normalizeVm0007EvidenceMapDraftPackage,
  saveVm0007EvidenceMapDraft,
} from "./vm0007EvidenceMapDraftStore";
import type {
  Vm0007EvidenceMapDraftPackage,
  Vm0007EvidenceMapDraftRow,
} from "./vm0007EvidenceMapDraft";

export const VM0007_REVIEW_POLICY_VERSION = "policy-v1";

export type Vm0007EvidenceMapEdit = Readonly<Partial<Pick<
  Vm0007EvidenceMapDraftRow,
  "assessmentReason" | "clientAction" | "proposedApplicability" | "proposedAcceptedEvidence" | "proposedRejectedEvidence"
  | "assessment"
>>>;

export type Vm0007ReviewResult =
  | Readonly<{ ok: true; package: Vm0007EvidenceMapDraftPackage; row: Vm0007EvidenceMapDraftRow }>
  | Readonly<{ ok: false; reason: string }>;

export type Vm0007FinalizeResult =
  | Readonly<{ ok: true; package: Vm0007EvidenceMapDraftPackage; pipeline: ProjectReadinessPipelineResult & { ready: true } }>
  | Readonly<{ ok: false; package: Vm0007EvidenceMapDraftPackage; blockedBy: readonly string[]; pipeline?: ProjectReadinessPipelineResult }>;

function now(): string { return new Date().toISOString(); }
function reviewerRef(value: string): string { return value.trim(); }
function rowFor(pkg: Vm0007EvidenceMapDraftPackage, rowId: string): Vm0007EvidenceMapDraftRow | null {
  return pkg.rows.find((row) => row.rowId === rowId) ?? null;
}
function currentAssessment(row: Vm0007EvidenceMapDraftRow): boolean {
  if (row.assessment === undefined || row.assessment.evidenceMapRowId !== row.rowId || row.assessment.rowVersion !== (row.rowVersion ?? 1)) return false;
  const canonicalRow = toEvidenceMapRow(row, now(), "reviewer:validation");
  return validateProjectEvidenceMapAssessment(canonicalRow, row.assessment).valid;
}
function eventFor(input: { reviewerIdentity: string; currentState: ReviewerWorkflowState; nextState: ReviewerWorkflowState; note: string; timestamp?: string }): ReviewerWorkflowEvent | null {
  const event: ReviewerWorkflowEvent = {
    reviewerIdentity: reviewerRef(input.reviewerIdentity),
    timestamp: input.timestamp ?? now(),
    reasonOrNote: input.note.trim(),
    previousState: input.currentState,
    newState: input.nextState,
    presentationContractVersion: PRESENTATION_CONTRACT_VERSION,
    reviewPolicyVersion: VM0007_REVIEW_POLICY_VERSION,
  };
  return validateReviewerWorkflowEvent(event).complete ? event : null;
}

function applyTransition(pkgInput: Vm0007EvidenceMapDraftPackage, rowId: string, input: { reviewerIdentity: string; action: "approve" | "edit" | "reopen"; note: string; timestamp?: string; edit?: Vm0007EvidenceMapEdit }): Vm0007ReviewResult {
  const pkg = normalizeVm0007EvidenceMapDraftPackage(pkgInput);
  const current = rowFor(pkg, rowId);
  if (!current) return { ok: false, reason: "row-not-found" };
  if (!reviewerRef(input.reviewerIdentity) || !input.note.trim()) return { ok: false, reason: "reviewer-metadata-required" };
  const nextState = ({ approve: "approved", edit: "edited", reopen: "reopened" } as const)[input.action];
  if (!reviewerWorkflowActions(current.reviewState!).includes(input.action)) return { ok: false, reason: "unsupported-transition" };
  if (input.action === "approve" && !currentAssessment(current)) return { ok: false, reason: "canonical-assessment-required-or-stale" };
  const event = eventFor({ reviewerIdentity: input.reviewerIdentity, currentState: current.reviewState!, nextState, note: input.note, timestamp: input.timestamp });
  if (!event) return { ok: false, reason: "reviewer-metadata-required" };
  const transition = transitionReviewerWorkflow(current.reviewState!, current.reviewHistory, event);
  if (!transition.accepted) return { ok: false, reason: transition.reason };
  const nextRowVersion = input.action === "approve" ? (current.rowVersion ?? 1) : (current.rowVersion ?? 1) + 1;
  const assessmentAffectsValidity = input.action === "edit" && input.edit !== undefined;
  const replacementAssessment = input.edit?.assessment;
  const replacementApplicability: Vm0007EvidenceMapDraftRow["proposedApplicability"] | undefined = replacementAssessment?.applicability.decision === "APPLICABLE"
    ? "APPLICABLE"
    : replacementAssessment?.applicability.decision === "NOT_APPLICABLE"
      ? "NOT_APPLICABLE"
      : replacementAssessment?.applicability.decision === "NOT_EVALUATED"
        ? "UNKNOWN"
        : undefined;
  const changed = input.action === "edit" && input.edit ? {
    ...current,
    ...input.edit,
    ...(replacementApplicability ? { proposedApplicability: replacementApplicability } : {}),
    assessment: replacementAssessment ? { ...replacementAssessment, evidenceMapRowId: rowId, rowVersion: nextRowVersion } : (assessmentAffectsValidity ? undefined : current.assessment),
  } : current;
  const updatedRow: Vm0007EvidenceMapDraftRow = {
    ...changed,
    reviewState: transition.state,
    reviewHistory: transition.history,
    rowVersion: nextRowVersion,
    finalizationState: "draft",
    finalizationActorRef: null,
    finalizedAt: null,
    finalizationBasis: null,
    reviewHistoryRef: `${pkg.auditId}:${rowId}:history:${transition.history.length}`,
  };
  if (input.action === "reopen" && current.assessment) {
    updatedRow.assessment = { ...current.assessment, reviewState: "REOPENED", rowVersion: nextRowVersion };
  }
  const updated: Vm0007EvidenceMapDraftPackage = {
    ...pkg,
    finalizationState: "draft",
    finalizedBy: null,
    finalizedAt: null,
    finalizationBasis: null,
    rows: pkg.rows.map((row) => row.rowId === rowId ? updatedRow : row),
  };
  if (!saveVm0007EvidenceMapDraft(updated)) return { ok: false, reason: "draft-persistence-failed" };
  clearQuickCheckReadinessPayload(pkg.auditId);
  return { ok: true, package: updated, row: updatedRow };
}

export function approveVm0007EvidenceMapRow(pkg: Vm0007EvidenceMapDraftPackage, rowId: string, reviewerIdentity: string, note = "Reviewed and approved.", timestamp?: string): Vm0007ReviewResult {
  return applyTransition(pkg, rowId, { reviewerIdentity, action: "approve", note, timestamp });
}

export function editVm0007EvidenceMapRow(pkg: Vm0007EvidenceMapDraftPackage, rowId: string, edit: Vm0007EvidenceMapEdit, reviewerIdentity: string, note = "Evidence Map row edited.", timestamp?: string): Vm0007ReviewResult {
  const current = rowFor(normalizeVm0007EvidenceMapDraftPackage(pkg), rowId);
  if (current?.reviewState === "edited" && edit.assessment) {
    const reopened = applyTransition(pkg, rowId, { reviewerIdentity, action: "reopen", note: "Reopened to replace the invalidated assessment.", timestamp });
    if (!reopened.ok) return reopened;
    return applyTransition(reopened.package, rowId, { reviewerIdentity, action: "edit", edit, note, timestamp });
  }
  return applyTransition(pkg, rowId, { reviewerIdentity, action: "edit", edit, note, timestamp });
}

export function reopenVm0007EvidenceMapRow(pkg: Vm0007EvidenceMapDraftPackage, rowId: string, reviewerIdentity: string, note = "Reopened for further review.", timestamp?: string): Vm0007ReviewResult {
  return applyTransition(pkg, rowId, { reviewerIdentity, action: "reopen", note, timestamp });
}

function toEvidenceMapRow(row: Vm0007EvidenceMapDraftRow, finalizedAt: string, reviewerIdentity: string): EvidenceMapRow {
  const acceptedEvidence = row.proposedAcceptedEvidence ? [{ evidenceId: `${row.rowId}:accepted`, quote: row.proposedAcceptedEvidence.quote, provenance: row.proposedAcceptedEvidence.provenance }] : [];
  const rejectedEvidence = row.proposedRejectedEvidence ? [{ evidenceId: `${row.rowId}:rejected`, quote: row.proposedRejectedEvidence.quote, rejectionReason: row.proposedRejectedEvidence.reason, provenance: row.proposedRejectedEvidence.provenance }] : [];
  const evidenceProvenance = [...acceptedEvidence, ...rejectedEvidence].map((item) => item.provenance);
  return {
    rowId: row.rowId,
    requirement: { requirementId: row.stableRuleId, requirementReference: row.ruleReference, requirementText: row.requirementText },
    methodology: { methodologyId: row.methodologyId, rulebookVersion: row.methodologyVersion },
    upstreamStatus: row.upstreamStatus,
    applicabilityState: row.proposedApplicability,
    acceptedEvidence,
    rejectedEvidence,
    assessmentReason: row.assessmentReason,
    clientAction: row.clientAction || null,
    searchCoverage: row.searchCoverage,
    sourceDocument: row.sourceDocument,
    evidenceProvenance,
    finalizationState: "finalized",
    finalizationActorRef: reviewerIdentity,
    finalizedAt,
    finalizationBasis: "Reviewer-approved Evidence Map row.",
    reviewHistoryRef: row.reviewHistoryRef || `${row.auditId}:${row.rowId}:history`,
    evidenceMapContractVersion: "v1",
    reviewPolicyVersion: VM0007_REVIEW_POLICY_VERSION,
  };
}

export function finalizeVm0007EvidenceMap(pkgInput: Vm0007EvidenceMapDraftPackage, reviewerIdentity: string, timestamp = now()): Vm0007FinalizeResult {
  const pkg = normalizeVm0007EvidenceMapDraftPackage(pkgInput);
  const blockedBy: string[] = [];
  if (!reviewerRef(reviewerIdentity)) blockedBy.push("missing reviewer metadata");
  if (pkg.blockedBy.length) blockedBy.push(...pkg.blockedBy);
  if (pkg.rows.some((row) => row.reviewState !== "approved")) blockedBy.push("one or more rows are not approved");
  if (pkg.rows.some((row) => !row.reviewHistory?.length || !row.reviewHistory.every((event) => validateReviewerWorkflowEvent(event).complete))) blockedBy.push("required review history is missing or invalid");
  if (pkg.rows.some((row) => !currentAssessment(row))) blockedBy.push("canonical assessment is missing, invalid, stale, or unresolved");
  if (blockedBy.length) return { ok: false, package: pkg, blockedBy: Array.from(new Set(blockedBy)) };
  const finalizedRows = pkg.rows.map((row) => ({ ...row, finalizationState: "finalized" as const, finalizationActorRef: reviewerRef(reviewerIdentity), finalizedAt: timestamp, finalizationBasis: "Reviewer-approved Evidence Map finalization.", reviewHistoryRef: row.reviewHistoryRef || `${pkg.auditId}:${row.rowId}:history` }));
  const rows = finalizedRows.map((row) => toEvidenceMapRow(row, timestamp, reviewerRef(reviewerIdentity)));
  const assessments = finalizedRows.map((row) => row.assessment);
  const pipeline = finalizeQuickCheckEvidenceMapForReadiness({ auditId: pkg.auditId, auditGeneratedAt: pkg.generatedAt, rows, assessments: assessments as NonNullable<typeof assessments[number]>[] });
  if (!pipeline.ready) return { ok: false, package: pkg, blockedBy: pipeline.blockedBy.map((entry) => entry.detail ? `${entry.category}: ${entry.detail}` : entry.category), pipeline };
  if (!pipeline.gateResult.releaseReady) {
    clearQuickCheckReadinessPayload(pkg.auditId);
    const reasons = pipeline.gateResult.releaseState === "BLOCKED" ? pipeline.gateResult.blockedBy : pipeline.gateResult.warnings;
    return {
      ok: false,
      package: pkg,
      blockedBy: reasons.map((reason) => reason.detail ? `${reason.category}: ${reason.detail}` : reason.category),
      pipeline,
    };
  }
  const finalized: Vm0007EvidenceMapDraftPackage = { ...pkg, rows: finalizedRows, finalizationState: "finalized", finalizedBy: reviewerRef(reviewerIdentity), finalizedAt: timestamp, finalizationBasis: "Reviewer-approved Evidence Map finalization." };
  if (!saveVm0007EvidenceMapDraft(finalized)) return { ok: false, package: pkg, blockedBy: ["draft-persistence-failed"], pipeline };
  return { ok: true, package: finalized, pipeline };
}

export function loadAndFinalizeVm0007EvidenceMap(auditId: string, reviewerIdentity: string, timestamp?: string): Vm0007FinalizeResult | null {
  const pkg = loadVm0007EvidenceMapDraft(auditId);
  return pkg ? finalizeVm0007EvidenceMap(pkg, reviewerIdentity, timestamp) : null;
}
