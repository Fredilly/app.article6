import {
  reviewerWorkflowActions,
  transitionReviewerWorkflow,
  validateReviewerWorkflowEvent,
  type ReviewerWorkflowEvent,
  type ReviewerWorkflowState,
} from "@/lib/evidence/readinessReport";
import { PRESENTATION_CONTRACT_VERSION } from "@/lib/evidence/reportPresentationObject";
import type { EvidenceMapEvidenceProvenance, EvidenceMapRow } from "@/lib/evidence/evidenceMapDependencyContract";
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
  Vm0007EvidenceMapDraftEvidenceRecord,
  Vm0007EvidenceMapDraftRow,
} from "./vm0007EvidenceMapDraft";

export const VM0007_REVIEW_POLICY_VERSION = "policy-v1";

export type Vm0007EvidenceMapEdit = Readonly<Partial<Pick<
  Vm0007EvidenceMapDraftRow,
  "assessmentReason" | "gap" | "clientAction" | "proposedApplicability" | "proposedAcceptedEvidence" | "proposedRejectedEvidence"
  | "acceptedEvidence" | "rejectedEvidence" | "assessment"
>>>;

export type Vm0007ReviewResult =
  | Readonly<{ ok: true; package: Vm0007EvidenceMapDraftPackage; row: Vm0007EvidenceMapDraftRow }>
  | Readonly<{ ok: false; reason: string }>;

export type Vm0007FinalizeResult =
  | Readonly<{ ok: true; package: Vm0007EvidenceMapDraftPackage; pipeline: ProjectReadinessPipelineResult & { ready: true } }>
  | Readonly<{ ok: false; package: Vm0007EvidenceMapDraftPackage; blockedBy: readonly string[]; pipeline?: ProjectReadinessPipelineResult }>;

function now(): string { return new Date().toISOString(); }
function reviewerRef(value: string): string { return value.trim(); }

/** Stable identity for one evidence record; mutable array position is never used. */
export function vm0007EvidenceIdentity(record: Pick<Vm0007EvidenceMapDraftEvidenceRecord, "quote"> & { provenance: Omit<Pick<EvidenceMapEvidenceProvenance, "docId" | "page" | "sectionPath" | "spanId">, "sectionPath"> & { sectionPath: readonly string[] } }): string {
  return JSON.stringify([
    record.provenance.docId,
    record.provenance.page,
    record.provenance.sectionPath,
    record.provenance.spanId,
    record.quote,
  ]);
}

/**
 * Compact deterministic non-cryptographic hash for public finalized IDs.
 * Two independent 32-bit lanes keep this synchronous in browser and server
 * callers while avoiding quote/provenance disclosure in the ID itself.
 */
export function compactEvidenceIdentityHash(identity: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < identity.length; index += 1) {
    const code = identity.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ (code + index), 0x85ebca6b) >>> 0;
  }
  return `${first.toString(16).padStart(8, "0")}${second.toString(16).padStart(8, "0")}`;
}

export function vm0007FinalizedEvidenceId(rowId: string, classification: "accepted" | "rejected", evidenceIdentity: string): string {
  return `${rowId}:${classification}:${compactEvidenceIdentityHash(evidenceIdentity)}`;
}

function evidenceRecords(row: Vm0007EvidenceMapDraftRow, rejected: boolean): readonly Vm0007EvidenceMapDraftEvidenceRecord[] {
  if (rejected) {
    return row.rejectedEvidence ?? (row.proposedRejectedEvidence ? [{
      quote: row.proposedRejectedEvidence.quote,
      page: row.proposedRejectedEvidence.provenance.page,
      section: row.proposedRejectedEvidence.provenance.sectionHeading,
      spanId: row.proposedRejectedEvidence.provenance.spanId,
      rejectionReason: row.proposedRejectedEvidence.reason,
      provenance: row.proposedRejectedEvidence.provenance,
    }] : []);
  }
  return row.acceptedEvidence ?? (row.proposedAcceptedEvidence ? [{
    quote: row.proposedAcceptedEvidence.quote,
    page: row.proposedAcceptedEvidence.provenance.page,
    section: row.proposedAcceptedEvidence.provenance.sectionHeading,
    spanId: row.proposedAcceptedEvidence.provenance.spanId,
    provenance: row.proposedAcceptedEvidence.provenance,
  }] : []);
}

function evidenceMatch(records: readonly Vm0007EvidenceMapDraftEvidenceRecord[], identity: string): { record: Vm0007EvidenceMapDraftEvidenceRecord; index: number } | null {
  const matches = records.flatMap((record, index) => vm0007EvidenceIdentity(record) === identity ? [{ record, index }] : []);
  return matches.length === 1 ? matches[0] : null;
}
function rowFor(pkg: Vm0007EvidenceMapDraftPackage, rowId: string): Vm0007EvidenceMapDraftRow | null {
  return pkg.rows.find((row) => row.rowId === rowId) ?? null;
}
function currentAssessment(row: Vm0007EvidenceMapDraftRow): boolean {
  return vm0007EvidenceMapRowWorkflowState(row).blockerReasons.length === 0;
}

export type Vm0007EvidenceMapRowWorkflowState = Readonly<{
  unresolved: boolean;
  blockerReasons: readonly string[];
}>;

