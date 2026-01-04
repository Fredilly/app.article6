import type { AOI, EvidencePin, VerificationRun } from "@/lib/proofMap/types";
import type { GeoVistaVerificationRequest } from "@/services/geovista/client";
import { getVerification } from "@/services/geovista/client";
import type { GeoVistaVerification } from "@/services/geovista/types";
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

export function mapGeoVistaVerificationToRunStatus(verification: GeoVistaVerification): VerificationRun["status"] {
  if (verification.ok === false) return "error";
  if (verification.mode === "mock") return "ok";
  if (verification.severity === "ok") return "ok";
  if (verification.severity === "warn") return "warn";
  if (verification.severity === "fail") return "fail";
  return "ok";
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
    aoi_snapshot: { name: input.aoi.name, bbox: input.aoi.bbox, area_km2: input.aoi.area_km2 },
    aoi_fingerprint: input.aoi_fingerprint,
    input_fingerprint: input.input_fingerprint,
    cited_ids: aggregates.cited_ids,
    attachment_sha256: aggregates.attachment_sha256,
    cited_ids_count: aggregates.cited_ids.length,
    attachment_count: aggregates.attachment_sha256.length,
    provider: "geovista",
    status: "queued",
    created_at: nowIso(),
  };
}

export async function runGeoVistaVerification(input: {
  method: { code: string; version: string };
  aoi: AOI;
  cited_ids: string[];
  attachment_sha256: string[];
}): Promise<{ runStatus: VerificationRun["status"]; summary: string; result_json: unknown }> {
  const req: GeoVistaVerificationRequest = {
    method_code: input.method.code,
    method_version: input.method.version,
    method: { code: input.method.code, version: input.method.version },
    cited_ids: input.cited_ids,
  };

  const verification = await getVerification({
    ...req,
    aoi: input.aoi,
    attachment_sha256: input.attachment_sha256,
  });

  if (!verification) {
    return {
      runStatus: "error",
      summary: "GeoVista unavailable.",
      result_json: { status: "error", summary: "GeoVista unavailable." },
    };
  }

  return {
    runStatus: mapGeoVistaVerificationToRunStatus(verification),
    summary: verification.summary,
    result_json: verification,
  };
}
