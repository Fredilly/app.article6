"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";

import { Tooltip } from "@/components/ui/Tooltip";

type HealthStatus = "ok" | "degraded" | "loading";

type HealthResponse = {
  count?: number;
  updatedAt?: string;
  engineUrl?: string;
  error?: string;
};

type HealthState = {
  status: HealthStatus;
  count: number;
  updatedAt?: string;
  source: "static" | "remote";
};

const POLL_INTERVAL = 30_000;

async function fetchHealth(): Promise<HealthState> {
  try {
    const response = await fetch("/api/manifest/health", { cache: "no-store" });
    const json = (await response.json()) as HealthResponse;
    const status: HealthStatus = response.ok && !json.error ? "ok" : "degraded";
    const source = json.engineUrl && json.engineUrl !== "static" ? "remote" : "static";
    return {
      status,
      count: typeof json.count === "number" ? json.count : 0,
      updatedAt: json.updatedAt,
      source,
    };
  } catch (error) {
    console.warn("[ManifestHealthBadge] health request failed", error);
    return {
      status: "degraded",
      count: 0,
      source: "static",
    };
  }
}

export default function ManifestHealthBadge() {
  const [health, setHealth] = useState<HealthState>({ status: "loading", count: 0, source: "static" });

  useEffect(() => {
    let mounted = true;
    let timer: number | null = null;

    const load = async () => {
      const next = await fetchHealth();
      if (mounted) {
        setHealth(next);
      }
    };

    load();
    timer = window.setInterval(load, POLL_INTERVAL);

    return () => {
      mounted = false;
      if (timer) window.clearInterval(timer);
    };
  }, []);

  const badgeClass = useMemo(() => {
    switch (health.status) {
      case "ok":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "degraded":
        return "bg-rose-100 text-rose-800 border-rose-200";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  }, [health.status]);

  const label =
    health.status === "loading"
      ? "Manifest health"
      : health.status === "ok"
      ? `Manifest healthy (${health.count})`
      : "Manifest degraded";

  const tooltipContent = (
    <div className="space-y-1">
      <p className="font-medium">{health.status === "ok" ? "Healthy" : health.status === "degraded" ? "Degraded" : "Loading"}</p>
      <p className="text-xs text-slate-200">Last updated: {health.updatedAt ? new Date(health.updatedAt).toLocaleString() : "—"}</p>
      <p className="text-xs text-slate-200 capitalize">Source: {health.source}</p>
      <p className="text-xs text-slate-200">Rules: {health.count}</p>
    </div>
  );

  return (
    <Tooltip content={tooltipContent}>
      <span
        className={clsx(
          "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium",
          badgeClass,
        )}
      >
        <span className="inline-block h-2 w-2 rounded-full bg-current" aria-hidden="true" />
        {label}
      </span>
    </Tooltip>
  );
}
