import { NextResponse } from "next/server";
import { buildEngineHeaders, resolveEngineEndpoint, resolveEngineMode } from "@/lib/engine/config";
import {
  buildManifestIndex,
  coerceManifestEntry,
  filterEntries,
  loadManifestEntries,
  type RemoteManifestEntry,
} from "@/lib/manifest/cards";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawQuery = (url.searchParams.get("q") ?? "").trim();
  const allParam = url.searchParams.get("all") ?? "";
  const showAll = !rawQuery || ["1", "true", "yes"].includes(allParam.toLowerCase());

  // Always load local manifest for enrichment/fallback
  const manifestEntries = await loadManifestEntries();

  if (resolveEngineMode() === "remote") {
    try {
      // Build /manifest URL from engine endpoint (handles both .../query and base)
      const engineUrl = resolveEngineEndpoint();
      const manifestUrl = new URL(engineUrl);
      const normalizedPath = manifestUrl.pathname.replace(/\/$/, "");
      manifestUrl.pathname = normalizedPath.endsWith("/query")
        ? `${normalizedPath.slice(0, -6)}/manifest`
        : `${normalizedPath}/manifest`;

      if (showAll) {
        manifestUrl.searchParams.set("all", "1");
      } else if (rawQuery) {
        manifestUrl.searchParams.set("q", rawQuery);
      }
      // Prefer card-like (human) view from the engine if supported
      manifestUrl.searchParams.set("view", "cards");

      const response = await fetch(manifestUrl, {
        method: "GET",
        headers: buildEngineHeaders(),
        cache: "no-store",
      }).catch((error) => {
        throw new Error(
          `Failed to reach engine manifest: ${error instanceof Error ? error.message : String(error)}`,
        );
      });

      const rawBody = await response.text();
      let parsedBody: unknown = null;
      if (rawBody) {
        try {
          parsedBody = JSON.parse(rawBody);
        } catch (error) {
          throw new Error(
            `Invalid engine manifest JSON: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      if (!response.ok) {
        throw new Error(`Engine manifest responded ${response.status}: ${rawBody || "no body"}`);
      }

      const remoteEntries = Array.isArray(parsedBody)
        ? parsedBody
        : parsedBody && typeof parsedBody === "object"
        ? (parsedBody as { results?: unknown[]; rules?: unknown[] }).results ??
          (parsedBody as { results?: unknown[]; rules?: unknown[] }).rules
        : undefined;

      if (!Array.isArray(remoteEntries)) {
        throw new Error("Engine manifest response missing rules array");
      }

      // Enrich with local (static) manifest when keys match; coerce otherwise
      const manifestIndex = buildManifestIndex(manifestEntries);
      const enriched = remoteEntries.map((e) =>
        coerceManifestEntry(e as RemoteManifestEntry, manifestIndex),
      );

      return NextResponse.json(enriched);
    } catch (error) {
      console.warn(
        "[manifest] Remote manifest unavailable, using static dataset:",
        error instanceof Error ? error.message : String(error),
      );
      // fall through to static
    }
  }

  const filtered = filterEntries(manifestEntries, rawQuery, showAll);
  return NextResponse.json(filtered);
}
