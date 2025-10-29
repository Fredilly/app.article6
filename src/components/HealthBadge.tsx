"use client";

import { useHealth } from "@/hooks/useHealth";
import { ALWAYS_SHOW_HEALTH } from "@/lib/flags";

export default function HealthBadge() {
  const { data } = useHealth(20000);
  if (!ALWAYS_SHOW_HEALTH) return null;
  if (!data) {
    return <span className="text-zinc-400 text-xs">● checking…</span>;
  }

  const ok = Boolean(data.ok);
  const degraded = Boolean(data.degraded);
  const source = data.source || "unknown";

  let dotClass = "text-zinc-400";
  let label = "healthy";
  if (!ok || degraded) {
    dotClass = "text-red-500";
    label = "degraded";
  } else {
    dotClass = "text-green-500";
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium">
      <span className={dotClass}>●</span>
      <span>{label}</span>
      <span className="text-zinc-400">({source})</span>
    </span>
  );
}
