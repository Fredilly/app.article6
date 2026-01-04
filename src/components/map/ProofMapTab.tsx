"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import MapCanvas from "@/components/map/MapCanvas";
import type { AOI, EvidencePin, VerificationRun } from "@/lib/proofMap/types";
import { parseAoiGeoJson } from "@/lib/proofMap/aoi";
import type { ProofEvidenceItem } from "@/lib/proof/bundle";
import { kindFromCitedId } from "@/lib/proofMap/pins";
import { createAndStoreEvidenceAttachment, deleteAttachmentBytes } from "@/lib/proofMap/attachments";
import { aoiFingerprint, createQueuedVerificationRun, runGeoVistaVerification, runInputFingerprint, splitRunsByAoiFingerprint } from "@/lib/proofMap/verificationRuns";
import type { Map as MapLibreMap } from "maplibre-gl";

type ProofMapTabProps = {
  methodCode: string;
  version: string;
  aoi: AOI | null;
  evidencePins: EvidencePin[];
  verificationRuns: VerificationRun[];
  evidenceSnapshots?: ProofEvidenceItem[];
  onSetAoi: (aoi: AOI | null) => void;
  onRemoveAoi: () => void;
  onSetEvidencePins: (pins: EvidencePin[]) => void;
  onSetVerificationRuns: (runs: VerificationRun[]) => void;
  onNavigateEvidence: (type: "rule" | "section", id: string) => Promise<boolean>;
};

function formatNum(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "—";
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let bytes = value;
  let unit = 0;
  while (bytes >= 1024 && unit < units.length - 1) {
    bytes /= 1024;
    unit += 1;
  }
  const rounded = unit === 0 ? `${Math.round(bytes)}` : bytes.toFixed(1);
  return `${rounded} ${units[unit]}`;
}

