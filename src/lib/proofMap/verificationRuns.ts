import type { AOI, EvidencePin, VerificationRun } from "@/lib/proofMap/types";
import type { GeoVistaVerificationRequest } from "@/services/geovista/client";
import { getVerification } from "@/services/geovista/client";
import type { GeoVistaVerification } from "@/services/geovista/types";
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

function mapGeoVistaStatusToRunStatus(status: GeoVistaVerification["status"]): VerificationRun["status"] {
  if (status === "verified") return "ok";
  if (status === "needs_review") return "warn";
  if (status === "not_run") return "fail";
  return "error";
}

export function createQueuedVerificationRun(input: {
  method: { code: string; version: string };
  aoi: AOI;
  pins: EvidencePin[];
}): VerificationRun {
  const aggregates = buildVerificationRunInputFromPins(input.pins);
  return {
    id: newId("run"),
    method: input.method,
    aoi_id: input.aoi.id,
    cited_ids: aggregates.cited_ids,
    attachment_sha256: aggregates.attachment_sha256,
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
    runStatus: mapGeoVistaStatusToRunStatus(verification.status),
    summary: verification.summary,
    result_json: verification,
  };
}
