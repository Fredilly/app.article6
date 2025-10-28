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

export type ManifestLoadResult = {
  entries: ManifestEntry[];
  source: "remote" | "static";
  fetchedAt: string;
  error?: string;
};

async function loadRemoteManifest(
  manifestEntries: ManifestEntry[],
  options: { rawQuery: string; showAll: boolean },
): Promise<ManifestLoadResult> {
  const engineUrl = resolveEngineEndpoint();
  const manifestUrl = new URL(engineUrl);
  const normalizedPath = manifestUrl.pathname.replace(/\/$/, "");
  manifestUrl.pathname = normalizedPath.endsWith("/query")
    ? `${normalizedPath.slice(0, -6)}/manifest`
    : `${normalizedPath}/manifest`;

  if (options.showAll) {
    manifestUrl.searchParams.set("all", "1");
  } else if (options.rawQuery) {
    manifestUrl.searchParams.set("q", options.rawQuery);
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
  return {
    entries: remoteEntries.map(entry =>
      coerceManifestEntry(entry as RemoteManifestEntry, manifestIndex),
    ),
    source: "remote",
    fetchedAt: new Date().toISOString(),
  };
}

function buildStaticResult(
  manifestEntries: ManifestEntry[],
  options: { rawQuery: string; showAll: boolean },
  error?: string,
): ManifestLoadResult {
  return {
    entries: filterEntries(manifestEntries, options.rawQuery, options.showAll),
    source: "static",
    fetchedAt: new Date().toISOString(),
    error,
  };
}

export async function loadManifestWithMeta(
  options: ManifestLoadOptions = {},
): Promise<ManifestLoadResult> {
  const rawQuery = options.rawQuery?.trim() ?? "";
  const showAll = options.showAll ?? rawQuery.length === 0;
  const manifestEntries = await loadManifestEntries();

  if (resolveEngineMode() === "remote") {
    try {
      return await loadRemoteManifest(manifestEntries, { rawQuery, showAll });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("[manifest] Remote manifest unavailable, using static dataset:", message);
      return buildStaticResult(manifestEntries, { rawQuery, showAll }, message);
    }
  }

  return buildStaticResult(manifestEntries, { rawQuery, showAll });
}

export async function loadManifestAll(
  options: ManifestLoadOptions = {},
): Promise<ManifestEntry[]> {
  const result = await loadManifestWithMeta(options);
  return result.entries;
}
