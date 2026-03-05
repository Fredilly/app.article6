import { useEffect, useMemo, useState } from "react";
import type { RunSummary } from "@/lib/verify/runState";
import ProvenanceChip from "./ProvenanceChip";

type OutcomeWidgetProps = {
  summary: RunSummary;
  exportedAt?: string | null;
  onCopy: (value: string) => void;
  onExportSnapshot: () => void;
  onCreateTicket?: () => void;
  className?: string;
  debugKey?: string | null;
  debugLinkedCount?: number;
  provenance?: {
    repo?: string | null;
    sha?: string | null;
    generatedAt?: string | null;
    onClick?: () => void;
  };
  showCreateTicket?: boolean;
};

function formatNum(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

function formatBbox(bbox: [number, number, number, number] | null): string {
  if (!bbox) return "—";
  return `${bbox[0].toFixed(2)}, ${bbox[1].toFixed(2)} → ${bbox[2].toFixed(2)}, ${bbox[3].toFixed(2)}`;
}

function summarizeQuery(query: RunSummary["stac"]["query"]): string {
  const parts: string[] = [];
  if (query.collection) parts.push(`collection: ${query.collection}`);
  if (query.source) parts.push(`source: ${query.source}`);
  if (query.datetime?.start || query.datetime?.end) {
    const start = query.datetime.start ?? "…";
    const end = query.datetime.end ?? "…";
    parts.push(`datetime: ${start} → ${end}`);
  }
  if (typeof query.limit === "number") parts.push(`limit: ${query.limit}`);
  return parts.length ? parts.join(" • ") : "—";
}

export default function OutcomeWidget({
  summary,
  exportedAt = null,
  onCopy,
  onExportSnapshot,
  onCreateTicket,
  className,
  debugKey = null,
  debugLinkedCount,
  provenance,
  showCreateTicket = false,
}: OutcomeWidgetProps) {
  const [expanded, setExpanded] = useState(false);
  const [showIds, setShowIds] = useState(false);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    setExpanded(isDesktop);
  }, []);

  const aoiReady = Boolean(summary.aoi.hash);
  const stacCount = summary.stac.itemIds.length;
  const linkedCount = summary.linkage.linkedRuleIds.length;
  const showDebug = process.env.NODE_ENV !== "production";
  const debugLinked = summary.linkage.linkedRuleIds[0] ?? "";

  const collapsedLine = useMemo(() => {
    const aoiLabel = aoiReady ? "AOI ✓" : "AOI —";
    const stacLabel = `Items ${stacCount}`;
    const ruleLabel = `Rules ${linkedCount}`;
    return `Outcome • ${aoiLabel} • ${stacLabel} • ${ruleLabel}`;
  }, [aoiReady, linkedCount, stacCount]);

  const fullQuery = useMemo(() => summarizeQuery(summary.stac.query), [summary.stac.query]);
  const sourceHost = useMemo(() => {
    const source = summary.stac.query.source;
    if (!source) return "";
    try {
      return new URL(source).host;
    } catch {
      return source;
    }
  }, [summary.stac.query.source]);
  const exportedLabel = useMemo(() => {
    if (!exportedAt) return null;
    const date = new Date(exportedAt);
    if (Number.isNaN(date.getTime())) return exportedAt;
    return date.toLocaleString();
  }, [exportedAt]);

  return (
    <div id="verify-outcome" className={`rounded-xl border border-slate-200 bg-white p-4 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-900">Outcome</div>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50 lg:hidden"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded ? "Hide" : "Show"}
        </button>
      </div>

      {!expanded ? (
        <div className="mt-2 text-xs text-slate-600 lg:hidden">{collapsedLine}</div>
      ) : (
        <div className="mt-3 grid gap-4">
          <div className="grid gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">AOI</div>
            <div className="grid gap-2 text-xs text-slate-700">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-900">Hash</span>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
                  onClick={() => summary.aoi.hash && onCopy(summary.aoi.hash)}
                  disabled={!summary.aoi.hash}
                >
                  Copy hash
                </button>
              </div>
              <div className="min-w-0">
                <div className="truncate font-mono text-[11px] text-slate-600" title={summary.aoi.hash ?? "—"}>
                  {summary.aoi.hash ?? "—"}
                </div>
              </div>
              <div className="text-[11px] text-slate-600">BBox: {formatBbox(summary.aoi.bbox)}</div>
              <div className="text-[11px] text-slate-600">Area: {formatNum(summary.aoi.areaKm2)} km²</div>
            </div>
          </div>

          <div className="grid gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">STAC</div>
            <div className="min-w-0 text-[11px] text-slate-600" title={fullQuery}>
              <span className="font-semibold text-slate-700">Source:</span>{" "}
              <span className="font-mono">{sourceHost || "—"}</span>
              <div className="truncate text-[11px] text-slate-600">Query: {fullQuery}</div>
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
              <span className="min-w-0">
                Items: <span className="font-semibold text-slate-900">{stacCount}</span>
              </span>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
                  onClick={() => onCopy(summary.stac.itemIds.join("\n"))}
                  disabled={!stacCount}
                >
                  Copy IDs
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
                  onClick={() => setShowIds((value) => !value)}
                  disabled={!stacCount}
                >
                  {showIds ? "Hide IDs" : "View IDs"}
                </button>
              </div>
            </div>
            {showIds && stacCount ? (
              <div className="max-h-32 overflow-auto rounded-md border border-slate-100 bg-slate-50 px-2 py-2 font-mono text-[11px] text-slate-700">
                {summary.stac.itemIds.slice(0, 60).join("\n")}
                {summary.stac.itemIds.length > 60 ? `\nShowing first 60 of ${summary.stac.itemIds.length}.` : ""}
              </div>
            ) : null}
          </div>

          <div className="grid gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Linked rules</div>
            {showDebug ? (
              <div className="text-[11px] text-slate-400">
                Debug linked ids: {linkedCount}
                {debugLinked ? ` (${debugLinked})` : ""}
                {debugKey ? ` • key=${debugKey}` : ""}
                {typeof debugLinkedCount === "number" ? ` • linked=${debugLinkedCount}` : ""}
              </div>
            ) : null}
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
              <span className="min-w-0">
                Count: <span className="font-semibold text-slate-900">{linkedCount}</span>
              </span>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
                  onClick={() => onCopy(summary.linkage.linkedRuleIds.join("\n"))}
                  disabled={!linkedCount}
                >
                  Copy IDs
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
                  onClick={() => setShowRules((value) => !value)}
                  disabled={!linkedCount}
                >
                  {showRules ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            {showRules && linkedCount ? (
              <div className="max-h-24 overflow-auto rounded-lg border border-slate-100 bg-slate-50 px-2 py-2">
                <div className="font-mono text-[11px] text-slate-700">
                  {summary.linkage.linkedRuleIds.join("\n")}
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-full border border-sky-200 bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700"
                onClick={onExportSnapshot}
              >
                Export snapshot
              </button>
              {showCreateTicket && onCreateTicket ? (
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
                  onClick={onCreateTicket}
                >
                  Create ticket
                </button>
              ) : null}
              {exportedLabel ? (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  Exported {exportedLabel}
                </span>
              ) : null}
            </div>
            <ProvenanceChip
              repo={provenance?.repo ?? null}
              sha={provenance?.sha ?? null}
              generatedAt={provenance?.generatedAt ?? null}
              onClick={provenance?.onClick}
            />
          </div>
        </div>
      )}
    </div>
  );
}
