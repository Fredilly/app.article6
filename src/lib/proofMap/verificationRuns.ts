import type { AOI, EvidencePin, VerificationRun } from "@/lib/proofMap/types";
import { canonicalJson, sha256Hex } from "@/lib/proof/fingerprints";
import { dedupeStrings } from "@/lib/proofMap/pins";

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${prefix}_${nowIso()}_${Math.random().toString(16).slice(2)}`;
}

export type VerificationRunInput = {
  cited_ids: string[];
  attachment_sha256: string[];
};

export function buildVerificationRunInputFromPins(pins: EvidencePin[]): VerificationRunInput {
  const cited: string[] = [];
  const attachmentSha: string[] = [];
  for (const pin of pins ?? []) {
    cited.push(...(pin.cited_ids ?? []));
    for (const att of pin.attachments ?? []) attachmentSha.push(att.sha256);
  }
  return { cited_ids: dedupeStrings(cited), attachment_sha256: dedupeStrings(attachmentSha) };
}

export async function aoiFingerprint(geojson: AOI["geojson"]): Promise<string> {
  return await sha256Hex(canonicalJson(geojson));
}

export async function runInputFingerprint(input: {
  aoi_fp: string;
  cited_ids: string[];
  attachment_sha256: string[];
}): Promise<string> {
  const cited = [...dedupeStrings(input.cited_ids)].sort((a, b) => a.localeCompare(b));
  const attachments = [...dedupeStrings(input.attachment_sha256)].sort((a, b) => a.localeCompare(b));
  return await sha256Hex(canonicalJson({ aoi_fp: input.aoi_fp, cited_ids: cited, attachment_sha256: attachments }));
}

export function splitRunsByAoiFingerprint(input: {
  runs: VerificationRun[];
  currentAoiFingerprint: string;
}): { current: VerificationRun[]; stale: VerificationRun[] } {
  const current: VerificationRun[] = [];
  const stale: VerificationRun[] = [];
  for (const run of input.runs ?? []) {
    if (run.aoi_fingerprint === input.currentAoiFingerprint) current.push(run);
    else stale.push(run);
  }
  return { current, stale };
}

export function runsForCurrentAoi(input: {
  runs: VerificationRun[];
  currentAoiFingerprint: string | null;
}): VerificationRun[] {
  if (!input.currentAoiFingerprint) return [];
  return (input.runs ?? []).filter((run) => run.aoi_fingerprint === input.currentAoiFingerprint);
}

export function shouldDisableRunVerification(input: {
  isRunning: boolean;
  aoi: AOI | null;
  currentAoiFingerprint: string | null;
  methodCode: string;
  version: string;
  evidencePins: EvidencePin[];
}): boolean {
  if (input.isRunning) return true;
  if (!input.aoi) return true;
  if (!input.currentAoiFingerprint) return true;
  if (!input.methodCode.trim() || !input.version.trim()) return true;
  return false;
}

export function createQueuedVerificationRun(input: {
  method: { code: string; version: string };
  aoi: AOI;
  pins: EvidencePin[];
  aoi_fingerprint: string;
  input_fingerprint: string;
}): VerificationRun {
  const aggregates = buildVerificationRunInputFromPins(input.pins);
  return {
    id: newId("run"),
    method: input.method,
    aoi_id: input.aoi.id,
    aoi_snapshot: {
      name: input.aoi.name,
      bbox: input.aoi.bbox,
      area_km2: input.aoi.area_km2,
      aoi_source_type: input.aoi.aoi_source_type,
      aoi_source_feature_count: input.aoi.aoi_source_feature_count,
      aoi_policy: input.aoi.aoi_policy,
    },
    aoi_fingerprint: input.aoi_fingerprint,
    input_fingerprint: input.input_fingerprint,
    cited_ids: aggregates.cited_ids,
    attachment_sha256: aggregates.attachment_sha256,
    cited_ids_count: aggregates.cited_ids.length,
    attachment_count: aggregates.attachment_sha256.length,
    provider: "stac",
    status: "queued",
    created_at: nowIso(),
  };
}

async function fetchJson(url: string, body: unknown): Promise<{ ok: boolean; status: number; json: unknown }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : null;
  return { ok: res.ok, status: res.status, json };
}

export async function runStacEvidenceSearch(input: {
  method: { code: string; version: string };
  aoi: AOI;
  cited_ids: string[];
  attachment_sha256: string[];
}): Promise<{ provider: VerificationRun["provider"]; runStatus: VerificationRun["status"]; summary: string; result_json: unknown }> {
  const stac = await fetchJson("/api/stac/search", { aoi_geojson: input.aoi.geojson });
  if (!stac.ok) {
    return {
      provider: "stac",
      runStatus: "error",
      summary: "Satellite search failed.",
      result_json: stac.json,
    };
  }
  const stacRecord = stac.json && typeof stac.json === "object" ? (stac.json as Record<string, unknown>) : null;
  const items = stacRecord && Array.isArray(stacRecord.items) ? (stacRecord.items as unknown[]) : [];
  const itemsCount = items.length;
  return {
    provider: "stac",
    runStatus: "ok",
    summary: `STAC returned ${itemsCount} item(s).`,
    result_json: stac.json,
  };
}
