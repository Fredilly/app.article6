"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import MapCanvas from "@/components/map/MapCanvas";
import { canonicalJsonStringify } from "@/lib/export/canonicalJson";
import { sha256Text } from "@/lib/proof/hash";
import { parseAoiGeoJson } from "@/lib/proofMap/aoi";
import type { AOI } from "@/lib/proofMap/types";
import normalizeStacItems, { type StacItemLike } from "@/lib/stac/normalizeStacItems";
import { buildEvidenceRuleIndex } from "@/lib/trace/evidenceLinks";
import type { TraceIndex } from "@/lib/trace/traceIndex";

type EvidenceMapPageProps = {
  methodCode: string;
  version: string;
};

type StacState = {
  sourceUrl: string;
  itemsById: Record<string, StacItemLike & { id: string }>;
  featureCollection: GeoJSON.FeatureCollection;
};

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function dataQualityChips(item: StacItemLike & { id: string }): string[] {
  const props = item.properties ?? {};
  const chips: string[] = [];

  const cloud = asNumber(props["eo:cloud_cover"]) ?? asNumber(item.cloud_cover);
  if (cloud != null) chips.push(`Cloud ${cloud}%`);

  const quality = asString(props["quality"]) ?? asString(props["data_quality"]);
  if (quality) chips.push(`Quality ${quality}`);

  return chips;
}

