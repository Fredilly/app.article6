export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";

type StacItemSummary = {
  id: string;
  datetime?: string;
  collection?: string;
  links?: Array<{ rel?: string; href?: string; type?: string }>;
  assets?: Record<string, { href?: string; type?: string }>;
};

function requireEnv(name: string): string | null {
  const value = process.env[name];
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim();
}

function requireIntEnv(name: string, fallback: number): number {
  const raw = requireEnv(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/g, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function newRequestId(): string {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `req_${nowIso()}_${Math.random().toString(16).slice(2)}`;
}

type PolygonLike =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function bboxFromGeometry(geometry: PolygonLike): [number, number, number, number] {
  const points: Array<[number, number]> = [];
  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates) {
      for (const pt of ring) points.push([pt[0], pt[1]]);
    }
  } else {
    for (const poly of geometry.coordinates) {
      for (const ring of poly) {
        for (const pt of ring) points.push([pt[0], pt[1]]);
      }
    }
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return [0, 0, 0, 0];
  }
  return [minX, minY, maxX, maxY];
}

function extractPolygonGeometry(value: unknown): PolygonLike | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const type = typeof record.type === "string" ? record.type : "";
  if (type === "Polygon" || type === "MultiPolygon") {
    return record as unknown as PolygonLike;
  }
  if (type === "Feature") {
    const geom = record.geometry;
    return extractPolygonGeometry(geom);
  }
  return null;
}

const SearchSchema = z.object({
  aoi_geojson: z.unknown(),
  bbox: z.array(z.number()).length(4).optional(),
  datetime: z.string().optional(),
  collections: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(100).optional(),
});

export async function POST(req: Request) {
  const request_id = newRequestId();
  const received_at = nowIso();

  const parsedBody = SearchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsedBody.success) {
    return NextResponse.json({ ok: false, code: "BAD_REQUEST", request_id, message: "Invalid request payload." }, { status: 400 });
  }

  const geometry = extractPolygonGeometry(parsedBody.data.aoi_geojson);
  if (!geometry) {
    return NextResponse.json(
      { ok: false, code: "BAD_REQUEST", request_id, message: "AOI must be a Polygon or MultiPolygon GeoJSON." },
      { status: 400 },
    );
  }

  const stacBaseUrl = requireEnv("STAC_BASE_URL") ?? "https://earth-search.aws.element84.com/v1";
  const timeoutMs = requireIntEnv("STAC_TIMEOUT_MS", 15_000);
  const collectionsDefault = (requireEnv("STAC_DEFAULT_COLLECTIONS") ?? "sentinel-2-l2a")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  const collections = parsedBody.data.collections?.length ? parsedBody.data.collections : collectionsDefault;
  const bbox = parsedBody.data.bbox?.length === 4 && parsedBody.data.bbox.every(isFiniteNumber) ? (parsedBody.data.bbox as [number, number, number, number]) : bboxFromGeometry(geometry);
  const limit = parsedBody.data.limit ?? 10;
  const datetime = parsedBody.data.datetime;

  const endpoint = joinUrl(stacBaseUrl, "/search");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let upstream: Response;
  try {
    upstream = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/geo+json,application/json" },
      body: JSON.stringify({
        collections,
        intersects: geometry,
        bbox,
        datetime,
        limit,
      }),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeout);
    return NextResponse.json(
      { ok: false, code: "STAC_UNAVAILABLE", request_id, message: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }

  const raw = await upstream.text();
  let json: unknown = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    return NextResponse.json({ ok: false, code: "STAC_UNAVAILABLE", request_id, message: "Invalid STAC response." }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { ok: false, code: "STAC_UPSTREAM_ERROR", request_id, message: `STAC HTTP ${upstream.status}`, upstream: json },
      { status: 502 },
    );
  }

  const features =
    json && typeof json === "object" && Array.isArray((json as Record<string, unknown>).features)
      ? ((json as Record<string, unknown>).features as unknown[])
      : [];

  const items: StacItemSummary[] = [];
  for (const feature of features) {
    if (!feature || typeof feature !== "object") continue;
    const record = feature as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : "";
    if (!id) continue;
    const collection = typeof record.collection === "string" ? record.collection : undefined;
    const props = record.properties && typeof record.properties === "object" ? (record.properties as Record<string, unknown>) : undefined;
    const datetimeValue = props && typeof props.datetime === "string" ? props.datetime : undefined;
    const links = Array.isArray(record.links)
      ? (record.links as unknown[])
          .filter((v) => v && typeof v === "object")
          .map((v) => {
            const r = v as Record<string, unknown>;
            return { rel: typeof r.rel === "string" ? r.rel : undefined, href: typeof r.href === "string" ? r.href : undefined, type: typeof r.type === "string" ? r.type : undefined };
          })
      : undefined;
    const assets = record.assets && typeof record.assets === "object" ? (record.assets as Record<string, { href?: string; type?: string }>) : undefined;
    items.push({ id, datetime: datetimeValue, collection, links, assets });
  }

  return NextResponse.json({
    ok: true,
    mode: "real",
    request_id,
    provenance: {
      provider: "earth-search",
      stac_base_url: stacBaseUrl,
      endpoint,
      received_at,
      collections,
      datetime,
      bbox,
      limit,
    },
    items,
    request: { aoi_geojson_type: geometry.type, bbox, datetime, collections, limit },
  });
}

