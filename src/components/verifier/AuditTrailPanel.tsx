"use client";

import { useMemo } from "react";
import type { AuditTrailEvent } from "@/lib/auditTrail/types";

type AuditTrailPanelProps = {
  events: AuditTrailEvent[];
  exportJson: string;
  exportSha256: string;
  onClear: () => void;
  onExport: () => void;
  onJumpToRule: (ruleId: string) => void;
  onOpenEvidence: (url: string) => void;
  onNotify?: (message: string) => void;
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function downloadJson(text: string, filename: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AuditTrailPanel({
  events,
  exportJson,
  exportSha256,
  onClear,
  onExport,
  onJumpToRule,
  onOpenEvidence,
  onNotify,
}: AuditTrailPanelProps) {
  const ordered = useMemo(() => [...events].reverse(), [events]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">Audit Trail</div>
          <div className="text-xs text-slate-500">{events.length} event(s)</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={() => {
              downloadJson(exportJson, "audit-trail.json");
              onExport();
              onNotify?.("Audit trail exported.");
            }}
          >
            Export JSON
          </button>
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(exportSha256);
                onNotify?.("SHA256 copied.");
              } catch {
                onNotify?.("Copy failed.");
              }
            }}
          >
            Copy SHA256
          </button>
          <button
            type="button"
            className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 shadow-sm hover:bg-rose-100"
            onClick={onClear}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        {ordered.length ? (
          ordered.map((event, index) => {
            const ruleId = typeof event.payload.rule_id === "string" ? event.payload.rule_id : null;
            const stacUrl = typeof event.payload.stac_url === "string" ? event.payload.stac_url : null;
            return (
              <div key={`${event.ts_iso}-${index}`} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-700">{event.kind}</div>
                  <div className="text-[11px] text-slate-500">{formatTime(event.ts_iso)}</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ruleId ? (
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => onJumpToRule(ruleId)}
                    >
                      Jump to rule
                    </button>
                  ) : null}
                  {stacUrl ? (
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => onOpenEvidence(stacUrl)}
                    >
                      Open evidence
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-3 text-xs text-slate-500">
            No audit events yet. Start in Verify mode to log actions.
          </div>
        )}
      </div>
    </section>
  );
}
