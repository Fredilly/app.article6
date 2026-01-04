export type AOI = {
  id: string;
  name: string;
  geojson: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
  bbox: [number, number, number, number];
  area_km2: number;
  created_at: string;
};

export type EvidencePinKind = "photo" | "doc" | "note";

export type EvidencePin = {
  id: string;
  kind: EvidencePinKind;
  title: string;
  aoi_id?: string | null;
  cited_ids: string[];
  location?: { lng: number; lat: number };
  created_at: string;
};

export type ProofMapState = {
  aoi: AOI | null;
  evidence_pins: EvidencePin[];
};

