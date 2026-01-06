import type { AOI, EvidencePin, VerificationRun } from "@/lib/proofMap/types";
import type { ProofEvidenceItem } from "@/lib/proof/bundle";

function aoiKey(code: string, version: string): string {
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
    const raw = window.localStorage.getItem(aoiKey(code, version));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as AOI) : null;
  } catch {
    return null;
  }
}

export function saveAoi(code: string, version: string, aoi: AOI | null) {
  if (typeof window === "undefined") return;
  try {
    if (!aoi) window.localStorage.removeItem(aoiKey(code, version));
    else window.localStorage.setItem(aoiKey(code, version), JSON.stringify(aoi));
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
    window.localStorage.removeItem(aoiKey(code, version));
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
