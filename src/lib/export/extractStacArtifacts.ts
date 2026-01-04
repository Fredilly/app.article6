import type { VerificationRun } from "@/lib/proofMap/types";
import selectLatestStacRun from "@/lib/runs/selectLatestStacRun";
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
  runs: VerificationRun[];
  currentAoiFingerprint: string | null;
}): {
  itemsJson: unknown;
  evidenceGeojson: GeoJSON.FeatureCollection;
  runMeta: { id: string; status: string; executed_at: string };
} {
  const run = selectLatestStacRun({ runs: input.runs, aoiFingerprint: input.currentAoiFingerprint });
  if (!run) {
    return {
      itemsJson: { items: [] },
      evidenceGeojson: emptyFeatureCollection(),
      runMeta: { id: "none", status: "none", executed_at: "none" },
    };
  }

  const executedAt = (run.ended_at ?? run.created_at) || "none";
  const runMeta = { id: run.id || "none", status: run.status || "none", executed_at: executedAt };

  const raw = run.result_json;
  if (isFeatureCollection(raw)) {
    return {
      itemsJson: toJsonSafe(raw),
      evidenceGeojson: raw,
      runMeta,
    };
  }

  const normalized = normalizeStacItems(raw);
  const evidenceGeojson = normalized.featureCollection?.features?.length ? normalized.featureCollection : emptyFeatureCollection();

  if (isRecord(raw) && Array.isArray(raw.items)) {
    return { itemsJson: toJsonSafe(raw), evidenceGeojson, runMeta };
  }

  const items = itemsFromFeatureCollection(evidenceGeojson);
  return {
    itemsJson: { items },
    evidenceGeojson,
    runMeta,
  };
}
