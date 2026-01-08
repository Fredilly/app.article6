"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapCanvas from "@/components/map/MapCanvas";
import type { AOI, EvidencePin, VerificationRun } from "@/lib/proofMap/types";
import { parseAoiGeoJson } from "@/lib/proofMap/aoi";
import type { ProofEvidenceItem } from "@/lib/proof/bundle";
import { kindFromCitedId } from "@/lib/proofMap/pins";
import { createAndStoreEvidenceAttachment, deleteAttachmentBytes } from "@/lib/proofMap/attachments";
import { aoiFingerprint, createQueuedVerificationRun, runInputFingerprint, runsForCurrentAoi, runStacEvidenceSearch, shouldDisableRunVerification } from "@/lib/proofMap/verificationRuns";
import type { Map as MapLibreMap } from "maplibre-gl";
import selectLatestOkStacRunForActiveAoi from "@/lib/runs/selectLatestOkStacRunForActiveAoi";
import normalizeStacItems from "@/lib/stac/normalizeStacItems";
import { pickProvenanceFields, shortSha as shortCommitSha } from "@/lib/trustFormat";
import { buildEvidenceSnapshot } from "@/lib/proofMap/evidenceSnapshot";
import deriveLinksFromProperties from "@/lib/proofMap/deriveLinksFromProperties";
import getFeatureBbox from "@/lib/map/getFeatureBbox";
import { bboxIntersects, centerFromBbox, unionBbox } from "@/lib/map/bbox";