function shortSha(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 10)}…${trimmed.slice(-2)}`;
}

function formatLocalDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value);
  }
}

function statusPill(status: VerificationRun["status"]): { label: string; className: string } {
  if (status === "ok") return { label: "OK", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (status === "warn") return { label: "WARN", className: "bg-amber-50 text-amber-800 border-amber-200" };
  if (status === "fail") return { label: "FAIL", className: "bg-rose-50 text-rose-700 border-rose-200" };
  if (status === "queued") return { label: "QUEUED", className: "bg-slate-50 text-slate-700 border-slate-200" };
  return { label: "ERROR", className: "bg-rose-50 text-rose-700 border-rose-200" };
}

export default function ProofMapTab({
  methodCode,
  version,
  aoi,
  evidencePins,
  verificationRuns,
  evidenceSnapshots,
  onSetAoi,
  onRemoveAoi,
  onSetEvidencePins,
  onSetVerificationRuns,
  onNavigateEvidence,
}: ProofMapTabProps) {
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ProofEvidenceItem | null>(null);
  const [runJson, setRunJson] = useState<VerificationRun | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [currentAoiFingerprint, setCurrentAoiFingerprint] = useState<string | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReadyTick, setMapReadyTick] = useState(0);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 900);
  };

  const bboxLabel = useMemo(() => {
    if (!aoi) return null;
    const [minLng, minLat, maxLng, maxLat] = aoi.bbox;
    return `${formatNum(minLng)}, ${formatNum(minLat)} → ${formatNum(maxLng)}, ${formatNum(maxLat)}`;
  }, [aoi]);

  useEffect(() => {
    let cancelled = false;
    if (!aoi) {
      setCurrentAoiFingerprint(null);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const fp = await aoiFingerprint(aoi.geojson);
        if (!cancelled) setCurrentAoiFingerprint(fp);
      } catch {
        if (!cancelled) setCurrentAoiFingerprint(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [aoi]);

  const runBuckets = useMemo(() => {
    if (!currentAoiFingerprint) return { current: [], stale: verificationRuns };
    return splitRunsByAoiFingerprint({ runs: verificationRuns, currentAoiFingerprint });
  }, [currentAoiFingerprint, verificationRuns]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !aoi?.bbox) return;

    const fit = () => {
      try {
        map.resize?.();
      } catch {
        // ignore
      }
      try {
        map.fitBounds(
          [
            [aoi.bbox[0], aoi.bbox[1]],
            [aoi.bbox[2], aoi.bbox[3]],
          ],
          { padding: 20, duration: 0 },
        );
      } catch {
        // ignore
      }
    };

    requestAnimationFrame(() => {
      if (!map.isStyleLoaded?.()) {
        map.once?.("load", fit);
        return;
      }
      fit();
    });
  }, [aoi, mapReadyTick]);

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <MapCanvas
        aoi={aoi}
        pins={evidencePins}
        onMapReady={(map) => {
          mapRef.current = map;
          setMapReadyTick((value) => value + 1);
        }}
        onMapDestroyed={() => {
          mapRef.current = null;
        }}
      />

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4">
        {toast ? (
          <div className="fixed bottom-4 right-4 z-50 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow">
            {toast}
          </div>
        ) : null}
        {snapshot ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
                <div className="text-sm font-semibold text-slate-900">Bundle snapshot</div>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  onClick={() => setSnapshot(null)}
                >
                  Close
                </button>
              </div>
              <div className="grid gap-2 px-5 py-4">
                <div className="text-xs font-semibold text-slate-900">
                  {snapshot.kind}: {snapshot.id}
                </div>
                {snapshot.title ? <div className="text-sm text-slate-800">{snapshot.title}</div> : null}
                {snapshot.snippet ? <div className="text-sm text-slate-700">{snapshot.snippet}</div> : null}
                {snapshot.stable_ref ? (
                  <a className="break-words font-mono text-xs text-slate-600 underline" href={snapshot.stable_ref}>
                    {snapshot.stable_ref}
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        {runJson ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
                <div className="text-sm font-semibold text-slate-900">Verification JSON</div>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  onClick={() => setRunJson(null)}
                >
                  Close
                </button>
              </div>
              <div className="max-h-[70vh] overflow-auto px-5 py-4">
                <pre className="whitespace-pre-wrap break-words font-mono text-xs text-slate-700">
                  {prettyJson(runJson)}
                </pre>
              </div>
            </div>
          </div>
        ) : null}
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
            <div className="mt-3">
              <button
                type="button"
                className="w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  isRunning ||
                  !aoi ||
                  !currentAoiFingerprint ||
                  !methodCode.trim() ||
                  !version.trim() ||
                  !evidencePins.some((pin) => (pin.cited_ids ?? []).length)
                }
                onClick={async () => {
                  if (!aoi) return;
                  setError(null);
                  if (isRunning) return;
                  if (!currentAoiFingerprint) return;

                  const cited_ids = evidencePins.flatMap((pin) => pin.cited_ids ?? []);
                  const attachment_sha256 = evidencePins.flatMap((pin) => (pin.attachments ?? []).map((att) => att.sha256));
                  const input_fingerprint = await runInputFingerprint({
                    aoi_fp: currentAoiFingerprint,
                    cited_ids,
                    attachment_sha256,
                  });
                  if (verificationRuns[0]?.input_fingerprint === input_fingerprint) {
                    showToast("Already ran this exact input.");
                    return;
                  }

                  setIsRunning(true);
                  const queued = createQueuedVerificationRun({
                    method: { code: methodCode, version },
                    aoi,
                    pins: evidencePins,
                    aoi_fingerprint: currentAoiFingerprint,
                    input_fingerprint,
                  });
                  onSetVerificationRuns([queued, ...verificationRuns]);
                  try {
                    const res = await runGeoVistaVerification({
                      method: { code: methodCode, version },
                      aoi,
                      cited_ids: queued.cited_ids,
                      attachment_sha256: queued.attachment_sha256,
                    });
                    const updated: VerificationRun = {
                      ...queued,
                      provider: res.provider,
                      status: res.runStatus,
                      summary: res.summary,
                      result_json: res.result_json,
                    };
                    onSetVerificationRuns([updated, ...verificationRuns]);
                    showToast("Verification complete");
                  } catch (e) {
                    const message = e instanceof Error ? e.message : String(e);
                    const updated: VerificationRun = {
                      ...queued,
                      status: "error",
                      summary: message,
                      result_json: { error: message },
                    };
                    onSetVerificationRuns([updated, ...verificationRuns]);
                    setError(message);
                  } finally {
                    setIsRunning(false);
                  }
                }}
              >
                {isRunning ? "Running…" : "Run verification"}
              </button>
              {!evidencePins.some((pin) => (pin.cited_ids ?? []).length) ? (
                <div className="mt-1 text-[11px] text-slate-500">Add a pin with cited ids to enable.</div>
              ) : null}
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
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-xs font-semibold text-slate-900">{pin.title}</div>
                        {!aoi ? (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                            Unbound (no AOI)
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{formatLocalDateTime(pin.created_at)}</div>
                    </div>
                    <label className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                      Attach file
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (!file) return;
                          setError(null);
                          try {
                            const result = await createAndStoreEvidenceAttachment({ pin_id: pin.id, file });
                            if (!result.ok) {
                              setError(result.message);
                              return;
                            }
                            onSetEvidencePins(
                              evidencePins.map((existing) =>
                                existing.id === pin.id
                                  ? {
                                      ...existing,
                                      attachments: [...(existing.attachments ?? []), result.attachment],
                                    }
                                  : existing,
                              ),
                            );
                            showToast("Attachment saved");
                          } catch (e) {
                            setError(e instanceof Error ? e.message : String(e));
                          }
                        }}
                      />
                    </label>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(pin.cited_ids ?? []).map((id) => {
                      const type = kindFromCitedId(id);
                      return (
                        <button
                          key={`${pin.id}:${id}`}
                          type="button"
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          onClick={async () => {
                            if (!type) return void showToast("Unsupported id");
                            const ok = await onNavigateEvidence(type, id);
                            if (ok) return;
                            const matchSnapshot = (evidenceSnapshots ?? []).find((item) => item.id === id);
                            if (matchSnapshot) setSnapshot(matchSnapshot);
                            else showToast("Evidence not found");
                          }}
                        >
                          {id}
                        </button>
                      );
                    })}
                  </div>
                  {(pin.attachments ?? []).length ? (
                    <div className="mt-3 grid gap-1 rounded-lg border border-slate-100 bg-slate-50 px-2 py-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Attachments
                      </div>
                      <div className="grid gap-1">
                        {(pin.attachments ?? []).map((att) => (
                          <div key={att.id} className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-xs font-semibold text-slate-800">
                                {att.filename} <span className="font-normal text-slate-500">({formatBytes(att.size)})</span>
                              </div>
                              <div className="font-mono text-[11px] text-slate-600">{shortSha(att.sha256)}</div>
                            </div>
                            <button
                              type="button"
                              className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                              onClick={async () => {
                                setError(null);
                                try {
                                  await deleteAttachmentBytes(att.id);
                                } catch {
                                  // ignore (metadata removal still matters)
                                }
                                onSetEvidencePins(
                                  evidencePins.map((existing) =>
                                    existing.id === pin.id
                                      ? {
                                          ...existing,
                                          attachments: (existing.attachments ?? []).filter((item) => item.id !== att.id),
                                        }
                                      : existing,
                                  ),
                                );
                                showToast("Attachment removed");
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-500">No pins yet. Use “Add to map” from Assistant.</div>
            )}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-slate-700">Verification runs (current AOI)</div>
          <div className="mt-2 grid gap-2">
            {currentAoiFingerprint && runBuckets.current.length ? (
              runBuckets.current.map((run) => {
                const pill = statusPill(run.status);
                return (
                  <div key={run.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${pill.className}`}>
                        {pill.label}
                      </span>
                      <span className="text-xs text-slate-500">{formatLocalDateTime(run.created_at)}</span>
                    </div>
                    {run.summary ? <div className="mt-1 text-xs text-slate-700">{run.summary}</div> : null}
                    {run.result_json ? (
                      <button
                        type="button"
                        className="mt-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                        onClick={() => setRunJson(run)}
                      >
                        View JSON
                      </button>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <div className="text-xs text-slate-500">
                {!aoi ? "No AOI uploaded." : !currentAoiFingerprint ? "Computing AOI fingerprint…" : "No runs yet for this AOI."}
              </div>
            )}
            {aoi && runBuckets.stale.length ? (
              <div className="mt-1">
                <button
                  type="button"
                  className="w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  onClick={() => setShowHistory((v) => !v)}
                >
                  {showHistory ? "Hide history" : `History (older AOIs) • ${runBuckets.stale.length}`}
                </button>
                {showHistory ? (
                  <div className="mt-2 grid gap-2">
                    {runBuckets.stale.map((run) => {
                      const pill = statusPill(run.status);
                      return (
                        <div key={run.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${pill.className}`}>
                                {pill.label}
                              </span>
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                STALE (AOI changed)
                              </span>
                            </div>
                            <span className="text-xs text-slate-500">{formatLocalDateTime(run.created_at)}</span>
                          </div>
                          {run.summary ? <div className="mt-1 text-xs text-slate-700">{run.summary}</div> : null}
                          {run.result_json ? (
                            <button
                              type="button"
                              className="mt-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                              onClick={() => setRunJson(run)}
                            >
                              View JSON
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
