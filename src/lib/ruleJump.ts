import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { applyUrlUpdates } from "@/lib/nav/urlState";

export function jumpToRule(router: AppRouterInstance, ruleId: string): void {
  if (typeof window === "undefined") return;
  const pathname = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  const next = applyUrlUpdates(params, { tab: "rules", rule: ruleId });
  router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
}
