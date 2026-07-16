import {
  validateVm0007EvidenceMapDraftPackage,
  type Vm0007EvidenceMapDraftPackage,
} from "./vm0007EvidenceMapDraft";
import type { ReviewerWorkflowState } from "@/lib/evidence/readinessReport";

const PREFIX = "article6:vm0007-evidence-map-draft:v1:";
export const VM0007_EVIDENCE_MAP_DRAFT_EVENT = "vm0007-evidence-map-draft";
const storage = () => typeof window === "undefined" ? null : window.localStorage;
const key = (auditId: string) => `${PREFIX}${auditId.trim()}`;

/** Upgrade the PR #989 draft shape without changing its canonical evidence. */
export function normalizeVm0007EvidenceMapDraftPackage(pkg: Vm0007EvidenceMapDraftPackage): Vm0007EvidenceMapDraftPackage {
  const finalizationState = pkg.finalizationState ?? (pkg.rows.some((row) => row.finalizationState === "finalized") ? "finalized" : "draft");
  return {
    ...pkg,
    mapVersion: pkg.mapVersion ?? 1,
    finalizationState,
    finalizedBy: pkg.finalizedBy ?? null,
    finalizedAt: pkg.finalizedAt ?? null,
    finalizationBasis: pkg.finalizationBasis ?? null,
    rows: pkg.rows.map((row) => ({
      ...row,
      // v1 drafts may have only the singular machine proposal fields. Keep
      // those proposals untouched while materializing the reviewer working
      // collections used by the review contract.
      acceptedEvidence: row.acceptedEvidence ?? (row.proposedAcceptedEvidence ? [{
        quote: row.proposedAcceptedEvidence.quote,
        page: row.proposedAcceptedEvidence.provenance.page,
        section: row.proposedAcceptedEvidence.provenance.sectionHeading,
        spanId: row.proposedAcceptedEvidence.provenance.spanId,
        provenance: row.proposedAcceptedEvidence.provenance,
      }] : []),
      rejectedEvidence: row.rejectedEvidence ?? (row.proposedRejectedEvidence ? [{
        quote: row.proposedRejectedEvidence.quote,
        page: row.proposedRejectedEvidence.provenance.page,
        section: row.proposedRejectedEvidence.provenance.sectionHeading,
        spanId: row.proposedRejectedEvidence.provenance.spanId,
        rejectionReason: row.proposedRejectedEvidence.reason,
        provenance: row.proposedRejectedEvidence.provenance,
      }] : []),
      reviewState: (row.reviewState ?? "pending review") as ReviewerWorkflowState,
      reviewHistory: row.reviewHistory ?? [],
      rowVersion: row.rowVersion ?? 1,
      finalizationActorRef: row.finalizationActorRef ?? null,
      finalizedAt: row.finalizedAt ?? null,
      finalizationBasis: row.finalizationBasis ?? null,
      reviewHistoryRef: row.reviewHistoryRef ?? null,
    })),
  };
}

export function loadVm0007EvidenceMapDraft(auditId: string): Vm0007EvidenceMapDraftPackage | null {
  const raw = storage()?.getItem(key(auditId));
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!validateVm0007EvidenceMapDraftPackage(value, auditId)) return null;
    return normalizeVm0007EvidenceMapDraftPackage(value);
  } catch { return null; }
}

export function saveVm0007EvidenceMapDraft(pkg: Vm0007EvidenceMapDraftPackage): boolean {
  const normalized = normalizeVm0007EvidenceMapDraftPackage(pkg);
  if (!validateVm0007EvidenceMapDraftPackage(normalized)) return false;
  const target = storage();
  if (!target) return false;
  target.setItem(key(normalized.auditId), JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(VM0007_EVIDENCE_MAP_DRAFT_EVENT, { detail: { auditId: normalized.auditId, state: "saved", package: normalized } }));
  return true;
}

export function clearVm0007EvidenceMapDraft(auditId: string): boolean {
  const target = storage();
  if (!target) return false;
  target.removeItem(key(auditId));
  window.dispatchEvent(new CustomEvent(VM0007_EVIDENCE_MAP_DRAFT_EVENT, { detail: { auditId, state: "cleared", package: null } }));
  return true;
}
