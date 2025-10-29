"use client";

import clsx from "clsx";

import { useHealth } from "@/hooks/useHealth";
import { ALWAYS_SHOW_HEALTH } from "@/lib/flags";

export default function HealthBadge() {
  const { data } = useHealth(20000);

  if (!ALWAYS_SHOW_HEALTH) return null;

  const status = data?.status ?? "loading";
  const isHealthy = status === "healthy";
  const isLoading = status === "loading";
  const label = isLoading
    ? "Checking manifest…"
    : isHealthy
    ? "Healthy (demo)"
    : "Manifest degraded";
  const dotClass = clsx(
    "h-2 w-2 rounded-full",
    isLoading ? "bg-slate-400" : isHealthy ? "bg-emerald-500" : "bg-rose-500",
  );
  const containerClass = clsx(
    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium shadow-sm",
    isLoading
      ? "badge-pulse bg-slate-200/80 text-slate-700"
      : isHealthy
      ? "badge-pulse bg-emerald-100 text-emerald-700"
      : "badge-pulse bg-rose-100 text-rose-700",
  );

  return (
    <span
      role="status"
      aria-live="polite"
      title="Badge reflects current manifest integrity (auto-updates)."
      className={containerClass}
    >
      <span className={dotClass} aria-hidden="true" />
      <span>{label}</span>
      {data?.source ? (
        <span className="text-xs font-medium text-slate-500">
          {data.source}
        </span>
      ) : null}
    </span>
  );
}
