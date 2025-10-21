import { buildEngineHeaders, resolveEngineEndpoint, resolveEngineMode } from "@/lib/engine/config";
import {
  buildManifestIndex,
  coerceManifestEntry,
  filterEntries,
  loadManifestEntries,
  type ManifestEntry,
  type RemoteManifestEntry,
} from "@/lib/manifest/cards";

export type ManifestLoadOptions = {
  rawQuery?: string;
  showAll?: boolean;
};

export async function loadManifestAll(options: ManifestLoadOptions = {}): Promise<ManifestEntry[]> {
  const rawQuery = options.rawQuery?.trim() ?? "";
  const showAll = options.showAll ?? rawQuery.length === 0;

  // Always load static manifest for enrichment/fallback.
  const manifestEntries = await loadManifestEntries();

  if (resolveEngineMode() === "remote") {
    try {
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
      manifestUrl.searchParams.set("view", "cards");

      const response = await fetch(manifestUrl, {
        method: "GET",
        headers: buildEngineHeaders(),
        cache: "no-store",
      });

      const bodyText = await response.text();
      let parsedBody: unknown = null;
      if (bodyText) {
        try {
          parsedBody = JSON.parse(bodyText);
        } catch (error) {
          throw new Error(
            `Invalid engine manifest JSON: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      if (!response.ok) {
        throw new Error(`Engine manifest responded ${response.status}: ${bodyText || "no body"}`);
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

      const manifestIndex = buildManifestIndex(manifestEntries);
      return remoteEntries.map(entry =>
        coerceManifestEntry(entry as RemoteManifestEntry, manifestIndex),
      );
    } catch (error) {
      console.warn(
        "[manifest] Remote manifest unavailable, using static dataset:",
        error instanceof Error ? error.message : String(error),
      );
      // Fall through to static manifest below.
    }
  }

  return filterEntries(manifestEntries, rawQuery, showAll);
}

