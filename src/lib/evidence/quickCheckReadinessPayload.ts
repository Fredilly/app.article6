import { type PresentationGateResult } from "@/lib/evidence/presentationGate";
import { createReadinessReportViewModel, isPresentationGateResult, type ReadinessReportViewModel } from "@/lib/evidence/readinessReport";

const STORAGE_PREFIX = "article6:quick-check-readiness-payload:v1:";
export const QUICK_CHECK_READINESS_PAYLOAD_EVENT = "article6:quick-check-readiness-payload-saved";

export type QuickCheckReadinessPayload = Readonly<{
  auditId: string;
  auditGeneratedAt: string;
  gateResult: PresentationGateResult;
}>;
export type QuickCheckReadinessPayloadEventDetail = Readonly<{
  auditId: string;
  payload: QuickCheckReadinessPayload | null;
  state: "saved" | "cleared";
}>;

export function quickCheckReadinessPayloadStorageKey(auditId: string): string {
  return `${STORAGE_PREFIX}${auditId}`;
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function loadQuickCheckReadinessPayload(auditId: string): QuickCheckReadinessPayload | null {
  const normalized = auditId.trim();
  if (!normalized || normalized !== auditId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(quickCheckReadinessPayloadStorageKey(normalized));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<QuickCheckReadinessPayload>;
    if (parsed.auditId !== normalized || !validTimestamp(parsed.auditGeneratedAt) || !isPresentationGateResult(parsed.gateResult)) return null;
    return parsed as QuickCheckReadinessPayload;
  } catch {
    return null;
  }
}

export function saveQuickCheckReadinessPayload(payload: QuickCheckReadinessPayload): boolean {
  if (!payload.auditId || payload.auditId.trim() !== payload.auditId || !validTimestamp(payload.auditGeneratedAt) || !isPresentationGateResult(payload.gateResult) || typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(quickCheckReadinessPayloadStorageKey(payload.auditId), JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent<QuickCheckReadinessPayloadEventDetail>(QUICK_CHECK_READINESS_PAYLOAD_EVENT, { detail: { auditId: payload.auditId, payload, state: "saved" } }));
    return true;
  } catch {
    return false;
  }
}

export function clearQuickCheckReadinessPayload(auditId: string): boolean {
  const normalized = auditId.trim();
  if (!normalized || normalized !== auditId || typeof window === "undefined") return false;
  try {
    window.localStorage.removeItem(quickCheckReadinessPayloadStorageKey(normalized));
    window.dispatchEvent(new CustomEvent<QuickCheckReadinessPayloadEventDetail>(QUICK_CHECK_READINESS_PAYLOAD_EVENT, { detail: { auditId: normalized, payload: null, state: "cleared" } }));
    return true;
  } catch {
    return false;
  }
}

export function createQuickCheckReadinessReportViewModel(payload: QuickCheckReadinessPayload | null): ReadinessReportViewModel {
  return createReadinessReportViewModel(payload?.gateResult ?? null);
}
