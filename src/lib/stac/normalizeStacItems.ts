export type StacItemLike = {
  id?: string;
  bbox?: unknown;
  geometry?: unknown;
  cloud_cover?: unknown;
  properties?: Record<string, unknown>;
  assets?: Record<string, unknown>;
  links?: unknown;
  datetime?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseBbox(value: unknown): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length < 4) return null;
  const minLng = asNumber(value[0]);
  const minLat = asNumber(value[1]);
  const maxLng = asNumber(value[2]);
  const maxLat = asNumber(value[3]);
  if (minLng == null || minLat == null || maxLng == null || maxLat == null) return null;
  return [minLng, minLat, maxLng, maxLat];
}

function polygonFromBbox(bbox: [number, number, number, number]): GeoJSON.Polygon {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return {
    type: "Polygon",
    coordinates: [[[minLng, minLat], [minLng, maxLat], [maxLng, maxLat], [maxLng, minLat], [minLng, minLat]]],
  };
}

function normalizeStacItemFromFeature(feature: GeoJSON.Feature): StacItemLike & { id: string } {
  const props = isRecord(feature.properties) ? feature.properties : {};
  const featureId = typeof feature.id === "string" ? feature.id : typeof feature.id === "number" ? String(feature.id) : null;
  const id = asString(props.id) ?? featureId ?? "unknown";
  const bbox = (feature as unknown as { bbox?: unknown }).bbox;
  return {
    id,
    bbox,
    geometry: feature.geometry,
    cloud_cover: props["eo:cloud_cover"],
    properties: props,
    assets: isRecord(props.assets) ? (props.assets as Record<string, unknown>) : undefined,
    links: props.links,
    datetime: asString(props.datetime),
  };
}

function normalizeStacItemFromItem(item: unknown): (StacItemLike & { id: string }) | null {
  if (!isRecord(item)) return null;
  const properties = isRecord(item.properties) ? item.properties : {};
  const id = asString(item.id) ?? asString(properties.id) ?? null;
  if (!id) return null;
  return {
    id,
    bbox: item.bbox,
    geometry: item.geometry,
    cloud_cover: item.cloud_cover ?? properties["eo:cloud_cover"],
    properties,
    assets: isRecord(item.assets) ? (item.assets as Record<string, unknown>) : undefined,
    links: item.links,
    datetime: asString(properties.datetime) ?? asString(item.datetime),
  };
}

function itemToFeature(item: StacItemLike & { id: string }): GeoJSON.Feature<GeoJSON.Geometry> | null {
  const properties: Record<string, unknown> = {
    ...(isRecord(item.properties) ? item.properties : {}),
    id: item.id,
  };

  const datetime = asString(properties.datetime) ?? asString(item.datetime);
  if (datetime) properties.datetime = datetime;

  const cloudCover = asNumber(properties["eo:cloud_cover"]) ?? asNumber(item.cloud_cover);
  if (cloudCover != null) properties["eo:cloud_cover"] = cloudCover;

  if (item.links != null) properties.links = item.links;
  if (item.assets != null) properties.assets = item.assets;

  let geometry: GeoJSON.Geometry | null = null;

  if (item.geometry && isRecord(item.geometry) && typeof item.geometry.type === "string") {
    const type = String(item.geometry.type);
    if (type === "Polygon" || type === "MultiPolygon" || type === "Point") {
      geometry = item.geometry as unknown as GeoJSON.Geometry;
    }
  }

  if (!geometry) {
    const bbox = parseBbox(item.bbox);
    if (bbox) geometry = polygonFromBbox(bbox);
  }

  if (!geometry) return null;

  return {
    type: "Feature",
    id: item.id,
    properties,
    geometry,
  };
}

export default function normalizeStacItems(input: unknown): {
  featureCollection: GeoJSON.FeatureCollection;
  itemsById: Record<string, StacItemLike & { id: string }>;
} {
  const itemsById: Record<string, StacItemLike & { id: string }> = {};
  const features: GeoJSON.Feature[] = [];

  try {
    if (isRecord(input) && input.type === "FeatureCollection" && Array.isArray(input.features)) {
      for (const rawFeature of input.features) {
        if (!isRecord(rawFeature) || rawFeature.type !== "Feature") continue;
        const feature = rawFeature as unknown as GeoJSON.Feature;
        const item = normalizeStacItemFromFeature(feature);
        itemsById[item.id] = item;

        const geoType = feature.geometry && typeof feature.geometry.type === "string" ? feature.geometry.type : null;
        if (geoType === "Polygon" || geoType === "MultiPolygon" || geoType === "Point") {
          const props = isRecord(feature.properties) ? feature.properties : {};
          const normalizedProps: Record<string, unknown> = { ...props, id: item.id };
          if (item.links != null) normalizedProps.links = item.links;
          if (item.assets != null) normalizedProps.assets = item.assets;
          features.push({ ...feature, id: item.id, properties: normalizedProps });
        } else {
          const bbox = parseBbox((feature as unknown as { bbox?: unknown }).bbox);
          if (bbox) {
            const derived = itemToFeature({ ...item, bbox });
            if (derived) features.push(derived);
          }
        }
      }
      return { featureCollection: { type: "FeatureCollection", features }, itemsById };
    }

    if (isRecord(input) && Array.isArray(input.items)) {
      for (const raw of input.items as unknown[]) {
        const item = normalizeStacItemFromItem(raw);
        if (!item) continue;
        itemsById[item.id] = item;
        const feature = itemToFeature(item);
        if (feature) features.push(feature);
      }
      return { featureCollection: { type: "FeatureCollection", features }, itemsById };
    }
  } catch {
    // fallthrough
  }

  return { featureCollection: { type: "FeatureCollection", features: [] }, itemsById: {} };
}
