export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { buildEngineHeaders, resolveEngineEndpoint, resolveEngineMode } from "@/lib/engine/config";
import { withMetrics } from "@/lib/metrics";

type HealthStatus = "ok" | "degraded";

type EngineHealth = {
  mode: string;
  endpoint?: string;
  requiresAuth: boolean;
  configured: boolean;
  error?: string;
};

async function handleHealthCheck() {
  const mode = resolveEngineMode();
  const requiresAuth = Boolean(process.env.ENGINE_BEARER);
  const engine: EngineHealth = {
    mode,
    requiresAuth,
    configured: mode === "demo" ? true : Boolean(process.env.ENGINE_URL),
  };

  if (mode === "remote") {
    try {
      const endpoint = resolveEngineEndpoint();
      engine.endpoint = endpoint.origin + endpoint.pathname;

      if (process.env.ENGINE_HEALTH_PATH) {
        const healthUrl = new URL(process.env.ENGINE_HEALTH_PATH, endpoint);
        await fetch(healthUrl, {
          method: "GET",
          headers: buildEngineHeaders(),
          cache: "no-store",
        }).then(res => {
          if (!res.ok) {
            engine.error = `Engine health responded ${res.status}`;
          }
        }).catch(error => {
          engine.error = `Engine health unreachable: ${error instanceof Error ? error.message : String(error)}`;
        });
      }
    } catch (error) {
      engine.error = error instanceof Error ? error.message : String(error);
    }
  }

  const status: HealthStatus = engine.error ? "degraded" : "ok";
  const payload = {
    status,
    timestamp: new Date().toISOString(),
    engine,
  };

  return NextResponse.json(payload, { status: status === "ok" ? 200 : 503 });
}

export const GET = withMetrics("api/health:GET", handleHealthCheck);
