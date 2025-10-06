import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  buildEngineHeaders,
  resolveEngineEndpoint,
  resolveEngineMode,
} from "@/lib/engine/config";

export const runtime = "nodejs";

async function loadManifestEntries(): Promise<unknown[]> {
  try {
    const filePath = path.join(process.cwd(), "public", "manifest", "index.json");
    const contents = await readFile(filePath, "utf8");
    const parsed = JSON.parse(contents);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawQuery = (url.searchParams.get("q") ?? "").trim();
  const showAll = url.searchParams.get("all") === "1" || rawQuery.length === 0;

  if (resolveEngineMode() === "remote") {
    try {
      const engineUrl = resolveEngineEndpoint();
      const manifestUrl = new URL("./manifest", engineUrl);
      if (showAll) {
        manifestUrl.searchParams.set("all", "1");
      } else {
        manifestUrl.searchParams.set("q", rawQuery);
      }

      const response = await fetch(manifestUrl, {
        method: "GET",
        headers: buildEngineHeaders(),
        cache: "no-store",
      }).catch((error) => {
        throw new Error(
          `Failed to reach engine manifest: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });

      const rawBody = await response.text();
      let parsedBody: unknown = null;
      if (rawBody) {
        try {
          parsedBody = JSON.parse(rawBody);
        } catch (error) {
          throw new Error(
            `Invalid engine manifest JSON: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }

      if (!response.ok) {
        throw new Error(
          `Engine manifest responded ${response.status}: ${rawBody || "no body"}`,
        );
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

      return NextResponse.json({ results: remoteEntries });
    } catch (error) {
      console.warn(
        "[manifest] Falling back to static manifest:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  const entries = await loadManifestEntries();
  if (showAll) {
    return NextResponse.json({ results: entries });
  }

  const normalizedQuery = rawQuery.toLowerCase();
  const filtered = entries.filter((entry) => {
    if (entry && typeof entry === "object") {
      const haystack = JSON.stringify(entry).toLowerCase();
      return haystack.includes(normalizedQuery);
    }
    return false;
  });

  return NextResponse.json({ results: filtered });
}
