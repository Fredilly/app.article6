"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import MapCanvas from "@/components/map/MapCanvas";
import AuditTrailPanel from "@/components/verifier/AuditTrailPanel";
import DeltaImpactTasksPanel from "@/components/verify/DeltaImpactTasksPanel";
import OutcomeWidget from "@/components/verify/OutcomeWidget";
import FinalReviewSummaryPanel from "@/components/verify/FinalReviewSummaryPanel";
import ReviewSummaryCard from "@/components/verify/ReviewSummaryCard";
import RunHistoryPanel from "@/components/verify/RunHistoryPanel";
import EvidenceWorkflowStepper from "@/components/verify/EvidenceWorkflowStepper";
import type { AOI, EvidencePin, VerificationRun } from "@/lib/proofMap/types";
import { parseAoiGeoJson } from "@/lib/proofMap/aoi";
import type { ProofEvidenceItem } from "@/lib/proof/bundle";
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
import { buildReviewSummary, type ReviewSummary } from "@/lib/verify/buildReviewSummary";
import { buildReviewSummaryPdf } from "@/lib/verify/reviewSummaryPdf";
import { buildFinalizedExportKpis, buildSelectedStacExport, prepareChecklistExport } from "@/lib/verify/finalizedExport";
import { computeKpis, linkedRuleIdsFromPins } from "@/lib/kpis/computeKpis";
import {
  buildEvidenceInventory,
  coalesceEvidencePins,
  evidencePinDedupeKey,
  formatEvidenceInventoryId,
  linkEvidencePinToRequirement,
  linkPddFragmentToRequirement,
  unlinkPddFragmentFromRequirement,
  unlinkEvidencePinFromRequirement,
  upsertPddFragmentOnEvidencePin,
} from "@/lib/evidence/inventory";
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
  getVerifyWizardStepDetails,
  loadRunFromHistory,
  type VerifyRunHistoryEntry,
  persistVerifierRunBundle,
  readRunHistory,
  readVerifierRunBundle,
  saveCurrentRunToHistory,
  shortRunId,
} from "@/lib/verify/runState";
import ProofCoverageChip from "@/components/verify/ProofCoverageChip";
import type { EvidenceSnapshot } from "@/lib/proofMap/evidenceSnapshot";

type ToastState = {
  title: string;
  subtitle?: string | null;
};

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
  onSetEvidencePins: (pins: EvidencePin[] | ((current: EvidencePin[]) => EvidencePin[])) => void;
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
};

