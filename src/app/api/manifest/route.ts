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
  const query = (url.searchParams.get("q") ?? "").trim();

  if (resolveEngineMode() === "remote") {
    try {
      const engineUrl = resolveEngineEndpoint();
      const manifestUrl = new URL(engineUrl);
      const replacedPath = manifestUrl.pathname.replace(/\/?query\/?$/, "/manifest");
      if (replacedPath !== manifestUrl.pathname) {
        manifestUrl.pathname = replacedPath;
      } else {
        manifestUrl.pathname = `${manifestUrl.pathname.replace(/\/$/, "")}/manifest`;
      }
      if (query) manifestUrl.searchParams.set("q", query);

      const response = await fetch(manifestUrl, {
        method: "GET",
        headers: buildEngineHeaders(),
        cache: "no-store",
      }).catch(error => {
        throw new Error(`Failed to reach engine manifest: ${error instanceof Error ? error.message : String(error)}`);
      });

      const raw = await response.text();
      let parsed: unknown = undefined;
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

      const rules = parsed && typeof parsed === "object" && parsed !== null ? (parsed as { rules?: unknown }).rules : undefined;
      if (!Array.isArray(rules)) {
        throw new Error("Engine manifest response missing rules array");
      }

      return NextResponse.json({ rules });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  const normalizedQuery = query.toLowerCase();

  const data = await loadManifest();
  const entries = Array.isArray(data) ? data : [];

  const results = entries.filter(entry => {
    if (!normalizedQuery) return true;
    if (entry && typeof entry === "object") {
      const haystack = JSON.stringify(entry).toLowerCase();
      return haystack.includes(normalizedQuery);
    }
    return false;
  });

  return NextResponse.json({ results });
}
