import { type PresentationGateResult } from "@/lib/evidence/presentationGate";
import { createReadinessReportViewModel, isPresentationGateResult, type ReadinessReportViewModel } from "@/lib/evidence/readinessReport";

const STORAGE_PREFIX = "article6:project-readiness-payload:v1:";
export const PROJECT_READINESS_PAYLOAD_EVENT = "article6:project-readiness-payload-saved";

export type ProjectReadinessPayload = Readonly<{
  projectId: string;
  gateResult: PresentationGateResult;
}>;

export type ProjectReadinessPayloadEventDetail = Readonly<{
  projectId: string;
  payload: ProjectReadinessPayload | null;
  state: "saved" | "cleared";
}>;

export type ReadinessPayloadStorageScope = Readonly<{
  id: string;
  save: (gateResult: PresentationGateResult) => boolean;
  clear: () => void;
}>;

export function projectReadinessPayloadStorageKey(projectId: string): string {
  return `${STORAGE_PREFIX}${projectId}`;
}

export function loadProjectReadinessPayload(projectId: string): ProjectReadinessPayload | null {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(projectReadinessPayloadStorageKey(normalizedProjectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (
      parsed.projectId !== normalizedProjectId ||
      !Object.prototype.hasOwnProperty.call(parsed, "gateResult") ||
      !isPresentationGateResult(parsed.gateResult)
    ) return null;
    return { projectId: normalizedProjectId, gateResult: parsed.gateResult };
  } catch {
    return null;
  }
}

export function saveProjectReadinessPayload(payload: ProjectReadinessPayload): boolean {
  const projectId = payload.projectId.trim();
  if (!projectId || projectId !== payload.projectId || !isPresentationGateResult(payload.gateResult)) return false;
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(projectReadinessPayloadStorageKey(projectId), JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent<ProjectReadinessPayloadEventDetail>(PROJECT_READINESS_PAYLOAD_EVENT, {
      detail: { projectId, payload, state: "saved" },
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearProjectReadinessPayload(projectId: string): boolean {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId || normalizedProjectId !== projectId || typeof window === "undefined") return false;
  try {
    window.localStorage.removeItem(projectReadinessPayloadStorageKey(normalizedProjectId));
    window.dispatchEvent(new CustomEvent<ProjectReadinessPayloadEventDetail>(PROJECT_READINESS_PAYLOAD_EVENT, {
      detail: { projectId: normalizedProjectId, payload: null, state: "cleared" },
    }));
    return true;
  } catch {
    return false;
  }
}

export function createProjectReadinessReportViewModel(payload: ProjectReadinessPayload | null): ReadinessReportViewModel {
  return createReadinessReportViewModel(payload?.gateResult ?? null);
}

export function hasProjectReadinessPayload(projectId: string): boolean {
  return createProjectReadinessReportViewModel(loadProjectReadinessPayload(projectId)).rows.length > 0;
}