function formatNum(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "—";
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

function downloadBytes(bytes: Uint8Array, filename: string, mimeType: string) {
  const blobPart = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([blobPart], { type: mimeType });
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

function inventoryLinkStateLabel(linkedRequirementIds: string[]): string {
  if (!linkedRequirementIds.length) return "Unlinked";
  if (linkedRequirementIds.length === 1) return "Linked to 1 requirement";
  return `Linked to ${linkedRequirementIds.length} requirements`;
}

function inventoryRelationshipSummary(linkedRequirementIds: string[]): string {
  if (!linkedRequirementIds.length) return "Not linked yet";
  if (linkedRequirementIds.length === 1) return `Linked to ${linkedRequirementIds[0]}`;
  return `Linked to ${linkedRequirementIds.join(", ")}`;
}

function formatPddPageLabel(pageStart?: number, pageEnd?: number): string | null {
  if (typeof pageStart === "number" && typeof pageEnd === "number" && pageStart !== pageEnd) {
    return `p. ${pageStart}-${pageEnd}`;
  }
  if (typeof pageStart === "number") return `p. ${pageStart}`;
  if (typeof pageEnd === "number") return `p. ${pageEnd}`;
  return null;
}

type PddFragmentDraft = {
  pageStart: string;
  pageEnd: string;
  sectionLabel: string;
  sectionHeading: string;
  excerpt: string;
};

const EMPTY_PDD_FRAGMENT_DRAFT: PddFragmentDraft = {
  pageStart: "",
  pageEnd: "",
  sectionLabel: "",
  sectionHeading: "",
  excerpt: "",
};

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
}: ProofMapTabProps) {
  const isEvidenceMode = mode === "evidence";
  const isListMode = viewMode === "list";
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
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
  const lastAoiSelectionResetKeyRef = useRef<string | null>(null);
  const [startOverOpen, setStartOverOpen] = useState(false);
  const [startOverBusy, setStartOverBusy] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [verifierBundle, setVerifierBundle] = useState(() => readVerifierRunBundle(methodCode, version));
  const [runHistory, setRunHistory] = useState(() => readRunHistory(methodCode, version));
  const [baselineTick, setBaselineTick] = useState(0);
  const [currentInputFingerprint, setCurrentInputFingerprint] = useState<string | null>(null);
  const [secondarySectionOpen, setSecondarySectionOpen] = useState(false);
  const [runHistoryOpen, setRunHistoryOpen] = useState(false);
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [selectedRuleContext, setSelectedRuleContext] = useState<{
    id: string | null;
    text: string | null;
    sectionId: string | null;
    sectionTitle: string | null;
  } | null>(null);
  const [reviewArtifact, setReviewArtifact] = useState<EvidenceSnapshot | null>(null);
  const [reviewPdfBusy, setReviewPdfBusy] = useState(false);
  const [reviewPdfError, setReviewPdfError] = useState<string | null>(null);
  const uploadAoiInputRef = useRef<HTMLInputElement | null>(null);
  const uploadWorkbookInputRef = useRef<HTMLInputElement | null>(null);
  const uploadPddInputRef = useRef<HTMLInputElement | null>(null);
  const [pddFragmentDrafts, setPddFragmentDrafts] = useState<Record<string, PddFragmentDraft>>({});
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
  const linkedPinsCount = useMemo(
    () => evidencePins.filter((pin) => linkedRuleIdsFromPins([pin]).length > 0).length,
    [evidencePins],
  );
  const evidenceInventory = useMemo(() => buildEvidenceInventory(evidencePins), [evidencePins]);
  const evidencePinsById = useMemo(() => new Map(evidencePins.map((pin) => [pin.id, pin])), [evidencePins]);
  const selectedRuleId = activeRuleId ?? null;

  const showToast = useCallback((message: string | ToastState) => {
    const next = typeof message === "string" ? { title: message } : message;
    setToast(next);
    window.setTimeout(() => {
      setToast((current) => (current?.title === next.title && current?.subtitle === next.subtitle ? null : current));
    }, 1600);
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

  const fetchSelectedRuleContext = useCallback(
    async (ruleId: string | null) => {
      if (!ruleId) return null;
      const fallback = {
        id: ruleId,
        text: null,
        sectionId: null,
        sectionTitle: null,
      };
      try {
        const ruleResponse = await fetch(
          `/api/methods/${encodeURIComponent(methodCode)}/v/${encodeURIComponent(version)}/rules?id=${encodeURIComponent(ruleId)}`,
          { cache: "no-store" },
        );
        if (!ruleResponse.ok) return fallback;
        const rulePayload = (await ruleResponse.json()) as { rule?: Record<string, unknown> };
        const ruleRecord = rulePayload.rule;
        if (!ruleRecord || typeof ruleRecord !== "object") return fallback;
        const sectionId = asNonEmptyString(ruleRecord.sectionId) ?? null;
        let sectionTitle: string | null = null;
        if (sectionId) {
          try {
            const sectionsResponse = await fetch(
              `/api/methods/${encodeURIComponent(methodCode)}/v/${encodeURIComponent(version)}/sections`,
              { cache: "no-store" },
            );
            if (sectionsResponse.ok) {
              const sectionsPayload = (await sectionsResponse.json()) as { sections?: Array<Record<string, unknown>> };
              const match =
                sectionsPayload.sections?.find((item) => asNonEmptyString(item.id) === sectionId) ?? null;
              sectionTitle = match ? asNonEmptyString(match.title) ?? sectionId : sectionId;
            } else {
              sectionTitle = sectionId;
            }
          } catch {
            sectionTitle = sectionId;
          }
        }
        return {
          id: asNonEmptyString(ruleRecord.id) ?? ruleId,
          text: asNonEmptyString(ruleRecord.text) ?? null,
          sectionId,
          sectionTitle,
        };
      } catch {
        return fallback;
      }
    },
    [methodCode, version],
  );

  useEffect(() => {
    let active = true;
    void fetchSelectedRuleContext(selectedRuleId).then((next) => {
      if (!active) return;
      setSelectedRuleContext(next);
    });
    return () => {
      active = false;
    };
  }, [fetchSelectedRuleContext, selectedRuleId]);

  useEffect(() => {
    setVerifierBundle(readVerifierRunBundle(methodCode, version));
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

  const markBundleEdited = useCallback(
    (
      current: typeof verifierBundle,
      options: { invalidateFinality?: boolean; clearSavedReviewerArtifact?: boolean } = {},
    ) => {
      const invalidateFinality = options.invalidateFinality ?? false;
      const clearSavedReviewerArtifact = options.clearSavedReviewerArtifact ?? invalidateFinality;
      return {
        ...current,
        isEditedDraft:
          current.isEditedDraft ||
          Boolean(current.loadedFromRunId || current.derivedFromRunId || current.exportedAt),
        exportedAt: invalidateFinality ? null : current.exportedAt,
        savedReviewerArtifactAt: clearSavedReviewerArtifact ? null : current.savedReviewerArtifactAt,
        finalizedAt: invalidateFinality ? null : current.finalizedAt,
        minutes: clearSavedReviewerArtifact ? "" : current.minutes,
        outcomeNote: clearSavedReviewerArtifact ? "" : current.outcomeNote,
      };
    },
    [],
  );

  const handleMinutesChange = useCallback((value: string) => {
    setVerifierBundle((current) => ({
      ...current,
      draftMinutes: value,
      isEditedDraft:
        current.isEditedDraft ||
        (value !== current.minutes && Boolean(current.loadedFromRunId || current.derivedFromRunId || current.exportedAt)),
    }));
  }, []);

  const handleOutcomeNoteChange = useCallback((value: string) => {
    setVerifierBundle((current) => ({
      ...current,
      draftOutcomeNote: value,
      isEditedDraft:
        current.isEditedDraft ||
        (value !== current.outcomeNote &&
          Boolean(current.loadedFromRunId || current.derivedFromRunId || current.exportedAt)),
    }));
  }, []);

  const handleSaveReviewerArtifact = useCallback(() => {
    const savedAt = new Date().toISOString();
    setVerifierBundle((current) => {
      const hasSavedArtifact = Boolean(current.draftMinutes.trim() || current.draftOutcomeNote.trim());
      return {
        ...current,
        minutes: current.draftMinutes,
        outcomeNote: current.draftOutcomeNote,
        savedReviewerArtifactAt: hasSavedArtifact ? savedAt : null,
        isEditedDraft:
          current.isEditedDraft ||
          ((current.draftMinutes !== current.minutes || current.draftOutcomeNote !== current.outcomeNote) &&
            Boolean(current.loadedFromRunId || current.derivedFromRunId || current.exportedAt)),
      };
    });
    showToast({ title: "Reviewer artifact saved", subtitle: "Saved text now counts for run completion" });
  }, [showToast]);

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
        setVerifierBundle((current) => markBundleEdited(current, { invalidateFinality: true }));
        onSelectStacItemId(null);
        onUploadAoi(result.aoi);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [markBundleEdited, onAuditEvent, onSelectStacItemId, onUploadAoi],
  );

  const handleDeltaChange = useCallback((value: string) => {
    setVerifierBundle((current) => ({ ...markBundleEdited(current, { invalidateFinality: true }), delta: value }));
  }, [markBundleEdited]);

  const handleImpactChange = useCallback((value: string) => {
    setVerifierBundle((current) => ({ ...markBundleEdited(current, { invalidateFinality: true }), impact: value }));
  }, [markBundleEdited]);

  const commitDraftTask = useCallback(() => {
    const text = draftTask.trim();
    if (!text) return;
    const task = addTaskWithText(text);
    setVerifierBundle((current) => ({
      ...markBundleEdited(current, { invalidateFinality: true }),
      tasks: [...current.tasks, task],
    }));
    setDraftTask("");
    setShowDraftTask(false);
  }, [draftTask, markBundleEdited]);

  const handleAddTask = useCallback(() => {
    setShowDraftTask(true);
    requestAnimationFrame(() => {
      draftTaskInputRef.current?.focus();
    });
  }, []);

  const handleToggleTask = useCallback((id: string) => {
    const timestamp = new Date().toISOString();
    setVerifierBundle((current) => ({
      ...markBundleEdited(current, { invalidateFinality: true }),
      tasks: current.tasks.map((task) =>
        task.id === id ? { ...task, done: !task.done, updatedAt: timestamp } : task,
      ),
    }));
  }, [markBundleEdited]);

  const handleUpdateTask = useCallback((id: string, value: string) => {
    const timestamp = new Date().toISOString();
    setVerifierBundle((current) => ({
      ...markBundleEdited(current, { invalidateFinality: true }),
      tasks: current.tasks.map((task) =>
        task.id === id ? { ...task, text: value, updatedAt: timestamp } : task,
      ),
    }));
  }, [markBundleEdited]);

  const handleDeleteTask = useCallback((id: string) => {
    setVerifierBundle((current) => ({
      ...markBundleEdited(current, { invalidateFinality: true }),
      tasks: current.tasks.filter((task) => task.id !== id),
    }));
  }, [markBundleEdited]);

  const buildHistoryBundle = useCallback(() => {
    return {
      runContext: verifierBundle.runContext,
      exportedAt: verifierBundle.exportedAt,
      savedReviewerArtifactAt: verifierBundle.savedReviewerArtifactAt,
      finalizedAt: verifierBundle.finalizedAt,
      loadedFromRunId: verifierBundle.loadedFromRunId,
      derivedFromRunId: verifierBundle.derivedFromRunId,
      isEditedDraft: verifierBundle.isEditedDraft,
      minutes: verifierBundle.minutes,
      outcomeNote: verifierBundle.outcomeNote,
      draftMinutes: verifierBundle.draftMinutes,
      draftOutcomeNote: verifierBundle.draftOutcomeNote,
      checklist: verifierBundle.checklist,
      delta: verifierBundle.delta,
      impact: verifierBundle.impact,
      tasks: verifierBundle.tasks,
      selectedRuleId,
      linkedRuleIds,
      aoi,
      evidencePins,
      verificationRuns,
      selectedStacItemId,
    };
  }, [aoi, evidencePins, linkedRuleIds, selectedRuleId, selectedStacItemId, verificationRuns, verifierBundle]);

  const currentWorkspaceBundle = useMemo(() => buildHistoryBundle(), [buildHistoryBundle]);
  const currentRunId = verifierBundle.runContext.runId;
  const currentRunLabel = shortRunId(currentRunId);
  const loadedFromRunLabel = verifierBundle.loadedFromRunId ? shortRunId(verifierBundle.loadedFromRunId) : null;
  const activeHistoryRunId = verifierBundle.loadedFromRunId ?? (runHistory.some((entry) => entry.runId === currentRunId) ? currentRunId : null);
  const activeHistoryEntry = useMemo(
    () => runHistory.find((entry) => entry.runId === currentRunId) ?? null,
    [currentRunId, runHistory],
  );
  const hasUnsavedWorkspaceEdits = useMemo(() => {
    if (!activeHistoryEntry) {
      return Boolean(
        aoi ||
          evidencePins.length ||
          verificationRuns.length ||
          selectedStacItemId ||
          verifierBundle.exportedAt ||
          verifierBundle.savedReviewerArtifactAt ||
          verifierBundle.finalizedAt ||
          verifierBundle.minutes.trim() ||
          verifierBundle.outcomeNote.trim() ||
          verifierBundle.draftMinutes.trim() ||
          verifierBundle.draftOutcomeNote.trim() ||
          verifierBundle.delta.trim() ||
          verifierBundle.impact.trim() ||
          verifierBundle.tasks.length,
      );
    }
    return canonicalJsonStringify(activeHistoryEntry.bundle) !== canonicalJsonStringify(currentWorkspaceBundle);
  }, [
    activeHistoryEntry,
    aoi,
    currentWorkspaceBundle,
    evidencePins.length,
    selectedStacItemId,
    verificationRuns.length,
    verifierBundle.delta,
    verifierBundle.exportedAt,
    verifierBundle.finalizedAt,
    verifierBundle.impact,
    verifierBundle.draftMinutes,
    verifierBundle.draftOutcomeNote,
    verifierBundle.minutes,
    verifierBundle.outcomeNote,
    verifierBundle.savedReviewerArtifactAt,
    verifierBundle.tasks.length,
  ]);
  const mutableWorkspaceFingerprint = useMemo(
    () =>
      canonicalJsonStringify({
        selectedRuleId,
        aoiId: aoi?.id ?? null,
        aoiHash: currentAoiFingerprint,
        selectedStacItemId,
        pins: evidencePins.map((pin) => ({
          id: pin.id,
          ruleId: pin.ruleId ?? null,
          itemId: pin.itemId ?? null,
          attachments: (pin.attachments ?? []).length,
        })),
        runs: verificationRuns.map((run) => ({ id: run.id, status: run.status, ended_at: run.ended_at ?? null })),
      }),
    [aoi?.id, currentAoiFingerprint, evidencePins, selectedRuleId, selectedStacItemId, verificationRuns],
  );
  const previousMutableWorkspaceRef = useRef<{ runId: string; fingerprint: string } | null>(null);
  const ignoredMutableWorkspaceRunIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!verifierBundle.finalizedAt) return;
    if (ignoredMutableWorkspaceRunIdRef.current === verifierBundle.runContext.runId) return;
    ignoredMutableWorkspaceRunIdRef.current = verifierBundle.runContext.runId;
  }, [verifierBundle.finalizedAt, verifierBundle.runContext.runId]);

  useEffect(() => {
    const previous = previousMutableWorkspaceRef.current;
    const current = { runId: verifierBundle.runContext.runId, fingerprint: mutableWorkspaceFingerprint };
    if (!previous || previous.runId !== current.runId) {
      previousMutableWorkspaceRef.current = current;
      return;
    }
    if (previous.fingerprint === current.fingerprint) return;
    if (ignoredMutableWorkspaceRunIdRef.current === current.runId) {
      ignoredMutableWorkspaceRunIdRef.current = null;
      previousMutableWorkspaceRef.current = current;
      return;
    }
    previousMutableWorkspaceRef.current = current;
    setVerifierBundle((bundle) => markBundleEdited(bundle, { invalidateFinality: true }));
  }, [markBundleEdited, mutableWorkspaceFingerprint, verifierBundle.runContext.runId]);

  const persistCurrentWorkspaceAsDraft = useCallback(() => {
    const historicalCurrent = runHistory.find((entry) => entry.runId === verifierBundle.runContext.runId) ?? null;
    const draftBundle =
      historicalCurrent && canonicalJsonStringify(historicalCurrent.bundle) !== canonicalJsonStringify(currentWorkspaceBundle)
        ? {
            ...currentWorkspaceBundle,
            runContext: createVerifierRunBundle(methodCode, version).runContext,
          }
        : currentWorkspaceBundle;
    setVerifierBundle((current) =>
      current.runContext.runId === draftBundle.runContext.runId
        ? current
        : { ...current, runContext: draftBundle.runContext },
    );
    setRunHistory(saveCurrentRunToHistory(methodCode, version, draftBundle));
    return draftBundle.runContext.runId;
  }, [currentWorkspaceBundle, methodCode, runHistory, verifierBundle.runContext.runId, version]);

  const handleSaveRunHistory = useCallback(
    (bundleOverride?: ReturnType<typeof buildHistoryBundle>) => {
      const bundle = bundleOverride ?? buildHistoryBundle();
      setRunHistory(saveCurrentRunToHistory(methodCode, version, bundle));
    },
    [buildHistoryBundle, methodCode, version],
  );

  const handleLoadRunHistory = useCallback(
    (runId: string) => {
      if (runId === verifierBundle.runContext.runId) return;
      if (hasUnsavedWorkspaceEdits && typeof window !== "undefined") {
        const confirmed = window.confirm("Save the current workspace as a draft before loading another run?");
        if (!confirmed) return;
        persistCurrentWorkspaceAsDraft();
      }
      const loaded = loadRunFromHistory(methodCode, version, runId);
      if (!loaded) return;
      const editableRun = createVerifierRunBundle(methodCode, version);
      ignoredMutableWorkspaceRunIdRef.current = editableRun.runContext.runId;
      setVerifierBundle({
        runContext: editableRun.runContext,
        exportedAt: loaded.exportedAt ?? null,
        savedReviewerArtifactAt: loaded.savedReviewerArtifactAt ?? loaded.exportedAt ?? null,
        finalizedAt: null,
        loadedFromRunId: runId,
        derivedFromRunId: runId,
        isEditedDraft: false,
        minutes: loaded.minutes ?? "",
        outcomeNote: loaded.outcomeNote ?? "",
        draftMinutes: loaded.minutes ?? "",
        draftOutcomeNote: loaded.outcomeNote ?? "",
        checklist: loaded.checklist ?? [],
        delta: loaded.delta ?? "",
        impact: loaded.impact ?? "",
        tasks: Array.isArray(loaded.tasks) ? loaded.tasks : [],
      });
      onSetAoi(loaded.aoi ?? null);
      onSetEvidencePins(loaded.evidencePins as EvidencePin[]);
      onSetVerificationRuns(loaded.verificationRuns as VerificationRun[]);
      onSelectStacItemId(loaded.selectedStacItemId ?? null);
      onSelectRuleId?.(loaded.selectedRuleId ?? null);
      onEvidenceSelectionChange?.(null);
      setSecondarySectionOpen(true);
      setRunHistoryOpen(true);
      showToast({ title: `Loaded run ${shortRunId(runId)}`, subtitle: "Saved evidence and review state restored" });
    },
    [
      hasUnsavedWorkspaceEdits,
      methodCode,
      onEvidenceSelectionChange,
      onSelectRuleId,
      onSelectStacItemId,
      onSetAoi,
      onSetEvidencePins,
      onSetVerificationRuns,
      persistCurrentWorkspaceAsDraft,
      showToast,
      verifierBundle.runContext.runId,
      version,
    ],
  );

  const handleDeleteRunHistory = useCallback(
    (runId: string) => {
      setRunHistory(deleteRunFromHistory(methodCode, version, runId));
    },
    [methodCode, version],
  );

  const handleSearchStac = useCallback(async () => {
    if (!aoi) return;
    setVerifierBundle((current) => markBundleEdited(current, { invalidateFinality: true }));
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
    markBundleEdited,
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
    persistCurrentWorkspaceAsDraft();
    onSetEvidencePins([]);
    onSetVerificationRuns([]);
    onSetStacEvidenceState(null);
    onSelectStacItemId(null);
    onEvidenceSelectionChange?.(null);
    onSelectRuleId?.(null);
    setVerifierBundle(createVerifierRunBundle(methodCode, version));
    setSecondarySectionOpen(false);
    setRunHistoryOpen(false);
    setOutcomeOpen(false);
    showToast({ title: "Started new run", subtitle: "Fresh review workspace created" });
  }, [
    methodCode,
    onEvidenceSelectionChange,
    onSelectRuleId,
    onSelectStacItemId,
    onSetEvidencePins,
    onSetStacEvidenceState,
    onSetVerificationRuns,
    persistCurrentWorkspaceAsDraft,
    showToast,
    version,
  ]);
  const handleNavigateEvidence = useCallback(
    async (type: "rule" | "section", id: string) => {
      return await onNavigateEvidence(type, id);
    },
    [onNavigateEvidence],
  );

  const handleViewRunHistory = useCallback(() => {
    setSecondarySectionOpen(true);
    setRunHistoryOpen(true);
  }, []);

  const selectEvidence = (id: string, source: "pin" | "polygon") => {
    setVerifierBundle((current) => markBundleEdited(current, { invalidateFinality: true }));
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
    const nextKey = aoi
      ? JSON.stringify({
          id: aoi.id,
          created_at: aoi.created_at,
          bbox: aoi.bbox,
          area_km2: aoi.area_km2,
        })
      : null;
    if (lastAoiSelectionResetKeyRef.current === nextKey) return;
    lastAoiSelectionResetKeyRef.current = nextKey;
    onSelectStacItemId(null);
  }, [aoi, onSelectStacItemId]);

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
          selectedRuleId,
          linkedRuleIds,
        },
        exportState: {
          snapshotExportedAt: verifierBundle.exportedAt,
        },
        verifier: {
          runId: verifierBundle.runContext.runId,
          createdAt: verifierBundle.runContext.createdAt,
          minutes: verifierBundle.minutes,
          outcomeNote: verifierBundle.outcomeNote,
          finalizedAt: verifierBundle.finalizedAt,
          finalizedState: verifierBundle.finalizedAt ? "finalized" : "draft",
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
      selectedRuleId,
      methodCode,
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
  const hasComparisonContext = Boolean(latestBaseline && baselineComparable.ok);

  const upliftSummary = useMemo(() => {
    if (!latestBaseline || !baselineComparable.ok) return null;
    return computeUplift(latestBaseline.baselineKpis, runKpis);
  }, [baselineComparable.ok, latestBaseline, runKpis]);
  const baselineActionsDisabled = baselineMissing.length > 0;
  const baselineDisabledTooltip = "Load AOI to enable baseline comparisons";
  const compareTargetLabel = verifierBundle.loadedFromRunId
    ? `Loaded from run ${shortRunId(verifierBundle.loadedFromRunId)}`
    : "Current workspace";
  const comparisonUnavailableMessage = useMemo(() => {
    if (!latestBaseline) return null;
    if (baselineComparable.ok) return null;
    if (verifierBundle.isEditedDraft || verifierBundle.loadedFromRunId) {
      return {
        title: "Comparison unavailable: current workspace changed since baseline",
        detail: "AOI, selected evidence, pin changes, or unsaved draft edits can invalidate baseline comparison.",
      };
    }
    return {
      title: "Comparison unavailable",
      detail:
        baselineComparable.reasons.join("; ") ||
        "Current workspace does not match the method, version, harness, or dataset context used for the baseline.",
    };
  }, [baselineComparable, latestBaseline, verifierBundle.isEditedDraft, verifierBundle.loadedFromRunId]);
  const wizardDetails = useMemo(
    () =>
      getVerifyWizardStepDetails({
        selectedRuleId,
        aoiHash: currentAoiFingerprint,
        stacItemIds: stacFeatureIds,
        selectedStacItemId,
        linkedRuleIds,
        snapshotExportedAt: verifierBundle.exportedAt,
        reviewerArtifactSavedAt: verifierBundle.savedReviewerArtifactAt,
        minutes: verifierBundle.minutes,
        outcomeNote: verifierBundle.outcomeNote,
        finalizedAt: verifierBundle.finalizedAt,
      }),
    [
      currentAoiFingerprint,
      linkedRuleIds,
      selectedRuleId,
      selectedStacItemId,
      stacFeatureIds,
      verifierBundle.exportedAt,
      verifierBundle.finalizedAt,
      verifierBundle.minutes,
      verifierBundle.outcomeNote,
      verifierBundle.savedReviewerArtifactAt,
    ],
  );
  const currentWorkspaceIsFinal = Boolean(verifierBundle.finalizedAt);
  const selectedStacItemRecord = useMemo(() => {
    if (!selectedStacItemId) return null;
    const candidate = currentStacEvidence?.itemsById?.[selectedStacItemId];
    return candidate && typeof candidate === "object" ? (candidate as Record<string, unknown>) : null;
  }, [currentStacEvidence?.itemsById, selectedStacItemId]);
  const reviewSummary = useMemo<ReviewSummary>(
    () =>
      buildReviewSummary({
        method: { code: methodCode, version },
        aoi: {
          id: aoi?.id ?? null,
          label: aoi?.name ?? null,
          bbox: aoi?.bbox ?? null,
        },
        selected: {
          id: selectedStacItemId,
          item: selectedStacItemRecord,
        },
        outcome: runSummary,
        verifier: {
          outcomeNote: verifierBundle.outcomeNote,
          finalizedAt: verifierBundle.finalizedAt,
          finalizedState: verifierBundle.finalizedAt ? "finalized" : "draft",
        },
        rule: selectedRuleContext,
        generatedAt: verifierBundle.finalizedAt ?? verifierBundle.exportedAt ?? runSummary.provenance.generatedAt ?? null,
      }),
    [
      aoi?.bbox,
      aoi?.id,
      aoi?.name,
      methodCode,
      runSummary,
      selectedRuleContext,
      selectedStacItemId,
      selectedStacItemRecord,
      verifierBundle.exportedAt,
      verifierBundle.finalizedAt,
      verifierBundle.outcomeNote,
      version,
    ],
  );
  const ruleSectionRef = useRef<HTMLDivElement | null>(null);
  const aoiSectionRef = useRef<HTMLDivElement | null>(null);
  const stacSectionRef = useRef<HTMLDivElement | null>(null);
  const selectedItemSectionRef = useRef<HTMLDivElement | null>(null);
  const pinsSectionRef = useRef<HTMLDivElement | null>(null);
  const reviewerSectionRef = useRef<HTMLDivElement | null>(null);
  const finalSummarySectionRef = useRef<HTMLDivElement | null>(null);
  const activeLeftSection = useMemo(() => {
    switch (wizardDetails.activeStep) {
      case 1:
        return "rule";
      case 2:
        return "aoi";
      case 3:
        return "stac";
      case 4:
        return "selected";
      case 5:
        return "pins";
      case 6:
        return "reviewer";
      case 7:
        return "summary";
      default:
        return "summary";
    }
  }, [wizardDetails.activeStep]);
  const leftPaneHeader = useMemo(() => {
    if (wizardDetails.isComplete) {
      return {
        title: "Run complete",
        instruction: "This workspace is finalized. Start another run to continue with a fresh review.",
        stepLabel: "Complete",
      };
    }
    switch (wizardDetails.activeStep) {
      case 1:
        return { title: "Pick rule", instruction: "Choose the rule you are verifying before building evidence context.", stepLabel: "Step 1 of 7" };
      case 2:
        return { title: "Confirm AOI", instruction: "Upload or confirm the AOI so the evidence search has a clear scope.", stepLabel: "Step 2 of 7" };
      case 3:
        return { title: "Search STAC", instruction: "Run the evidence search and inspect the returned context in the left pane.", stepLabel: "Step 3 of 7" };
      case 4:
        return { title: "Select item", instruction: "Pick the most relevant STAC item from the returned evidence set.", stepLabel: "Step 4 of 7" };
      case 5:
        return {
          title: "Evidence inventory",
          instruction: "Create an evidence object first, then link or unlink it against the selected rule.",
          stepLabel: "Step 5 of 7",
        };
      case 6:
        return { title: "Save reviewer artifact", instruction: "Write concise reviewer notes, then save them explicitly before finalization.", stepLabel: "Step 6 of 7" };
      case 7:
        return { title: "Finalize run", instruction: "Finalize to export the single immutable run artifact with evidence and reviewer notes.", stepLabel: "Step 7 of 7" };
      default:
        return { title: "Verify run", instruction: "Use the right pane to continue the canonical wizard flow.", stepLabel: "Step" };
    }
  }, [wizardDetails.activeStep, wizardDetails.isComplete]);

  useEffect(() => {
    const ref =
      activeLeftSection === "rule" ? ruleSectionRef :
      activeLeftSection === "aoi" ? aoiSectionRef :
      activeLeftSection === "stac" ? stacSectionRef :
      activeLeftSection === "selected" ? selectedItemSectionRef :
      activeLeftSection === "pins" ? pinsSectionRef :
      activeLeftSection === "reviewer" ? reviewerSectionRef :
      finalSummarySectionRef;
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeLeftSection]);

  useEffect(() => {
    if (currentWorkspaceIsFinal) return;
    setReviewArtifact(null);
    setReviewPdfError(null);
    setReviewPdfBusy(false);
  }, [currentWorkspaceIsFinal]);

  const buildStacItemsJson = useCallback(() => {
    if (!latestStacRun || latestStacRun.status !== "ok") return { items: [] as Array<Record<string, unknown>> };
    if (!latestStacRun.result_json) return { items: [] as Array<Record<string, unknown>> };
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
  }, [latestStacRun]);

  const buildSelectedItemPayload = useCallback(() => {
    const minimalItem = buildSelectedStacExport({
      selectedStacItemId,
      selectedStacItemRecord,
      evidencePins,
    });
    const citedIds = evidencePins.flatMap((pin) => pin.cited_ids ?? []);
    const selectedIds = selectedStacItemId ? [selectedStacItemId] : citedIds.length ? citedIds : undefined;
    return { minimalItem, selectedIds };
  }, [evidencePins, selectedStacItemId, selectedStacItemRecord]);

  const buildEvidenceSource = useCallback(() => {
    return stacEndpointUrl
      ? { type: "stac_url" as const, ref: stacEndpointUrl }
      : localEvidenceHashInputs
        ? { type: "upload" as const, ref: "local_pins", hash_inputs: localEvidenceHashInputs }
        : { type: "unknown" as const, ref: "unknown" };
  }, [localEvidenceHashInputs, stacEndpointUrl]);

  const buildFinalReviewArtifact = useCallback(
    async (options: {
      finalizedAt: string;
      runContext: { runId: string; createdAt: string };
      summaryState: "draft" | "finalized";
      checklist: typeof verifierBundle.checklist;
      snapshotExportedAt: string | null;
    }) => {
      const { minimalItem, selectedIds } = buildSelectedItemPayload();
      const evidenceSource = buildEvidenceSource();
      const checklistExport = prepareChecklistExport(options.checklist);
      const verifierSnapshot = {
        runId: options.runContext.runId,
        createdAt: options.runContext.createdAt,
        minutes: verifierBundle.minutes,
        outcomeNote: verifierBundle.outcomeNote,
        finalizedAt: options.summaryState === "finalized" ? options.finalizedAt : null,
        finalizedState: options.summaryState,
        delta: verifierBundle.delta,
        impact: verifierBundle.impact,
        checklist: options.checklist,
        tasks: verifierBundle.tasks,
      };
      const exportVerifierSnapshot = {
        ...verifierSnapshot,
        checklistStatus: checklistExport.checklistStatus,
        checklist: checklistExport.checklist,
      };
      const outcome = buildRunSummary({
        ...runSummary,
        linkage: {
          ...runSummary.linkage,
          selectedRuleId,
          linkedRuleIds,
        },
        exportState: {
          ...runSummary.exportState,
          snapshotExportedAt: options.snapshotExportedAt,
        },
        verifier: verifierSnapshot,
        provenance: {
          ...runSummary.provenance,
          generatedAt: options.finalizedAt,
        },
      });
      const kpis = buildFinalizedExportKpis({
        stacSearchResultIds: outcome.stac.itemIds,
        selectedEvidenceItemIds,
        linkedRuleIds,
        totalRules,
        snapshotExportedAt: options.snapshotExportedAt,
      });
      const ruleContext = await fetchSelectedRuleContext(selectedRuleId);
      const summary = buildReviewSummary({
        method: { code: methodCode, version },
        aoi: {
          id: aoi?.id ?? null,
          label: aoi?.name ?? null,
          bbox: aoi?.bbox ?? null,
        },
        selected: {
          id: selectedStacItemId,
          item: selectedStacItemRecord,
        },
        outcome,
        verifier: exportVerifierSnapshot,
        rule: ruleContext,
        generatedAt: options.finalizedAt,
      });
      const artifact = await buildOutcomeSnapshot({
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
          ids: options.summaryState === "finalized" ? undefined : selectedIds,
          item: minimalItem ?? undefined,
        },
        app: {
          commit: asNonEmptyString(process.env.NEXT_PUBLIC_GIT_SHA),
          env: asNonEmptyString(process.env.NEXT_PUBLIC_VERCEL_ENV),
          version: asNonEmptyString(process.env.NEXT_PUBLIC_APP_VERSION),
        },
        items: options.summaryState === "finalized" ? undefined : selectedStacItemId ? [{ id: selectedStacItemId, linked_rules: minimalItem?.linked_rules ?? [] }] : [],
        stacItemsJson: options.summaryState === "finalized" ? undefined : buildStacItemsJson(),
        outcome,
        kpis,
        verifier: exportVerifierSnapshot,
        summary,
      });

      return {
        artifact: artifact as EvidenceSnapshot,
        summary,
        verifierSnapshot,
      };
    },
    [
      aoi,
      buildEvidenceSource,
      buildSelectedItemPayload,
      buildStacItemsJson,
      fetchSelectedRuleContext,
      linkedRuleIds,
      methodCode,
      runSummary,
      selectedEvidenceItemIds,
      selectedRuleId,
      selectedStacItemId,
      selectedStacItemRecord,
      totalRules,
      verifierBundle,
      version,
    ],
  );

  useEffect(() => {
    if (!currentWorkspaceIsFinal || reviewArtifact || !verifierBundle.finalizedAt) return;
    let active = true;
    void buildFinalReviewArtifact({
      finalizedAt: verifierBundle.finalizedAt,
      runContext: verifierBundle.runContext,
      summaryState: "finalized",
      checklist: verifierBundle.checklist,
      snapshotExportedAt: verifierBundle.finalizedAt,
    })
      .then(({ artifact }) => {
        if (active) setReviewArtifact(artifact);
      })
      .catch(() => {
        if (active) setReviewArtifact(null);
      });
    return () => {
      active = false;
    };
  }, [buildFinalReviewArtifact, currentWorkspaceIsFinal, reviewArtifact, verifierBundle]);

  const handleFinalizeRun = useCallback(() => {
    if (!linkedRuleIds.length || !verifierBundle.savedReviewerArtifactAt) return;
    void (async () => {
      const finalizedAt = new Date().toISOString();
      const nextRunContext =
        activeHistoryEntry && canonicalJsonStringify(activeHistoryEntry.bundle) !== canonicalJsonStringify(currentWorkspaceBundle)
          ? createVerifierRunBundle(methodCode, version).runContext
          : verifierBundle.runContext;
      const { artifact } = await buildFinalReviewArtifact({
        finalizedAt,
        runContext: nextRunContext,
        summaryState: "finalized",
        checklist: verifierBundle.checklist,
        snapshotExportedAt: finalizedAt,
      });
      setReviewArtifact(artifact);
      setReviewPdfError(null);
      setVerifierBundle((current) => ({
        ...current,
        runContext: nextRunContext,
        exportedAt: finalizedAt,
        finalizedAt,
        loadedFromRunId: null,
        isEditedDraft: false,
      }));
      handleSaveRunHistory({
        ...buildHistoryBundle(),
        runContext: nextRunContext,
        exportedAt: finalizedAt,
        finalizedAt,
        loadedFromRunId: null,
        isEditedDraft: false,
      });
      setSecondarySectionOpen(true);
      showToast({ title: "Run complete", subtitle: "Review summary ready. Download JSON or PDF from the result card." });
    })().catch((error) => {
      setError(error instanceof Error ? error.message : String(error));
      showToast("Finalize failed");
    });
  }, [
    activeHistoryEntry,
    buildFinalReviewArtifact,
    buildHistoryBundle,
    currentWorkspaceBundle,
    handleSaveRunHistory,
    linkedRuleIds,
    methodCode,
    showToast,
    verifierBundle,
    version,
  ]);

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
    const hasReviewerDraft = Boolean(verifierBundle.draftMinutes.trim() || verifierBundle.draftOutcomeNote.trim());
    const hasComparisonNotes = Boolean(verifierBundle.delta.trim() || verifierBundle.impact.trim() || verifierBundle.tasks.length);
    const hasWorkspaceRunState = Boolean(
      verifierBundle.exportedAt ||
      verifierBundle.savedReviewerArtifactAt ||
      verifierBundle.finalizedAt ||
      verifierBundle.loadedFromRunId ||
      verifierBundle.derivedFromRunId,
    );
    return hasAoi || hasPins || hasSelection || hasEvidence || hasRuns || hasSnapshots || hasReviewerDraft || hasComparisonNotes || hasWorkspaceRunState;
  }, [
    aoi,
    currentStacEvidence?.fc?.features?.length,
    evidencePins.length,
    evidenceSnapshots,
    selectedStacItemId,
    verificationRuns.length,
    verifierBundle.delta,
    verifierBundle.derivedFromRunId,
    verifierBundle.draftMinutes,
    verifierBundle.draftOutcomeNote,
    verifierBundle.exportedAt,
    verifierBundle.finalizedAt,
    verifierBundle.impact,
    verifierBundle.loadedFromRunId,
    verifierBundle.savedReviewerArtifactAt,
    verifierBundle.tasks.length,
  ]);

  const searchDisabled = shouldDisableRunVerification({ isRunning, aoi, currentAoiFingerprint, methodCode, version, evidencePins });
  const hasRule = Boolean(selectedRuleId);
  const hasAoi = Boolean(aoi?.geojson);
  const hasSearchResults = (stacFeatureIds?.length ?? 0) > 0;
  const hasSelectedItem = Boolean(selectedStacItemId && currentStacEvidence?.itemsById?.[selectedStacItemId]);
  const currentPinItemId = hasSelectedItem ? selectedStacItemId : null;
  const canCreatePin = hasRule && hasSelectedItem;
  const canAddSelectedItemToInventory = Boolean(currentPinItemId);
  const createPinDisabledReason = canCreatePin
    ? "Pin = durable link between a rule and an evidence item. Drives Linked/Coverage."
    : !hasRule
      ? "Select a rule to pin evidence."
      : "Select an evidence item to pin.";
  const addInventoryDisabledReason = canAddSelectedItemToInventory
    ? "Add the selected evidence item to inventory without linking it yet."
    : "Select an evidence item to add it to inventory.";

  const triggerAoiUpload = useCallback(() => {
    uploadAoiInputRef.current?.click();
  }, []);

  const handleCreatePin = useCallback(() => {
    if (!selectedRuleId || !currentPinItemId) return;
    try {
      const ts = new Date().toISOString();
      const candidate: EvidencePin = {
        id:
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `pin_${ts}_${Math.random().toString(16).slice(2)}`,
        kind: "note",
        title: currentPinItemId,
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
      const dedupeKey = evidencePinDedupeKey(candidate);
      const existing = evidencePins.find((pin) => evidencePinDedupeKey(pin) === dedupeKey);
      onSetEvidencePins((current) => {
        const existingPin = current.find((pin) => evidencePinDedupeKey(pin) === dedupeKey);
        return existingPin
          ? linkEvidencePinToRequirement(current, existingPin.id, selectedRuleId)
          : coalesceEvidencePins([candidate, ...current]);
      });
      setVerifierBundle((current) => markBundleEdited(current, { invalidateFinality: true }));
      showToast(existing ? `Updated ${currentPinItemId} in inventory` : `Added ${currentPinItemId} and linked it to ${selectedRuleId}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      showToast("Inventory update failed. Selection kept.");
    }
  }, [
    aoi?.id,
    currentAoiFingerprint,
    currentPinItemId,
    currentStacEvidence?.runId,
    evidencePins,
    markBundleEdited,
    methodCode,
    onSetEvidencePins,
    selectedRuleId,
    showToast,
    version,
  ]);

  const handleAddSelectedItemToInventory = useCallback(() => {
    if (!currentPinItemId) return;
    try {
      const ts = new Date().toISOString();
      const candidate: EvidencePin = {
        id:
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `pin_${ts}_${Math.random().toString(16).slice(2)}`,
        kind: "note",
        title: currentPinItemId,
        ts,
        itemId: currentPinItemId,
        note: `${methodCode}@${version}`,
        aoi_id: aoi?.id ?? null,
        aoi_fingerprint: currentAoiFingerprint ?? undefined,
        cited_ids: [],
        stac_item_ids: [currentPinItemId],
        stac_run_id: currentStacEvidence?.runId,
        created_at: ts,
      };
      const dedupeKey = evidencePinDedupeKey(candidate);
      const existing = evidencePins.find((pin) => evidencePinDedupeKey(pin) === dedupeKey);
      onSetEvidencePins((current) => {
        const existingPin = current.find((pin) => evidencePinDedupeKey(pin) === dedupeKey);
        return existingPin ? coalesceEvidencePins(current) : coalesceEvidencePins([candidate, ...current]);
      });
      setVerifierBundle((current) => markBundleEdited(current, { invalidateFinality: true }));
      showToast(existing ? `${currentPinItemId} is already in inventory` : `Added ${currentPinItemId} to inventory`);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      showToast("Inventory capture failed. Selection kept.");
    }
  }, [
    aoi?.id,
    currentAoiFingerprint,
    currentPinItemId,
    currentStacEvidence?.runId,
    evidencePins,
    markBundleEdited,
    methodCode,
    onSetEvidencePins,
    showToast,
    version,
  ]);

  const handleWorkbookUpload = useCallback(async (file: File | null) => {
    if (!file) return;
    setError(null);
    const ts = new Date().toISOString();
    const pinId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `pin_${ts}_${Math.random().toString(16).slice(2)}`;
    try {
      const result = await createAndStoreEvidenceAttachment({ pin_id: pinId, file });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const candidate: EvidencePin = {
        id: pinId,
        kind: "doc",
        title: file.name,
        ts,
        note: `${methodCode}@${version}`,
        aoi_id: aoi?.id ?? null,
        aoi_fingerprint: currentAoiFingerprint ?? undefined,
        cited_ids: [],
        attachments: [result.attachment],
        created_at: ts,
      };
      const dedupeKey = evidencePinDedupeKey(candidate);
      const existing = evidencePins.find((pin) => evidencePinDedupeKey(pin) === dedupeKey);
      onSetEvidencePins((current) => {
        const existingPin = current.find((pin) => evidencePinDedupeKey(pin) === dedupeKey);
        return existingPin ? coalesceEvidencePins(current) : coalesceEvidencePins([candidate, ...current]);
      });
      setVerifierBundle((current) => markBundleEdited(current, { invalidateFinality: true }));
      showToast(existing ? `${file.name} is already in inventory` : `Added workbook ${file.name} to inventory`);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      showToast("Workbook intake failed.");
    }
  }, [
    aoi?.id,
    currentAoiFingerprint,
    evidencePins,
    markBundleEdited,
    methodCode,
    onSetEvidencePins,
    showToast,
    version,
  ]);

  const updatePddFragmentDraft = useCallback((evidenceId: string, patch: Partial<PddFragmentDraft>) => {
    setPddFragmentDrafts((current) => ({
      ...current,
      [evidenceId]: {
        ...(current[evidenceId] ?? EMPTY_PDD_FRAGMENT_DRAFT),
        ...patch,
      },
    }));
  }, []);

  const handlePddUpload = useCallback(async (file: File | null) => {
    if (!file) return;
    setError(null);
    const ts = new Date().toISOString();
    const pinId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `pin_${ts}_${Math.random().toString(16).slice(2)}`;
    try {
      const result = await createAndStoreEvidenceAttachment({ pin_id: pinId, file });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const candidate: EvidencePin = {
        id: pinId,
        kind: "pdd",
        title: file.name,
        ts,
        note: `${methodCode}@${version}`,
        aoi_id: aoi?.id ?? null,
        aoi_fingerprint: currentAoiFingerprint ?? undefined,
        cited_ids: [],
        attachments: [result.attachment],
        pdd_document: {
          evidence_id: pinId,
          attachment_id: result.attachment.id,
          file_name: result.attachment.filename,
          mime: result.attachment.mime,
          added_at: result.attachment.created_at,
          sha256: result.attachment.sha256,
        },
        created_at: ts,
      };
      const dedupeKey = evidencePinDedupeKey(candidate);
      const existing = evidencePins.find((pin) => evidencePinDedupeKey(pin) === dedupeKey);
      onSetEvidencePins((current) => {
        const existingPin = current.find((pin) => evidencePinDedupeKey(pin) === dedupeKey);
        return existingPin ? coalesceEvidencePins(current) : coalesceEvidencePins([candidate, ...current]);
      });
      setVerifierBundle((current) => markBundleEdited(current, { invalidateFinality: true }));
      showToast(existing ? `${file.name} is already in inventory` : `Added PDD ${file.name} to inventory`);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      showToast("PDD intake failed.");
    }
  }, [
    aoi?.id,
    currentAoiFingerprint,
    evidencePins,
    markBundleEdited,
    methodCode,
    onSetEvidencePins,
    showToast,
    version,
  ]);

  const handleSavePddFragment = useCallback((pin: EvidencePin) => {
    const draft = pddFragmentDrafts[pin.id] ?? EMPTY_PDD_FRAGMENT_DRAFT;
    const parsePage = (value: string): number | undefined => {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      const parsed = Number(trimmed);
      return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
    };
    const pageStart = parsePage(draft.pageStart);
    const pageEnd = parsePage(draft.pageEnd) ?? pageStart;
    const sectionLabel = draft.sectionLabel.trim();
    const sectionHeading = draft.sectionHeading.trim();
    const excerpt = draft.excerpt.trim();
    if (!pageStart && !pageEnd && !sectionLabel && !sectionHeading && !excerpt) {
      setError("Add at least one fragment field before saving.");
      return;
    }
    onSetEvidencePins((current) =>
      upsertPddFragmentOnEvidencePin(current, pin.id, {
        page_start: pageStart,
        page_end: pageEnd,
        section_label: sectionLabel || undefined,
        section_heading: sectionHeading || undefined,
        excerpt: excerpt || undefined,
      }),
    );
    setPddFragmentDrafts((current) => ({ ...current, [pin.id]: EMPTY_PDD_FRAGMENT_DRAFT }));
    setVerifierBundle((current) => markBundleEdited(current, { invalidateFinality: true }));
    showToast("PDD fragment saved");
  }, [markBundleEdited, onSetEvidencePins, pddFragmentDrafts, showToast]);

  const handleExportSnapshot = useCallback(async () => {
    const exportedAt = new Date().toISOString();
    const nextRunContext =
      activeHistoryEntry && canonicalJsonStringify(activeHistoryEntry.bundle) !== canonicalJsonStringify(currentWorkspaceBundle)
        ? createVerifierRunBundle(methodCode, version).runContext
        : verifierBundle.runContext;
    const checklistAfterExport = verifierBundle.checklist.map((item) =>
      item.id === "exported-snapshot" ? { ...item, checked: true, updatedAt: exportedAt } : item,
    );
    const verifierSnapshot = {
      runId: nextRunContext.runId,
      createdAt: nextRunContext.createdAt,
      minutes: verifierBundle.minutes,
      outcomeNote: verifierBundle.outcomeNote,
      finalizedAt: null,
      finalizedState: "draft" as const,
      delta: verifierBundle.delta,
      impact: verifierBundle.impact,
      checklist: checklistAfterExport,
      tasks: verifierBundle.tasks,
    };

    setVerifierBundle((current) => ({
      ...current,
      runContext: nextRunContext,
      exportedAt,
      checklist: checklistAfterExport,
      finalizedAt: null,
      loadedFromRunId: null,
      isEditedDraft: false,
    }));
    handleSaveRunHistory({
      runContext: { runId: verifierSnapshot.runId, createdAt: verifierSnapshot.createdAt },
      exportedAt,
      savedReviewerArtifactAt: verifierBundle.savedReviewerArtifactAt,
      finalizedAt: null,
      loadedFromRunId: null,
      derivedFromRunId: verifierBundle.derivedFromRunId,
      isEditedDraft: false,
      minutes: verifierSnapshot.minutes,
      outcomeNote: verifierSnapshot.outcomeNote,
      draftMinutes: verifierBundle.draftMinutes,
      draftOutcomeNote: verifierBundle.draftOutcomeNote,
      delta: verifierSnapshot.delta,
      impact: verifierSnapshot.impact,
      checklist: verifierSnapshot.checklist,
      tasks: verifierSnapshot.tasks,
      selectedRuleId,
      linkedRuleIds,
      aoi,
      evidencePins,
      verificationRuns,
      selectedStacItemId,
    });
    const { artifact } = await buildFinalReviewArtifact({
      finalizedAt: exportedAt,
      runContext: nextRunContext,
      summaryState: "draft",
      checklist: checklistAfterExport,
      snapshotExportedAt: exportedAt,
    });
    const filename = `evidence-snapshot.${safeFilename(methodCode)}.${safeFilename(version)}.json`;
    downloadJson(artifact, filename);
    showToast("Snapshot exported");
  }, [
    activeHistoryEntry,
    aoi,
    buildFinalReviewArtifact,
    currentWorkspaceBundle,
    evidencePins,
    handleSaveRunHistory,
    linkedRuleIds,
    methodCode,
    selectedRuleId,
    selectedStacItemId,
    showToast,
    verifierBundle,
    verificationRuns,
    version,
  ]);

  const handleDownloadReviewSummaryJson = useCallback(async () => {
    const finalizedAt = verifierBundle.finalizedAt ?? verifierBundle.exportedAt;
    if (!finalizedAt) return;
    const artifact =
      reviewArtifact ??
      (
        await buildFinalReviewArtifact({
          finalizedAt,
          runContext: verifierBundle.runContext,
          summaryState: "finalized",
          checklist: verifierBundle.checklist,
          snapshotExportedAt: finalizedAt,
        })
      ).artifact;
    setReviewArtifact(artifact);
    const filename = `verify-final.${safeFilename(methodCode)}.${safeFilename(version)}.${safeFilename(verifierBundle.runContext.runId)}.json`;
    downloadJson(artifact, filename);
  }, [buildFinalReviewArtifact, methodCode, reviewArtifact, verifierBundle, version]);

  const handleDownloadReviewSummaryPdf = useCallback(async () => {
    const finalizedAt = verifierBundle.finalizedAt ?? verifierBundle.exportedAt;
    if (!finalizedAt) return;
    setReviewPdfBusy(true);
    setReviewPdfError(null);
    try {
      const artifact =
        reviewArtifact ??
        (
          await buildFinalReviewArtifact({
            finalizedAt,
            runContext: verifierBundle.runContext,
            summaryState: "finalized",
            checklist: verifierBundle.checklist,
            snapshotExportedAt: finalizedAt,
          })
        ).artifact;
      setReviewArtifact(artifact);
      const pdf = buildReviewSummaryPdf(artifact.summary ?? reviewSummary);
      const filename = `verify-review-summary.${safeFilename(methodCode)}.${safeFilename(version)}.${safeFilename(verifierBundle.runContext.runId)}.pdf`;
      downloadBytes(pdf, filename, "application/pdf");
    } catch (error) {
      setReviewPdfError(error instanceof Error ? error.message : String(error));
    } finally {
      setReviewPdfBusy(false);
    }
  }, [buildFinalReviewArtifact, methodCode, reviewArtifact, reviewSummary, verifierBundle, version]);

  const handleCopyReviewSummaryLink = useCallback(async () => {
    if (typeof window === "undefined") return;
    await copyToClipboard(window.location.href);
  }, [copyToClipboard]);

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
      onSetStacEvidenceState(null);
      onSelectRuleId?.(null);
      setVerifierBundle(createVerifierRunBundle(methodCode, version));

      setError(null);
      setSnapshot(null);
      setRunJson(null);
      setViewportBbox(null);
      setStacInspectOpen(false);
      setLastSelectionSource(null);
      setStacCentroidsEnabled(true);
      setSecondarySectionOpen(false);
      setRunHistoryOpen(false);
      setOutcomeOpen(false);
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
    methodCode,
    onStartOver,
    onSelectRuleId,
    onSetStacEvidenceState,
    showToast,
    startOverBusy,
    version,
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-slate-700">Evidence inventory</div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600">
              <label className="cursor-pointer rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                Add workbook
                <input
                  ref={uploadWorkbookInputRef}
                  type="file"
                  accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/vnd.ms-excel"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0] ?? null;
                    event.target.value = "";
                    await handleWorkbookUpload(file);
                  }}
                />
              </label>
              <label className="cursor-pointer rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                Add PDD
                <input
                  ref={uploadPddInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0] ?? null;
                    event.target.value = "";
                    await handlePddUpload(file);
                  }}
                />
              </label>
              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">
                {evidenceInventory.length} item{evidenceInventory.length === 1 ? "" : "s"}
              </span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800">
                {evidenceInventory.filter((item) => item.link_state === "unlinked").length} unlinked
              </span>
            </div>
          </div>
          <div className="mt-2 grid gap-2">
            {evidenceInventory.length ? (
              evidenceInventory.map((item) => {
                const pin = evidencePinsById.get(item.evidence_id);
                if (!pin) return null;
                const linkedToSelectedRule = Boolean(selectedRuleId && item.linked_requirement_ids.includes(selectedRuleId));
                const pddDraft = pddFragmentDrafts[pin.id] ?? EMPTY_PDD_FRAGMENT_DRAFT;
                return (
                  <div key={item.evidence_id} className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                              item.link_state === "linked"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                : "border-amber-200 bg-amber-50 text-amber-800"
                            }`}
                          >
                            {inventoryLinkStateLabel(item.linked_requirement_ids)}
                          </span>
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">{item.display_name}</div>
                        <div className="mt-1 text-[11px] text-slate-600">
                          {inventoryRelationshipSummary(item.linked_requirement_ids)}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {selectedRuleId && !item.pdd_document ? (
                          linkedToSelectedRule ? (
                            <button
                              type="button"
                              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                              onClick={() => {
                                onSetEvidencePins((current) => unlinkEvidencePinFromRequirement(current, pin.id, selectedRuleId));
                                showToast(`Unlinked ${formatEvidenceInventoryId(pin.id)} from ${selectedRuleId}`);
                              }}
                            >
                              Unlink
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                              onClick={() => {
                                onSetEvidencePins((current) => linkEvidencePinToRequirement(current, pin.id, selectedRuleId));
                                showToast(`Linked ${formatEvidenceInventoryId(pin.id)} to ${selectedRuleId}`);
                              }}
                            >
                              Link
                            </button>
                          )
                        ) : selectedRuleId && item.pdd_document ? (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                            Use fragment links below
                          </span>
                        ) : null}
                      </div>
                    </div>
                      <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50">
                      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-slate-700">
                        More
                      </summary>
                        <div className="grid gap-2 px-3 pb-3 text-[11px] text-slate-600">
                          <div>ID: {formatEvidenceInventoryId(item.evidence_id)}</div>
                          <div>Type: {item.type}</div>
                          <div>{item.source_summary} · added {formatLocalDateTime(item.added_at)}</div>
                          {item.workbook_assets?.length ? (
                            <div>
                              Workbook summary: {item.workbook_assets[0]?.sheet_count ?? 0} sheet{item.workbook_assets[0]?.sheet_count === 1 ? "" : "s"} •{" "}
                              {item.workbook_record_groups?.length ?? 0} candidate group{(item.workbook_record_groups?.length ?? 0) === 1 ? "" : "s"}
                            </div>
                          ) : (
                            <div>
                              {(pin.stac_item_ids ?? []).length} STAC item
                              {(pin.stac_item_ids ?? []).length === 1 ? "" : "s"}
                              {" · "}
                              {(pin.attachments ?? []).length} attachment
                              {(pin.attachments ?? []).length === 1 ? "" : "s"}
                            </div>
                          )}
                          <div>Provenance: {item.provenance_summary}</div>
                          {item.workbook_assets?.length ? (
                            <div className="grid gap-1">
                              {item.workbook_assets.flatMap((asset) =>
                                asset.sheets.map((sheet) => (
                                  <div key={`${asset.workbook_id}:${sheet.sheet_name}`}>
                                    Sheet {sheet.sheet_name} • {sheet.row_count} row{sheet.row_count === 1 ? "" : "s"} • {sheet.column_count} column{sheet.column_count === 1 ? "" : "s"}
                                    {sheet.bounds_ref ? ` • ${sheet.bounds_ref}` : ""}
                                  </div>
                                )),
                              )}
                            </div>
                          ) : null}
                          {item.workbook_record_groups?.length ? (
                            <div className="grid gap-1">
                              {item.workbook_record_groups.map((group) => (
                                <div key={group.group_id}>
                                  {group.display_name} • {group.group_type} • {group.source_sheet}
                                  {group.source_range ? ` • ${group.source_range}` : ""}
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {item.pdd_document ? (
                            <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-2">
                              <div className="font-semibold text-slate-700">PDD document</div>
                              <div>
                                {item.pdd_document.file_name} • {item.pdd_document.mime}
                                {item.pdd_document.sha256 ? ` • ${shortSha(item.pdd_document.sha256)}` : ""}
                              </div>
                              <div className="grid gap-2 md:grid-cols-2">
                                <label className="grid gap-1">
                                  <span>Section label</span>
                                  <input
                                    type="text"
                                    value={pddDraft.sectionLabel}
                                    onChange={(event) => updatePddFragmentDraft(pin.id, { sectionLabel: event.target.value })}
                                    className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-900"
                                  />
                                </label>
                                <label className="grid gap-1">
                                  <span>Section heading</span>
                                  <input
                                    type="text"
                                    value={pddDraft.sectionHeading}
                                    onChange={(event) => updatePddFragmentDraft(pin.id, { sectionHeading: event.target.value })}
                                    className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-900"
                                  />
                                </label>
                                <label className="grid gap-1">
                                  <span>Page start</span>
                                  <input
                                    type="number"
                                    min="1"
                                    value={pddDraft.pageStart}
                                    onChange={(event) => updatePddFragmentDraft(pin.id, { pageStart: event.target.value })}
                                    className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-900"
                                  />
                                </label>
                                <label className="grid gap-1">
                                  <span>Page end</span>
                                  <input
                                    type="number"
                                    min="1"
                                    value={pddDraft.pageEnd}
                                    onChange={(event) => updatePddFragmentDraft(pin.id, { pageEnd: event.target.value })}
                                    className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-900"
                                  />
                                </label>
                              </div>
                              <label className="grid gap-1">
                                <span>Excerpt</span>
                                <textarea
                                  value={pddDraft.excerpt}
                                  onChange={(event) => updatePddFragmentDraft(pin.id, { excerpt: event.target.value })}
                                  rows={3}
                                  className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-900"
                                />
                              </label>
                              <div>
                                <button
                                  type="button"
                                  className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                                  onClick={() => handleSavePddFragment(pin)}
                                >
                                  Save fragment
                                </button>
                              </div>
                              {item.pdd_fragments?.length ? (
                                <div className="grid gap-2">
                                  {item.pdd_fragments.map((fragment) => {
                                    const linkedRuleIds = (pin.pdd_fragment_links ?? [])
                                      .filter((link) => link.fragment_id === fragment.fragment_id)
                                      .map((link) => link.rule_id);
                                    const linkedToSelectedFragment = Boolean(
                                      selectedRuleId && linkedRuleIds.includes(selectedRuleId),
                                    );
                                    return (
                                      <div key={fragment.fragment_id} className="rounded border border-slate-200 bg-slate-50 p-2">
                                        <div className="font-medium text-slate-800">
                                          {fragment.section_heading ?? fragment.section_label ?? "PDD fragment"}
                                        </div>
                                        <div className="mt-1">
                                          {[formatPddPageLabel(fragment.page_start, fragment.page_end), fragment.excerpt]
                                            .filter(Boolean)
                                            .join(" • ") || "Fragment metadata pending"}
                                        </div>
                                        {fragment.excerpt ? (
                                          <div className="mt-1 rounded border border-slate-200 bg-white px-2 py-1 text-slate-700">
                                            {fragment.excerpt}
                                          </div>
                                        ) : null}
                                        {linkedRuleIds.length ? (
                                          <div className="mt-1">Linked to: {linkedRuleIds.join(", ")}</div>
                                        ) : null}
                                        {selectedRuleId ? (
                                          <div className="mt-2">
                                            {linkedToSelectedFragment ? (
                                              <button
                                                type="button"
                                                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                                onClick={() => {
                                                  onSetEvidencePins((current) =>
                                                    unlinkPddFragmentFromRequirement(current, pin.id, fragment.fragment_id, selectedRuleId),
                                                  );
                                                  showToast(`Unlinked ${fragment.fragment_id} from ${selectedRuleId}`);
                                                }}
                                              >
                                                Unlink fragment
                                              </button>
                                            ) : (
                                              <button
                                                type="button"
                                                className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                                                onClick={() => {
                                                  onSetEvidencePins((current) =>
                                                    linkPddFragmentToRequirement(current, pin.id, fragment.fragment_id, selectedRuleId),
                                                  );
                                                  showToast(`Linked ${fragment.fragment_id} to ${selectedRuleId}`);
                                                }}
                                              >
                                                Link fragment
                                              </button>
                                            )}
                                          </div>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          {item.linked_requirement_ids.length ? (
                            <div className="flex flex-wrap gap-2">
                              {item.linked_requirement_ids.map((id) => (
                              <button
                                key={`${pin.id}:${id}`}
                                type="button"
                                className="rounded-full border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] text-slate-700 hover:bg-slate-50"
                                onClick={async () => {
                                  const ok = await handleNavigateEvidence("rule", id);
                                  if (!ok) showToast("Rule not found");
                                }}
                              >
                                {id}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          <label className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                            Attach file
                            <input
                              type="file"
                              accept="application/pdf,image/jpeg,image/png,text/csv,application/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.pdf,.jpg,.jpeg,.png,.csv,.xlsx"
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
                                  onSetEvidencePins((current) =>
                                    coalesceEvidencePins(
                                      current.map((existing) =>
                                        existing.id === pin.id
                                          ? {
                                              ...existing,
                                              attachments: [...(existing.attachments ?? []), result.attachment],
                                            }
                                          : existing,
                                      ),
                                    ),
                                  );
                                  showToast("Attachment saved");
                                } catch (e) {
                                  setError(e instanceof Error ? e.message : String(e));
                                }
                              }}
                            />
                          </label>
                          {currentStacEvidence?.runId && selectedStacItemId ? (
                            <button
                              type="button"
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                              onClick={() => {
                                onSetEvidencePins((current) =>
                                  coalesceEvidencePins(
                                    current.map((entry) => {
                                      if (entry.id !== pin.id) return entry;
                                      const existing = new Set(entry.stac_item_ids ?? []);
                                      existing.add(selectedStacItemId);
                                      return {
                                        ...entry,
                                        stac_item_ids: Array.from(existing),
                                        stac_run_id: entry.stac_run_id ?? currentStacEvidence.runId,
                                      };
                                    }),
                                  ),
                                );
                                showToast("STAC item attached");
                              }}
                            >
                              Attach STAC item
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </details>
                  </div>
                );
              })
            ) : (
              <div className="text-xs text-slate-500">No evidence inventory yet. Add a STAC item to inventory to create the first evidence object.</div>
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
                  <div className="flex flex-wrap gap-2">
                    <Tooltip content={addInventoryDisabledReason}>
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={handleAddSelectedItemToInventory}
                        disabled={!canAddSelectedItemToInventory}
                      >
                        Add to inventory
                      </button>
                    </Tooltip>
                    <Tooltip content={createPinDisabledReason}>
                      <button
                        type="button"
                        className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 shadow-sm hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={handleCreatePin}
                        disabled={!canCreatePin}
                      >
                        Link to selected rule
                      </button>
                    </Tooltip>
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
          className={`fixed right-4 z-50 max-w-xs rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow ${
            undoVisible ? "bottom-14" : "bottom-4"
          }`}
        >
          <div className="font-semibold text-slate-900">{toast.title}</div>
          {toast.subtitle ? <div className="mt-0.5 text-[11px] text-slate-500">{toast.subtitle}</div> : null}
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
                This clears the current AOI, evidence links, export state, reviewer draft, and comparison notes for this method/version.
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
          <div
            data-testid="left-pane-step-focus"
            className={`sticky top-0 z-10 rounded-xl border px-4 py-3 text-sm shadow-sm transition ${
              currentWorkspaceIsFinal
                ? "border-slate-200/70 bg-slate-50/90 text-slate-500 shadow-none"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className={`font-semibold ${currentWorkspaceIsFinal ? "text-slate-700" : "text-slate-900"}`}>{leftPaneHeader.title}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{leftPaneHeader.stepLabel}</div>
            </div>
            <div className="mt-1 text-xs text-slate-600">{leftPaneHeader.instruction}</div>
          </div>
          <div className={`grid gap-2 transition ${currentWorkspaceIsFinal ? "opacity-55" : ""}`}>
            <div
              ref={ruleSectionRef}
              data-testid="left-section-rule"
              className={`rounded-xl border bg-white px-3 py-2 transition ${activeLeftSection === "rule" ? "border-sky-300 shadow-sm" : "border-slate-200 opacity-70"}`}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Rule context</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{selectedRuleId ?? "No rule selected"}</div>
            </div>
            <div
              ref={aoiSectionRef}
              data-testid="left-section-aoi"
              className={`rounded-xl border bg-white px-3 py-2 transition ${activeLeftSection === "aoi" ? "border-sky-300 shadow-sm" : "border-slate-200 opacity-70"}`}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">AOI summary</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{aoi?.name ?? "No AOI loaded"}</div>
              <div className="mt-1 text-[11px] text-slate-500">{bboxLabel ?? "Upload an AOI to continue."}</div>
            </div>
            <div
              ref={stacSectionRef}
              data-testid="left-section-stac"
              className={`rounded-xl border bg-white px-3 py-2 transition ${activeLeftSection === "stac" ? "border-sky-300 shadow-sm" : "border-slate-200 opacity-70"}`}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">STAC evidence</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{stacFeatureIds.length} item{stacFeatureIds.length === 1 ? "" : "s"}</div>
              <div className="mt-1 text-[11px] text-slate-500">{stacQuery.source ?? "Run a STAC search to load evidence context."}</div>
            </div>
            <div
              ref={selectedItemSectionRef}
              data-testid="left-section-selected"
              className={`rounded-xl border bg-white px-3 py-2 transition ${activeLeftSection === "selected" ? "border-sky-300 shadow-sm" : "border-slate-200 opacity-70"}`}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Selected item</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{selectedStacItemId ?? "No item selected"}</div>
            </div>
            <div
              ref={pinsSectionRef}
              data-testid="left-section-pins"
              className={`rounded-xl border bg-white px-3 py-2 transition ${activeLeftSection === "pins" ? "border-sky-300 shadow-sm" : "border-slate-200 opacity-70"}`}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Evidence inventory</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {evidenceInventory.length} item{evidenceInventory.length === 1 ? "" : "s"}
              </div>
            </div>
            <div
              ref={reviewerSectionRef}
              data-testid="left-section-reviewer"
              className={`rounded-xl border bg-white px-3 py-2 transition ${activeLeftSection === "reviewer" ? "border-sky-300 shadow-sm" : "border-slate-200 opacity-70"}`}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Reviewer artifact</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {verifierBundle.savedReviewerArtifactAt ? "Saved reviewer artifact" : "Draft reviewer artifact"}
              </div>
              <div className="mt-1 line-clamp-2 text-[11px] text-slate-500">
                {(verifierBundle.savedReviewerArtifactAt ? verifierBundle.minutes || verifierBundle.outcomeNote : verifierBundle.draftMinutes || verifierBundle.draftOutcomeNote) || "No reviewer notes yet."}
              </div>
            </div>
            <div
              ref={finalSummarySectionRef}
              data-testid="left-section-summary"
              className={`rounded-xl border bg-white px-3 py-2 transition ${activeLeftSection === "summary" ? "border-sky-300 shadow-sm" : "border-slate-200 opacity-70"}`}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Final summary</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{currentWorkspaceIsFinal ? "Final artifact written" : "Not finalized yet"}</div>
              <div className="mt-1 text-[11px] text-slate-500">
                {currentWorkspaceIsFinal ? `Finalized ${formatLocalDateTime(verifierBundle.finalizedAt ?? "")}` : "Finalize run to export the single immutable artifact."}
              </div>
            </div>
          </div>
          <div
            className={
              isListMode
                ? `grid gap-3 rounded-xl border bg-white p-4 transition ${
                    currentWorkspaceIsFinal
                      ? "border-slate-200/70 bg-slate-50/80 opacity-45 shadow-none"
                      : wizardDetails.activeStep === 4 || wizardDetails.activeStep === 5
                      ? "border-sky-300 shadow-sm"
                      : wizardDetails.activeStep === 3
                        ? "border-amber-300 shadow-sm"
                        : "border-slate-200"
                  }`
                : "hidden"
            }
          >
            {listContent}
          </div>
          <div
            className={
              isListMode
                ? "hidden"
                : currentWorkspaceIsFinal
                  ? "rounded-xl border border-slate-200/70 opacity-45 shadow-none"
                : wizardDetails.activeStep === 4 || wizardDetails.activeStep === 5
                  ? "rounded-xl border border-sky-300 shadow-sm"
                  : wizardDetails.activeStep === 3
                    ? "rounded-xl border border-amber-300 shadow-sm"
                    : undefined
            }
          >
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

        <div
          className={`grid min-w-0 w-full max-w-full gap-3 overflow-hidden rounded-xl border p-4 transition ${
            currentWorkspaceIsFinal
              ? "border-emerald-200 bg-white/95 shadow-sm shadow-emerald-100"
              : "border-slate-200 bg-white"
          } ${panelCollapsed ? "lg:hidden" : ""}`}
        >
          <input
            ref={uploadAoiInputRef}
            type="file"
            accept=".json,.geojson,application/json"
            className="hidden"
            onChange={handleUploadAoiChange}
          />

          <div className={`flex items-start justify-between gap-2 ${currentWorkspaceIsFinal ? "opacity-70" : ""}`}>
            <div>
              <div className="text-sm font-semibold text-slate-900">
                {currentWorkspaceIsFinal ? "Final Review Summary" : "Evidence workflow"}
              </div>
              {!currentWorkspaceIsFinal ? (
                <div className="mt-1 text-xs text-slate-500">
                  Single path: rule -&gt; AOI -&gt; STAC -&gt; item -&gt; pin -&gt; reviewer save -&gt; finalize.
                </div>
              ) : (
                <div className="mt-1 text-xs text-slate-500">
                  Finalized result, exports, and summary are now the primary right-panel surface.
                </div>
              )}
            </div>
            {!currentWorkspaceIsFinal ? (
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
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  onClick={handleNewRun}
                >
                  New run
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
            ) : null}
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="transition">
            {currentWorkspaceIsFinal ? (
              <FinalReviewSummaryPanel
                summary={reviewArtifact?.summary ?? reviewSummary}
                artifact={reviewArtifact}
                currentRunLabel={currentRunLabel}
                loadedFromRunLabel={loadedFromRunLabel}
                finalizedAt={verifierBundle.finalizedAt}
                reviewedRuleCount={linkedRuleIds.length}
                linkedEvidenceCount={evidenceInventory.filter((item) => item.link_state === "linked").length}
                wizard={wizardDetails}
                onDownloadJson={() => {
                  void handleDownloadReviewSummaryJson();
                }}
                onDownloadPdf={() => {
                  void handleDownloadReviewSummaryPdf();
                }}
                onCopyLink={() => {
                  void handleCopyReviewSummaryLink();
                }}
                onStartAnotherRun={handleNewRun}
                onViewRunHistory={handleViewRunHistory}
                pdfBusy={reviewPdfBusy}
                pdfError={reviewPdfError}
              />
            ) : (
              <EvidenceWorkflowStepper
                ruleOptions={ruleOptions}
                selectedRuleId={selectedRuleId}
                onSelectRuleId={onSelectRuleId}
                onViewRule={onViewRule}
                hasAoi={hasAoi}
                aoiLabel={aoi?.name ?? null}
                aoiSummary={
                  aoi
                    ? {
                        isPreview,
                        willClearWork,
                        isSameAoi,
                        showSameAoiPrompt,
                        areaKm2: aoi.area_km2 ?? null,
                        bboxLabel,
                      }
                    : null
                }
                searchDisabled={searchDisabled}
                isRunning={isRunning}
                hasSearchResults={hasSearchResults}
                stacResultCount={stacFeatureIds.length}
                selectedStacItemId={selectedStacItemId}
                onClearSelectedItem={() => onSelectStacItemId(null)}
                canCreatePin={canCreatePin}
                createPinDisabledReason={createPinDisabledReason}
                pinsCount={linkedPinsCount}
                onUploadAoi={triggerAoiUpload}
                onApplyDraftAoiClick={handleApplyDraftAoiClick}
                onCancelDraftAoi={() => {
                  setShowSameAoiPrompt(false);
                  onCancelDraftAoi();
                }}
                onKeepSameAoi={handleKeepSameAoi}
                onResetSameAoi={handleResetSameAoi}
                onSearchStac={() => {
                  void handleSearchStac();
                }}
                onCreatePin={handleCreatePin}
                draftMinutes={verifierBundle.draftMinutes}
                draftOutcomeNote={verifierBundle.draftOutcomeNote}
                savedMinutes={verifierBundle.minutes}
                savedOutcomeNote={verifierBundle.outcomeNote}
                savedReviewerArtifactAt={verifierBundle.savedReviewerArtifactAt}
                onReviewerMinutesChange={handleMinutesChange}
                onReviewerOutcomeNoteChange={handleOutcomeNoteChange}
                onSaveReviewerArtifact={handleSaveReviewerArtifact}
                onFinalizeRun={handleFinalizeRun}
                finalizedAt={verifierBundle.finalizedAt}
                currentRunLabel={currentRunLabel}
                loadedFromRunLabel={loadedFromRunLabel}
                isEditedDraft={verifierBundle.isEditedDraft}
                hasUnsavedWorkspaceEdits={hasUnsavedWorkspaceEdits}
                currentWorkspaceIsFinal={currentWorkspaceIsFinal}
                wizard={wizardDetails}
                onStartAnotherRun={handleNewRun}
                onViewRunHistory={handleViewRunHistory}
                onViewOutcome={() => setOutcomeOpen(true)}
                methodCode={methodCode}
                version={version}
                reviewedRuleCount={linkedRuleIds.length}
                linkedEvidenceCount={evidenceInventory.filter((item) => item.link_state === "linked").length}
                finalizedResult={
                  <ReviewSummaryCard
                    summary={reviewArtifact?.summary ?? reviewSummary}
                    artifact={reviewArtifact}
                    onDownloadJson={() => {
                      void handleDownloadReviewSummaryJson();
                    }}
                    onDownloadPdf={() => {
                      void handleDownloadReviewSummaryPdf();
                    }}
                    onCopyLink={() => {
                      void handleCopyReviewSummaryLink();
                    }}
                    pdfBusy={reviewPdfBusy}
                    pdfError={reviewPdfError}
                  />
                }
              />
            )}
          </div>

          <div className="rounded-xl border-t border-dashed border-slate-200 pt-3">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-left"
              onClick={() => setSecondarySectionOpen((value) => !value)}
              data-testid="secondary-context-toggle"
            >
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Secondary context</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">Baseline, comparison notes, run history, and outcome</div>
              </div>
              <span className="text-xs font-semibold text-slate-500">{secondarySectionOpen ? "Hide" : "Show"}</span>
            </button>
          </div>

          {secondarySectionOpen ? (
            <div className="grid gap-3" data-testid="secondary-context">
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
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                        <div className="font-semibold text-amber-800">{comparisonUnavailableMessage?.title ?? "Comparison unavailable"}</div>
                        <div className="mt-1 text-[11px] text-amber-700">
                          {comparisonUnavailableMessage?.detail ?? "Current workspace cannot be compared to the saved baseline."}
                        </div>
                      </div>
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

              <DeltaImpactTasksPanel
                showComparisonFields={hasComparisonContext}
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

              <details
                className="rounded-xl border border-slate-200 bg-white"
                open={runHistoryOpen}
                onToggle={(event) => setRunHistoryOpen(event.currentTarget.open)}
              >
                <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-slate-900" data-testid="run-history-toggle">
                  Run history
                  <span className="ml-2 text-[11px] font-medium text-slate-500">{runHistory.length} runs</span>
                </summary>
                <div className="px-3 pb-3">
                  <div className="mb-3 text-xs text-slate-500">
                    <div>New run starts a fresh review.</div>
                    <div>Load restores this run into the editable workspace.</div>
                  </div>
                  <RunHistoryPanel
                    items={runHistory}
                    onLoad={handleLoadRunHistory}
                    onDelete={handleDeleteRunHistory}
                    showTitle={false}
                    activeRunId={activeHistoryRunId}
                    badgeForRun={badgeForRun}
                  />
                </div>
              </details>

              <details
                className="rounded-xl border border-slate-200 bg-white"
                open={outcomeOpen}
                onToggle={(event) => setOutcomeOpen(event.currentTarget.open)}
              >
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
                    exportedAt={verifierBundle.exportedAt}
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
          ) : null}

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
  );
}
