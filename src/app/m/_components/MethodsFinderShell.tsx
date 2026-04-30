"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MethodsLayoutProvider } from "@/app/m/_components/MethodsLayoutContext";
import { applyUrlUpdates } from "@/lib/nav/urlState";
import { getVerifyView } from "@/lib/mode";

type MethodsFinderShellProps = {
  left: ReactNode;
  right: ReactNode;
};

const METHODS_COLLAPSED_KEY = "a6:methodsCollapsed";
const METHODS_SESSION_KEY = "a6:methodsCollapsedSessionInit";
const METHODS_SESSION_USER_KEY = "a6:methodsCollapsedUser";

export default function MethodsFinderShell({ left, right }: MethodsFinderShellProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = (searchParams.get("tab") ?? "").trim().toLowerCase();
  const isVerifyTab = tab === "verify" || tab === "map";
  const mode = getVerifyView(searchParams);
  const methodsParam = (searchParams.get("methods") ?? "").trim().toLowerCase();
  const [methodsCollapsed, setMethodsCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isVerifyTab) {
      setMethodsCollapsed(false);
      return;
    }
    const media = window.matchMedia("(min-width: 1024px)");
    if (!media.matches) {
      setMethodsCollapsed(false);
      return;
    }
    if (methodsParam === "hidden") {
      setMethodsCollapsed(true);
      return;
    }
    if (methodsParam === "shown") {
      setMethodsCollapsed(false);
      return;
    }
    const sessionOverride = window.sessionStorage.getItem(METHODS_SESSION_USER_KEY);
    if (mode === "map" && sessionOverride !== "expanded") {
      setMethodsCollapsed(true);
      return;
    }
    const seen = window.sessionStorage.getItem(METHODS_SESSION_KEY);
    if (!seen) {
      setMethodsCollapsed(true);
      window.sessionStorage.setItem(METHODS_SESSION_KEY, "1");
      return;
    }
    if (sessionOverride === "expanded") {
      setMethodsCollapsed(false);
      return;
    }
    if (sessionOverride === "collapsed") {
      setMethodsCollapsed(true);
      return;
    }
    const stored = window.localStorage.getItem(METHODS_COLLAPSED_KEY);
    if (stored === "1") setMethodsCollapsed(true);
    if (stored === "0") setMethodsCollapsed(false);
  }, [isVerifyTab, methodsParam, mode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(METHODS_COLLAPSED_KEY, methodsCollapsed ? "1" : "0");
  }, [methodsCollapsed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isVerifyTab) return;
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new Event("a6:verify-layout"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isVerifyTab, methodsCollapsed, mode]);

  const setMethodsCollapsedWithUrl = useCallback(
    (next: boolean) => {
      setMethodsCollapsed(next);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(METHODS_SESSION_USER_KEY, next ? "collapsed" : "expanded");
      }
      if (!pathname || !isVerifyTab) return;
      const nextQuery = applyUrlUpdates(searchParams, { methods: next ? "hidden" : "shown" });
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    },
    [isVerifyTab, pathname, router, searchParams],
  );

  const collapsed = isVerifyTab ? methodsCollapsed : false;
  const layoutClass = useMemo(
    () =>
      `grid gap-4 ${
        collapsed ? "lg:grid-cols-[minmax(0,1fr)]" : "lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[336px_minmax(0,1fr)]"
      }`,
    [collapsed],
  );

  return (
    <MethodsLayoutProvider value={{ isVerifyTab, methodsCollapsed: collapsed, setMethodsCollapsed: setMethodsCollapsedWithUrl }}>
      <div className={layoutClass}>
        <section className={`w-full ${collapsed ? "lg:hidden" : "lg:sticky lg:top-4 lg:self-start"}`}>{left}</section>
        <section className="w-full">{right}</section>
      </div>
    </MethodsLayoutProvider>
  );
}
