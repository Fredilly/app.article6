type LngLat = [number, number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function collectCoords(value: unknown, coords: LngLat[]) {
  if (!value) return;
  if (Array.isArray(value)) {
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      coords.push([value[0], value[1]]);
      return;
    }
    for (const item of value) collectCoords(item, coords);
  }
}

function geometryFromGeoJson(input: unknown): unknown {
  if (!isRecord(input)) return null;
  if (input.type === "Feature") {
    const geom = isRecord(input.geometry) ? input.geometry : null;
    if (!geom || (geom.type !== "Polygon" && geom.type !== "MultiPolygon")) return null;
    return geom.coordinates;
  }
  if (input.type === "FeatureCollection" && Array.isArray(input.features)) {
    return input.features.map((feature) => {
      if (!isRecord(feature)) return null;
      const geom = isRecord(feature.geometry) ? feature.geometry : null;
      if (!geom || (geom.type !== "Polygon" && geom.type !== "MultiPolygon")) return null;
      return geom.coordinates;
    });
  }
  if (input.type === "Polygon" || input.type === "MultiPolygon") return input.coordinates;
  return null;
}

export function geojsonToLngLatBounds(geojson: unknown): [[number, number], [number, number]] {
  const geometry = geometryFromGeoJson(geojson);
  if (!geometry) {
    throw new Error("AOI GeoJSON must be a Feature, FeatureCollection, Polygon, or MultiPolygon.");
  }

  const coords: LngLat[] = [];
  collectCoords(geometry, coords);

  if (!coords.length) {
    throw new Error("AOI GeoJSON has no coordinate data.");
  }

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const [lng, lat] of coords) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }

  if (![minLng, minLat, maxLng, maxLat].every((v) => Number.isFinite(v))) {
    throw new Error("AOI GeoJSON bounds could not be computed.");
  }

  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}
