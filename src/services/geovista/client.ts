import type { GeoVistaVerification } from "@/services/geovista/types";

export type GeoVistaVerificationRequest = {
  method_code: string;
  method_version: string;
  cited_ids: string[];
  question_id?: string;
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
      const error =
        parsed && typeof parsed === "object" && typeof (parsed as Record<string, unknown>).error === "string"
          ? String((parsed as Record<string, unknown>).error)
          : `GeoVista HTTP ${res.status}`;
      return {
        status: "error",
        summary: "GeoVista unavailable.",
        artifacts: [],
        generated_at: nowIso(),
        provenance: { error },
      };
    }

    return parsed as GeoVistaVerification;
  } catch (error) {
    return {
      status: "error",
      summary: "GeoVista unavailable.",
      artifacts: [],
      generated_at: nowIso(),
      provenance: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}
