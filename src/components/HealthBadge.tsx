"use client";

import { motion } from "framer-motion";
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
  const { data } = useHealth(20000);
  if (!ALWAYS_SHOW_HEALTH) return null;
  if (!data) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400">
        <span className="text-zinc-400">●</span>
        checking…
      </span>
    );
  }

  const ok = Boolean(data.ok) && !Boolean(data.degraded);
  const dotClass = ok ? "bg-green-500" : "bg-red-500";
  const label = ok ? "healthy" : "degraded";

  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-zinc-700">
      <motion.span
        className={`h-2.5 w-2.5 rounded-full ${dotClass}`}
        animate={ok ? healthyAnimation : undefined}
        transition={ok ? healthyTransition : undefined}
      />
      <span>{label}</span>
    </span>
  );
}
