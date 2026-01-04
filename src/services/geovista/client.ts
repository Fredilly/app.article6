import type { GeoVistaVerification } from "@/services/geovista/types";
import { buildArtifactsFromEvidenceIds } from "@/services/geovista/artifacts";
import type { AOI } from "@/lib/proofMap/types";

export type GeoVistaVerificationRequest = {
  method_code: string;
  method_version: string;
  method?: { code: string; version: string };
  cited_ids: string[];
  question_id?: string;
  aoi?: AOI;
  attachment_sha256?: string[];
};

function isEnabled(): boolean {
  return process.env.NEXT_PUBLIC_GEOVISTA_ENABLED === "true";
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function getVerification(
  req: GeoVistaVerificationRequest,
): Promise<GeoVistaVerification | null> {
  if (!isEnabled()) return null;
  try {
    const res = await fetch("/api/geovista/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      cache: "no-store",
    });
    const raw = await res.text();
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;

    if (!res.ok) {
      const code =
        parsed && typeof parsed === "object" && typeof (parsed as Record<string, unknown>).code === "string"
          ? String((parsed as Record<string, unknown>).code)
          : "";
      const message =
        parsed && typeof parsed === "object" && typeof (parsed as Record<string, unknown>).message === "string"
          ? String((parsed as Record<string, unknown>).message)
          : `GeoVista HTTP ${res.status}`;

      if (res.status === 501 && code === "GEOVISTA_NOT_CONFIGURED") {
        const artifacts = buildArtifactsFromEvidenceIds(req.cited_ids);
        return {
          mode: "mock",
          status: "not_run",
          summary: `GeoVista enabled (mock). Ready to verify ${artifacts.length} cited item(s).`,
          artifacts,
          generated_at: nowIso(),
          provenance: { source: "mock", reason: code },
        };
      }

      return {
        mode: "real",
        status: "error",
        summary: "GeoVista unavailable.",
        artifacts: [],
        generated_at: nowIso(),
        provenance: { code: code || "GEOVISTA_UNAVAILABLE", message },
      };
    }

    if (parsed && typeof parsed === "object") {
      return { ...(parsed as Record<string, unknown>), mode: "real" } as GeoVistaVerification;
    }
    return {
      mode: "real",
      status: "error",
      summary: "GeoVista unavailable.",
      artifacts: [],
      generated_at: nowIso(),
      provenance: { code: "GEOVISTA_UNAVAILABLE", message: "GeoVista returned an invalid response." },
    };
  } catch (error) {
    return {
      mode: "real",
      status: "error",
      summary: "GeoVista unavailable.",
      artifacts: [],
      generated_at: nowIso(),
      provenance: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}
