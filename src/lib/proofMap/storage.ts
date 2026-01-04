import type { ProofMapState } from "@/lib/proofMap/types";

function keyFor(code: string, version: string): string {
  return `proofmap:${code}:${version}`;
}

export function loadProofMapState(code: string, version: string): ProofMapState {
  if (typeof window === "undefined") return { aoi: null, evidence_pins: [] };
  try {
    const raw = window.localStorage.getItem(keyFor(code, version));
    if (!raw) return { aoi: null, evidence_pins: [] };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return { aoi: null, evidence_pins: [] };
    const record = parsed as Record<string, unknown>;
    const aoi = record.aoi && typeof record.aoi === "object" ? (record.aoi as ProofMapState["aoi"]) : null;
    const evidence_pins = Array.isArray(record.evidence_pins) ? (record.evidence_pins as ProofMapState["evidence_pins"]) : [];
    return { aoi: aoi ?? null, evidence_pins };
  } catch {
    return { aoi: null, evidence_pins: [] };
  }
}

export function saveProofMapState(code: string, version: string, state: ProofMapState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(keyFor(code, version), JSON.stringify(state));
  } catch {
    // ignore
  }
}

