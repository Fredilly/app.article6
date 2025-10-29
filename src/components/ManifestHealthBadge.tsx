"use client";

import { motion, type TargetAndTransition } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Tooltip from "@/components/ui/Tooltip";

type HealthStatus = "ok" | "degraded";

type ManifestHealthPayload = {
  count?: number;
  updatedAt?: string;
  engineUrl?: string;
  error?: string | null;
};

type HealthState = {
  status: HealthStatus;
  lastUpdated: string | null;
  source: string;
  ruleCount: number | null;
  error: string | null;
};

const INITIAL_STATE: HealthState = {
  status: "degraded",
  lastUpdated: null,
  source: "static",
  ruleCount: null,
  error: "Awaiting status…",
};

function formatSource(engineUrl: string | undefined) {
  if (!engineUrl || engineUrl === "demo") return "demo";
  if (engineUrl === "static") return "static";
  try {
    const url = new URL(engineUrl);
    return url.hostname ?? "remote";
  } catch {
    return engineUrl.toLowerCase().includes("http") ? "remote" : engineUrl;
  }
}

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
      const source = formatSource(payload.engineUrl ?? undefined);
      const ruleCount =
        typeof payload.count === "number" && Number.isFinite(payload.count)
          ? payload.count
          : null;
      const status: HealthStatus =
        response.ok && !payload.error && (ruleCount === null || ruleCount > 0)
          ? "ok"
          : "degraded";
      if (mountedRef.current) {
        setHealth({
          status,
          lastUpdated: payload.updatedAt ?? new Date().toISOString(),
          source,
          ruleCount,
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
        Status: {health.status === "ok" ? "Healthy" : "Degraded"}
      </span>
      <span>Source: {health.source}</span>
      <span>Rules indexed: {health.ruleCount ?? "—"}</span>
      <span>Last checked: {formattedTimestamp}</span>
      <span className="text-xs text-slate-200">
        Badge reflects current manifest integrity (auto-updates).
      </span>
      {health.error ? <span className="text-rose-200">{health.error}</span> : null}
    </div>
  );

  const badgeClasses =
    health.status === "ok"
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : "bg-rose-100 text-rose-700 border-rose-200";

  const dotClasses = health.status === "ok" ? "bg-emerald-500" : "bg-rose-500";
  const label = health.status === "ok" ? "Manifest healthy" : "Manifest degraded";

  const pulseAnimation: TargetAndTransition = {
    opacity: health.status === "ok" ? [0.75, 1, 0.75] : [0.65, 1, 0.65],
    scale: [1, 1.05, 1],
  };

  const dotAnimation: TargetAndTransition = {
    scale: [1, 1.2, 1],
  };

  return (
    <Tooltip content={tooltipContent}>
      <motion.button
        type="button"
        onClick={() => void fetchHealth()}
        className={`flex h-11 items-center gap-2 rounded-full border px-3 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500 focus-visible:outline-offset-2 ${badgeClasses}`}
        aria-live="polite"
        animate={pulseAnimation}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        whileHover={{ scale: 1.05, opacity: 1 }}
        whileFocus={{ scale: 1.05, opacity: 1 }}
      >
        <motion.span
          className={`h-2.5 w-2.5 rounded-full ${dotClasses}`}
          aria-hidden="true"
          animate={dotAnimation}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <span>{label}</span>
        <span className="text-xs text-slate-500">({health.source})</span>
        <span className="sr-only">
          {loading ? "Refreshing status" : `Last updated ${formattedTimestamp}`}
        </span>
      </motion.button>
    </Tooltip>
  );
}
