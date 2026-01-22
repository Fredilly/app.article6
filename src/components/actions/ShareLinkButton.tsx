"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { DetailTab } from "@/lib/nav/urlState";
import { applyUrlUpdates } from "@/lib/nav/urlState";
import { encodeShareState } from "@/lib/shareLink";

type ShareLinkButtonProps = {
  tab: DetailTab;
  ruleId?: string | null;
  sectionId?: string | null;
};

export default function ShareLinkButton({ tab, ruleId, sectionId }: ShareLinkButtonProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
    const { tab: shareTab, rule, section, hash } = encodeShareState({
      tab,
      rule: ruleId ?? undefined,
      section: sectionId ?? undefined,
    });
    const params = new URLSearchParams(searchParams.toString());
    const next = applyUrlUpdates(params, {
      tab: shareTab ?? null,
      rule: rule ?? null,
      section: section ?? null,
    });
    const url = new URL(pathname, window.location.origin);
    url.search = next ? `?${next}` : "";
    url.hash = hash ? `#${hash}` : "";
    return url.toString();
  }, [pathname, ruleId, searchParams, sectionId, tab]);

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
