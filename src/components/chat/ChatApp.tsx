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
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 md:px-8 md:py-10">
        <div className="mx-auto w-full max-w-4xl">
          <div className="max-w-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Article 6</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 md:text-[2.7rem]">
              One claim. One file. One clear next step.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 md:text-[15px]">
              Start with one claim and one file. Quick Check gives you a preliminary match, then opens the full review only when you need it.
            </p>
          </div>
        </div>

        {selectedMethod || deeplinkWarnings.length ? (
          <div className="mx-auto w-full max-w-4xl rounded-3xl border border-slate-200 bg-white/85 p-4 text-sm text-slate-700 shadow-sm backdrop-blur">
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