type ProofMapTabProps = {
  methodCode: string;
  version: string;
  provenanceJson?: unknown | null;
  aoi: AOI | null;
  evidencePins: EvidencePin[];
  verificationRuns: VerificationRun[];
  stacEvidenceState:
    | {
        aoiFingerprint: string;
        fc: GeoJSON.FeatureCollection;
        itemsById: Record<string, unknown>;
        runId: string;
        source?: { type: "stac_url" | "unknown"; ref: string };
      }
    | null;
  selectedStacItemId: string | null;
  evidenceSnapshots?: ProofEvidenceItem[];
  onSetAoi: (aoi: AOI | null) => void;
  onSetEvidencePins: (pins: EvidencePin[]) => void;
  onSetVerificationRuns: (runs: VerificationRun[]) => void;
  onSetStacEvidenceState: (
    next:
      | {
          aoiFingerprint: string;
          fc: GeoJSON.FeatureCollection;
          itemsById: Record<string, unknown>;
          runId: string;
          source?: { type: "stac_url" | "unknown"; ref: string };
        }
      | null,
  ) => void;
  onSelectStacItemId: (id: string | null) => void;
  onStartOver: () => void;
  onNavigateEvidence: (type: "rule" | "section", id: string) => Promise<boolean>;
  onEvidenceSelectionChange?: (selection: { kind: "evidence"; id: string; ruleIds: string[]; sectionIds: string[] } | null) => void;
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

function downloadJson(value: unknown, filename: string) {
  const text = JSON.stringify(value, null, 2);
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

function safeFilename(value: string): string {
  const trimmed = (value ?? "").trim() || "unknown";
  return trimmed.replace(/[^\w.\-]+/g, "_").slice(0, 64) || "unknown";
}

function hostnamePathFromUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.host}${url.pathname}`;
  } catch {
    return value;
  }
}

function parseBbox(value: unknown): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length < 4) return null;
  const a = value[0];
  const b = value[1];
  const c = value[2];
  const d = value[3];
  if (typeof a !== "number" || typeof b !== "number" || typeof c !== "number" || typeof d !== "number") return null;
  if (![a, b, c, d].every((n) => Number.isFinite(n))) return null;
  return [a, b, c, d];
}

function formatLocalDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function zoomToBbox(map: MapLibreMap | null, bbox: [number, number, number, number] | null, padding = 70) {
  if (!map?.fitBounds) return;
  if (!bbox) return;
  try {
    map.fitBounds(
      [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ],
      { padding, duration: 0 },
    );
  } catch {
    // ignore
  }
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
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
  provenanceJson,
  aoi,
  evidencePins,
  verificationRuns,
  stacEvidenceState,
  selectedStacItemId,
  evidenceSnapshots,
  onSetAoi,
  onSetEvidencePins,
  onSetVerificationRuns,
  onSetStacEvidenceState,
  onSelectStacItemId,
  onStartOver,
  onNavigateEvidence,
  onEvidenceSelectionChange,
}: ProofMapTabProps) {
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ProofEvidenceItem | null>(null);
  const [runJson, setRunJson] = useState<VerificationRun | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentAoiFingerprint, setCurrentAoiFingerprint] = useState<string | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReadyTick, setMapReadyTick] = useState(0);
  const [stacCentroidsEnabled, setStacCentroidsEnabled] = useState(true);
  const [viewportBbox, setViewportBbox] = useState<[number, number, number, number] | null>(null);
  const stacEvidenceCardRef = useRef<HTMLDivElement | null>(null);
  const [stacInspectOpen, setStacInspectOpen] = useState(false);
  const [lastSelectionSource, setLastSelectionSource] = useState<"pin" | "polygon" | null>(null);
  const [startOverOpen, setStartOverOpen] = useState(false);
  const [startOverBusy, setStartOverBusy] = useState(false);
  const [initialViewportBbox, setInitialViewportBbox] = useState<[number, number, number, number] | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = new URLSearchParams(window.location.search).get("bbox");
    if (!raw) return null;
    const parts = raw.split(",").map((value) => Number(value.trim()));
    if (parts.length !== 4) return null;
    if (parts.some((n) => !Number.isFinite(n))) return null;
    return [parts[0], parts[1], parts[2], parts[3]];
  });
  const viewStorageKey = useMemo(() => `${methodCode}@${version}`, [methodCode, version]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 900);
  };

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast("Copied");
    } catch {
      showToast("Copy failed");
    }
  };

  const selectEvidence = (id: string, source: "pin" | "polygon") => {
    onSelectStacItemId(id);
    setLastSelectionSource(source);
    setStacInspectOpen(true);
    requestAnimationFrame(() => {
      try {
        stacEvidenceCardRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      } catch {
        // ignore
      }
    });
  };

  useEffect(() => {
    if (selectedStacItemId) return;
    setLastSelectionSource(null);
    setStacInspectOpen(false);
  }, [selectedStacItemId]);

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
        if (cancelled) return;
        setCurrentAoiFingerprint(fp);
        onSelectStacItemId(null);
        if (aoi.aoi_fingerprint !== fp) {
          onSetAoi({ ...aoi, aoi_fingerprint: fp });
        }
      } catch {
        if (!cancelled) setCurrentAoiFingerprint(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [aoi, onSelectStacItemId, onSetAoi]);

  useEffect(() => {
    if (!aoi || !currentAoiFingerprint) return;
    const nextPins = evidencePins.map((pin) => {
      if (pin.aoi_fingerprint) return pin;
      if (pin.aoi_id && pin.aoi_id === aoi.id) return { ...pin, aoi_fingerprint: currentAoiFingerprint };
      return pin;
    });
    const changed = nextPins.some((pin, idx) => pin !== evidencePins[idx]);
    if (changed) onSetEvidencePins(nextPins);
  }, [aoi, currentAoiFingerprint, evidencePins, onSetEvidencePins]);

  useEffect(() => {
    onSelectStacItemId(null);
  }, [methodCode, onSelectStacItemId, version]);

  const currentRuns = useMemo(() => {
    return runsForCurrentAoi({ runs: verificationRuns, currentAoiFingerprint });
  }, [currentAoiFingerprint, verificationRuns]);

  const latestStacRun = useMemo(() => {
    return selectLatestOkStacRunForActiveAoi({ runs: verificationRuns, activeAoiFingerprint: currentAoiFingerprint });
  }, [currentAoiFingerprint, verificationRuns]);

  const currentStacEvidence = useMemo(() => {
    if (!currentAoiFingerprint) return null;
    if (!stacEvidenceState) return null;
    if (stacEvidenceState.aoiFingerprint !== currentAoiFingerprint) return null;
    return stacEvidenceState;
  }, [currentAoiFingerprint, stacEvidenceState]);

  const stacRenderedCount = currentStacEvidence?.fc?.features?.length ?? 0;

  const evidenceDiagnostics = useMemo(() => {
    const features = currentStacEvidence?.fc?.features ?? [];
    const total = features.length;
    let valid = 0;
    let bounds: [number, number, number, number] | null = null;
    const byIdBbox = new Map<string, [number, number, number, number]>();

    for (const feature of features) {
      const bbox = getFeatureBbox(feature);
      const id =
        feature && typeof feature === "object"
          ? (() => {
              const record = feature as unknown as { id?: unknown; properties?: unknown };
              const props = record.properties && typeof record.properties === "object" ? (record.properties as Record<string, unknown>) : null;
              const pid = props && typeof props.id === "string" ? props.id : null;
              const fid = typeof record.id === "string" ? record.id : null;
              return pid ?? fid ?? null;
            })()
          : null;

      if (!bbox || !id) {
        continue;
      }
      valid += 1;
      bounds = unionBbox(bounds, bbox);
      byIdBbox.set(id, bbox);
    }

    const inView =
      viewportBbox && total
        ? Array.from(byIdBbox.values()).reduce((acc, bbox) => (bboxIntersects(viewportBbox, bbox) ? acc + 1 : acc), 0)
        : null;

    return { total, valid, skipped: total - valid, bounds, byIdBbox, inView };
  }, [currentStacEvidence?.fc?.features, viewportBbox]);

  const stacCentroids = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(() => {
    const features: Array<GeoJSON.Feature<GeoJSON.Point>> = [];
    for (const [id, bbox] of evidenceDiagnostics.byIdBbox.entries()) {
      const [lng, lat] = centerFromBbox(bbox);
      features.push({
        type: "Feature",
        id,
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: { id },
      });
    }
    return { type: "FeatureCollection", features };
  }, [evidenceDiagnostics.byIdBbox]);

  const stacFeatureIds = useMemo(() => {
    const ids = Array.from(evidenceDiagnostics.byIdBbox.keys());
    ids.sort((a, b) => a.localeCompare(b));
    return ids;
  }, [evidenceDiagnostics.byIdBbox]);

  const selectedStacDetails = useMemo(() => {
    if (!selectedStacItemId) return null;
    const record = currentStacEvidence?.itemsById?.[selectedStacItemId];
    if (!record || typeof record !== "object") return null;

    const selected = record as Record<string, unknown>;
    const props = isRecord(selected.properties) ? (selected.properties as Record<string, unknown>) : null;
    const links = deriveLinksFromProperties(props);
    const bbox = parseBbox(selected.bbox);
    const bboxLabel = bbox ? `${formatNum(bbox[0])}, ${formatNum(bbox[1])} → ${formatNum(bbox[2])}, ${formatNum(bbox[3])}` : "—";

    const rawDatetime =
      (props && typeof props.datetime === "string" ? props.datetime : null) ??
      (typeof selected.datetime === "string" ? selected.datetime : null);

    const cloudCover = props ? props["eo:cloud_cover"] : null;

    const assets = props && isRecord(props.assets) ? (props.assets as Record<string, unknown>) : null;
    const assetRows = assets
      ? (Object.entries(assets)
          .map(([key, value]) => {
            const href =
              typeof value === "string"
                ? value
                : isRecord(value) && typeof value.href === "string"
                  ? value.href
                  : null;
            return href ? { key, href } : null;
          })
          .filter(Boolean) as Array<{ key: string; href: string }>)
      : [];

    const propsLinks = props && Array.isArray(props.links) ? (props.links as unknown[]) : [];
    const linkRows = propsLinks
      .map((link) => {
        if (!isRecord(link)) return null;
        if (typeof link.href !== "string") return null;
        const rel = typeof link.rel === "string" ? link.rel : "link";
        return { rel, href: link.href };
      })
      .filter(Boolean) as Array<{ rel: string; href: string }>;

    return {
      id: selectedStacItemId,
      datetime: rawDatetime ? formatLocalDateTime(rawDatetime) : "—",
      cloudCover: cloudCover == null ? "—" : String(cloudCover),
      runId: currentStacEvidence?.runId ?? "",
      bbox: bboxLabel,
      assetsCount: assetRows.length,
      assetRows,
      linkRows,
      ruleIds: links.ruleIds,
      sectionIds: links.sectionIds,
    };
  }, [currentStacEvidence, selectedStacItemId]);

  useEffect(() => {
    if (!onEvidenceSelectionChange) return;
    if (!selectedStacDetails) {
      onEvidenceSelectionChange(null);
      return;
    }
    onEvidenceSelectionChange({
      kind: "evidence",
      id: selectedStacDetails.id,
      ruleIds: selectedStacDetails.ruleIds ?? [],
      sectionIds: selectedStacDetails.sectionIds ?? [],
    });
  }, [onEvidenceSelectionChange, selectedStacDetails]);

  const stacEndpointUrl = useMemo(() => {
    if (currentStacEvidence?.source?.type === "stac_url") return currentStacEvidence.source.ref;
    if (!latestStacRun) return null;
    const root =
      latestStacRun.result_json && typeof latestStacRun.result_json === "object"
        ? (latestStacRun.result_json as Record<string, unknown>)
        : null;
    const prov = root && root.provenance && typeof root.provenance === "object" ? (root.provenance as Record<string, unknown>) : null;
    const endpoint = prov && typeof prov.endpoint === "string" ? prov.endpoint : null;
    return endpoint && endpoint.trim() ? endpoint.trim() : null;
  }, [currentStacEvidence?.source, latestStacRun]);

  const localEvidenceHashInputs = useMemo(() => {
    const citedIds = evidencePins.flatMap((pin) => pin.cited_ids ?? []);
    const attachmentSha = evidencePins.flatMap((pin) => (pin.attachments ?? []).map((att) => att.sha256));
    const combined = [...citedIds.map((v) => `cited:${v}`), ...attachmentSha.map((v) => `att:${v}`)].filter(Boolean);
    return combined.length ? combined : null;
  }, [evidencePins]);

  const trustPicked = useMemo(() => pickProvenanceFields(provenanceJson), [provenanceJson]);
  const auditHashes = trustPicked.auditHashes;
  const appCommit = shortCommitSha(process.env.NEXT_PUBLIC_GIT_SHA || "");

  const evidenceChip = useMemo(() => {
    if (stacEndpointUrl) {
      return { label: "evidence", display: hostnamePathFromUrl(stacEndpointUrl), value: stacEndpointUrl };
    }
    return null;
  }, [stacEndpointUrl]);

  const hasStartOverState = useMemo(() => {
    const hasAoi = Boolean(aoi);
    const hasPins = evidencePins.length > 0;
    const hasSelection = Boolean(selectedStacItemId);
    const hasEvidence = (currentStacEvidence?.fc?.features?.length ?? 0) > 0;
    const hasRuns = verificationRuns.length > 0;
    const hasSnapshots = (evidenceSnapshots ?? []).length > 0;
    return hasAoi || hasPins || hasSelection || hasEvidence || hasRuns || hasSnapshots;
  }, [aoi, currentStacEvidence?.fc?.features?.length, evidencePins.length, evidenceSnapshots, selectedStacItemId, verificationRuns.length]);

  const runStartOver = useCallback(async () => {
    if (startOverBusy) return;
    setStartOverBusy(true);
    try {
      for (const pin of evidencePins) {
        for (const attachment of pin.attachments ?? []) {
          if (!attachment?.id) continue;
          try {
            await deleteAttachmentBytes(attachment.id);
          } catch {
            // ignore
          }
        }
      }
      onStartOver();

      setError(null);
      setSnapshot(null);
      setRunJson(null);
      setViewportBbox(null);
      setStacInspectOpen(false);
      setLastSelectionSource(null);
      setStacCentroidsEnabled(true);
      try {
        mapRef.current?.jumpTo?.({ center: [0, 0], zoom: 1 });
      } catch {
        // ignore
      }
      showToast("Cleared. Upload an AOI to begin.");
    } finally {
      setStartOverBusy(false);
      setStartOverOpen(false);
    }
  }, [
    evidencePins,
    onStartOver,
    startOverBusy,
  ]);

  useEffect(() => {
    if (!startOverOpen) return;
    if (hasStartOverState) return;
    setStartOverOpen(false);
  }, [hasStartOverState, startOverOpen]);

  useEffect(() => {
    if (!currentAoiFingerprint) return;
    if (!latestStacRun) return;

    if (stacEvidenceState && stacEvidenceState.aoiFingerprint === currentAoiFingerprint && stacEvidenceState.runId === latestStacRun.id) {
      return;
    }

    const normalized = normalizeStacItems(latestStacRun.result_json);
    const endpoint = (() => {
      const root =
        latestStacRun.result_json && typeof latestStacRun.result_json === "object"
          ? (latestStacRun.result_json as Record<string, unknown>)
          : null;
      const prov = root && root.provenance && typeof root.provenance === "object" ? (root.provenance as Record<string, unknown>) : null;
      const url = prov && typeof prov.endpoint === "string" ? prov.endpoint : null;
      return url && url.trim() ? url.trim() : null;
    })();

    onSetStacEvidenceState({
      aoiFingerprint: currentAoiFingerprint,
      fc: normalized.featureCollection,
      itemsById: normalized.itemsById,
      runId: latestStacRun.id,
      source: endpoint ? { type: "stac_url", ref: endpoint } : { type: "unknown", ref: "unknown" },
    });
  }, [currentAoiFingerprint, latestStacRun, onSetStacEvidenceState, stacEvidenceState]);

  useEffect(() => {
    if (selectedStacItemId && !latestStacRun) onSelectStacItemId(null);
  }, [latestStacRun, onSelectStacItemId, selectedStacItemId]);

  useEffect(() => {
    if (!selectedStacItemId) return;
    if (!currentStacEvidence?.itemsById?.[selectedStacItemId]) {
      onSelectStacItemId(null);
    }
  }, [currentStacEvidence, onSelectStacItemId, selectedStacItemId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    requestAnimationFrame(() => {
      try {
        map.resize?.();
      } catch {
        // ignore
      }
    });
  }, [mapReadyTick]);

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
    <div className="mt-4 grid gap-4">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={async () => {
                const text = `${methodCode}@${version}`;
                await copyToClipboard(text);
              }}
              title={`Copy method ${methodCode}@${version}`}
            >
              <span className="text-slate-500">method:</span>
              <span className="font-mono">{methodCode}@{version}</span>
            </button>

            {appCommit ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={async () => {
                  const full = (process.env.NEXT_PUBLIC_GIT_SHA || "").trim();
                  await copyToClipboard(full || appCommit);
                }}
                title="Copy app commit"
              >
                <span className="text-slate-500">app:</span>
                <span className="font-mono">{appCommit}</span>
              </button>
            ) : null}

            {evidenceChip ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={async () => {
                  await copyToClipboard(evidenceChip.value);
                }}
                title="Copy evidence layer ref"
              >
                <span className="text-slate-500">{evidenceChip.label}:</span>
                <span className="font-mono">{evidenceChip.display}</span>
              </button>
            ) : localEvidenceHashInputs ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={async () => {
                  const snapshot = await buildEvidenceSnapshot({
                    method: { code: methodCode, version },
                    evidence_source: { type: "upload", ref: "local_pins", hash_inputs: localEvidenceHashInputs },
                    generated_at: new Date().toISOString(),
                  });
                  if (snapshot.evidence_source.hash) await copyToClipboard(snapshot.evidence_source.hash);
                }}
                title="Copy local evidence hash"
              >
                <span className="text-slate-500">evidence:</span>
                <span className="font-mono">local:{localEvidenceHashInputs.length}</span>
              </button>
            ) : (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
                evidence: none
              </span>
            )}

            {auditHashes?.rules ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={async () => copyToClipboard(auditHashes.rules ?? "")}
                title="Copy rules_sha256"
              >
                <span className="text-slate-500">rules:</span>
                <span className="font-mono">{shortSha(auditHashes.rules)}</span>
              </button>
            ) : null}
            {auditHashes?.sections ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={async () => copyToClipboard(auditHashes.sections ?? "")}
                title="Copy sections_sha256"
              >
                <span className="text-slate-500">sections:</span>
                <span className="font-mono">{shortSha(auditHashes.sections)}</span>
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={async () => {
                const now = new Date();
                const date = now.toISOString().slice(0, 10);
                const selectedItem =
                  selectedStacItemId && currentStacEvidence?.itemsById?.[selectedStacItemId] && typeof currentStacEvidence.itemsById[selectedStacItemId] === "object"
                    ? (currentStacEvidence.itemsById[selectedStacItemId] as Record<string, unknown>)
                    : null;

                const minimalItem = selectedItem
                  ? {
                      id: selectedStacItemId ?? undefined,
                      datetime:
                        isRecord(selectedItem.properties) && typeof selectedItem.properties.datetime === "string"
                          ? selectedItem.properties.datetime
                          : typeof selectedItem.datetime === "string"
                            ? selectedItem.datetime
                            : undefined,
                      bbox: selectedItem.bbox,
                      geometry: selectedItem.geometry,
                    }
                  : undefined;

                const citedIds = evidencePins.flatMap((pin) => pin.cited_ids ?? []);
                const selectedIds = selectedStacItemId ? [selectedStacItemId] : citedIds.length ? citedIds : undefined;

                const evidenceSource =
                  stacEndpointUrl
                    ? { type: "stac_url" as const, ref: stacEndpointUrl }
                    : localEvidenceHashInputs
                      ? { type: "upload" as const, ref: "local_pins", hash_inputs: localEvidenceHashInputs }
                      : { type: "unknown" as const, ref: "unknown" };

                const snap = await buildEvidenceSnapshot({
                  method: { code: methodCode, version },
                  aoi: aoi
                    ? {
                        id: aoi.id,
                        bbox: aoi.bbox,
                        geojson: aoi.geojson,
                      }
                    : undefined,
                  evidence_source: evidenceSource,
                  selected: {
                    id: selectedStacItemId ?? undefined,
                    ids: selectedIds,
                    item: minimalItem ?? undefined,
                  },
                  generated_at: now.toISOString(),
                  app: {
                    commit: asNonEmptyString(process.env.NEXT_PUBLIC_GIT_SHA),
                    env: asNonEmptyString(process.env.NEXT_PUBLIC_VERCEL_ENV),
                    version: asNonEmptyString(process.env.NEXT_PUBLIC_APP_VERSION),
                  },
                });

                const filename = `evidence-snapshot.${safeFilename(methodCode)}.${safeFilename(version)}.${date}.json`;
                downloadJson(snap, filename);
                showToast("Snapshot downloaded");
              }}
            >
              Export snapshot
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <MapCanvas
        aoi={aoi}
        pins={evidencePins}
        stacEvidence={currentStacEvidence?.fc ?? null}
        stacEvidenceCentroids={stacCentroids}
        stacEvidenceCentroidsEnabled={stacCentroidsEnabled}
        stacEvidenceRunId={currentStacEvidence?.runId ?? null}
        viewStorageKey={viewStorageKey}
        initialViewportBbox={initialViewportBbox}
        selectedStacItemId={selectedStacItemId}
        onSelectEvidence={({ id, source }) => selectEvidence(id, source)}
        onViewportBboxChange={(bbox) => {
          setViewportBbox(bbox);
        }}
        onMapReady={(map) => {
          mapRef.current = map;
          setMapReadyTick((value) => value + 1);
          setInitialViewportBbox(null);
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
                <div className="text-sm font-semibold text-slate-900">Evidence search JSON</div>
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
        {startOverOpen ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
                <div className="text-sm font-semibold text-slate-900">Start over?</div>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => setStartOverOpen(false)}
                  disabled={startOverBusy}
                >
                  Close
                </button>
              </div>
              <div className="grid gap-4 px-5 py-4">
                <div className="text-sm text-slate-700">
                  This clears the AOI, pins, and evidence selections for this method/version.
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => setStartOverOpen(false)}
                    disabled={startOverBusy}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-rose-200 bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => void runStartOver()}
                    disabled={startOverBusy}
                  >
                    Start over
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-slate-900">AOI + Evidence</div>
            <div className="mt-1 text-xs text-slate-500">Stored locally for this method/version.</div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 shadow-sm hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                if (hasStartOverState) setStartOverOpen(true);
                else showToast("Nothing to clear.");
              }}
              disabled={startOverBusy}
            >
              Start over
            </button>
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
        </div>
        <div className="text-xs text-slate-500">Clears AOI, pins, and evidence selections.</div>

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        ) : null}

        {aoi ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-xs font-semibold text-slate-900">{aoi.name}</div>
            <div className="mt-2 grid gap-1 text-xs text-slate-600">
              <div>area: {formatNum(aoi.area_km2)} km²</div>
              <div className="break-words">bbox: {bboxLabel}</div>
            </div>
            <div className="mt-3">
              <button
                type="button"
                className="w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={shouldDisableRunVerification({ isRunning, aoi, currentAoiFingerprint, methodCode, version, evidencePins })}
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
                    const res = await runStacEvidenceSearch({
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
                      ended_at: new Date().toISOString(),
                    };

                    if (res.provider === "stac" && res.runStatus === "ok") {
                      const normalized = normalizeStacItems(res.result_json);
                      const endpoint = (() => {
                        const root = res.result_json && typeof res.result_json === "object" ? (res.result_json as Record<string, unknown>) : null;
                        const prov = root && root.provenance && typeof root.provenance === "object" ? (root.provenance as Record<string, unknown>) : null;
                        const url = prov && typeof prov.endpoint === "string" ? prov.endpoint : null;
                        return url && url.trim() ? url.trim() : null;
                      })();

                      onSetStacEvidenceState({
                        aoiFingerprint: currentAoiFingerprint,
                        fc: normalized.featureCollection,
                        itemsById: normalized.itemsById,
                        runId: updated.id,
                        source: endpoint ? { type: "stac_url", ref: endpoint } : { type: "unknown", ref: "unknown" },
                      });
                      onSelectStacItemId(null);

                      let evidenceBbox: [number, number, number, number] | null = null;
                      for (const item of Object.values(normalized.itemsById)) {
                        if (!item || typeof item !== "object") continue;
                        const record = item as Record<string, unknown>;
                        evidenceBbox = unionBbox(evidenceBbox, getFeatureBbox(record));
                      }
                      const targetBbox = unionBbox(parseBbox(aoi.bbox), evidenceBbox) ?? evidenceBbox ?? parseBbox(aoi.bbox);
                      if (targetBbox && mapRef.current?.fitBounds) {
                        try {
                          mapRef.current.fitBounds(
                            [
                              [targetBbox[0], targetBbox[1]],
                              [targetBbox[2], targetBbox[3]],
                            ],
                            { padding: 40, duration: 0 },
                          );
                        } catch {
                          // ignore
                        }
                      }
                    }

                    onSetVerificationRuns([updated, ...verificationRuns]);
                    showToast("Search complete");
                  } catch (e) {
                    const message = e instanceof Error ? e.message : String(e);
                    const updated: VerificationRun = {
                      ...queued,
                      status: "error",
                      summary: message,
                      result_json: { error: message },
                      ended_at: new Date().toISOString(),
                    };
                    onSetVerificationRuns([updated, ...verificationRuns]);
                    setError(message);
                  } finally {
                    setIsRunning(false);
                  }
                }}
              >
                {isRunning ? "Searching…" : "Search STAC evidence"}
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
                  {currentStacEvidence?.runId && selectedStacItemId ? (
                    <button
                      type="button"
                      className="mt-2 w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                      onClick={() => {
                        const existing = new Set(pin.stac_item_ids ?? []);
                        existing.add(selectedStacItemId);
                        onSetEvidencePins(
                          evidencePins.map((item) =>
                            item.id === pin.id
                              ? {
                                  ...item,
                                  stac_item_ids: Array.from(existing),
                                  stac_run_id: item.stac_run_id ?? currentStacEvidence.runId,
                                }
                              : item,
                          ),
                        );
                        showToast("STAC item attached");
                      }}
                    >
                      Attach selected STAC item
                    </button>
                  ) : null}
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
                  {(pin.stac_item_ids ?? []).length ? (
                    <div className="mt-3 grid gap-1 rounded-lg border border-slate-100 bg-slate-50 px-2 py-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        STAC items
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(pin.stac_item_ids ?? []).map((id) => (
                          <button
                            key={id}
                            type="button"
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                            onClick={() => onSelectStacItemId(id)}
                          >
                            {id}
                          </button>
                        ))}
                      </div>
                      {pin.stac_run_id ? (
                        <div className="mt-1 font-mono text-[11px] text-slate-500">run: {pin.stac_run_id}</div>
                      ) : null}
                    </div>
                  ) : null}
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
          <div className="text-xs font-semibold text-slate-700">STAC Evidence</div>
          <div className="mt-2 grid gap-2">
            {aoi && currentAoiFingerprint && stacRenderedCount ? (
              <div ref={stacEvidenceCardRef} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-900">
                    {stacRenderedCount} feature(s)
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => onSelectStacItemId(null)}
                    disabled={!selectedStacItemId}
                  >
                    Clear selection
                  </button>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">Rendered: {stacRenderedCount}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span>
                    Valid: {evidenceDiagnostics.valid}, Skipped: {evidenceDiagnostics.skipped}
                  </span>
                  {evidenceDiagnostics.inView != null ? (
                    <span>
                      In view: {evidenceDiagnostics.inView}/{evidenceDiagnostics.valid}
                    </span>
                  ) : null}
                </div>
                {evidenceDiagnostics.bounds ? (
                  <div className="mt-1 break-words font-mono text-[11px] text-slate-500">
                    Bounds: {formatNum(evidenceDiagnostics.bounds[0])}, {formatNum(evidenceDiagnostics.bounds[1])} →{" "}
                    {formatNum(evidenceDiagnostics.bounds[2])}, {formatNum(evidenceDiagnostics.bounds[3])}
                  </div>
                ) : (
                  <div className="mt-1 text-[11px] text-slate-500">Bounds: —</div>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                    onClick={() => {
                      if (!evidenceDiagnostics.bounds) return void showToast("No valid evidence geometry/bbox");
                      zoomToBbox(mapRef.current, evidenceDiagnostics.bounds, 80);
                    }}
                    title="Zoom map to evidence bounds"
                  >
                    Zoom to evidence ({evidenceDiagnostics.valid})
                  </button>
                  <button
                    type="button"
                    className={`rounded-full border px-3 py-1 text-xs font-semibold shadow-sm ${
                      stacCentroidsEnabled
                        ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                    onClick={() => setStacCentroidsEnabled((v) => !v)}
                    title="Toggle centroid pins"
                  >
                    Pins: {stacCentroidsEnabled ? "On" : "Off"}
                  </button>
                </div>
                {stacFeatureIds.length ? (
                  <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-2 py-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Features
                    </div>
                    <div className="mt-2 max-h-40 overflow-auto">
                      <div className="grid gap-1">
                        {stacFeatureIds.slice(0, 60).map((id) => {
                          const bbox = evidenceDiagnostics.byIdBbox.get(id) ?? null;
                          const selected = id === selectedStacItemId;
                          return (
                            <button
                              key={id}
                              type="button"
                              className={`w-full rounded-md border px-2 py-1 text-left text-xs font-semibold shadow-sm transition ${
                                selected
                                  ? "border-sky-200 bg-white text-slate-900"
                                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                              }`}
                              onClick={() => {
                                selectEvidence(id, "pin");
                                zoomToBbox(mapRef.current, bbox, 120);
                              }}
                              title="Select and zoom to feature"
                            >
                              <span className="font-mono">{id}</span>
                            </button>
                          );
                        })}
                        {stacFeatureIds.length > 60 ? (
                          <div className="pt-1 text-[11px] text-slate-500">
                            Showing first 60 of {stacFeatureIds.length}.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
                {selectedStacItemId && !stacInspectOpen ? (
                  <button
                    type="button"
                    className="mt-3 w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                    onClick={() => setStacInspectOpen(true)}
                  >
                    Open inspect
                  </button>
                ) : null}
                {selectedStacDetails && stacInspectOpen ? (
                  <div className="mt-3 grid gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2 py-2">
                      <div className="text-xs font-semibold text-slate-900">
                        Selected: <span className="font-mono">{selectedStacDetails.id}</span>
                        {lastSelectionSource ? (
                          <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            via {lastSelectionSource}
                          </span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                        onClick={() => setStacInspectOpen(false)}
                        title="Collapse inspect"
                      >
                        Hide
                      </button>
                    </div>
                    <div className="grid gap-1 text-xs text-slate-700">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900">Item ID</span>
                        <button
                          type="button"
                          className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                          onClick={() => copyToClipboard(selectedStacDetails.id)}
                        >
                          Copy
                        </button>
                      </div>
                      <div className="break-words font-mono text-[11px] text-slate-600">{selectedStacDetails.id}</div>
                    </div>
                    <div className="grid gap-1 text-xs text-slate-700">
                      <div className="font-semibold text-slate-900">BBox</div>
                      <div className="font-mono text-[11px] text-slate-600">{selectedStacDetails.bbox}</div>
                    </div>
                    <div className="grid gap-1 text-xs text-slate-700">
                      <div className="font-semibold text-slate-900">Datetime</div>
                      <div className="font-mono text-[11px] text-slate-600">{selectedStacDetails.datetime}</div>
                    </div>
                    <div className="grid gap-1 text-xs text-slate-700">
                      <div className="font-semibold text-slate-900">Cloud cover</div>
                      <div className="font-mono text-[11px] text-slate-600">{selectedStacDetails.cloudCover}</div>
                    </div>
                    <div className="grid gap-1 text-xs text-slate-700">
                      <div className="font-semibold text-slate-900">Assets</div>
                      <div className="font-mono text-[11px] text-slate-600">{selectedStacDetails.assetsCount}</div>
                    </div>
                    {selectedStacDetails.runId ? (
                      <div className="grid gap-1 text-xs text-slate-700">
                        <div className="font-semibold text-slate-900">Run</div>
                        <div className="font-mono text-[11px] text-slate-600">{selectedStacDetails.runId}</div>
                      </div>
                    ) : null}
                    {selectedStacDetails.ruleIds.length || selectedStacDetails.sectionIds.length ? (
                      <div className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Linked to
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {selectedStacDetails.ruleIds.map((id) => (
                            <button
                              key={id}
                              type="button"
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                              onClick={async () => {
                                const ok = await onNavigateEvidence("rule", id);
                                if (!ok) showToast("Rule not found");
                              }}
                              title={`Open rule ${id}`}
                            >
                              <span className="font-mono">{id}</span>
                            </button>
                          ))}
                          {selectedStacDetails.sectionIds.map((id) => (
                            <button
                              key={id}
                              type="button"
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                              onClick={async () => {
                                const ok = await onNavigateEvidence("section", id);
                                if (!ok) showToast("Section not found");
                              }}
                              title={`Open section ${id}`}
                            >
                              <span className="font-mono">{id}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500">Linked to: none</div>
                    )}
                    {selectedStacDetails.assetRows.length ? (
                      <div className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Assets</div>
                        <div className="mt-2 grid gap-2">
                          {selectedStacDetails.assetRows.map((row) => (
                            <div key={row.key} className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-800">{row.key}</div>
                                <div className="break-words font-mono text-[11px] text-slate-600">{row.href}</div>
                              </div>
                              <button
                                type="button"
                                className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                                onClick={() => copyToClipboard(row.href)}
                              >
                                Copy
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {selectedStacDetails.linkRows.length ? (
                      <div className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Links</div>
                        <div className="mt-2 grid gap-2">
                          {selectedStacDetails.linkRows.map((row, idx) => (
                            <div key={`${row.href}:${idx}`} className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-800">{row.rel}</div>
                                <div className="break-words font-mono text-[11px] text-slate-600">{row.href}</div>
                              </div>
                              <button
                                type="button"
                                className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                                onClick={() => copyToClipboard(row.href)}
                              >
                                Copy
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-slate-500">Click a footprint/marker on the map to inspect.</div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-500">
                {!aoi ? "No AOI selected." : !currentAoiFingerprint ? "Computing AOI fingerprint…" : "No STAC evidence for this AOI."}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-slate-700">Evidence searches (current AOI)</div>
          <div className="mt-2 grid gap-2">
            {aoi && currentAoiFingerprint && currentRuns.length ? (
              currentRuns.map((run) => {
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
                {!aoi ? "No AOI selected." : !currentAoiFingerprint ? "Computing AOI fingerprint…" : "No runs yet for this AOI."}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
