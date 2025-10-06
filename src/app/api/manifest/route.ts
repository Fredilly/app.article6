import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildEngineHeaders, resolveEngineEndpoint, resolveEngineMode } from "@/lib/engine/config";

export const runtime = "nodejs";

async function loadManifest() {
  const fallback: unknown = [];
  try {
    const filePath = path.join(process.cwd(), "public", "manifest", "index.json");
    const contents = await readFile(filePath, "utf8");
    return JSON.parse(contents) as unknown;
  } catch {
    return fallback;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawQuery = (url.searchParams.get("q") ?? "").trim();
  const showAll = url.searchParams.get("all") === "1";

  if (resolveEngineMode() === "remote") {
    try {
      const engineUrl = resolveEngineEndpoint();
      const manifestUrl = new URL(engineUrl);
      const replacedPath = manifestUrl.pathname.replace(/\/?query\/?$/, "/manifest");
      manifestUrl.pathname = replacedPath !== manifestUrl.pathname ? replacedPath : `${manifestUrl.pathname.replace(/\/$/, "")}/manifest`;
      if (showAll) {
        manifestUrl.searchParams.set("all", "1");
      } else if (rawQuery) {
        manifestUrl.searchParams.set("q", rawQuery);
      }

      const response = await fetch(manifestUrl, {
        method: "GET",
        headers: buildEngineHeaders(),
        cache: "no-store",
      }).catch(error => {
        throw new Error(`Failed to reach engine manifest: ${error instanceof Error ? error.message : String(error)}`);
      });

      const raw = await response.text();
      let parsed: unknown;
      if (raw) {
        try {
          parsed = JSON.parse(raw);
        } catch (error) {
          throw new Error(`Invalid engine manifest JSON: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      if (!response.ok) {
        const payload = parsed && typeof parsed === "object" ? parsed : { error: raw || `Engine HTTP ${response.status}` };
        return NextResponse.json(payload, { status: response.status });
      }

      const fromResponse = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object"
        ? (parsed as { rules?: unknown; results?: unknown }).rules ?? (parsed as { rules?: unknown; results?: unknown }).results
        : undefined;

      if (!Array.isArray(fromResponse)) {
        throw new Error("Engine manifest response missing rules array");
      }

      return NextResponse.json(fromResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  const data = await loadManifest();
  const entries = Array.isArray(data) ? data : [];

  if (showAll || !rawQuery) {
    return NextResponse.json(entries);
  }

  const normalizedQuery = rawQuery.toLowerCase();
  const filtered = entries.filter(entry => {
    if (entry && typeof entry === "object") {
      const haystack = JSON.stringify(entry).toLowerCase();
      return haystack.includes(normalizedQuery);
    }
    return false;
  });

  return NextResponse.json(filtered);
}
