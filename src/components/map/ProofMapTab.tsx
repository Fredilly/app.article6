"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import MapCanvas from "@/components/map/MapCanvas";
import AuditTrailPanel from "@/components/verifier/AuditTrailPanel";
import DeltaImpactTasksPanel from "@/components/verify/DeltaImpactTasksPanel";
import OutcomeWidget from "@/components/verify/OutcomeWidget";
import RunHistoryPanel from "@/components/verify/RunHistoryPanel";
import VerifierMinutesPanel from "@/components/verify/VerifierMinutesPanel";
import type { AOI, EvidencePin, VerificationRun } from "@/lib/proofMap/types";
import { parseAoiGeoJson } from "@/lib/proofMap/aoi";
import type { ProofEvidenceItem } from "@/lib/proof/bundle";
import { kindFromCitedId } from "@/lib/proofMap/pins";
import Tooltip from "@/components/ui/Tooltip";
import { createAndStoreEvidenceAttachment, deleteAttachmentBytes } from "@/lib/proofMap/attachments";
import { aoiFingerprint, createQueuedVerificationRun, runInputFingerprint, runsForCurrentAoi, runStacEvidenceSearch, shouldDisableRunVerification } from "@/lib/proofMap/verificationRuns";
import type { Map as MapLibreMap } from "maplibre-gl";
import selectLatestOkStacRunForActiveAoi from "@/lib/runs/selectLatestOkStacRunForActiveAoi";
import normalizeStacItems from "@/lib/stac/normalizeStacItems";
import { pickProvenanceFields, shortSha as shortCommitSha } from "@/lib/trustFormat";
import { canonicalJsonStringify } from "@/lib/export/canonicalJson";
import { canonicalJsonStringify as canonicalAuditJsonStringify } from "@/lib/auditTrail/canonicalJson";
import { sha256Hex as auditSha256Hex } from "@/lib/auditTrail/hash";
import type { AuditTrailEvent, AuditTrailEventInput } from "@/lib/auditTrail/types";
import deriveLinksFromProperties from "@/lib/proofMap/deriveLinksFromProperties";
import { getWorkspaceWorkFlags } from "@/lib/proofMap/workspace";
import getFeatureBbox from "@/lib/map/getFeatureBbox";
import { bboxIntersects, centerFromBbox, unionBbox } from "@/lib/map/bbox";
import { TICKETS_FEATURE_ENABLED } from "@/lib/flags";
import { buildOutcomeSnapshot } from "@/lib/verify/snapshotExport";
import { computeKpis, linkedRuleIdsFromPins } from "@/lib/kpis/computeKpis";
import type { BaselineKey, BaselineRecord } from "@/lib/baseline/baselineStore";
import { clearBaseline, getLatestBaselineForMethod, rotateBaseline, setBaseline } from "@/lib/baseline/baselineStore";
import { computeUplift, isComparable } from "@/lib/baseline/uplift";
import { addIntakeItem } from "@/lib/intake/storage";
import {
  SNAPSHOT_SCHEMA_VERSION,
  addTaskWithText,
  buildRunSummary,
  createVerifierRunBundle,
  createTicketTemplate,
  deleteRunFromHistory,
  extractStacQuery,
  loadRunFromHistory,
  type VerifyRunHistoryEntry,
  persistVerifierRunBundle,
  readRunHistory,
  readVerifierRunBundle,
  saveCurrentRunToHistory,
  shortRunId,
} from "@/lib/verify/runState";
import ProofCoverageChip from "@/components/verify/ProofCoverageChip";

