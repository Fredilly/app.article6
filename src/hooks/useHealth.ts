"use client";

import { useEffect, useState } from "react";

type Health = { ok: boolean; degraded?: boolean; source?: string } & Record<string, unknown>;

export function useHealth(intervalMs = 20000) {
  const [data, setData] = useState<Health | null>(null);
  const [err, setErr] = useState<Error | null>(null);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const response = await fetch("/api/manifest/health", { cache: "no-store" });
        const parsed = (await response.json()) as Health;
        if (alive) setData(parsed);
      } catch (error: unknown) {
        if (!alive) return;
        setErr(error instanceof Error ? error : new Error(String(error)));
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
