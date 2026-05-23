import type { AOI, AoiFeature, AoiFeatureRole } from "@/lib/proofMap/types";

export type AoiParseResult =
  | { ok: true; aoi: AOI }
  | { ok: false; error: string };

export const AOI_FEATURE_ROLE_OPTIONS: AoiFeatureRole[] = [
  "primary_project_area",
  "project_zone",
  "leakage_belt",
  "reference_region",
  "excluded_area",
  "stratum",
  "monitoring_plot",
  "canal_block",
  "dipwell",
  "subsidence_pole",
  "other",
];

function nowIso(): string {
  return new Date().toISOString();
}

type AoiSourceInfo = {
  sourceType: "FeatureCollection" | "Feature" | "Geometry";
  featureCount: number;
};

function isGeometry(value: unknown): value is GeoJSON.Geometry {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.type === "string" && Array.isArray(record.coordinates);
}

function isFeature(value: unknown): value is GeoJSON.Feature<GeoJSON.Geometry> {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.type === "Feature" && isGeometry(record.geometry);
}

function isPolygonGeometry(
  geometry: GeoJSON.Geometry | null | undefined,
): geometry is GeoJSON.Polygon | GeoJSON.MultiPolygon {
  return Boolean(geometry && (geometry.type === "Polygon" || geometry.type === "MultiPolygon"));
}

function asFeatureCollection(
  value: unknown,
): { features: GeoJSON.Feature<GeoJSON.Geometry>[]; source: AoiSourceInfo } | null {
  if (isFeature(value)) {
    return { features: [value], source: { sourceType: "Feature", featureCount: 1 } };
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (isGeometry(value)) {
    return {
      features: [
        {
          type: "Feature",
          geometry: value,
          properties: {},
        },
      ],
      source: { sourceType: "Geometry", featureCount: 1 },
    };
  }
  if (record.type !== "FeatureCollection" || !Array.isArray(record.features) || !record.features.length) {
    return null;
  }
  const features = record.features.filter(isFeature);
  if (!features.length || features.length !== record.features.length) return null;
  return {
    features,
    source: { sourceType: "FeatureCollection", featureCount: features.length },
  };
}

function walkCoordinates(value: unknown, fn: (lng: number, lat: number) => void) {
  if (!Array.isArray(value)) return;
  if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
    fn(value[0], value[1]);
    return;
  }
  for (const child of value) walkCoordinates(child, fn);
}

function bboxForGeometry(geometry: GeoJSON.Geometry): [number, number, number, number] | null {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  walkCoordinates((geometry as { coordinates?: unknown }).coordinates, (lng, lat) => {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  });

  if (
    !Number.isFinite(minLng) ||
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLng) ||
    !Number.isFinite(maxLat)
  ) {
    return null;
  }
  return [minLng, minLat, maxLng, maxLat];
}

function unionBbox(values: Array<[number, number, number, number] | null | undefined>): [number, number, number, number] {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const bbox of values) {
    if (!bbox) continue;
    minLng = Math.min(minLng, bbox[0]);
    minLat = Math.min(minLat, bbox[1]);
    maxLng = Math.max(maxLng, bbox[2]);
    maxLat = Math.max(maxLat, bbox[3]);
  }
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

