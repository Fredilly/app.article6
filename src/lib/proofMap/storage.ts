import type { AOI, EvidencePin } from "@/lib/proofMap/types";

function aoiKey(code: string, version: string): string {
  return `aoi:${code}:${version}`;
}

function pinsKey(code: string, version: string): string {
  return `pins:${code}:${version}`;
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

