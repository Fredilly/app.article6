/**
 * Extract STAC support facts from items for display in the review panel.
 * These are support facts, not auto-verification.
 */

export type StacSupportFact = {
  id: string;
  datetime?: string;
  cloudCover?: number | null;
  collection?: string;
  bbox?: [number, number, number, number];
};

export type StacSupportSummary = {
  sceneCount: number;
  dateRange: { earliest: string; latest: string } | null;
  avgCloudCover: number | null;
  collections: string[];
  facts: StacSupportFact[];
};

export function extractStacSupportFacts(
  items: Array<{
    id: string;
    datetime?: string;
    cloud_cover?: number | null;
    collection?: string;
    bbox?: [number, number, number, number];
  }>,
  maxItems = 10,
): StacSupportSummary {
  if (!items || items.length === 0) {
    return {
      sceneCount: 0,
      dateRange: null,
      avgCloudCover: null,
      collections: [],
      facts: [],
    };
  }

  const facts: StacSupportFact[] = items.slice(0, maxItems).map((item) => ({
    id: item.id,
    datetime: item.datetime,
    cloudCover: typeof item.cloud_cover === "number" ? item.cloud_cover : null,
    collection: item.collection,
    bbox: item.bbox,
  }));

  // Date range — parse instants so mixed-offset timestamps sort correctly.
  // Unparsable datetimes (NaN) are ignored to avoid corrupting the range.
  let earliestInstant = Infinity;
  let latestInstant = -Infinity;
  let earliestStr: string | null = null;
  let latestStr: string | null = null;

  for (const item of items) {
    const dt = item.datetime;
    if (!dt) continue;
    const ms = Date.parse(dt);
    if (!Number.isFinite(ms)) continue;
    if (ms < earliestInstant) {
      earliestInstant = ms;
      earliestStr = dt;
    }
    if (ms > latestInstant) {
      latestInstant = ms;
      latestStr = dt;
    }
  }

  const dateRange = earliestStr && latestStr
    ? { earliest: earliestStr, latest: latestStr }
    : null;

  // Average cloud cover
  const cloudCovers = items
    .map((item) => item.cloud_cover)
    .filter((c): c is number => typeof c === "number" && Number.isFinite(c));

  const avgCloudCover = cloudCovers.length > 0
    ? Math.round(cloudCovers.reduce((a, b) => a + b, 0) / cloudCovers.length * 10) / 10
    : null;

  // Unique collections
  const collections = [...new Set(items.map((item) => item.collection).filter(Boolean))] as string[];

  return {
    sceneCount: items.length,
    dateRange,
    avgCloudCover,
    collections,
    facts,
  };
}
