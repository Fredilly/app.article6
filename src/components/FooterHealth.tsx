"use client";

import { useEffect, useState } from "react";

type HealthResponse = {
  count: number;
  updatedAt: string;
};

type HealthState = {
  count: number;
  updatedLabel: string;
};

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().slice(11, 16);
}

export default function FooterHealth() {
  const [health, setHealth] = useState<HealthState | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    let cancelled = false;

    async function loadHealth() {
      try {
        const response = await fetch("/api/manifest/health", { cache: "no-store" });
        if (!response.ok) throw new Error(`Unexpected status ${response.status}`);
        const payload: unknown = await response.json();
        if (
          typeof payload === "object" &&
          payload !== null &&
          "count" in payload &&
          "updatedAt" in payload
        ) {
          const countValue = Number((payload as HealthResponse).count ?? 0);
          const updatedAtValue = String((payload as HealthResponse).updatedAt ?? "");
          if (!cancelled) {
            setHealth({ count: Number.isFinite(countValue) ? countValue : 0, updatedLabel: formatTime(updatedAtValue) });
            setHasError(false);
          }
          return;
        }
        throw new Error("Invalid health payload");
      } catch (error) {
        console.warn(
          "[FooterHealth] Failed to load manifest health:",
          error instanceof Error ? error.message : String(error),
        );
        if (!cancelled) {
          setHealth(null);
          setHasError(true);
        }
      }
    }

    loadHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  if (process.env.NODE_ENV === "production") return null;

  const manifestLabel = health ? `Manifest: ${health.count} · ${health.updatedLabel}` : "Manifest: —";

  return (
    <span className="text-xs font-medium text-slate-500" role="status" aria-live="polite">
      {manifestLabel}
      {hasError ? <span className="sr-only"> (health data unavailable)</span> : null}
    </span>
  );
}
