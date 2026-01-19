import type { AOI, EvidencePin, VerificationRun } from "@/lib/proofMap/types";
import type { ProofEvidenceItem } from "@/lib/proof/bundle";

const AOI_STORAGE_VERSION = "v2";

function aoiCurrentKey(code: string, version: string): string {
  return `aoi:${AOI_STORAGE_VERSION}:${code}:${version}:current`;
}

function aoiDraftKey(code: string, version: string): string {
  return `aoi:${AOI_STORAGE_VERSION}:${code}:${version}:draft`;
}

function legacyAoiKey(code: string, version: string): string {
  return `aoi:${code}:${version}`;
}

function pinsKey(code: string, version: string): string {
  return `pins:${code}:${version}`;
}

function snapshotsKey(code: string, version: string): string {
  return `snapshots:${code}:${version}`;
}

function runsKey(code: string, version: string): string {
  return `runs:${code}:${version}`;
}

export function loadAoi(code: string, version: string): AOI | null {
  if (typeof window === "undefined") return null;
  try {
    const currentRaw = window.localStorage.getItem(aoiCurrentKey(code, version));
    if (currentRaw) {
      const parsed = JSON.parse(currentRaw) as unknown;
      return parsed && typeof parsed === "object" ? (parsed as AOI) : null;
    }
    const legacyRaw = window.localStorage.getItem(legacyAoiKey(code, version));
    if (!legacyRaw) return null;
    const parsed = JSON.parse(legacyRaw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as AOI) : null;
  } catch {
    return null;
  }
}

export function saveAoi(code: string, version: string, aoi: AOI | null) {
  if (typeof window === "undefined") return;
  try {
    if (!aoi) {
      window.localStorage.removeItem(aoiCurrentKey(code, version));
    } else {
      window.localStorage.setItem(aoiCurrentKey(code, version), JSON.stringify(aoi));
    }
    window.localStorage.removeItem(legacyAoiKey(code, version));
  } catch {
    // ignore
  }
}

export function loadDraftAoi(code: string, version: string): AOI | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(aoiDraftKey(code, version));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as AOI) : null;
  } catch {
    return null;
  }
}

export function saveDraftAoi(code: string, version: string, aoi: AOI | null) {
  if (typeof window === "undefined") return;
  try {
    if (!aoi) window.localStorage.removeItem(aoiDraftKey(code, version));
    else window.localStorage.setItem(aoiDraftKey(code, version), JSON.stringify(aoi));
  } catch {
    // ignore
  }
}

export function loadPins(code: string, version: string): EvidencePin[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(pinsKey(code, version));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as EvidencePin[]) : [];
  } catch {
    return [];
  }
}

export function savePins(code: string, version: string, pins: EvidencePin[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(pinsKey(code, version), JSON.stringify(pins));
  } catch {
    // ignore
  }
}

export function loadEvidenceSnapshots(code: string, version: string): ProofEvidenceItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(snapshotsKey(code, version));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ProofEvidenceItem[]) : [];
  } catch {
    return [];
  }
}

export function saveEvidenceSnapshots(code: string, version: string, items: ProofEvidenceItem[] | null | undefined) {
  if (typeof window === "undefined") return;
  try {
    if (!items || !items.length) window.localStorage.removeItem(snapshotsKey(code, version));
    else window.localStorage.setItem(snapshotsKey(code, version), JSON.stringify(items));
  } catch {
    // ignore
  }
}

export function loadVerificationRuns(code: string, version: string): VerificationRun[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(runsKey(code, version));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as VerificationRun[]) : [];
  } catch {
    return [];
  }
}

export function saveVerificationRuns(code: string, version: string, runs: VerificationRun[] | null | undefined) {
  if (typeof window === "undefined") return;
  try {
    if (!runs || !runs.length) window.localStorage.removeItem(runsKey(code, version));
    else window.localStorage.setItem(runsKey(code, version), JSON.stringify(runs));
  } catch {
    // ignore
  }
}

export function clearProofMapStorage(code: string, version: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(aoiCurrentKey(code, version));
    window.localStorage.removeItem(aoiDraftKey(code, version));
    window.localStorage.removeItem(legacyAoiKey(code, version));
    window.localStorage.removeItem(pinsKey(code, version));
    window.localStorage.removeItem(snapshotsKey(code, version));
    window.localStorage.removeItem(runsKey(code, version));
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
