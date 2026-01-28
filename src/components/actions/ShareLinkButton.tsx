"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { DetailTab } from "@/lib/nav/urlState";
import { encodeShareState } from "@/lib/shareLink";

type ShareLinkButtonProps = {
  tab: DetailTab;
  view?: "map" | "list" | null;
  ruleId?: string | null;
  sectionId?: string | null;
};

export default function ShareLinkButton({ tab, view, ruleId, sectionId }: ShareLinkButtonProps) {
  const pathname = usePathname();
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 900);
  }, []);

  useEffect(() => {
    return () => {
      setToast(null);
    };
  }, []);

  const buildShareUrl = useCallback(() => {
    if (!pathname) return null;
    const { tab: shareTab, view: shareView, rule, section, hash } = encodeShareState({
      tab,
      view,
      rule: ruleId ?? undefined,
      section: sectionId ?? undefined,
    });
    const url = new URL(window.location.origin + pathname);
    if (shareTab) url.searchParams.set("tab", shareTab);
    if (shareView) url.searchParams.set("view", shareView);
    if (rule) url.searchParams.set("rule", rule);
    if (section) url.searchParams.set("section", section);
    url.hash = hash ? `#${hash}` : "";
    return url.toString();
  }, [pathname, ruleId, sectionId, tab, view]);

  const handleShare = useCallback(async () => {
    const url = buildShareUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Copied");
    } catch {
      showToast("Copy failed");
    }
  }, [buildShareUrl, showToast]);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleShare}
        className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
      >
        Share
      </button>
      {toast ? <span className="text-xs font-semibold text-slate-500">{toast}</span> : null}
    </div>
  );
}
