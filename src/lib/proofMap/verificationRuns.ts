import type { AOI, EvidencePin, VerificationRun } from "@/lib/proofMap/types";
import type { GeoVistaVerificationRequest } from "@/services/geovista/client";
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
  provider?: VerificationRun["provider"];
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
    provider: input.provider ?? "geovista",
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

export async function runGeoVistaVerification(input: {
  method: { code: string; version: string };
  aoi: AOI;
  cited_ids: string[];
  attachment_sha256: string[];
}): Promise<{ provider: VerificationRun["provider"]; runStatus: VerificationRun["status"]; summary: string; result_json: unknown }> {
  const req: GeoVistaVerificationRequest = {
    method_code: input.method.code,
    method_version: input.method.version,
    method: { code: input.method.code, version: input.method.version },
    cited_ids: input.cited_ids,
  };

  const geovista = await fetchJson("/api/geovista/verify", {
    ...req,
    aoi: input.aoi,
    attachment_sha256: input.attachment_sha256,
  });

  if (geovista.status === 501) {
    const code =
      geovista.json && typeof geovista.json === "object" && typeof (geovista.json as Record<string, unknown>).code === "string"
        ? String((geovista.json as Record<string, unknown>).code)
        : "";
    if (code === "GEOVISTA_NOT_CONFIGURED") {
      const stac = await fetchJson("/api/stac/search", { aoi_geojson: input.aoi.geojson });
      if (!stac.ok) {
        return {
          provider: "stac",
          runStatus: "error",
          summary: "STAC unavailable.",
          result_json: stac.json,
        };
      }
      const stacRecord =
        stac.json && typeof stac.json === "object" ? (stac.json as Record<string, unknown>) : null;
      const items = stacRecord && Array.isArray(stacRecord.items) ? (stacRecord.items as unknown[]) : [];
      const itemsCount = items.length;
      return {
        provider: "stac",
        runStatus: "ok",
        summary: `STAC returned ${itemsCount} item(s).`,
        result_json: stac.json,
      };
    }
  }

  if (!geovista.ok) {
    return {
      provider: "geovista",
      runStatus: "error",
      summary: "GeoVista unavailable.",
      result_json: geovista.json ?? { status: "error", summary: "GeoVista unavailable." },
    };
  }

  const verification = geovista.json as GeoVistaVerification;
  return {
    provider: "geovista",
    runStatus: mapGeoVistaVerificationToRunStatus(verification),
    summary: verification.summary ?? "GeoVista response received.",
    result_json: verification,
  };
}
