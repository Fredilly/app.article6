import type { VerificationRun } from "@/lib/proofMap/types";
import normalizeStacItems from "@/lib/stac/normalizeStacItems";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFeatureCollection(value: unknown): value is GeoJSON.FeatureCollection {
  return isRecord(value) && value.type === "FeatureCollection" && Array.isArray(value.features);
}

function emptyFeatureCollection(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function toJsonSafe(value: unknown): unknown {
  const seen = new WeakSet<object>();

  const walk = (input: unknown): unknown => {
    if (input === null) return null;
    if (typeof input === "string" || typeof input === "number" || typeof input === "boolean") return input;
    if (typeof input === "bigint") return input.toString();
    if (typeof input === "undefined" || typeof input === "function" || typeof input === "symbol") return null;
    if (Array.isArray(input)) return input.map((item) => walk(item));
    if (!isRecord(input)) return String(input);

    if (seen.has(input)) return "[Circular]";
    seen.add(input);

    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(input)) out[key] = walk(item);
    return out;
  };

  return walk(value);
}

function itemsFromFeatureCollection(fc: GeoJSON.FeatureCollection): Array<Record<string, unknown>> {
  return (fc.features ?? []).map((feature) => {
    const props = isRecord(feature.properties) ? feature.properties : {};
    const id = typeof props.id === "string" ? props.id : typeof feature.id === "string" ? feature.id : "";
    const datetime = typeof props.datetime === "string" ? props.datetime : "";
    const cloudCover = props["eo:cloud_cover"];
    const links = props.links;
    const assets = props.assets;
    const bbox = (feature as unknown as { bbox?: unknown }).bbox;
    return {
      id,
      datetime: datetime || undefined,
      cloud_cover: cloudCover,
      links,
      assets,
      bbox,
      geometry: feature.geometry,
    };
  });
}

export default function extractStacArtifacts(input: {
  runsForAoi: VerificationRun[];
}): {
  stac_run_id: string;
  stac_status: string;
  stac_executed_at: string;
  stac_item_count: number;
  stac_items_json: unknown;
  stac_evidence_geojson: GeoJSON.FeatureCollection;
} {
  const candidates = (input.runsForAoi ?? []).filter((run) => run.provider === "stac" && run.status === "ok");
  candidates.sort((a, b) => {
    const aTime = Date.parse(a.ended_at ?? a.created_at);
    const bTime = Date.parse(b.ended_at ?? b.created_at);
    const aScore = Number.isFinite(aTime) ? aTime : 0;
    const bScore = Number.isFinite(bTime) ? bTime : 0;
    return bScore - aScore;
  });
  const run = candidates[0] ?? null;
  if (!run) {
    return {
      stac_run_id: "none",
      stac_status: "none",
      stac_executed_at: "none",
      stac_item_count: 0,
      stac_items_json: { items: [] },
      stac_evidence_geojson: emptyFeatureCollection(),
    };
  }

  const executedAt = (run.ended_at ?? run.created_at) || "none";
  const runId = run.id || "none";

  const raw = run.result_json;
  if (isFeatureCollection(raw)) {
    const itemCount = raw.features?.length ?? 0;
    return {
      stac_run_id: runId,
      stac_status: run.status || "ok",
      stac_executed_at: executedAt,
      stac_item_count: itemCount,
      stac_items_json: toJsonSafe(raw),
      stac_evidence_geojson: raw,
    };
  }

  const normalized = normalizeStacItems(raw);
  const evidenceGeojson = normalized.featureCollection?.features?.length ? normalized.featureCollection : emptyFeatureCollection();

  if (isRecord(raw) && Array.isArray(raw.items)) {
    const itemsCount = raw.items.length;
    return {
      stac_run_id: runId,
      stac_status: run.status || "ok",
      stac_executed_at: executedAt,
      stac_item_count: itemsCount,
      stac_items_json: toJsonSafe(raw),
      stac_evidence_geojson: evidenceGeojson,
    };
  }

  const items = itemsFromFeatureCollection(evidenceGeojson);
  return {
    stac_run_id: runId,
    stac_status: run.status || "ok",
    stac_executed_at: executedAt,
    stac_item_count: items.length,
    stac_items_json: { items },
    stac_evidence_geojson: evidenceGeojson,
  };
}
