import type { AOI, EvidencePin, VerificationRun } from "@/lib/proofMap/types";
import type { ProofEvidenceItem } from "@/lib/proof/bundle";

const AOI_STORAGE_VERSION = "v2";

function normalizeWorkspaceId(workspaceId?: string | null): string {
  return (workspaceId ?? "").trim();
}

function aoiCurrentKey(code: string, version: string, workspaceId?: string | null): string {
  const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
  if (normalizedWorkspaceId) return `aoi:${AOI_STORAGE_VERSION}:workspace:${normalizedWorkspaceId}:current`;
  return `aoi:${AOI_STORAGE_VERSION}:${code}:${version}:current`;
}

function aoiDraftKey(code: string, version: string, workspaceId?: string | null): string {
  const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
  if (normalizedWorkspaceId) return `aoi:${AOI_STORAGE_VERSION}:workspace:${normalizedWorkspaceId}:draft`;
  return `aoi:${AOI_STORAGE_VERSION}:${code}:${version}:draft`;
}

function legacyAoiKey(code: string, version: string): string {
  return `aoi:${code}:${version}`;
}

function pinsKey(code: string, version: string, workspaceId?: string | null): string {
  const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
  if (normalizedWorkspaceId) return `pins:workspace:${normalizedWorkspaceId}`;
  return `pins:${code}:${version}`;
}

function snapshotsKey(code: string, version: string, workspaceId?: string | null): string {
  const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
  if (normalizedWorkspaceId) return `snapshots:workspace:${normalizedWorkspaceId}`;
  return `snapshots:${code}:${version}`;
}

function runsKey(code: string, version: string, workspaceId?: string | null): string {
  const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
  if (normalizedWorkspaceId) return `runs:workspace:${normalizedWorkspaceId}`;
  return `runs:${code}:${version}`;
}

export function loadAoi(code: string, version: string, workspaceId?: string | null): AOI | null {
  if (typeof window === "undefined") return null;
  try {
    const currentRaw = window.localStorage.getItem(aoiCurrentKey(code, version, workspaceId));
    if (currentRaw) {
      const parsed = JSON.parse(currentRaw) as unknown;
      return parsed && typeof parsed === "object" ? (parsed as AOI) : null;
    }
    if (normalizeWorkspaceId(workspaceId)) return null;
    const legacyRaw = window.localStorage.getItem(legacyAoiKey(code, version));
    if (!legacyRaw) return null;
    const parsed = JSON.parse(legacyRaw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as AOI) : null;
  } catch {
    return null;
  }
}

export function saveAoi(code: string, version: string, aoi: AOI | null, workspaceId?: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (!aoi) {
      window.localStorage.removeItem(aoiCurrentKey(code, version, workspaceId));
    } else {
      window.localStorage.setItem(aoiCurrentKey(code, version, workspaceId), JSON.stringify(aoi));
    }
    if (!normalizeWorkspaceId(workspaceId)) {
      window.localStorage.removeItem(legacyAoiKey(code, version));
    }
  } catch {
    // ignore
  }
}

export function loadDraftAoi(code: string, version: string, workspaceId?: string | null): AOI | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(aoiDraftKey(code, version, workspaceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as AOI) : null;
  } catch {
    return null;
  }
}

export function saveDraftAoi(code: string, version: string, aoi: AOI | null, workspaceId?: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (!aoi) window.localStorage.removeItem(aoiDraftKey(code, version, workspaceId));
    else window.localStorage.setItem(aoiDraftKey(code, version, workspaceId), JSON.stringify(aoi));
  } catch {
    // ignore
  }
}

export function loadPins(code: string, version: string, workspaceId?: string | null): EvidencePin[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(pinsKey(code, version, workspaceId));
    if (!raw) return [];
    if (!raw && normalizeWorkspaceId(workspaceId)) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as EvidencePin[]) : [];
  } catch {
    return [];
  }
}

export function savePins(code: string, version: string, pins: EvidencePin[], workspaceId?: string | null) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(pinsKey(code, version, workspaceId), JSON.stringify(pins));
  } catch {
    // ignore
  }
}

export function loadEvidenceSnapshots(code: string, version: string, workspaceId?: string | null): ProofEvidenceItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(snapshotsKey(code, version, workspaceId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ProofEvidenceItem[]) : [];
  } catch {
    return [];
  }
}

export function saveEvidenceSnapshots(code: string, version: string, items: ProofEvidenceItem[] | null | undefined, workspaceId?: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (!items || !items.length) window.localStorage.removeItem(snapshotsKey(code, version, workspaceId));
    else window.localStorage.setItem(snapshotsKey(code, version, workspaceId), JSON.stringify(items));
  } catch {
    // ignore
  }
}

export function loadVerificationRuns(code: string, version: string, workspaceId?: string | null): VerificationRun[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(runsKey(code, version, workspaceId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as VerificationRun[]) : [];
  } catch {
    return [];
  }
}

export function saveVerificationRuns(code: string, version: string, runs: VerificationRun[] | null | undefined, workspaceId?: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (!runs || !runs.length) window.localStorage.removeItem(runsKey(code, version, workspaceId));
    else window.localStorage.setItem(runsKey(code, version, workspaceId), JSON.stringify(runs));
  } catch {
    // ignore
  }
}

export function clearProofMapStorage(code: string, version: string, workspaceId?: string | null) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(aoiCurrentKey(code, version, workspaceId));
    window.localStorage.removeItem(aoiDraftKey(code, version, workspaceId));
    window.localStorage.removeItem(pinsKey(code, version, workspaceId));
    window.localStorage.removeItem(snapshotsKey(code, version, workspaceId));
    window.localStorage.removeItem(runsKey(code, version, workspaceId));
    if (!normalizeWorkspaceId(workspaceId)) {
      window.localStorage.removeItem(legacyAoiKey(code, version));
    }
  } catch {
    // ignore
  }
}

export function clearStoredMapView(viewKey: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(`a6:mapview:${viewKey}`);
  } catch {
    // ignore
  }
}