function downloadText(text: string, filename: string) {
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

export default function EvidenceMapPage({ methodCode, version }: EvidenceMapPageProps) {
  const [stacUrl, setStacUrl] = useState("");
  const [stacState, setStacState] = useState<StacState | null>(null);
  const [stacLoading, setStacLoading] = useState(false);
  const [stacError, setStacError] = useState<string | null>(null);

  const [traceIndex, setTraceIndex] = useState<TraceIndex | null>(null);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);

  const [aoi, setAoi] = useState<AOI | null>(null);
  const [aoiError, setAoiError] = useState<string | null>(null);

  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTraceLoading(true);
    setTraceError(null);
    fetch(`/api/methods/${encodeURIComponent(methodCode)}/v/${encodeURIComponent(version)}/trace`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Trace request failed (${res.status})`);
        const payload = (await res.json()) as { trace?: unknown };
        if (!payload.trace || typeof payload.trace !== "object") throw new Error("Trace payload missing");
        if (!cancelled) setTraceIndex(payload.trace as TraceIndex);
      })
      .catch((error) => {
        if (!cancelled) setTraceError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) setTraceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [methodCode, version]);

  const evidenceRuleIndex = useMemo(() => buildEvidenceRuleIndex(traceIndex), [traceIndex]);

  const evidenceItems = useMemo(() => {
    const items = stacState ? Object.values(stacState.itemsById) : [];
    return items.sort((a, b) => a.id.localeCompare(b.id));
  }, [stacState]);

  const handleLoadStac = useCallback(async () => {
    const url = stacUrl.trim();
    if (!url) return;
    setStacLoading(true);
    setStacError(null);
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`STAC request failed (${response.status})`);
      const payload = await response.json();
      const normalized = normalizeStacItems(payload);
      setStacState({
        sourceUrl: url,
        itemsById: normalized.itemsById,
        featureCollection: normalized.featureCollection,
      });
      setSelectedEvidenceId(null);
    } catch (error) {
      setStacError(error instanceof Error ? error.message : String(error));
      setStacState(null);
    } finally {
      setStacLoading(false);
    }
  }, [stacUrl]);

  const handleLoadFixture = useCallback(async () => {
    setStacUrl("/fixtures/stac-item.json");
    setStacLoading(true);
    setStacError(null);
    try {
      const response = await fetch("/fixtures/stac-item.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`Fixture request failed (${response.status})`);
      const payload = await response.json();
      const normalized = normalizeStacItems(payload);
      setStacState({
        sourceUrl: "/fixtures/stac-item.json",
        itemsById: normalized.itemsById,
        featureCollection: normalized.featureCollection,
      });
      setSelectedEvidenceId(null);
    } catch (error) {
      setStacError(error instanceof Error ? error.message : String(error));
      setStacState(null);
    } finally {
      setStacLoading(false);
    }
  }, []);

  const onPickAoi = useCallback(async (file: File | null) => {
    if (!file) return;
    setAoiError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = parseAoiGeoJson(parsed, file.name);
      if (!result.ok) throw new Error(result.error);
      setAoi(result.aoi);
    } catch (error) {
      setAoiError(error instanceof Error ? error.message : String(error));
      setAoi(null);
    }
  }, []);

  const onExportSnapshot = useCallback(async () => {
    const evidenceIds = selectedEvidenceId ? [selectedEvidenceId] : [];
    const snapshot: Record<string, unknown> = {
      version: 1,
      method: { code: methodCode, version },
      stac_url: stacState?.sourceUrl ?? stacUrl.trim(),
      evidence_ids: evidenceIds.sort((a, b) => a.localeCompare(b)),
    };

    if (aoi) {
      const aoiCanonical = canonicalJsonStringify(aoi.geojson);
      snapshot.aoi_hash = await sha256Text(aoiCanonical);
    }

    const text = canonicalJsonStringify(snapshot);
    downloadText(text, `evidence-map-${methodCode}-${version}.json`);
  }, [aoi, methodCode, selectedEvidenceId, stacState?.sourceUrl, stacUrl, version]);

  const stacSourceLabel = stacState?.sourceUrl ?? stacUrl.trim();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
        <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Evidence Map</div>
              <div className="text-lg font-semibold text-slate-900">
                {methodCode} <span className="text-slate-500">/</span> {version}
              </div>
              <div className="text-xs text-slate-500">STAC source: {stacSourceLabel || "—"}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/m/${encodeURIComponent(methodCode)}/v/${encodeURIComponent(version)}`}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900"
              >
                Back to Method
              </Link>
              <button
                type="button"
                onClick={() => void onExportSnapshot()}
                className="rounded-full border border-slate-900 bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
                disabled={stacLoading}
              >
                Export snapshot
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <label className="space-y-1 text-xs text-slate-600">
              <span className="font-semibold text-slate-700">STAC URL</span>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  value={stacUrl}
                  onChange={(e) => setStacUrl(e.target.value)}
                  placeholder="https://example.com/stac/items.json"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void handleLoadStac()}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900"
                  disabled={stacLoading || !stacUrl.trim()}
                >
                  {stacLoading ? "Loading..." : "Load"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleLoadFixture()}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900"
                  disabled={stacLoading}
                >
                  Use fixture
                </button>
              </div>
              {stacError && <div className="text-xs text-rose-600">Error: {stacError}</div>}
            </label>

            <label className="space-y-1 text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Optional AOI (GeoJSON)</span>
              <input
                type="file"
                accept=".json,.geojson,application/json"
                onChange={(e) => void onPickAoi(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
              />
              {aoi && <div className="text-xs text-slate-500">Loaded AOI: {aoi.name}</div>}
              {aoiError && <div className="text-xs text-rose-600">AOI error: {aoiError}</div>}
            </label>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-2xl border border-slate-200 bg-white p-2">
            <MapCanvas
              aoi={aoi}
              pins={[]}
              stacEvidence={stacState?.featureCollection ?? null}
              selectedStacItemId={selectedEvidenceId}
              onSelectStacItemId={(id) => setSelectedEvidenceId(id)}
              viewStorageKey={`evidence-map-${methodCode}-${version}`}
            />
          </div>

          <aside className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Evidence</div>
              <div className="text-xs text-slate-500">{evidenceItems.length} items</div>
            </div>

            {traceLoading && <div className="text-xs text-slate-500">Loading trace index…</div>}
            {traceError && <div className="text-xs text-rose-600">Trace unavailable: {traceError}</div>}

            <div className="space-y-3 overflow-auto">
              {evidenceItems.length === 0 ? (
                <div className="text-sm text-slate-500">No evidence loaded yet.</div>
              ) : (
                evidenceItems.map((item) => {
                  const linkedRules = evidenceRuleIndex.get(item.id) ?? [];
                  const chips = dataQualityChips(item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedEvidenceId(item.id)}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                        selectedEvidenceId === item.id
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{item.id}</span>
                        <span className="text-xs opacity-70">{item.datetime ?? "—"}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1 text-xs">
                        <span className="rounded-full border px-2 py-0.5 text-[10px]">
                          Assets: {Object.keys(item.assets ?? {}).length}
                        </span>
                        {chips.map((chip) => (
                          <span key={chip} className="rounded-full border px-2 py-0.5 text-[10px]">
                            {chip}
                          </span>
                        ))}
                      </div>
                      <div className="mt-2 text-xs">
                        {linkedRules.length === 0 ? (
                          <span className="text-amber-600">Unlinked evidence</span>
                        ) : (
                          <div className="space-y-1">
                            <div className="text-xs font-semibold">Linked rules</div>
                            <div className="flex flex-wrap gap-1">
                              {linkedRules.map((ruleId) => (
                                <Link
                                  key={ruleId}
                                  href={`/m/${encodeURIComponent(methodCode)}/v/${encodeURIComponent(version)}?rule=${encodeURIComponent(ruleId)}`}
                                  className="rounded-full border px-2 py-0.5 text-[10px] hover:border-slate-300 hover:text-slate-900"
                                >
                                  {ruleId}
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
