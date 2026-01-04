export type GeoVistaArtifact = {
  id: string;
  kind?: "rule" | "section" | string;
  ref_id?: string;
  url?: string;
};

export type GeoVistaVerification = {
  status: "not_run" | "verified" | "needs_review" | "error";
  summary: string;
  artifacts: GeoVistaArtifact[];
  generated_at: string;
  provenance?: Record<string, unknown>;
};