/** The single reviewer-attention/blocker derivation used by guided review UI. */
export function vm0007EvidenceMapRowWorkflowState(row: Vm0007EvidenceMapDraftRow): Vm0007EvidenceMapRowWorkflowState {
  const blockers: string[] = [];
  if (!row.assessment) blockers.push("canonical assessment missing");
  else if (row.assessment.evidenceMapRowId !== row.rowId) blockers.push("canonical assessment invalid");
  else if (row.assessment.rowVersion !== (row.rowVersion ?? 1)) blockers.push("canonical assessment stale");
  else {
    const validation = validateProjectEvidenceMapAssessment(toEvidenceMapRow(row, now(), "reviewer:validation"), row.assessment);
    if (!validation.valid) blockers.push(validation.reason.replaceAll("-", " "));
  }
  return {
    unresolved: row.reviewState !== "approved" || blockers.length > 0,
    blockerReasons: Array.from(new Set(blockers)),
  };
}

export function vm0007EvidenceMapRowBlockers(row: Vm0007EvidenceMapDraftRow): readonly string[] {
  return vm0007EvidenceMapRowWorkflowState(row).blockerReasons;
}

export function vm0007EvidenceMapRowRequiresAttention(row: Vm0007EvidenceMapDraftRow): boolean {
  return vm0007EvidenceMapRowWorkflowState(row).unresolved;
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
  if (!saveVm0007EvidenceMapDraft(updated).ok) return { ok: false, reason: "draft-persistence-failed" };
  clearQuickCheckReadinessPayload(pkg.auditId);
  return { ok: true, package: updated, row: updatedRow };
}

function decideEvidence(input: {
  pkg: Vm0007EvidenceMapDraftPackage;
  rowId: string;
  evidenceIdentity: string;
  reviewerIdentity: string;
  note: string;
  reject: boolean;
  timestamp?: string;
}): Vm0007ReviewResult {
  const pkg = normalizeVm0007EvidenceMapDraftPackage(input.pkg);
  const row = rowFor(pkg, input.rowId);
  if (!row) return { ok: false, reason: "row-not-found" };
  if (!reviewerRef(input.reviewerIdentity) || !input.note.trim()) return { ok: false, reason: "reviewer-metadata-required" };
  if (!input.evidenceIdentity.trim()) return { ok: false, reason: "evidence-identity-required" };

  const from = evidenceRecords(row, !input.reject);
  const target = evidenceMatch(from, input.evidenceIdentity);
  if (!target) return { ok: false, reason: "unknown-or-ambiguous-evidence-identity" };
  const other = evidenceRecords(row, input.reject);
  if (other.some((record) => vm0007EvidenceIdentity(record) === input.evidenceIdentity)) return { ok: false, reason: "duplicate-evidence-identity" };

  const moved = input.reject
    ? { ...target.record, rejectionReason: input.note.trim() }
    : (() => {
      const accepted = { ...target.record };
      delete accepted.rejectionReason;
      return accepted;
    })();
  const edit: Vm0007EvidenceMapEdit = input.reject
    ? { acceptedEvidence: from.filter((_, index) => index !== target.index), rejectedEvidence: [...other, moved] }
    : { acceptedEvidence: [...other, moved], rejectedEvidence: from.filter((_, index) => index !== target.index) };
  return applyTransition(pkg, input.rowId, { reviewerIdentity: input.reviewerIdentity, action: "edit", note: input.note, timestamp: input.timestamp, edit });
}

export function rejectVm0007EvidenceRecord(pkg: Vm0007EvidenceMapDraftPackage, rowId: string, evidenceIdentity: string, reviewerIdentity: string, reason: string, timestamp?: string): Vm0007ReviewResult {
  return decideEvidence({ pkg, rowId, evidenceIdentity, reviewerIdentity, note: reason, reject: true, timestamp });
}

export function acceptVm0007EvidenceRecord(pkg: Vm0007EvidenceMapDraftPackage, rowId: string, evidenceIdentity: string, reviewerIdentity: string, note: string, timestamp?: string): Vm0007ReviewResult {
  return decideEvidence({ pkg, rowId, evidenceIdentity, reviewerIdentity, note, reject: false, timestamp });
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
  const acceptedRecords = evidenceRecords(row, false);
  const rejectedRecords = evidenceRecords(row, true);
  const acceptedEvidence = acceptedRecords.map((record) => ({ evidenceId: vm0007FinalizedEvidenceId(row.rowId, "accepted", vm0007EvidenceIdentity(record)), quote: record.quote, provenance: record.provenance }));
  const rejectedEvidence = rejectedRecords.map((record) => ({ evidenceId: vm0007FinalizedEvidenceId(row.rowId, "rejected", vm0007EvidenceIdentity(record)), quote: record.quote, rejectionReason: record.rejectionReason!, provenance: record.provenance }));
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
  if (!saveVm0007EvidenceMapDraft(finalized).ok) return { ok: false, package: pkg, blockedBy: ["draft-persistence-failed"], pipeline };
  return { ok: true, package: finalized, pipeline };
}

export function loadAndFinalizeVm0007EvidenceMap(auditId: string, reviewerIdentity: string, timestamp?: string): Vm0007FinalizeResult | null {
  const pkg = loadVm0007EvidenceMapDraft(auditId);
  return pkg ? finalizeVm0007EvidenceMap(pkg, reviewerIdentity, timestamp) : null;
}
