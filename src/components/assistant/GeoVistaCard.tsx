"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { GeoVistaVerification } from "@/services/geovista/types";

type GeoVistaCardProps = {
  loading?: boolean;
  verification?: GeoVistaVerification | null;
};

function statusLabel(status: GeoVistaVerification["status"]): string {
  if (status === "verified") return "Verified";
  if (status === "needs_review") return "Needs review";
  if (status === "error") return "Unavailable";
  return "Not run";
}

function statusBadgeClass(status: GeoVistaVerification["status"]): string {
  if (status === "verified") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "needs_review") return "border-amber-200 bg-amber-50 text-amber-900";
  if (status === "error") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function GeoVistaCard({ loading, verification }: GeoVistaCardProps) {
  const [open, setOpen] = useState(false);

  const artifacts = useMemo(() => verification?.artifacts ?? [], [verification?.artifacts]);
  const mode = verification?.mode;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">GeoVista Verification</div>
          {loading ? (
            <div className="mt-1 text-sm text-slate-700">Verifying…</div>
          ) : verification ? (
            <div className="mt-1 text-sm text-slate-700">{verification.summary}</div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {mode === "mock" ? (
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
              Mock
            </span>
          ) : (
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
                statusBadgeClass(verification?.status ?? "not_run"),
              )}
            >
              {loading ? "Verifying" : statusLabel(verification?.status ?? "not_run")}
            </span>
          )}
          {artifacts.length ? (
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={() => setOpen(true)}
            >
              View artifacts
            </button>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
              <div className="text-sm font-semibold text-slate-900">Artifacts</div>
              <button
                type="button"
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="grid gap-2 px-5 py-4">
              {artifacts.length ? (
                artifacts.map((artifact) => (
                  <div
                    key={artifact.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <div className="text-xs font-semibold text-slate-900">
                      {artifact.kind && artifact.ref_id ? `${artifact.kind}: ${artifact.ref_id}` : "Artifact"}
                    </div>
                    {artifact.url ? (
                      <a
                        className="mt-1 block break-words font-mono text-xs text-slate-600 underline"
                        href={artifact.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {artifact.url}
                      </a>
                    ) : (
                      <div className="mt-1 break-words font-mono text-xs text-slate-600">{artifact.id}</div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-600">No artifacts returned.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
