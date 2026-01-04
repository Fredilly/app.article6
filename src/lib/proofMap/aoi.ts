import type { AOI } from "@/lib/proofMap/types";

export type AoiParseResult =
  | { ok: true; aoi: AOI }
  | { ok: false; error: string };

function nowIso(): string {
  return new Date().toISOString();
}

function isPolygonFeature(
  value: unknown,
): value is GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (record.type !== "Feature") return false;
  const geometry = record.geometry;
  if (!geometry || typeof geometry !== "object") return false;
  const geom = geometry as Record<string, unknown>;
  return geom.type === "Polygon" || geom.type === "MultiPolygon";
}

function ensureFeature(
  value: unknown,
): GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null {
  if (isPolygonFeature(value)) return value;
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.type === "Polygon" || record.type === "MultiPolygon") {
    return {
      type: "Feature",
      geometry: record as unknown as GeoJSON.Polygon | GeoJSON.MultiPolygon,
      properties: {},
    };
  }
  if (record.type === "FeatureCollection" && Array.isArray(record.features) && record.features.length) {
    const first = record.features[0];
    return isPolygonFeature(first) ? first : null;
  }
  return null;
}

function bboxForFeature(
  feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
): [number, number, number, number] {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  const walk = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      const lng = value[0];
      const lat = value[1];
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
      return;
    }
    for (const child of value) walk(child);
  };

  walk(feature.geometry.coordinates);

  if (
    !Number.isFinite(minLng) ||
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLng) ||
    !Number.isFinite(maxLat)
  ) {
    return [0, 0, 0, 0];
  }
  return [minLng, minLat, maxLng, maxLat];
}

// Approximate area (km^2) using planar shoelace on lon/lat degrees projected to meters at mean latitude.
function areaKm2(feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>): number {
  const toMeters = (lng: number, lat: number, meanLat: number) => {
    const rad = (meanLat * Math.PI) / 180;
    const mPerDegLat = 111_320;
    const mPerDegLng = 111_320 * Math.cos(rad);
    return { x: lng * mPerDegLng, y: lat * mPerDegLat };
  };

  const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  let total = 0;

  for (const polygon of polygons) {
    const outer = polygon[0] ?? [];
    if (outer.length < 3) continue;
    const meanLat = outer.reduce((acc, c) => acc + (c[1] ?? 0), 0) / outer.length;
    let sum = 0;
    for (let i = 0; i < outer.length; i++) {
      const a = outer[i];
      const b = outer[(i + 1) % outer.length];
      const pa = toMeters(a[0], a[1], meanLat);
      const pb = toMeters(b[0], b[1], meanLat);
      sum += pa.x * pb.y - pb.x * pa.y;
    }
    total += Math.abs(sum) / 2;
  }

  return total / 1_000_000;
}

export function parseAoiGeoJson(input: unknown, nameHint?: string): AoiParseResult {
  const feature = ensureFeature(input);
  if (!feature) return { ok: false, error: "AOI must be a GeoJSON Polygon or MultiPolygon (or Feature/FeatureCollection containing one)." };

  if (feature.geometry.type !== "Polygon" && feature.geometry.type !== "MultiPolygon") {
    return { ok: false, error: "AOI geometry must be Polygon or MultiPolygon." };
  }

  const bbox = bboxForFeature(feature);
  const area_km2 = areaKm2(feature);
  const name = (nameHint ?? "AOI").trim() || "AOI";

  const aoi: AOI = {
    id: `aoi_${nowIso()}`,
    name,
    geojson: feature,
    bbox,
    area_km2: Number.isFinite(area_km2) ? Math.max(0, area_km2) : 0,
    created_at: nowIso(),
  };
  return { ok: true, aoi };
}
