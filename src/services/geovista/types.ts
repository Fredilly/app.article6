export type GeoVistaArtifact = {
  id: string;
  kind?: "rule" | "section" | string;
  ref_id?: string;
  url?: string;
};

export type GeoVistaVerification = {
  ok?: boolean;
  mode?: "mock" | "real";
  request_id?: string;
  provider_url?: string;
  received_at?: string;
  request?: Record<string, unknown>;
  provider_response?: unknown;
  code?: string;
  message?: string;
  status: "not_run" | "verified" | "needs_review" | "error";
  severity?: "ok" | "warn" | "fail";
  summary: string;
  artifacts: GeoVistaArtifact[];
  generated_at: string;
  provenance?: Record<string, unknown>;
};
