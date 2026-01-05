function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidLngLat(lng: number, lat: number): boolean {
  return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
}

function normalizeBbox(value: unknown): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length < 4) return null;
  const minLng = value[0];
  const minLat = value[1];
  const maxLng = value[2];
  const maxLat = value[3];
  if (!isFiniteNumber(minLng) || !isFiniteNumber(minLat) || !isFiniteNumber(maxLng) || !isFiniteNumber(maxLat)) return null;
  if (minLng > maxLng || minLat > maxLat) return null;
  if (!isValidLngLat(minLng, minLat) || !isValidLngLat(maxLng, maxLat)) return null;
  return [minLng, minLat, maxLng, maxLat];
}

function extendBounds(bounds: [number, number, number, number] | null, lng: number, lat: number): [number, number, number, number] | null {
  if (!isFiniteNumber(lng) || !isFiniteNumber(lat)) return bounds;
  if (!isValidLngLat(lng, lat)) return bounds;
  if (!bounds) return [lng, lat, lng, lat];
  return [Math.min(bounds[0], lng), Math.min(bounds[1], lat), Math.max(bounds[2], lng), Math.max(bounds[3], lat)];
}

function walkCoordinates(value: unknown, bounds: [number, number, number, number] | null): [number, number, number, number] | null {
  if (!Array.isArray(value)) return bounds;
  if (value.length >= 2 && isFiniteNumber(value[0]) && isFiniteNumber(value[1])) {
    return extendBounds(bounds, value[0], value[1]);
  }
  for (const child of value) bounds = walkCoordinates(child, bounds);
  return bounds;
}

export default function getFeatureBbox(feature: unknown): [number, number, number, number] | null {
  if (!isRecord(feature)) return null;

  const bbox = normalizeBbox(feature.bbox);
  if (bbox) return bbox;

  const geom = feature.geometry;
  if (!isRecord(geom)) return null;
  const coords = geom.coordinates;
  const computed = walkCoordinates(coords, null);
  return computed ? normalizeBbox(computed) : null;
}

