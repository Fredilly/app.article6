"use client";

import { Loader2 } from "lucide-react";
import QuickCheckPanel from "./QuickCheckPanel";
import useDeeplinkMethodVersion from "@/hooks/useDeeplinkMethodVersion";

export default function ChatApp() {
  const deeplink = useDeeplinkMethodVersion();
  const deeplinkWarnings = deeplink.resolved.warnings;
  const selectedMethod = deeplink.resolved.method;
  const selectedVersion = deeplink.resolved.resolvedVersion;

  return (
    <div className="min-h-screen bg-[#f9f9f9]">
      <div className="mx-auto flex w-full max-w-[82.8rem] flex-col gap-5 px-4 py-10 md:px-8 md:py-16">
        {selectedMethod || deeplinkWarnings.length ? (
          <div className="mx-auto w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Deeplink context</span>
              {deeplink.loading ? (
                <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-700">
                method: {selectedMethod ?? "—"}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-700">
                version: {selectedVersion ?? "—"}
              </span>
            </div>
            {deeplinkWarnings.length ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-700">
                {deeplinkWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <QuickCheckPanel initialMethod={selectedMethod} initialVersion={selectedVersion} />
      </div>
    </div>
  );
}