function areaKm2ForPolygon(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): number {
  const toMeters = (lng: number, lat: number, meanLat: number) => {
    const rad = (meanLat * Math.PI) / 180;
    const mPerDegLat = 111_320;
    const mPerDegLng = 111_320 * Math.cos(rad);
    return { x: lng * mPerDegLng, y: lat * mPerDegLat };
  };

  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
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

function featureName(feature: GeoJSON.Feature<GeoJSON.Geometry>, index: number, fallback: string): string {
  const props = feature.properties && typeof feature.properties === "object"
    ? feature.properties as Record<string, unknown>
    : null;
  const explicit = [
    props?.name,
    props?.title,
    props?.label,
    props?.feature_name,
    props?.id,
  ].find((value) => typeof value === "string" && value.trim());
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim();
  return index === 0 ? fallback : `Feature ${index + 1}`;
}

function normalizeFeatureId(name: string, index: number): string {
  const safe = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return safe ? `aoi-feature-${index + 1}-${safe}` : `aoi-feature-${index + 1}`;
}

function primaryFeatureFromAoi(aoi: AOI): AoiFeature | null {
  const features = aoi.features ?? [];
  const selectedId = aoi.primary_feature_id?.trim() ?? "";
  const byToggle = features.find((feature) => feature.use_for_satellite_search);
  const explicit = selectedId ? features.find((feature) => feature.id === selectedId) : null;
  const candidate = explicit ?? byToggle ?? null;
  if (!candidate || !isPolygonGeometry(candidate.geojson.geometry)) return null;
  return candidate;
}

function buildAoiFromFeatures(input: {
  id?: string;
  name: string;
  features: AoiFeature[];
  source: AoiSourceInfo;
  createdAt?: string;
  previousFingerprint?: string | null;
}): AOI {
  const createdAt = input.createdAt ?? nowIso();
  const primary = (() => {
    const selected = input.features.find((feature) => feature.use_for_satellite_search);
    if (!selected) return null;
    if (!isPolygonGeometry(selected.geojson.geometry)) return null;
    return selected;
  })();
  return {
    id: input.id ?? `aoi_${createdAt}`,
    name: input.name.trim() || "Area",
    geojson: primary && isPolygonGeometry(primary.geojson.geometry)
      ? {
          ...primary.geojson,
          geometry: primary.geojson.geometry,
        } as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>
      : null,
    bbox: primary?.bbox ?? unionBbox(input.features.map((feature) => feature.bbox)),
    area_km2: primary?.area_km2 ?? 0,
    aoi_source_type: input.source.sourceType,
    aoi_source_feature_count: input.source.featureCount,
    aoi_policy: input.source.featureCount > 1 ? "select_primary" : "reject_multi",
    aoi_fingerprint: primary ? input.previousFingerprint?.trim() || undefined : undefined,
    primary_feature_id: primary?.id ?? null,
    feature_collection: {
      type: "FeatureCollection",
      features: input.features.map((feature) => feature.geojson),
    },
    features: input.features.map((feature) => ({
      ...feature,
      geojson: structuredClone(feature.geojson),
      bbox: feature.bbox ? [...feature.bbox] as [number, number, number, number] : null,
    })),
    created_at: createdAt,
  };
}

function roleForAutoSelection(input: { polygonCount: number; isPolygon: boolean }): AoiFeatureRole {
  if (input.isPolygon && input.polygonCount === 1) return "primary_project_area";
  return "other";
}

export function parseAoiGeoJson(input: unknown, nameHint?: string): AoiParseResult {
  const normalized = asFeatureCollection(input);
  if (!normalized) {
    return {
      ok: false,
      error: "Area must be GeoJSON geometry, Feature, or FeatureCollection.",
    };
  }

  const fallbackName = (nameHint ?? "Area").trim() || "Area";
  const polygonCount = normalized.features.filter((feature) => isPolygonGeometry(feature.geometry)).length;
  if (polygonCount === 0) {
    return {
      ok: false,
      error: "Area must include at least one Polygon or MultiPolygon feature.",
    };
  }

  const features: AoiFeature[] = normalized.features.map((feature, index) => {
    const isPolygon = isPolygonGeometry(feature.geometry);
    const bbox = bboxForGeometry(feature.geometry);
    const role = roleForAutoSelection({ polygonCount, isPolygon });
    const useForSatelliteSearch = role === "primary_project_area";
    const area_km2 = (() => {
      if (!isPolygonGeometry(feature.geometry)) return null;
      return Math.max(0, areaKm2ForPolygon(feature.geometry));
    })();
    return {
      id: normalizeFeatureId(featureName(feature, index, fallbackName), index),
      name: featureName(feature, index, fallbackName),
      role,
      geometry_type: feature.geometry.type,
      area_km2,
      bbox,
      use_for_satellite_search: useForSatelliteSearch,
      geojson: structuredClone(feature),
    };
  });

  if (!features.length) {
    return { ok: false, error: "Area file did not contain any valid GeoJSON features." };
  }

  return {
    ok: true,
    aoi: buildAoiFromFeatures({
      name: fallbackName,
      features,
      source: normalized.source,
    }),
  };
}

export function updateAoiFeatureRole(aoi: AOI, featureId: string, role: AoiFeatureRole): AOI {
  const features = (aoi.features ?? []).map((feature) => {
    if (feature.id !== featureId) {
      if (role === "primary_project_area" && feature.role === "primary_project_area" && feature.use_for_satellite_search) {
        return { ...feature, use_for_satellite_search: false };
      }
      return feature;
    }
    const nextUseForSatelliteSearch =
      role === "primary_project_area" ? feature.use_for_satellite_search : false;
    return {
      ...feature,
      role,
      use_for_satellite_search: nextUseForSatelliteSearch,
    };
  });

  return buildAoiFromFeatures({
    id: aoi.id,
    name: aoi.name,
    features,
    source: {
      sourceType: aoi.aoi_source_type ?? "FeatureCollection",
      featureCount: aoi.aoi_source_feature_count ?? features.length,
    },
    createdAt: aoi.created_at,
  });
}

export function setAoiPrimaryFeature(aoi: AOI, featureId: string, enabled: boolean): AOI {
  const features = (aoi.features ?? []).map((feature) => {
    const isTarget = feature.id === featureId;
    const shouldEnable = enabled && isTarget;
    const nextRole = shouldEnable ? "primary_project_area" : feature.role;
    return {
      ...feature,
      role: nextRole,
      use_for_satellite_search: shouldEnable ? true : false,
    };
  });
  return buildAoiFromFeatures({
    id: aoi.id,
    name: aoi.name,
    features,
    source: {
      sourceType: aoi.aoi_source_type ?? "FeatureCollection",
      featureCount: aoi.aoi_source_feature_count ?? features.length,
    },
    createdAt: aoi.created_at,
  });
}

export function ensurePrimaryProjectAreaSelected(aoi: AOI): boolean {
  return Boolean(primaryFeatureFromAoi(aoi));
}

export function activeAoiSearchFeature(aoi: AOI | null): GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null {
  if (!aoi) return null;
  if (aoi.geojson && isPolygonGeometry(aoi.geojson.geometry)) return aoi.geojson;
  const primary = primaryFeatureFromAoi(aoi);
  if (!primary || !isPolygonGeometry(primary.geojson.geometry)) return null;
  return {
    ...primary.geojson,
    geometry: primary.geojson.geometry,
  } as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
}
