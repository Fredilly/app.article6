"use client";

import { useEffect, useState } from "react";

type HealthStatus = "healthy" | "degraded" | "loading";

export type ManifestHealth = {
  status: HealthStatus;
  count: number | null;
  updatedAt: string | null;
  source: string;
  errorMessage?: string;
};

export function useHealth(intervalMs = 20000) {
  const [data, setData] = useState<ManifestHealth | null>(null);
  const [err, setErr] = useState<Error | null>(null);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const response = await fetch("/api/manifest/health", { cache: "no-store" });
        const payload = (await response.json()) as Record<string, unknown>;
        const countRaw = payload["count"];
        const updatedAtRaw = payload["updatedAt"];
        const engineUrlRaw = payload["engineUrl"];
        const errorMessage =
          typeof payload["error"] === "string" ? (payload["error"] as string) : undefined;

        const count = typeof countRaw === "number" && Number.isFinite(countRaw) ? countRaw : null;
        const updatedAt = typeof updatedAtRaw === "string" ? updatedAtRaw : null;
        const sourceCandidate =
          typeof engineUrlRaw === "string" && engineUrlRaw.trim().length > 0
            ? (engineUrlRaw as string)
            : "static";

        const healthy = response.ok && typeof count === "number" && count > 0;
        const status: HealthStatus = healthy ? "healthy" : "degraded";
        const normalized: ManifestHealth = {
          status,
          count,
          updatedAt,
          source: sourceCandidate,
          errorMessage,
        };
        if (alive) {
          setData(normalized);
          setErr(null);
        }
      } catch (error: unknown) {
        if (!alive) return;
        setErr(error instanceof Error ? error : new Error(String(error)));
        if (alive) {
          setData({
            status: "degraded",
            count: null,
            updatedAt: null,
            source: "unreachable",
            errorMessage:
              error instanceof Error
                ? error.message
                : typeof error === "string"
                ? error
                : undefined,
          });
        }
      }
    }
    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [intervalMs]);

  return { data, error: err };
}
