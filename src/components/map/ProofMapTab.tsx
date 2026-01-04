"use client";

import { useMemo, useState } from "react";
import MapCanvas from "@/components/map/MapCanvas";
import type { AOI, EvidencePin } from "@/lib/proofMap/types";
import { parseAoiGeoJson } from "@/lib/proofMap/aoi";

type ProofMapTabProps = {
  aoi: AOI | null;
  evidencePins: EvidencePin[];
  onSetAoi: (aoi: AOI | null) => void;
  onRemoveAoi: () => void;
  onNavigateEvidence: (type: "rule" | "section", id: string) => void;
};

function formatNum(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "—";
}

export default function ProofMapTab({ aoi, evidencePins, onSetAoi, onRemoveAoi, onNavigateEvidence }: ProofMapTabProps) {
  const [error, setError] = useState<string | null>(null);

  const bboxLabel = useMemo(() => {
    if (!aoi) return null;
    const [minLng, minLat, maxLng, maxLat] = aoi.bbox;
    return `${formatNum(minLng)}, ${formatNum(minLat)} → ${formatNum(maxLng)}, ${formatNum(maxLat)}`;
  }, [aoi]);

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <MapCanvas aoi={aoi} pins={evidencePins} />

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-slate-900">AOI + Evidence</div>
            <div className="mt-1 text-xs text-slate-500">Stored locally for this method/version.</div>
          </div>
          <label className="inline-flex cursor-pointer items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            Upload AOI
            <input
              type="file"
              accept=".json,.geojson,application/json"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                setError(null);
                try {
                  const text = await file.text();
                  const parsed = JSON.parse(text) as unknown;
                  const result = parseAoiGeoJson(parsed, file.name.replace(/\\.(geojson|json)$/i, ""));
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  onSetAoi(result.aoi);
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              }}
            />
          </label>
        </div>

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        ) : null}

        {aoi ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-slate-900">{aoi.name}</div>
              <button
                type="button"
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={onRemoveAoi}
              >
                Remove AOI
              </button>
            </div>
            <div className="mt-2 grid gap-1 text-xs text-slate-600">
              <div>area: {formatNum(aoi.area_km2)} km²</div>
              <div className="break-words">bbox: {bboxLabel}</div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-3 text-xs text-slate-500">
            No AOI uploaded.
          </div>
        )}

        <div>
          <div className="text-xs font-semibold text-slate-700">Evidence pins</div>
          <div className="mt-2 grid gap-2">
            {evidencePins.length ? (
              evidencePins.map((pin) => (
                <div key={pin.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="text-xs font-semibold text-slate-900">{pin.title}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pin.cited_ids.map((id) => {
                      const type = /^R-/i.test(id) ? "rule" : "section";
                      return (
                        <button
                          key={`${pin.id}:${id}`}
                          type="button"
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          onClick={() => onNavigateEvidence(type, id)}
                        >
                          {id}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-500">No pins yet. Use “Add to map” from Assistant.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

