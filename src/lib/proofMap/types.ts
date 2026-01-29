export type AOI = {
  id: string;
  name: string;
  geojson: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
  bbox: [number, number, number, number];
  area_km2: number;
  aoi_source_type?: "FeatureCollection" | "Feature" | "Geometry";
  aoi_source_feature_count?: number;
  aoi_policy?: "reject_multi";
  aoi_fingerprint?: string;
  created_at: string;
};

export type EvidencePinKind = "photo" | "doc" | "note";

export type EvidenceAttachment = {
  id: string;
  pin_id: string;
  filename: string;
  mime: string;
  size: number;
  sha256: string;
  created_at: string;
};

export type VerificationRun = {
  id: string;
  method: { code: string; version: string };
  aoi_id?: string;
  aoi_snapshot?: {
    name: string;
    bbox: [number, number, number, number];
    area_km2: number;
    aoi_source_type?: AOI["aoi_source_type"];
    aoi_source_feature_count?: number;
    aoi_policy?: AOI["aoi_policy"];
  };
  aoi_fingerprint: string;
  input_fingerprint: string;
  pin_id?: string;
  cited_ids: string[];
  cited_ids_count: number;
  attachment_sha256: string[];
  attachment_count: number;
  provider: "stac";
  status: "queued" | "ok" | "warn" | "fail" | "error";
  summary?: string;
  result_json?: unknown;
  created_at: string;
  ended_at?: string;
};

export type EvidencePin = {
  id: string;
  kind: EvidencePinKind;
  title: string;
  aoi_id?: string | null;
  aoi_fingerprint?: string;
  cited_ids: string[];
  location?: { lng: number; lat: number };
  attachments?: EvidenceAttachment[];
  stac_item_ids?: string[];
  stac_run_id?: string;
  created_at: string;
};

export type ProofMapState = {
  aoi: AOI | null;
  evidence_pins: EvidencePin[];
};
