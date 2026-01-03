export type GeoVistaArtifact = {
  id: string;
  label?: string;
  href?: string;
};

export type GeoVistaVerification = {
  status: "not_run" | "verified" | "needs_review";
  summary: string;
  artifacts: GeoVistaArtifact[];
  generated_at: string;
  provenance?: Record<string, unknown>;
};

