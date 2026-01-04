export const runtime = "nodejs";

import { NextResponse } from "next/server";
import type { GeoVistaArtifact, GeoVistaVerification } from "@/services/geovista/types";
import { buildArtifactId, kindFromEvidenceId, type GeoVistaEvidenceKind } from "@/services/geovista/artifacts";

type VerifyRequest = {
  method_code?: string;
  method_version?: string;
  method?: { code?: string; version?: string };
  aoi?: unknown;
  cited_ids?: string[];
  attachment_sha256?: string[];
  question_id?: string;
};

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ code, message }, { status });
}

function requireEnv(name: string): string | null {
  const value = process.env[name];
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim();
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/g, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeStatus(value: unknown): GeoVistaVerification["status"] {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "verified") return "verified";
  if (raw === "needs_review" || raw === "needs review" || raw === "review") return "needs_review";
  if (raw === "not_run" || raw === "not run" || raw === "pending") return "not_run";
  if (raw === "error" || raw === "failed" || raw === "unavailable") return "error";
  return "error";
}

function normalizeArtifacts(value: unknown): GeoVistaArtifact[] {
  if (!Array.isArray(value)) return [];
  const out: GeoVistaArtifact[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const kindRaw = typeof record.kind === "string" ? record.kind.trim().toLowerCase() : "";
    const kind: GeoVistaEvidenceKind | null =
      kindRaw === "rule" ? "rule" : kindRaw === "section" ? "section" : null;

    const ref_id =
      typeof record.ref_id === "string"
        ? record.ref_id.trim()
        : typeof record.refId === "string"
          ? record.refId.trim()
          : typeof record.cited_id === "string"
            ? record.cited_id.trim()
            : typeof record.citedId === "string"
              ? record.citedId.trim()
              : null;

    const url =
      typeof record.url === "string"
        ? record.url.trim()
        : typeof record.href === "string"
          ? record.href.trim()
          : null;

    const fallbackId = typeof record.id === "string" ? record.id.trim() : "";

    if (kind && ref_id) {
      out.push({ id: buildArtifactId(kind, ref_id), kind, ref_id, url: url ?? undefined });
      continue;
    }

    const inferredKind = ref_id ? kindFromEvidenceId(ref_id) : null;
    if (inferredKind && ref_id) {
      out.push({ id: buildArtifactId(inferredKind, ref_id), kind: inferredKind, ref_id, url: url ?? undefined });
      continue;
    }

    if (fallbackId) out.push({ id: fallbackId, url: url ?? undefined });
  }
  return out;
}

function normalizeGeoVistaResponse(payload: unknown): GeoVistaVerification {
  if (!payload || typeof payload !== "object") {
    return {
      ok: false,
      status: "error",
      severity: "fail",
      summary: "GeoVista returned an invalid response.",
      artifacts: [],
      generated_at: nowIso(),
    };
  }

  const record = payload as Record<string, unknown>;
  const status = normalizeStatus(record.status ?? record.verification_status ?? record.verdict);
  const severity: GeoVistaVerification["severity"] =
    status === "verified" ? "ok" : status === "needs_review" ? "warn" : status === "not_run" ? "warn" : "fail";
  const summary =
    typeof record.summary === "string"
      ? record.summary
      : typeof record.message === "string"
        ? record.message
        : status === "verified"
          ? "Verified."
          : status === "needs_review"
            ? "Needs review."
            : status === "not_run"
              ? "Not run."
              : "GeoVista unavailable.";

  const artifacts = normalizeArtifacts(record.artifacts);

  const generated_at =
    typeof record.generated_at === "string"
      ? record.generated_at
      : typeof record.generatedAt === "string"
        ? record.generatedAt
        : nowIso();

  const provenance = record.provenance && typeof record.provenance === "object" ? (record.provenance as Record<string, unknown>) : undefined;

  return { ok: true, status, severity, summary, artifacts, generated_at, provenance };
}

export async function POST(req: Request) {
  const baseUrl = requireEnv("GEOVISTA_BASE_URL");
  const apiKey = requireEnv("GEOVISTA_API_KEY");
  if (!baseUrl || !apiKey) {
    return jsonError("GEOVISTA_NOT_CONFIGURED", "GeoVista not configured", 501);
  }

  const body: VerifyRequest = await req.json().catch(() => ({}));
  const method_code =
    typeof body.method_code === "string"
      ? body.method_code.trim()
      : body.method && typeof body.method === "object" && typeof body.method.code === "string"
        ? body.method.code.trim()
        : "";
  const method_version =
    typeof body.method_version === "string"
      ? body.method_version.trim()
      : body.method && typeof body.method === "object" && typeof body.method.version === "string"
        ? body.method.version.trim()
        : "";
  const question_id = typeof body.question_id === "string" ? body.question_id.trim() : undefined;
  const cited_ids = Array.isArray(body.cited_ids) ? body.cited_ids.map((v) => String(v).trim()).filter(Boolean) : [];
  const attachment_sha256 = Array.isArray(body.attachment_sha256)
    ? body.attachment_sha256.map((v) => String(v).trim()).filter(Boolean)
    : [];
  const aoi = body.aoi ?? undefined;

  if (!method_code) return jsonError("BAD_REQUEST", "Missing required field: method_code", 400);
  if (!method_version) return jsonError("BAD_REQUEST", "Missing required field: method_version", 400);
  if (!cited_ids.length) return jsonError("BAD_REQUEST", "Missing required field: cited_ids", 400);

  const endpoint = joinUrl(baseUrl, "/verify");

  let upstream: Response;
  try {
    upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ method_code, method_version, cited_ids, question_id, aoi, attachment_sha256 }),
      cache: "no-store",
    });
  } catch {
    return jsonError("GEOVISTA_UNAVAILABLE", "GeoVista unavailable", 502);
  }

  const raw = await upstream.text();
  let parsed: unknown = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return jsonError("GEOVISTA_UNAVAILABLE", "GeoVista unavailable", 502);
    }
  }

  if (!upstream.ok) {
    return jsonError("GEOVISTA_UNAVAILABLE", "GeoVista unavailable", 502);
  }

  const normalized = normalizeGeoVistaResponse(parsed);
  return NextResponse.json({ ...normalized, mode: "real" } satisfies GeoVistaVerification, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" },
  });
}
