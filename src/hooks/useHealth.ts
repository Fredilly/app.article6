"use client";

import { useEffect, useState } from "react";

type Health = { ok: boolean; degraded?: boolean; source?: string };

export function useHealth(intervalMs = 20000) {
  const [data, setData] = useState<Health | null>(null);
  const [err, setErr] = useState<Error | null>(null);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        const payload = (await response.json()) as Record<string, unknown>;
        const statusRaw = payload["status"];
        const status = typeof statusRaw === "string" ? statusRaw.toLowerCase() : "";
        const ok = status === "ok";
        const engineRaw = payload["engine"];
        const engineMode =
          typeof engineRaw === "object" &&
          engineRaw !== null &&
          "mode" in engineRaw &&
          typeof (engineRaw as Record<string, unknown>).mode === "string"
            ? ((engineRaw as Record<string, unknown>).mode as string)
            : undefined;
        const hasEndpoint =
          typeof engineRaw === "object" &&
          engineRaw !== null &&
          "endpoint" in engineRaw &&
          typeof (engineRaw as Record<string, unknown>).endpoint === "string";
        const sourceCandidate =
          engineMode ??
          (hasEndpoint ? "remote" : undefined) ??
          (typeof payload["engineUrl"] === "string" ? (payload["engineUrl"] as string) : undefined);
        const source =
          typeof sourceCandidate === "string" && sourceCandidate.trim().length > 0
            ? sourceCandidate
            : "static";
        const normalized: Health = {
          ok,
          degraded: !ok,
          source,
        };
        if (alive) {
          setData(normalized);
          setErr(null);
        }
      } catch (error: unknown) {
        if (!alive) return;
        setErr(error instanceof Error ? error : new Error(String(error)));
        if (alive) {
          setData({ ok: false, degraded: true, source: "unreachable" });
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
