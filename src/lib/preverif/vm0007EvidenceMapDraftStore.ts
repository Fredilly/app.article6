import {
  validateVm0007EvidenceMapDraftPackage,
  type Vm0007EvidenceMapDraftPackage,
} from "./vm0007EvidenceMapDraft";

const PREFIX = "article6:vm0007-evidence-map-draft:v1:";
export const VM0007_EVIDENCE_MAP_DRAFT_EVENT = "vm0007-evidence-map-draft";
const storage = () => typeof window === "undefined" ? null : window.localStorage;
const key = (auditId: string) => `${PREFIX}${auditId.trim()}`;

export function loadVm0007EvidenceMapDraft(auditId: string): Vm0007EvidenceMapDraftPackage | null {
  const raw = storage()?.getItem(key(auditId));
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return validateVm0007EvidenceMapDraftPackage(value, auditId) ? value : null;
  } catch { return null; }
}

export function saveVm0007EvidenceMapDraft(pkg: Vm0007EvidenceMapDraftPackage): boolean {
  if (!validateVm0007EvidenceMapDraftPackage(pkg)) return false;
  const target = storage();
  if (!target) return false;
  target.setItem(key(pkg.auditId), JSON.stringify(pkg));
  window.dispatchEvent(new CustomEvent(VM0007_EVIDENCE_MAP_DRAFT_EVENT, { detail: { auditId: pkg.auditId, state: "saved", package: pkg } }));
  return true;
}

export function clearVm0007EvidenceMapDraft(auditId: string): boolean {
  const target = storage();
  if (!target) return false;
  target.removeItem(key(auditId));
  window.dispatchEvent(new CustomEvent(VM0007_EVIDENCE_MAP_DRAFT_EVENT, { detail: { auditId, state: "cleared", package: null } }));
  return true;
}
