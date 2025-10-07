export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { runDemoAdapter } from "@/lib/engine/demo";
import type { QueryResponse } from "@/lib/engine/types";
import { buildEngineHeaders, resolveEngineEndpoint, resolveEngineMode } from "@/lib/engine/config";
import {
  buildManifestIndex,
  enrichResults,
  loadManifestEntries,
  type RemoteManifestEntry,
} from "@/lib/manifest/cards";
import { withMetrics } from "@/lib/metrics";

type QueryRequest = { query?: string };

async function enrichWithManifest(payload: unknown) {
  const manifestEntries = await loadManifestEntries();
  const manifestIndex = buildManifestIndex(manifestEntries);

  const base = payload && typeof payload === "object" ? { ...(payload as Record<string, unknown>) } : {};
  const rawResults = Array.isArray((base as { results?: unknown[] }).results)
    ? (base as { results: unknown[] }).results
    : Array.isArray((base as { rules?: unknown[] }).rules)
    ? (base as { rules: unknown[] }).rules
    : Array.isArray(payload)
    ? (payload as unknown[])
    : null;

  if (rawResults) {
    base.results = enrichResults(rawResults as RemoteManifestEntry[], manifestIndex);
  } else if (!("results" in base)) {
    base.results = [];
  }

  return base;
}

async function forwardToEngine(query: string) {
  if (resolveEngineMode() === "demo") {
    const payload = await runDemoAdapter(query);
    const enriched = await enrichWithManifest(payload);
    return NextResponse.json(enriched satisfies QueryResponse);
  }

  const engineUrl = resolveEngineEndpoint();
  const res = await fetch(engineUrl, {
    method: "POST",
    headers: buildEngineHeaders(),
    body: JSON.stringify({ query }),
    cache: "no-store",
  }).catch((error: unknown) => {
    throw new Error(`Failed to reach engine: ${error instanceof Error ? error.message : String(error)}`);
  });

  const raw = await res.text();
  let parsed: unknown = undefined;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`Invalid engine response JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!res.ok) {
    const payload = parsed && typeof parsed === "object" ? parsed : { error: raw || `Engine HTTP ${res.status}` };
    return NextResponse.json(payload, { status: res.status });
  }

  const enriched = await enrichWithManifest(parsed ?? {});
  return NextResponse.json(enriched satisfies QueryResponse);
}

async function handlePost(req: Request) {
  const { query }: QueryRequest = await req.json().catch(() => ({}));
  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "Missing required field: query" }, { status: 400 });
  }

  try {
    return await forwardToEngine(query);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

async function handleGet(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get("text") || url.searchParams.get("query") || "";
  if (!query) {
    return NextResponse.json({ error: "Missing query. Provide ?text=... or ?query=..." }, { status: 400 });
  }

  try {
    return await forwardToEngine(query);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export const POST = withMetrics("api/query:POST", handlePost);
export const GET = withMetrics("api/query:GET", handleGet);
