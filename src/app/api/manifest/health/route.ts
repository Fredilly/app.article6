import { NextResponse } from "next/server";
import { resolveEngineEndpoint, resolveEngineMode } from "@/lib/engine/config";
import { loadManifestWithMeta } from "@/lib/manifestSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
} as const;

type HealthStatus = "ok" | "degraded";

export async function GET() {
  try {
    const result = await loadManifestWithMeta({ showAll: true });
    const mode = resolveEngineMode();
    const degraded = mode === "remote" && result.source === "static" && Boolean(result.error);
    const status: HealthStatus = degraded ? "degraded" : "ok";
    const entries = Array.isArray(result.entries) ? result.entries : [];
    let engineUrl = "";

    if (mode === "remote") {
      try {
        const endpoint = resolveEngineEndpoint();
        engineUrl = endpoint.origin + endpoint.pathname;
      } catch {
        engineUrl = "";
      }
    }

    return NextResponse.json(
      {
        status,
        lastUpdated: result.fetchedAt,
        updatedAt: result.fetchedAt,
        source: result.source,
        ruleCount: entries.length,
        count: entries.length,
        engineUrl,
        error: result.error ?? null,
      },
      {
        status: status === "ok" ? 200 : 503,
        headers: RESPONSE_HEADERS,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        status: "degraded" satisfies HealthStatus,
        lastUpdated: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: "static" as const,
        ruleCount: 0,
        count: 0,
        engineUrl: "",
        error: message,
      },
      {
        status: 503,
        headers: RESPONSE_HEADERS,
      },
    );
  }
}
