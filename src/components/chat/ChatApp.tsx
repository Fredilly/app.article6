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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(226,232,240,0.75),_rgba(255,255,255,1)_55%)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-8 md:py-12">
        <header className="mx-auto w-full max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Article 6 Evidence</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
            Run one grounded check before opening the full review workspace.
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 md:text-base">
            The landing page now starts with a single claim-first verification step. Once the claim is grounded, the
            existing Review Workspace picks up the same methodology, requirement, evidence, and run context.
          </p>
        </header>

        {selectedMethod || deeplinkWarnings.length ? (
          <div className="mx-auto w-full max-w-3xl rounded-3xl border border-slate-200 bg-white/85 p-4 text-sm text-slate-700 shadow-sm backdrop-blur">
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
