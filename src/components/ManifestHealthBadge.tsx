"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Tooltip from "@/components/ui/Tooltip";

type HealthStatus = "ok" | "degraded";

type ManifestHealthPayload = {
  status: HealthStatus;
  lastUpdated: string;
  source: "remote" | "static";
  ruleCount: number;
  error?: string | null;
};

type HealthState = {
  status: HealthStatus;
  lastUpdated: string | null;
  source: "remote" | "static" | null;
  ruleCount: number | null;
  error?: string | null;
};

const INITIAL_STATE: HealthState = {
  status: "degraded",
  lastUpdated: null,
  source: null,
  ruleCount: null,
  error: "Awaiting status…",
};

export default function ManifestHealthBadge() {
  const [health, setHealth] = useState<HealthState>(INITIAL_STATE);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const formattedTimestamp = useMemo(() => {
    if (!health.lastUpdated) return "—";
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(health.lastUpdated));
    } catch {
      return health.lastUpdated;
    }
  }, [health.lastUpdated]);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/manifest/health", {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as ManifestHealthPayload;
      if (mountedRef.current) {
        setHealth({
          status: payload.status,
          lastUpdated: payload.lastUpdated ?? new Date().toISOString(),
          source: payload.source,
          ruleCount: payload.ruleCount,
          error: payload.error ?? null,
        });
      }
    } catch (error) {
      if (mountedRef.current) {
        setHealth({
          status: "degraded",
          lastUpdated: new Date().toISOString(),
          source: "static",
          ruleCount: null,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) {
        await fetchHealth();
      }
    })();
    const interval = window.setInterval(() => {
      if (!cancelled) {
        void fetchHealth();
      }
    }, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [fetchHealth]);

  const tooltipContent = (
    <div className="flex flex-col gap-1 text-left">
      <span className="font-semibold">
        Status: {health.status === "ok" ? "OK" : "Degraded"}
      </span>
      <span>Source: {health.source ?? "unknown"}</span>
      <span>Rules: {health.ruleCount ?? "—"}</span>
      <span>Updated: {formattedTimestamp}</span>
      {health.error ? <span className="text-rose-200">{health.error}</span> : null}
    </div>
  );

  const badgeClasses =
    health.status === "ok"
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : "bg-rose-100 text-rose-700 border-rose-200";

  const dotClasses = health.status === "ok" ? "bg-emerald-500" : "bg-rose-500";
  const label = health.status === "ok" ? "Manifest healthy" : "Manifest degraded";

  return (
    <Tooltip content={tooltipContent}>
      <button
        type="button"
        onClick={() => void fetchHealth()}
        className={`flex h-11 items-center gap-2 rounded-full border px-3 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500 focus-visible:outline-offset-2 ${badgeClasses}`}
        aria-live="polite"
      >
        <span className={`h-2.5 w-2.5 rounded-full ${dotClasses}`} aria-hidden="true" />
        <span>{label}</span>
        <span className="sr-only">
          {loading ? "Refreshing status" : `Last updated ${formattedTimestamp}`}
        </span>
      </button>
    </Tooltip>
  );
}