type ProofMapTabProps = {
  methodCode: string;
  version: string;
  provenanceJson?: unknown | null;
  mode?: "explorer" | "evidence";
  viewMode?: "list" | "map";
  verifierMode?: boolean;
  activeRuleId?: string | null;
  totalRules?: number | null;
  aoi: AOI | null;
  currentAoi: AOI | null;
  draftAoi: AOI | null;
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
  onUploadAoi: (aoi: AOI) => void;
  onApplyDraftAoi: (options?: { resetDerived?: boolean }) => void;
  onCancelDraftAoi: () => void;
  onUndoApplyAoi: () => void;
  applyToken: number;
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
  ruleOptions?: Array<{ id: string; title: string }>;
  onSelectRuleId?: (ruleId: string | null) => void;
  onViewRule?: (ruleId: string) => void;
  onAuditEvent?: (event: AuditTrailEventInput) => void;
  onOpenCoverageDrawer?: () => void;
  auditTrail?: {
    events: AuditTrailEvent[];
    exportJson: string;
    exportSha256: string;
    onClear: () => void;
    onExport: () => void;
    onJumpToRule: (ruleId: string) => void;
    onOpenEvidence: (url: string) => void;
  } | null;
  onEvidenceSelectionChange?: (selection: { kind: "evidence"; id: string; ruleIds: string[]; sectionIds: string[] } | null) => void;
  onChangeViewMode?: (mode: "list" | "map") => void;
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
  const text = canonicalJsonStringify(value);
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

function formatDelta(value: number, suffix = "", digits = 0): string {
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  const rounded = digits > 0 ? value.toFixed(digits) : String(Math.trunc(value));
  return `${sign}${rounded}${suffix}`;
}

function extractItemIdsFromRuns(runs: VerificationRun[]): string[] {
  for (const run of runs ?? []) {
    if (run.status !== "ok") continue;
    if (!run.result_json || typeof run.result_json !== "object") continue;
    try {
      const normalized = normalizeStacItems(run.result_json);
      return Object.keys(normalized.itemsById);
    } catch {
      return [];
    }
  }
  return [];
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
  mode = "explorer",
  viewMode = "map",
  verifierMode = false,
  activeRuleId = null,
  totalRules = null,
  aoi,
  currentAoi,
  draftAoi,
  evidencePins,
  verificationRuns,
  stacEvidenceState,
  selectedStacItemId,
  evidenceSnapshots,
  onSetAoi,
  onUploadAoi,
  onApplyDraftAoi,
  onCancelDraftAoi,
  onUndoApplyAoi,
  applyToken,
  onSetEvidencePins,
  onSetVerificationRuns,
  onSetStacEvidenceState,
  onSelectStacItemId,
  onStartOver,
  onNavigateEvidence,
  ruleOptions = [],
  onSelectRuleId,
  onViewRule,
  onAuditEvent,
  onOpenCoverageDrawer,
  auditTrail,
  onEvidenceSelectionChange,
  onChangeViewMode,
}: ProofMapTabProps) {
  const isEvidenceMode = mode === "evidence";
  const isListMode = viewMode === "list";
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pinListOpen, setPinListOpen] = useState(false);
  const [undoVisible, setUndoVisible] = useState(false);
  const [snapshot, setSnapshot] = useState<ProofEvidenceItem | null>(null);
  const [runJson, setRunJson] = useState<VerificationRun | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentAoiFingerprint, setCurrentAoiFingerprint] = useState<string | null>(null);
  const [currentAoiHashForCompare, setCurrentAoiHashForCompare] = useState<string | null>(null);
  const [draftAoiFingerprint, setDraftAoiFingerprint] = useState<string | null>(null);
  const [showSameAoiPrompt, setShowSameAoiPrompt] = useState(false);
  const [draftTask, setDraftTask] = useState("");
  const [showDraftTask, setShowDraftTask] = useState(false);
  const draftTaskInputRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReadyTick, setMapReadyTick] = useState(0);
  const [stacCentroidsEnabled, setStacCentroidsEnabled] = useState(true);
  const [viewportBbox, setViewportBbox] = useState<[number, number, number, number] | null>(null);
  const stacEvidenceCardRef = useRef<HTMLDivElement | null>(null);
  const [stacInspectOpen, setStacInspectOpen] = useState(false);
  const [lastSelectionSource, setLastSelectionSource] = useState<"pin" | "polygon" | null>(null);
  const [startOverOpen, setStartOverOpen] = useState(false);
  const [startOverBusy, setStartOverBusy] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [railMode, setRailMode] = useState<"run" | "evidence">("run");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [loadedRunId, setLoadedRunId] = useState<string | null>(null);
  const [verifierBundle, setVerifierBundle] = useState(() => readVerifierRunBundle(methodCode, version));
  const [runHistory, setRunHistory] = useState(() => readRunHistory(methodCode, version));
  const [baselineTick, setBaselineTick] = useState(0);
  const [snapshotExportedAt, setSnapshotExportedAt] = useState<string | null>(null);
  const [currentInputFingerprint, setCurrentInputFingerprint] = useState<string | null>(null);
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
  const linkedRuleIds = useMemo(() => linkedRuleIdsFromPins(evidencePins), [evidencePins]);
  const selectedRuleId = activeRuleId ?? null;

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 900);
  }, []);

  useEffect(() => {
    if (!applyToken) return;
    setUndoVisible(true);
    const timer = window.setTimeout(() => setUndoVisible(false), 4500);
    return () => window.clearTimeout(timer);
  }, [applyToken]);

  useEffect(() => {
    let active = true;
    if (!currentAoiFingerprint) {
      setCurrentInputFingerprint(null);
      return () => {
        active = false;
      };
    }
    const cited_ids = evidencePins.flatMap((pin) => pin.cited_ids ?? []);
    const attachment_sha256 = evidencePins.flatMap((pin) => (pin.attachments ?? []).map((att) => att.sha256));
    runInputFingerprint({ aoi_fp: currentAoiFingerprint, cited_ids, attachment_sha256 })
      .then((hash) => {
        if (active) setCurrentInputFingerprint(hash);
      })
      .catch(() => {
        if (active) setCurrentInputFingerprint(null);
      });
    return () => {
      active = false;
    };
  }, [currentAoiFingerprint, evidencePins]);

  const copyToClipboard = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast("Copied");
    } catch {
      showToast("Copy failed");
    }
  }, [showToast]);

  useEffect(() => {
    setVerifierBundle(readVerifierRunBundle(methodCode, version));
    setLoadedRunId(null);
  }, [methodCode, version]);

  useEffect(() => {
    setRunHistory(readRunHistory(methodCode, version));
  }, [methodCode, version]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      persistVerifierRunBundle(methodCode, version, verifierBundle);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [methodCode, verifierBundle, version]);

  const handleMinutesChange = useCallback((value: string) => {
    setLoadedRunId(null);
    setVerifierBundle((current) => ({ ...current, minutes: value }));
  }, []);

  const handleUploadAoiChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      setError(null);
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as unknown;
        const result = parseAoiGeoJson(parsed, file.name.replace(/\.(geojson|json)$/i, ""));
        if (!result.ok) {
          setError(result.error);
          return;
        }
        if (onAuditEvent) {
          try {
            const hash = await aoiFingerprint(result.aoi.geojson);
            onAuditEvent({
              kind: "evidence.input",
              payload: { geojson_hash: hash, aoi_hash: hash },
            });
          } catch {
            // ignore hash failures
          }
        }
        setLoadedRunId(null);
        onSelectStacItemId(null);
        onUploadAoi(result.aoi);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [onAuditEvent, onSelectStacItemId, onUploadAoi],
  );

  const handleDeltaChange = useCallback((value: string) => {
    setLoadedRunId(null);
    setVerifierBundle((current) => ({ ...current, delta: value }));
  }, []);

  const handleImpactChange = useCallback((value: string) => {
    setLoadedRunId(null);
    setVerifierBundle((current) => ({ ...current, impact: value }));
  }, []);

  const commitDraftTask = useCallback(() => {
    const text = draftTask.trim();
    if (!text) return;
    setLoadedRunId(null);
    const task = addTaskWithText(text);
    setVerifierBundle((current) => ({ ...current, tasks: [...current.tasks, task] }));
    setDraftTask("");
    setShowDraftTask(false);
  }, [draftTask]);

  const handleAddTask = useCallback(() => {
    setShowDraftTask(true);
    requestAnimationFrame(() => {
      draftTaskInputRef.current?.focus();
    });
  }, []);

  const handleToggleTask = useCallback((id: string) => {
    const timestamp = new Date().toISOString();
    setLoadedRunId(null);
    setVerifierBundle((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === id ? { ...task, done: !task.done, updatedAt: timestamp } : task,
      ),
    }));
  }, []);

  const handleUpdateTask = useCallback((id: string, value: string) => {
    const timestamp = new Date().toISOString();
    setLoadedRunId(null);
    setVerifierBundle((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === id ? { ...task, text: value, updatedAt: timestamp } : task,
      ),
    }));
  }, []);

  const handleDeleteTask = useCallback((id: string) => {
    setLoadedRunId(null);
    setVerifierBundle((current) => ({ ...current, tasks: current.tasks.filter((task) => task.id !== id) }));
  }, []);

  const buildHistoryBundle = useCallback(() => {
    return {
      runContext: verifierBundle.runContext,
      minutes: verifierBundle.minutes,
      checklist: verifierBundle.checklist,
      delta: verifierBundle.delta,
      impact: verifierBundle.impact,
      tasks: verifierBundle.tasks,
      linkedRuleIds,
      aoi,
      evidencePins,
      verificationRuns,
      selectedStacItemId,
    };
  }, [aoi, evidencePins, linkedRuleIds, selectedStacItemId, verificationRuns, verifierBundle]);

  const handleSaveRunHistory = useCallback(
    (bundleOverride?: ReturnType<typeof buildHistoryBundle>) => {
      const bundle = bundleOverride ?? buildHistoryBundle();
      setRunHistory(saveCurrentRunToHistory(methodCode, version, bundle));
    },
    [buildHistoryBundle, methodCode, version],
  );

  const handleLoadRunHistory = useCallback(
    (runId: string) => {
      const loaded = loadRunFromHistory(methodCode, version, runId);
      if (!loaded) return;
      setVerifierBundle({
        runContext: loaded.runContext,
        minutes: loaded.minutes ?? "",
        checklist: loaded.checklist ?? [],
        delta: loaded.delta ?? "",
        impact: loaded.impact ?? "",
        tasks: Array.isArray(loaded.tasks) ? loaded.tasks : [],
      });
      onSetAoi(loaded.aoi ?? null);
      onSetEvidencePins(loaded.evidencePins as EvidencePin[]);
      onSetVerificationRuns(loaded.verificationRuns as VerificationRun[]);
      onSelectStacItemId(loaded.selectedStacItemId ?? null);
      setSnapshotExportedAt(null);
      setLoadedRunId(runId);
    },
    [methodCode, onSelectStacItemId, onSetAoi, onSetEvidencePins, onSetVerificationRuns, version],
  );

  const handleDeleteRunHistory = useCallback(
    (runId: string) => {
      setRunHistory(deleteRunFromHistory(methodCode, version, runId));
    },
    [methodCode, version],
  );

  const handleToggleChecklist = useCallback((id: string) => {
    const timestamp = new Date().toISOString();
    setLoadedRunId(null);
    setVerifierBundle((current) => ({
      ...current,
      checklist: current.checklist.map((item) =>
        item.id === id ? { ...item, checked: !item.checked, updatedAt: timestamp } : item,
      ),
    }));
  }, []);

  const handleResetChecklist = useCallback(() => {
    const next = createVerifierRunBundle(methodCode, version);
    setLoadedRunId(null);
    setVerifierBundle((current) => ({ ...current, checklist: next.checklist }));
  }, [methodCode, version]);

  const handleSearchStac = useCallback(async () => {
    if (!aoi) return;
    setLoadedRunId(null);
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
        if (onAuditEvent) {
          onAuditEvent({
            kind: "evidence.input",
            payload: { stac_url: endpoint ?? "unknown", aoi_hash: currentAoiFingerprint },
          });
        }

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
  }, [
    aoi,
    currentAoiFingerprint,
    evidencePins,
    isRunning,
    methodCode,
    onAuditEvent,
    onSelectStacItemId,
    onSetStacEvidenceState,
    onSetVerificationRuns,
    showToast,
    verificationRuns,
    version,
  ]);

  const isSameAoi = Boolean(draftAoiFingerprint && currentAoiHashForCompare && draftAoiFingerprint === currentAoiHashForCompare);
  const handleApplyDraftAoiClick = useCallback(() => {
    if (isSameAoi) {
      setShowSameAoiPrompt(true);
      return;
    }
    setShowSameAoiPrompt(false);
    onApplyDraftAoi({ resetDerived: true });
  }, [isSameAoi, onApplyDraftAoi]);

  const handleKeepSameAoi = useCallback(() => {
    onApplyDraftAoi({ resetDerived: false });
    setShowSameAoiPrompt(false);
  }, [onApplyDraftAoi]);

  const handleResetSameAoi = useCallback(() => {
    onApplyDraftAoi({ resetDerived: true });
    setShowSameAoiPrompt(false);
  }, [onApplyDraftAoi]);

  const handleNewRun = useCallback(() => {
    handleSaveRunHistory();
    setVerifierBundle(createVerifierRunBundle(methodCode, version));
    setSnapshotExportedAt(null);
    setLoadedRunId(null);
  }, [handleSaveRunHistory, methodCode, version]);

  const handleNavigateEvidence = useCallback(
    async (type: "rule" | "section", id: string) => {
      return await onNavigateEvidence(type, id);
    },
    [onNavigateEvidence],
  );

  const selectEvidence = (id: string, source: "pin" | "polygon") => {
    setLoadedRunId(null);
    onSelectStacItemId(id);
    setLastSelectionSource(source);
    setStacInspectOpen(true);
    if (onAuditEvent) {
      void (async () => {
        const payload: Record<string, unknown> = { layer_id: "stac", feature_id: id };
        const record = currentStacEvidence?.itemsById?.[id];
        if (record && typeof record === "object") {
          payload.feature_hash = await auditSha256Hex(canonicalAuditJsonStringify(record));
        }
        onAuditEvent({ kind: "evidence.feature.select", payload });
      })();
    }
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

  useEffect(() => {
    if (isListMode) return;
    try {
      mapRef.current?.resize?.();
    } catch {
      // ignore
    }
  }, [isListMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("a6:verify:panelCollapsed");
    if (stored === "1") setPanelCollapsed(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("a6:verify:panelCollapsed", panelCollapsed ? "1" : "0");
  }, [panelCollapsed]);

  useEffect(() => {
    if (isListMode) return;
    try {
      mapRef.current?.resize?.();
    } catch {
      // ignore
    }
  }, [isListMode, panelCollapsed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      if (isListMode) return;
      requestAnimationFrame(() => {
        try {
          mapRef.current?.resize?.();
        } catch {
          // ignore
        }
      });
    };
    window.addEventListener("a6:verify-layout", handler);
    return () => window.removeEventListener("a6:verify-layout", handler);
  }, [isListMode]);

  const isPreview = Boolean(draftAoi);
  const { willClearWork } = useMemo(
    () =>
      getWorkspaceWorkFlags({
        evidencePins,
        selectedStacItemId,
        evidenceSnapshots,
        verificationRuns,
      }),
    [evidencePins, evidenceSnapshots, selectedStacItemId, verificationRuns],
  );

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
    let cancelled = false;
    if (!currentAoi) {
      setCurrentAoiHashForCompare(null);
      return () => {
        cancelled = true;
      };
    }
    if (currentAoi.aoi_fingerprint) {
      setCurrentAoiHashForCompare(currentAoi.aoi_fingerprint);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const fp = await aoiFingerprint(currentAoi.geojson);
        if (cancelled) return;
        setCurrentAoiHashForCompare(fp);
      } catch {
        if (!cancelled) setCurrentAoiHashForCompare(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentAoi]);

  useEffect(() => {
    let cancelled = false;
    if (!draftAoi) {
      setDraftAoiFingerprint(null);
      setShowSameAoiPrompt(false);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const fp = await aoiFingerprint(draftAoi.geojson);
        if (cancelled) return;
        setDraftAoiFingerprint(fp);
      } catch {
        if (!cancelled) setDraftAoiFingerprint(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draftAoi]);

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
  const latestRun = useMemo(() => {
    return currentRuns.find((run) => run.status !== "queued") ?? null;
  }, [currentRuns]);
  const intakeSuggestion = useMemo(() => {
    if (!latestRun) return null;
    if (!["warn", "fail", "error"].includes(latestRun.status)) return null;
    const type = latestRun.status === "warn" ? "ambiguous" : "fail";
    const summary = latestRun.summary?.trim();
    return { type, summary, run: latestRun };
  }, [latestRun]);

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

  const stacQuery = useMemo(() => extractStacQuery(latestStacRun?.result_json), [latestStacRun]);

  const localEvidenceHashInputs = useMemo(() => {
    const citedIds = evidencePins.flatMap((pin) => pin.cited_ids ?? []);
    const attachmentSha = evidencePins.flatMap((pin) => (pin.attachments ?? []).map((att) => att.sha256));
    const combined = [...citedIds.map((v) => `cited:${v}`), ...attachmentSha.map((v) => `att:${v}`)].filter(Boolean);
    return combined.length ? combined : null;
  }, [evidencePins]);

  const trustPicked = useMemo(() => pickProvenanceFields(provenanceJson), [provenanceJson]);
  const auditHashes = trustPicked.auditHashes;
  const appCommit = shortCommitSha(process.env.NEXT_PUBLIC_GIT_SHA || "");
  const selectedEvidenceItemIds = useMemo(() => {
    if (selectedStacItemId) return [selectedStacItemId];
    if (stacFeatureIds.length === 1) return [stacFeatureIds[0]];
    return [];
  }, [selectedStacItemId, stacFeatureIds]);

  const runSummary = useMemo(
    () =>
      buildRunSummary({
        aoi: {
          hash: currentAoiFingerprint,
          bbox: aoi?.bbox ?? null,
          areaKm2: typeof aoi?.area_km2 === "number" ? aoi.area_km2 : null,
        },
        stac: {
          query: stacQuery,
          itemIds: stacFeatureIds,
        },
        linkage: {
          linkedRuleIds,
        },
        exportState: {
          snapshotExportedAt,
        },
        verifier: {
          runId: verifierBundle.runContext.runId,
          createdAt: verifierBundle.runContext.createdAt,
          minutes: verifierBundle.minutes,
          checklist: verifierBundle.checklist,
          delta: verifierBundle.delta,
          impact: verifierBundle.impact,
          tasks: verifierBundle.tasks,
        },
        provenance: {
          methodCode,
          version,
          repoCommit: process.env.NEXT_PUBLIC_GIT_SHA ?? null,
          snapshotSchemaVersion: SNAPSHOT_SCHEMA_VERSION,
        },
      }),
    [
      aoi?.area_km2,
      aoi?.bbox,
      currentAoiFingerprint,
      linkedRuleIds,
      methodCode,
      snapshotExportedAt,
      stacFeatureIds,
      stacQuery,
      verifierBundle,
      version,
    ],
  );

  const runKpis = useMemo(
    () =>
      computeKpis({
        pins: evidencePins,
        totalRules,
        selectedEvidenceItemIds,
        snapshotExportedAt: runSummary.exportState.snapshotExportedAt,
      }),
    [evidencePins, runSummary.exportState.snapshotExportedAt, selectedEvidenceItemIds, totalRules],
  );

  const currentBaselineProvenance = useMemo<BaselineKey>(
    () => ({
      methodId: methodCode.trim(),
      versionId: version.trim(),
      harnessVersion: (process.env.NEXT_PUBLIC_GIT_SHA ?? "").trim(),
      datasetHash: (currentInputFingerprint ?? "").trim(),
    }),
    [currentInputFingerprint, methodCode, version],
  );

  const baselineMissing = useMemo(() => {
    const missing: string[] = [];
    if (!currentAoiFingerprint) missing.push("AOI");
    if (!currentBaselineProvenance.methodId || !currentBaselineProvenance.versionId) missing.push("method/version");
    if (!currentBaselineProvenance.harnessVersion) missing.push("harness version");
    if (!currentBaselineProvenance.datasetHash) missing.push("dataset hash");
    return missing;
  }, [currentAoiFingerprint, currentBaselineProvenance]);

  const latestBaseline = useMemo(
    () => {
      void baselineTick;
      return getLatestBaselineForMethod(methodCode.trim(), version.trim());
    },
    [baselineTick, methodCode, version],
  );

  const baselineComparable = useMemo(() => {
    if (!latestBaseline) return { ok: false, reasons: [] as string[] };
    return isComparable(latestBaseline.baselineProvenance, currentBaselineProvenance);
  }, [currentBaselineProvenance, latestBaseline]);

  const upliftSummary = useMemo(() => {
    if (!latestBaseline || !baselineComparable.ok) return null;
    return computeUplift(latestBaseline.baselineKpis, runKpis);
  }, [baselineComparable.ok, latestBaseline, runKpis]);
  const baselineActionsDisabled = baselineMissing.length > 0;
  const baselineDisabledTooltip = "Load AOI to enable baseline comparisons";
  const compareTargetLabel = loadedRunId ? `Loaded run ${loadedRunId}` : "Workspace (unsaved)";

  const badgeForRun = useCallback(
    (entry: VerifyRunHistoryEntry) => {
      if (!latestBaseline) return null;
      const runs = entry.bundle.verificationRuns ?? [];
      const datasetHash = runs.find((run) => typeof run.input_fingerprint === "string")?.input_fingerprint ?? "";
      const entryProv: BaselineKey = {
        methodId: currentBaselineProvenance.methodId,
        versionId: currentBaselineProvenance.versionId,
        harnessVersion: currentBaselineProvenance.harnessVersion,
        datasetHash,
      };
      const comparable = isComparable(latestBaseline.baselineProvenance, entryProv);
      if (!comparable.ok) {
        return {
          label: "≠",
          title: `Not comparable (${comparable.reasons.join(", ") || "unknown"})`,
          className: "border-amber-200 bg-amber-50 text-amber-700",
        };
      }
      const itemIds = extractItemIdsFromRuns(runs);
      const historyItemId =
        typeof entry.bundle.selectedStacItemId === "string" && entry.bundle.selectedStacItemId.trim()
          ? entry.bundle.selectedStacItemId
          : itemIds.length === 1
            ? itemIds[0]
            : null;
      const entryKpis = computeKpis({
        pins: (entry.bundle.evidencePins as EvidencePin[]) ?? [],
        totalRules,
        selectedEvidenceItemIds: historyItemId ? [historyItemId] : [],
        snapshotExportedAt: entry.createdAt,
      });
      const uplift = computeUplift(latestBaseline.baselineKpis, entryKpis);
      if (uplift.coverageDeltaPct != null) {
        const delta = uplift.coverageDeltaPct;
        return {
          label: `${formatDelta(delta, "%", 1)} cov`,
          title: "Uplift vs baseline (coverage)",
          className:
            delta > 0
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : delta < 0
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-slate-200 bg-white text-slate-600",
        };
      }
      if (uplift.linkedRulesDelta != null) {
        const delta = uplift.linkedRulesDelta;
        return {
          label: `${formatDelta(delta)} rules`,
          title: "Uplift vs baseline (linked rules)",
          className:
            delta > 0
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : delta < 0
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-slate-200 bg-white text-slate-600",
        };
      }
      if (uplift.itemsDelta != null) {
        const delta = uplift.itemsDelta;
        return {
          label: `${formatDelta(delta)} items`,
          title: "Uplift vs baseline (items)",
          className:
            delta > 0
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : delta < 0
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-slate-200 bg-white text-slate-600",
        };
      }
      return null;
    },
    [currentBaselineProvenance, latestBaseline, totalRules],
  );

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

  const searchDisabled = shouldDisableRunVerification({ isRunning, aoi, currentAoiFingerprint, methodCode, version, evidencePins });
  const hasRule = Boolean(selectedRuleId);
  const hasAoi = Boolean(aoi?.geojson);
  const hasSearchResults = (stacFeatureIds?.length ?? 0) > 0;
  const hasSelectedItem = Boolean(selectedStacItemId && currentStacEvidence?.itemsById?.[selectedStacItemId]);
  const currentPinItemId = hasSelectedItem ? selectedStacItemId : null;
  const canCreatePin = hasRule && hasSelectedItem;
  const createPinDisabledReason = canCreatePin
    ? "Pin = durable link between a rule and an evidence item. Drives Linked/Coverage."
    : !hasRule
      ? "Select a rule to pin evidence."
      : "Select an evidence item to pin.";

  const renderUploadAoiButton = (className?: string) => (
    <label className={`inline-flex cursor-pointer items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 ${className ?? ""}`}>
      Upload AOI
      <input
        type="file"
        accept=".json,.geojson,application/json"
        className="hidden"
        onChange={handleUploadAoiChange}
      />
    </label>
  );

  const handleCreatePin = useCallback(() => {
    if (!selectedRuleId || !currentPinItemId) return;
    const ts = new Date().toISOString();
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `pin_${ts}_${Math.random().toString(16).slice(2)}`;
    const pin: EvidencePin = {
      id,
      kind: "note",
      title: `Pin ${selectedRuleId} ↔ ${currentPinItemId}`,
      ts,
      ruleId: selectedRuleId,
      itemId: currentPinItemId,
      note: `${methodCode}@${version}`,
      aoi_id: aoi?.id ?? null,
      aoi_fingerprint: currentAoiFingerprint ?? undefined,
      cited_ids: [selectedRuleId],
      stac_item_ids: [currentPinItemId],
      stac_run_id: currentStacEvidence?.runId,
      created_at: ts,
    };
    onSetEvidencePins([pin, ...evidencePins]);
    showToast(`Pinned ${currentPinItemId} to ${selectedRuleId}`);
  }, [
    aoi?.id,
    currentAoiFingerprint,
    currentPinItemId,
    currentStacEvidence?.runId,
    evidencePins,
    methodCode,
    onSetEvidencePins,
    selectedRuleId,
    showToast,
    version,
  ]);

  const handleExportSnapshot = useCallback(async () => {
    const selectedItem =
      selectedStacItemId && currentStacEvidence?.itemsById?.[selectedStacItemId] && typeof currentStacEvidence.itemsById[selectedStacItemId] === "object"
        ? (currentStacEvidence.itemsById[selectedStacItemId] as Record<string, unknown>)
        : null;

    const linkedRules = selectedItem
      ? deriveLinksFromProperties(isRecord(selectedItem.properties) ? selectedItem.properties : null).ruleIds
      : [];
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
          linked_rules: linkedRules,
        }
      : undefined;
    const snapshotItems = selectedStacItemId ? [{ id: selectedStacItemId, linked_rules: linkedRules }] : [];

    const citedIds = evidencePins.flatMap((pin) => pin.cited_ids ?? []);
    const selectedIds = selectedStacItemId ? [selectedStacItemId] : citedIds.length ? citedIds : undefined;

    const evidenceSource =
      stacEndpointUrl
        ? { type: "stac_url" as const, ref: stacEndpointUrl }
        : localEvidenceHashInputs
          ? { type: "upload" as const, ref: "local_pins", hash_inputs: localEvidenceHashInputs }
          : { type: "unknown" as const, ref: "unknown" };

    const stacItemsJson = (() => {
      if (!latestStacRun || latestStacRun.status !== "ok") return { items: [] };
      if (!latestStacRun.result_json) return { items: [] };
      const normalized = normalizeStacItems(latestStacRun.result_json);
      const items = Object.values(normalized.itemsById).map((item) => {
        const props = isRecord(item.properties) ? item.properties : null;
        const collection = props && typeof props.collection === "string" ? props.collection : undefined;
        const cloudCover = item.cloud_cover ?? (props ? props["eo:cloud_cover"] : undefined);
        return {
          id: item.id,
          datetime: item.datetime,
          bbox: item.bbox,
          collection,
          cloud_cover: cloudCover,
        };
      });
      return { items };
    })();

    const exportedAt = new Date().toISOString();
    const checklistAfterExport = verifierBundle.checklist.map((item) =>
      item.id === "exported-snapshot" ? { ...item, checked: true, updatedAt: exportedAt } : item,
    );
    const verifierSnapshot = {
      runId: verifierBundle.runContext.runId,
      createdAt: verifierBundle.runContext.createdAt,
      minutes: verifierBundle.minutes,
      delta: verifierBundle.delta,
      impact: verifierBundle.impact,
      checklist: checklistAfterExport,
      tasks: verifierBundle.tasks,
    };

    setSnapshotExportedAt(exportedAt);
    setVerifierBundle((current) => ({ ...current, checklist: checklistAfterExport }));
    handleSaveRunHistory({
      runContext: { runId: verifierSnapshot.runId, createdAt: verifierSnapshot.createdAt },
      minutes: verifierSnapshot.minutes,
      delta: verifierSnapshot.delta,
      impact: verifierSnapshot.impact,
      checklist: verifierSnapshot.checklist,
      tasks: verifierSnapshot.tasks,
      linkedRuleIds,
      aoi,
      evidencePins,
      verificationRuns,
      selectedStacItemId,
    });

    const outcome = buildRunSummary({
      ...runSummary,
      exportState: {
        ...runSummary.exportState,
        snapshotExportedAt: exportedAt,
      },
      verifier: verifierSnapshot,
      provenance: {
        ...runSummary.provenance,
        generatedAt: exportedAt,
      },
    });
    const kpis = computeKpis({
      pins: evidencePins,
      totalRules,
      selectedEvidenceItemIds,
      snapshotExportedAt: outcome.exportState.snapshotExportedAt,
    });

    const snap = await buildOutcomeSnapshot({
      method: { code: methodCode, version },
      aoi: aoi
        ? {
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
      items: snapshotItems,
      app: {
        commit: asNonEmptyString(process.env.NEXT_PUBLIC_GIT_SHA),
        env: asNonEmptyString(process.env.NEXT_PUBLIC_VERCEL_ENV),
        version: asNonEmptyString(process.env.NEXT_PUBLIC_APP_VERSION),
      },
      stacItemsJson,
      outcome,
      kpis,
      verifier: verifierSnapshot,
    });

    const snapshotWithLegacyItems = {
      ...snap,
      items: stacItemsJson.items ?? [],
    };
    const filename = `evidence-snapshot.${safeFilename(methodCode)}.${safeFilename(version)}.json`;
    downloadJson(snapshotWithLegacyItems, filename);
    showToast("Snapshot downloaded");
  }, [
    aoi,
    currentStacEvidence?.itemsById,
    evidencePins,
    handleSaveRunHistory,
    latestStacRun,
    linkedRuleIds,
    localEvidenceHashInputs,
    methodCode,
    runSummary,
    selectedStacItemId,
    showToast,
    stacEndpointUrl,
    totalRules,
    selectedEvidenceItemIds,
    verifierBundle,
    verificationRuns,
    version,
  ]);

  const handleCreateTicket = useCallback(async () => {
    const template = createTicketTemplate(runSummary);
    await copyToClipboard(template);
    showToast("Ticket template copied");
    const repo = (process.env.NEXT_PUBLIC_GITHUB_REPO ?? "").trim();
    if (repo && typeof window !== "undefined") {
      const title = `Verify run ${runSummary.provenance.methodCode ?? "unknown"}@${runSummary.provenance.version ?? "unknown"} (${runSummary.verifier.runId ?? "run"})`;
      const url = `https://github.com/${repo}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(template)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, [copyToClipboard, runSummary, showToast]);

  const handleSetBaseline = useCallback(() => {
    if (baselineMissing.length) {
      showToast(`Cannot set baseline (${baselineMissing.join(", ")})`);
      return;
    }
    const baseline: BaselineRecord = {
      baselineRunId: runSummary.verifier.runId ?? "run",
      baselineTs: new Date().toISOString(),
      baselineKpis: runKpis,
      baselineProvenance: currentBaselineProvenance,
    };
    setBaseline(currentBaselineProvenance, baseline);
    setBaselineTick((value) => value + 1);
    showToast("Baseline set");
  }, [baselineMissing, currentBaselineProvenance, runKpis, runSummary.verifier.runId, showToast]);

  const handleRotateBaseline = useCallback(() => {
    if (baselineMissing.length) {
      showToast(`Cannot rotate baseline (${baselineMissing.join(", ")})`);
      return;
    }
    const reason = typeof window !== "undefined" ? window.prompt("Reason for baseline rotation?") : null;
    if (!reason || !reason.trim()) return;
    const next: BaselineRecord = {
      baselineRunId: runSummary.verifier.runId ?? "run",
      baselineTs: new Date().toISOString(),
      baselineKpis: runKpis,
      baselineProvenance: currentBaselineProvenance,
    };
    rotateBaseline(currentBaselineProvenance, next, reason.trim());
    setBaselineTick((value) => value + 1);
    showToast("Baseline rotated");
  }, [baselineMissing, currentBaselineProvenance, runKpis, runSummary.verifier.runId, showToast]);

  const handleClearBaseline = useCallback(() => {
    if (!latestBaseline) return;
    const confirmed = typeof window !== "undefined" ? window.confirm("Clear baseline?") : false;
    if (!confirmed) return;
    clearBaseline(latestBaseline.baselineProvenance);
    setBaselineTick((value) => value + 1);
    showToast("Baseline cleared");
  }, [latestBaseline, showToast]);

  const handleCreateIntake = useCallback(() => {
    if (!intakeSuggestion) return;
    const ruleId = activeRuleId ?? linkedRuleIds[0] ?? null;
    const description =
      intakeSuggestion.summary ??
      `Run ${intakeSuggestion.run.id} ended with status ${intakeSuggestion.run.status}.`;
    addIntakeItem({
      method: methodCode,
      version,
      rule_id: ruleId,
      type: intakeSuggestion.type,
      description,
      status: "new",
    });
    showToast("Intake item added");
  }, [activeRuleId, intakeSuggestion, linkedRuleIds, methodCode, showToast, version]);

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
    showToast,
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

  const listContent = (
    <>
      {isEvidenceMode ? null : (
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
                            const ok = await handleNavigateEvidence(type, id);
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
                                {att.filename}{" "}
                                <span className="font-normal text-slate-500">({formatBytes(att.size)})</span>
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
              <div className="text-xs text-slate-500">No pins yet. Add pins from Assistant if needed.</div>
            )}
          </div>
        </div>
      )}

      <div>
        <div className="text-xs font-semibold text-slate-700">STAC Evidence</div>
        <div className="mt-2 grid gap-2">
          {aoi && currentAoiFingerprint && stacRenderedCount ? (
            <div ref={stacEvidenceCardRef} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-slate-900">{stacRenderedCount} feature(s)</div>
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
                  <div className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Linked rules
                    </div>
                    {selectedStacDetails.ruleIds.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedStacDetails.ruleIds.map((id) => (
                          <button
                            key={id}
                            type="button"
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                            onClick={async () => {
                              const ok = await handleNavigateEvidence("rule", id);
                              if (!ok) showToast("Rule not found");
                            }}
                            title={`Open rule ${id}`}
                          >
                            <span className="font-mono">{id}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="mt-2 inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                        Unlinked
                      </span>
                    )}
                    {selectedStacDetails.sectionIds.length ? (
                      <div className="mt-3">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Linked sections
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {selectedStacDetails.sectionIds.map((id) => (
                            <button
                              key={id}
                              type="button"
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                              onClick={async () => {
                                const ok = await handleNavigateEvidence("section", id);
                                if (!ok) showToast("Section not found");
                              }}
                              title={`Open section ${id}`}
                            >
                              <span className="font-mono">{id}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
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
              {!aoi
                ? "No AOI selected."
                : !currentAoiFingerprint
                  ? "Computing AOI fingerprint…"
                  : "No STAC evidence for this AOI."}
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
              {!aoi
                ? "No AOI selected."
                : !currentAoiFingerprint
                  ? "Computing AOI fingerprint…"
                  : "No runs yet for this AOI."}
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="mt-4 grid gap-4">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
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
                  const snapshot = await buildOutcomeSnapshot({
                    method: { code: methodCode, version },
                    evidence_source: { type: "upload", ref: "local_pins", hash_inputs: localEvidenceHashInputs },
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

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <ProofCoverageChip
              kpis={runKpis}
              onViewCoverage={onOpenCoverageDrawer}
            />
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={() => {
                document.getElementById("verify-outcome")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              Outcome
            </button>
          </div>
        </div>
      </div>

      {undoVisible ? (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow">
          <span>New AOI applied.</span>
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
            onClick={() => {
              onUndoApplyAoi();
              setUndoVisible(false);
            }}
          >
            Undo
          </button>
        </div>
      ) : null}
      {toast ? (
        <div
          className={`fixed right-4 z-50 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow ${
            undoVisible ? "bottom-14" : "bottom-4"
          }`}
        >
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

      <div
        className={`grid gap-4 min-w-0 ${
          panelCollapsed ? "lg:grid-cols-[minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]"
        }`}
      >
        <div className="grid min-w-0 gap-3">
          {panelCollapsed ? (
            <div className="hidden justify-end lg:flex">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={() => setPanelCollapsed(false)}
                aria-label="Show Verify panel"
              >
                Show panel »
              </button>
            </div>
          ) : null}
          <div className={isListMode ? "grid gap-3 rounded-xl border border-slate-200 bg-white p-4" : "hidden"}>
            {listContent}
          </div>
          <div className={isListMode ? "hidden" : undefined}>
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
          </div>
        </div>

        <div className={`grid min-w-0 w-full max-w-full gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 ${panelCollapsed ? "lg:hidden" : ""}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
              {(["run", "evidence"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${railMode === mode ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"}`}
                  onClick={() => setRailMode(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>
            {railMode === "run" ? (
              <span className="text-xs text-slate-500">Run tools</span>
            ) : (
              <span className="text-xs text-slate-500">Evidence tools</span>
            )}
          </div>

          <div className="sticky top-0 z-10 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <div className={railMode === "run" ? "flex flex-wrap items-center gap-2" : "hidden"}>
              <button
                type="button"
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={handleNewRun}
              >
                New run
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-200 bg-slate-900 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
                onClick={handleExportSnapshot}
              >
                Export snapshot
              </button>
            </div>
            <div className={railMode === "evidence" ? "flex flex-wrap items-center gap-2" : "hidden"}>
              <div className="grid w-full gap-3">
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Step 1</div>
                  <div className="mt-1 text-xs font-semibold text-slate-900">Pick rule</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
                      <span className="text-xs font-semibold text-slate-600">Rule</span>
                      <select
                        className="max-w-[220px] bg-transparent text-xs text-slate-700 outline-none"
                        value={selectedRuleId ?? ""}
                        onChange={(event) => {
                          const next = event.target.value.trim();
                          onSelectRuleId?.(next || null);
                        }}
                      >
                        <option value="">Select rule…</option>
                        {ruleOptions.map((rule) => {
                          const preview = rule.title.trim().slice(0, 60);
                          return (
                            <option key={rule.id} value={rule.id}>
                              {rule.id} {preview ? `- ${preview}` : ""}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    {selectedRuleId ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        Rule: {selectedRuleId}
                        <button
                          type="button"
                          className="rounded-full border border-slate-200 bg-slate-50 px-1 text-[10px] leading-4 text-slate-600 hover:bg-slate-100"
                          onClick={() => onSelectRuleId?.(null)}
                          aria-label="Clear selected rule"
                        >
                          x
                        </button>
                      </span>
                    ) : null}
                    {selectedRuleId ? (
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                        onClick={() => onViewRule?.(selectedRuleId)}
                      >
                        View rule
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Step 2</div>
                  <div className="mt-1 text-xs font-semibold text-slate-900">Upload/Confirm AOI</div>
                  {!hasAoi ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {renderUploadAoiButton()}
                      <span className="text-xs text-slate-600">Upload AOI to enable STAC search.</span>
                    </div>
                  ) : (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        AOI ready
                      </span>
                      {aoi?.name ? <span className="text-xs text-slate-600">{aoi.name}</span> : null}
                    </div>
                  )}
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Step 3</div>
                  <div className="mt-1 text-xs font-semibold text-slate-900">Search STAC</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!hasAoi || searchDisabled}
                      onClick={handleSearchStac}
                    >
                      {isRunning ? "Searching…" : "Search STAC"}
                    </button>
                    {!hasAoi ? <span className="text-xs text-slate-500">AOI required first.</span> : null}
                    {hasAoi && !hasSearchResults ? <span className="text-xs text-slate-500">Run STAC search to load evidence items.</span> : null}
                    {hasSearchResults ? (
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {stacFeatureIds.length} items
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Step 4</div>
                  <div className="mt-1 text-xs font-semibold text-slate-900">Pick STAC item</div>
                  <div className="mt-1 text-xs text-slate-600">Select a STAC item from the list (left) or a footprint/marker on the map.</div>
                  <div className="mt-1 text-xs text-slate-500">Pick an item -&gt; then Create pin.</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="text-xs font-semibold text-slate-700 underline underline-offset-2 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60"
                      onClick={() => onChangeViewMode?.("list")}
                      disabled={!hasSearchResults || isListMode}
                    >
                      Go to list
                    </button>
                    <button
                      type="button"
                      className="text-xs font-semibold text-slate-700 underline underline-offset-2 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60"
                      onClick={() => onChangeViewMode?.("map")}
                      disabled={!hasSearchResults || !isListMode}
                    >
                      Go to map
                    </button>
                    {!hasSearchResults ? <span className="text-xs text-slate-500">Search STAC first.</span> : null}
                    {hasSelectedItem ? (
                      <>
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                          Selected: <span className="ml-1 font-mono">{selectedStacItemId}</span>
                        </span>
                        <button
                          type="button"
                          className="text-xs font-semibold text-slate-700 underline underline-offset-2"
                          onClick={() => onSelectStacItemId(null)}
                        >
                          Change selection
                        </button>
                      </>
                    ) : hasSearchResults ? (
                      <span className="text-xs text-slate-500">Select an item from list or map.</span>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Step 5</div>
                  <div className="mt-1 text-xs font-semibold text-slate-900">Create pin</div>
                  <div className="mt-2">
                    <Tooltip content={createPinDisabledReason}>
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={handleCreatePin}
                        disabled={!canCreatePin}
                      >
                        Create pin
                      </button>
                    </Tooltip>
                    {!canCreatePin ? (
                      <div className="mt-1 text-[11px] text-slate-500">
                        {!hasRule ? "Select a rule first." : "Select an evidence item first."}
                      </div>
                    ) : null}
                  </div>
                </div>
                <details
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                  open={advancedOpen}
                  onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
                >
                  <summary className="cursor-pointer text-xs font-semibold text-slate-700">Advanced</summary>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      Rendered {stacRenderedCount}
                    </span>
                    {evidenceChip ? (
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        Source {evidenceChip.display}
                      </span>
                    ) : null}
                  </div>
                </details>
              </div>
              <details
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                open={pinListOpen}
                onToggle={(event) => setPinListOpen(event.currentTarget.open)}
              >
                <summary className="cursor-pointer text-xs font-semibold text-slate-700">Pins ({evidencePins.length})</summary>
                <div className="mt-2 grid gap-1">
                  {evidencePins.length ? (
                    evidencePins.slice(0, 5).map((pin) => (
                      <div key={pin.id} className="text-[11px] text-slate-600">
                        <span className="font-mono">{pin.ruleId ?? pin.cited_ids?.[0] ?? "—"}</span>
                        {" -> "}
                        <span className="font-mono">{pin.itemId ?? pin.stac_item_ids?.[0] ?? "—"}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-[11px] text-slate-500">No pins yet.</div>
                  )}
                </div>
              </details>
            </div>
          </div>

          <div className={railMode === "run" ? "grid gap-3" : "hidden"}>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-900">Baseline</div>
                {latestBaseline ? (
                  <div className="text-[11px] text-slate-500">Run {shortRunId(latestBaseline.baselineRunId)}</div>
                ) : null}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {latestBaseline ? `Set ${formatLocalDateTime(latestBaseline.baselineTs)}` : "No baseline set"}
              </div>
              <div className="mt-1 text-xs text-slate-500">Comparing to: {compareTargetLabel}</div>
              {latestBaseline ? (
                <div className="mt-2 text-xs text-slate-600">
                  {baselineComparable.ok ? (
                    <Tooltip content="Same method/version + harness + dataset hash">
                      <span className="font-semibold text-emerald-700">Comparable ✅</span>
                    </Tooltip>
                  ) : (
                    <Tooltip content={baselineComparable.reasons.join("; ") || "Not comparable"}>
                      <span className="font-semibold text-amber-700">
                        Not comparable
                        {baselineComparable.reasons[0] ? ` (${baselineComparable.reasons[0]})` : ""}
                      </span>
                    </Tooltip>
                  )}
                </div>
              ) : null}
              {latestBaseline && baselineComparable.ok && upliftSummary ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {upliftSummary.coverageDeltaPct != null ? (
                    <Tooltip content="Δ(covered rules / total rules) vs baseline. Based on persisted link artifacts.">
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        Δ Coverage {formatDelta(upliftSummary.coverageDeltaPct, "%", 1)}
                      </span>
                    </Tooltip>
                  ) : null}
                  {upliftSummary.linkedRulesDelta != null ? (
                    <Tooltip content="Δ(# rules with persisted evidence links) vs baseline.">
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        Δ Linked {formatDelta(upliftSummary.linkedRulesDelta)}
                      </span>
                    </Tooltip>
                  ) : null}
                  {upliftSummary.itemsDelta != null ? (
                    <Tooltip content="Δ(selected evidence items count) vs baseline.">
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        Δ Items {formatDelta(upliftSummary.itemsDelta)}
                      </span>
                    </Tooltip>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {!latestBaseline ? (
                  <Tooltip content={baselineActionsDisabled ? baselineDisabledTooltip : "Set baseline"}>
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={handleSetBaseline}
                      disabled={baselineActionsDisabled}
                    >
                      Set baseline
                    </button>
                  </Tooltip>
                ) : (
                  <>
                    <Tooltip content={baselineActionsDisabled ? baselineDisabledTooltip : "Rotate baseline"}>
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={handleRotateBaseline}
                        disabled={baselineActionsDisabled}
                      >
                        Rotate baseline
                      </button>
                    </Tooltip>
                    <button
                      type="button"
                      className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 shadow-sm hover:bg-rose-100"
                      onClick={handleClearBaseline}
                    >
                      Clear baseline
                    </button>
                  </>
                )}
              </div>
            </div>
            <VerifierMinutesPanel
              runContext={verifierBundle.runContext}
              minutes={verifierBundle.minutes}
              checklist={verifierBundle.checklist}
              onMinutesChange={handleMinutesChange}
              onToggleChecklist={handleToggleChecklist}
              onResetChecklist={handleResetChecklist}
              onNewRun={handleNewRun}
              onCreateTicket={handleCreateTicket}
              showCreateTicket={TICKETS_FEATURE_ENABLED}
            />
            <DeltaImpactTasksPanel
              delta={verifierBundle.delta}
              impact={verifierBundle.impact}
              tasks={verifierBundle.tasks}
              draftTask={draftTask}
              showDraftTask={showDraftTask || verifierBundle.tasks.length === 0}
              draftTaskInputRef={draftTaskInputRef}
              onDraftTaskChange={setDraftTask}
              onCommitDraftTask={commitDraftTask}
              onDeltaChange={handleDeltaChange}
              onImpactChange={handleImpactChange}
              onAddTask={handleAddTask}
              onToggleTask={handleToggleTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
            />
            <details className="rounded-xl border border-slate-200 bg-white">
              <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-slate-900">
                Run history
                <span className="ml-2 text-[11px] font-medium text-slate-500">{runHistory.length} runs</span>
              </summary>
              <div className="px-3 pb-3">
                <RunHistoryPanel
                  items={runHistory}
                  onLoad={handleLoadRunHistory}
                  onDelete={handleDeleteRunHistory}
                  showTitle={false}
                  badgeForRun={badgeForRun}
                />
              </div>
            </details>
            <details className="rounded-xl border border-slate-200 bg-white">
              <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-slate-900">
                Outcome
              </summary>
              <div className="px-3 pb-3 pt-1">
                {intakeSuggestion ? (
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold">Hard-case intake suggested</div>
                      <button
                        type="button"
                        className="rounded-full border border-amber-300 bg-amber-200 px-3 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-300"
                        onClick={handleCreateIntake}
                      >
                        Create intake item
                      </button>
                    </div>
                    <div className="mt-1 text-[11px] text-amber-800">
                      Status {intakeSuggestion.run.status}. {intakeSuggestion.summary ?? "Add this run to the pilot queue."}
                    </div>
                  </div>
                ) : null}
                <OutcomeWidget
                  className="border-0 p-0"
                  summary={runSummary}
                  onCopy={copyToClipboard}
                  onExportSnapshot={handleExportSnapshot}
                  onCreateTicket={handleCreateTicket}
                  showCreateTicket={TICKETS_FEATURE_ENABLED}
                  debugKey={`${methodCode}@${version}`}
                  debugLinkedCount={linkedRuleIds.length}
                  provenance={{
                    repo: trustPicked.repo ?? null,
                    sha: trustPicked.sha ?? process.env.NEXT_PUBLIC_GIT_SHA ?? null,
                    generatedAt: trustPicked.generatedAt ?? null,
                  }}
                />
              </div>
            </details>
          </div>

          <div className={railMode === "evidence" ? "grid gap-3" : "hidden"}>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Upload AOI</div>
              <div className="mt-1 text-xs text-slate-500">Add a GeoJSON AOI to start evidence search.</div>
              <div className="mt-3">{renderUploadAoiButton()}</div>
            </div>
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
                <button
                  type="button"
                  className="hidden items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 lg:inline-flex"
                  onClick={() => setPanelCollapsed(true)}
                  aria-label="Collapse Verify panel"
                >
                  Collapse »
                </button>
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
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-xs font-semibold text-slate-900">{aoi.name}</div>
                  {isPreview ? (
                    <span className="rounded-full border border-sky-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                      Preview
                    </span>
                  ) : currentAoi ? (
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      Current
                    </span>
                  ) : null}
                </div>
                {isPreview ? (
                  <div className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-2 py-2 text-xs text-slate-700">
                    <div className="font-semibold text-slate-900">New AOI ready</div>
                    <div className="mt-1">
                      Replace the current AOI with <span className="font-semibold">{aoi.name}</span>?
                    </div>
                    {willClearWork ? (
                      <div className="mt-1 text-[11px] text-slate-600">
                        This will clear pins and evidence selections.
                      </div>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-sky-200 bg-sky-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-sky-700"
                        onClick={handleApplyDraftAoiClick}
                      >
                        Replace AOI
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                        onClick={() => {
                          setShowSameAoiPrompt(false);
                          onCancelDraftAoi();
                        }}
                      >
                        Keep current
                      </button>
                    </div>
                    {isSameAoi && showSameAoiPrompt ? (
                      <div className="mt-2 rounded-md border border-slate-200 bg-white px-2 py-2 text-[11px] text-slate-700">
                        <div className="font-semibold text-slate-800">Same AOI detected. Keep current links?</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                            onClick={handleKeepSameAoi}
                          >
                            Keep
                          </button>
                          <button
                            type="button"
                            className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 shadow-sm hover:bg-rose-100"
                            onClick={handleResetSameAoi}
                          >
                            Reset anyway
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-2 grid gap-1 text-xs text-slate-600">
                  <div>area: {formatNum(aoi.area_km2)} km²</div>
                  <div className="break-words">bbox: {bboxLabel}</div>
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    className="w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={searchDisabled}
                    onClick={handleSearchStac}
                  >
                    {isRunning ? "Searching…" : "Search STAC evidence"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-3 text-xs text-slate-500">
                {isListMode
                  ? "No evidence loaded yet. Add STAC link or upload AOI to begin."
                  : "No evidence loaded yet. This is the spatial view of evidence—upload an AOI to begin."}
              </div>
            )}

            {verifierMode && auditTrail ? (
              <details className="rounded-lg border border-slate-200 bg-white">
                <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-slate-900">
                  Audit trail
                  <span className="ml-2 text-[11px] font-medium text-slate-500">
                    {auditTrail.events.length} events
                  </span>
                </summary>
                <div className="px-3 pb-3">
                  <AuditTrailPanel
                    events={auditTrail.events}
                    exportJson={auditTrail.exportJson}
                    exportSha256={auditTrail.exportSha256}
                    onClear={auditTrail.onClear}
                    onExport={auditTrail.onExport}
                    onJumpToRule={auditTrail.onJumpToRule}
                    onOpenEvidence={auditTrail.onOpenEvidence}
                    onNotify={showToast}
                  />
                </div>
              </details>
            ) : null}

            {isListMode ? null : (
              <details className="rounded-lg border border-slate-200 bg-white">
                <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-slate-900">
                  Evidence list
                </summary>
                <div className="px-3 pb-3">{listContent}</div>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
