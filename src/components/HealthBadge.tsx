"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Tooltip from "@/components/ui/Tooltip";
import { useHealth } from "@/hooks/useHealth";
import { ALWAYS_SHOW_HEALTH } from "@/lib/flags";

const healthyAnimation = {
  scale: [1, 1.35, 1],
  opacity: [0.6, 1, 0.6],
};

const healthyTransition = {
  duration: 1.4,
  repeat: Infinity,
  ease: "easeInOut",
};

export default function HealthBadge() {
  const { data, error } = useHealth(20000);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    if (data || error) {
      setLastChecked(new Date());
    }
  }, [data, error]);

  const formattedTimestamp = useMemo(() => {
    if (!lastChecked) return "—";
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "short",
        timeStyle: "short",
      }).format(lastChecked);
    } catch {
      return lastChecked.toISOString();
    }
  }, [lastChecked]);

  if (!ALWAYS_SHOW_HEALTH) return null;

  const ok = Boolean(data?.ok) && !Boolean(data?.degraded);
  const dotClass = ok ? "bg-emerald-500" : "bg-rose-500";
  const label = ok ? "Healthy" : data ? "Degraded" : "Checking…";
  const source = data?.source ?? "unknown";
  const tooltipContent = (
    <div className="flex min-w-[14rem] flex-col gap-1 text-left">
      <span className="font-semibold">
        Status: {data ? (ok ? "Healthy" : "Degraded") : "Checking"}
      </span>
      <span>Source: {source}</span>
      <span>Last checked: {formattedTimestamp}</span>
      <span className="text-xs text-slate-200">Updates automatically every 20 seconds.</span>
      {error ? <span className="text-rose-200">{error.message}</span> : null}
    </div>
  );

  if (!data && !error) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400">
        <span className="leading-none text-zinc-400">●</span>
        Checking…
      </span>
    );
  }

  return (
    <Tooltip content={tooltipContent}>
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium leading-none text-zinc-600"
        aria-live="polite"
      >
        <motion.span
          className={`h-2.5 w-2.5 rounded-full ${dotClass}`}
          animate={ok ? healthyAnimation : undefined}
          transition={ok ? healthyTransition : undefined}
        />
        <span>{label}</span>
      </span>
    </Tooltip>
  );
}
