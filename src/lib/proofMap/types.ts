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

export type EvidencePinKind = "photo" | "doc" | "note" | "pdd";

export type PddFragmentBboxHint = {
  page?: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PddDocumentAsset = {
  evidence_id: string;
  attachment_id?: string | null;
  file_name: string;
  mime: string;
  added_at: string;
  sha256?: string | null;
};

export type PddFragment = {
  fragment_id: string;
  evidence_id: string;
  label?: string;
  page_start?: number;
  page_end?: number;
  section_label?: string;
  section_heading?: string;
  excerpt?: string;
  bbox_hint?: PddFragmentBboxHint | null;
};

export type PddFragmentLink = {
  fragment_id: string;
  rule_id: string;
  linked_at?: string;
};

export type WorkbookRecordGroupType =
  | "activity_data_table"
  | "parameter_source_table"
  | "calculation_table"
  | "sampling_log"
  | "monitoring_period_table";

export type WorkbookSheetSummary = {
  sheet_name: string;
  sheet_index: number;
  row_count: number;
  column_count: number;
  bounds_ref: string | null;
  header_row_ref: number | null;
  header_columns: string[];
  warnings: string[];
};

export type WorkbookRecordGroup = {
  group_id: string;
  group_type: WorkbookRecordGroupType;
  display_name: string;
  workbook_id: string;
  workbook_filename: string;
  source_sheet: string;
  source_range: string | null;
  row_count: number;
  column_names: string[];
  rows: Array<Record<string, string>>;
  provenance_summary: string;
};

export type WorkbookEvidenceAsset = {
  workbook_id: string;
  file_kind: "xlsx" | "csv";
  file_name: string;
  file_sha256: string;
  sheet_count: number;
  sheets: WorkbookSheetSummary[];
  record_groups: WorkbookRecordGroup[];
  warnings: string[];
};

export type EvidenceAttachment = {
  id: string;
  pin_id: string;
  filename: string;
  mime: string;
  size: number;
  sha256: string;
  created_at: string;
  workbook_asset?: WorkbookEvidenceAsset | null;
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
  ts?: string;
  ruleId?: string;
  itemId?: string;
  note?: string;
  aoi_id?: string | null;
  aoi_fingerprint?: string;
  cited_ids: string[];
  location?: { lng: number; lat: number };
  attachments?: EvidenceAttachment[];
  pdd_document?: PddDocumentAsset | null;
  pdd_fragments?: PddFragment[];
  pdd_fragment_links?: PddFragmentLink[];
  stac_item_ids?: string[];
  stac_run_id?: string;
  created_at: string;
};

export type VerificationSnapshot = {
  stacItemsJson?: { items: unknown[] };
};

export type ProofMapState = {
  aoi: AOI | null;
  evidence_pins: EvidencePin[];
};
