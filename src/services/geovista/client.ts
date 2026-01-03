import type { GeoVistaVerification } from "@/services/geovista/types";
import { buildArtifactsFromEvidenceIds } from "@/services/geovista/artifacts";

export type GeoVistaVerificationRequest = {
  method_code: string;
  method_version: string;
  cited_ids: string[];
};

function isEnabled(): boolean {
  return process.env.NEXT_PUBLIC_GEOVISTA_ENABLED === "true";
}

function nowIso(): string {
  return new Date().toISOString();
}

function mockVerification(req: GeoVistaVerificationRequest): GeoVistaVerification {
  const cited = req.cited_ids.filter(Boolean);
  const artifacts = buildArtifactsFromEvidenceIds(cited);

  return {
    status: "not_run",
    summary:
      cited.length > 0
        ? `GeoVista is enabled (mock). Ready to verify ${cited.length} cited item(s).`
        : "GeoVista is enabled (mock). Provide citations to verify.",
    artifacts,
    generated_at: nowIso(),
    provenance: {
      source: "mock",
      method_code: req.method_code,
      method_version: req.method_version,
    },
  };
}

export async function getVerification(
  req: GeoVistaVerificationRequest,
): Promise<GeoVistaVerification | null> {
  if (!isEnabled()) return null;
  return mockVerification(req);
}
