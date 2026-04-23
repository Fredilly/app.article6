"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import VersionSelector from "@/app/m/_components/VersionSelector";
import { IntegrityDiffPanel } from "@/app/m/_components/IntegrityDiffPanel";
import RequirementCoverageWorkspace from "@/app/m/_components/RequirementCoverageWorkspace";
import RuleDetailModal from "@/app/m/_components/RuleDetailModal";
import {
  buildRequirementCoverageRows,
  requirementProvenanceHint,
  summarizeExpectedEvidence,
  summarizeLinkedEvidence,
  type RequirementCoverageStatus,
} from "@/app/m/_lib/requirementCoverage";
import TrustStrip from "@/components/TrustStrip";
import ProofMapTab from "@/components/map/ProofMapTab";
import ReviewProgressIndicator from "@/components/verify/ReviewProgressIndicator";
import VerifyHeader from "@/app/m/_components/VerifyHeader";
import { useMethodsLayout } from "@/app/m/_components/MethodsLayoutContext";
import CoveragePanel from "@/components/coverage/CoveragePanel";
import CoverageDrawer from "@/components/coverage/CoverageDrawer";
import { buildCoverageQueue } from "@/lib/coverage/queue";
import { addCoverageTask } from "@/lib/coverage/tasks";
import {
  buildEvidenceInventory,
  coalesceEvidencePins,
  linkEvidencePinToRequirement,
  linkPddFragmentToRequirement,
  unlinkEvidencePinFromRequirement,
  unlinkPddFragmentFromRequirement,
} from "@/lib/evidence/inventory";
import { linkedRuleIdsFromPins } from "@/lib/kpis/computeKpis";
import { useAuditTrail, type AuditTrailEventInput } from "@/lib/auditTrail/store";
import { getVerifyView, isVerifierMode } from "@/lib/mode";
import { jumpToRule } from "@/lib/ruleJump";
import { decodeShareState, encodeShareState } from "@/lib/shareLink";
import { shouldResetDerivedState } from "@/lib/proofMap/aoiApply";
import {
  clearProofMapStorage,
  clearStoredMapView,
  loadAoi,
  loadDraftAoi,
  loadEvidenceSnapshots,
  loadPins,
  loadVerificationRuns,
  saveAoi,
  saveDraftAoi,
  saveEvidenceSnapshots,
  savePins,
  saveVerificationRuns,
} from "@/lib/proofMap/storage";
import type { AOI, EvidencePin } from "@/lib/proofMap/types";
import type { VerificationRun } from "@/lib/proofMap/types";
import { aoiFingerprint } from "@/lib/proofMap/verificationRuns";
import { isRuleLikeId } from "@/lib/proofMap/pins";
import type { ProofEvidenceItem } from "@/lib/proof/bundle";
import { importProofBundleText } from "@/lib/proof/import";
import { applyUrlUpdates, parseDetailTab, type DetailTab } from "@/lib/nav/urlState";
import type { MethodVersionLineage } from "@/app/m/_lib/methodVersionMetadata";
import { getReviewProgress, REVIEW_STORE_EVENT, type ReviewProgress } from "@/lib/verify/reviewStore";
import { deriveDocumentSupport } from "@/lib/verify/documentSupport";

type MethodDetail = {
  code: string;
  program: string;
  sector: string;
  versions: string[];
  latestVersion?: string;
  versionCount: number;
  hasRich: boolean;
  hasPrevious: boolean;
  ruleCountByVersion: Record<string, number | undefined>;
  lineage?: MethodVersionLineage | null;
};

type MethodDetailPaneProps = {
  method: MethodDetail;
  activeVersion?: string;
  initialRuleId?: string;
  mode?: "full" | "evidence";
  packTag?: string | null;
  provenanceJson?: unknown | null;
  manifestRulesPath?: string | null;
};

function updateRuleParamNoNav(ruleId: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const nextRule = (ruleId ?? "").trim();
  if (nextRule) url.searchParams.set("rule", nextRule);
  else url.searchParams.delete("rule");
  const next = url.toString();
  const prev = window.location.href;
  if (next !== prev) window.history.replaceState({}, "", next);
}

export default function MethodDetailPane({
  method,
  activeVersion,
  initialRuleId,
  mode = "full",
  packTag,
  provenanceJson,
  manifestRulesPath,
}: MethodDetailPaneProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchString = searchParams.toString();
  const isEvidenceRoute = pathname?.includes("/evidence");
  const isEvidenceMode = mode === "evidence" || isEvidenceRoute;
  const methodsLayout = useMethodsLayout();
  const verifierMode = useMemo(() => isVerifierMode(searchParams), [searchParams]);
  const urlVerifyMode = useMemo(() => getVerifyView(new URLSearchParams(searchString)), [searchString]);
  const [verifyViewMode, setVerifyViewMode] = useState<"list" | "map">(urlVerifyMode);
  const defaultTab: DetailTab = useMemo(() => (isEvidenceMode ? "verify" : "rules"), [isEvidenceMode]);
  const tab = useMemo(() => {
    if (isEvidenceMode) return "verify";
    const parsed = parseDetailTab(new URLSearchParams(searchString).get("tab"));
    return parsed ?? defaultTab;
  }, [defaultTab, isEvidenceMode, searchString]);
  const surfaceTab: DetailTab = tab === "verify" ? "verify" : "rules";
  const effectiveTab: DetailTab = isEvidenceMode ? "verify" : surfaceTab;
  const methodBasePath = useMemo(() => {
    const encodedCode = encodeURIComponent(method.code);
    if (activeVersion) {
      return `/m/${encodedCode}/v/${encodeURIComponent(activeVersion)}`;
    }
    return `/m/${encodedCode}`;
  }, [activeVersion, method.code]);
  const buildVerifyHref = useCallback(
    (versionOverride?: string) => {
      const basePath = versionOverride
        ? `/m/${encodeURIComponent(method.code)}/v/${encodeURIComponent(versionOverride)}`
        : methodBasePath;
      const params = new URLSearchParams(searchString);
      params.set("tab", "verify");
      if (!params.get("mode")) params.set("mode", "list");
      const query = params.toString();
      return query ? `${basePath}?${query}` : basePath;
    },
    [method.code, methodBasePath, searchString],
  );
  const { events: auditEvents, appendEvent, clearTrail, exportJson, exportSha256 } = useAuditTrail();
  const appendAuditEvent = useCallback(
    (input: AuditTrailEventInput) => {
      if (!verifierMode) return;
      appendEvent(input);
    },
    [appendEvent, verifierMode],
  );

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (typeof window === "undefined") return;
    const history = (window as unknown as { __a6TabHistory?: Array<{ tab: string; at: number }> }).__a6TabHistory ?? [];
    history.push({ tab, at: Date.now() });
    const trimmed = history.filter((entry) => Date.now() - entry.at < 1500).slice(-8);
    (window as unknown as { __a6TabHistory?: Array<{ tab: string; at: number }> }).__a6TabHistory = trimmed;
    if (trimmed.length < 6) return;
    const last = trimmed.slice(-6).map((x) => x.tab);
    const oscillating =
      last[0] === last[2] &&
      last[2] === last[4] &&
      last[1] === last[3] &&
      last[3] === last[5] &&
      last[0] !== last[1];
    if (oscillating) {
      throw new Error(`Tab oscillation detected: ${last.join(" → ")}`);
    }
  }, [tab]);

  useEffect(() => {
    if (!activeVersion) return;
    const key = `${method.code}@${activeVersion}`;
    if (lastMethodSelection.current === key) return;
    lastMethodSelection.current = key;
    appendAuditEvent({
      kind: "method.select",
      payload: { method_code: method.code, version: activeVersion },
    });
  }, [activeVersion, appendAuditEvent, method.code]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [rulesDeeplinkWarning, setRulesDeeplinkWarning] = useState<string | null>(null);
  type RuleListItem = {
    id: string;
    title: string;
    snippet: string;
    text?: string;
    summary?: string;
    logic?: string;
    notes?: string;
    when?: string[];
    expectedEvidence?: string[];
    tags: string[];
    type?: string;
    sectionId?: string;
    anchor?: string;
    citations?: Array<{ sectionId: string | undefined; anchor: string | undefined; label: string | undefined }>;
    refs?: {
      primarySection?: string;
      sectionAnchor?: string;
      sectionStableId?: string;
      sections: string[];
      tools: string[];
    };
  };
  type TraceLink = {
    section_id: string;
    title?: string | null;
    anchor?: string | null;
    match: "explicit" | "text";
  };
  type TraceIndex = {
    version: number;
    method?: { code?: string; version?: string };
    rule_to_sections: Record<string, TraceLink[]>;
  };
  const [rules, setRules] = useState<RuleListItem[]>([]);
  const [activeRuleId, setActiveRuleId] = useState<string | null>(initialRuleId ?? null);
  const [traceIndex, setTraceIndex] = useState<TraceIndex | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [, setTraceError] = useState<string | null>(null);
  const [ruleDetailModalOpen, setRuleDetailModalOpen] = useState(false);
  const [ruleDetail, setRuleDetail] = useState<{
    id: string;
    title: string;
    text: string;
    summary?: string;
    logic?: string;
    notes?: string;
    when?: string[];
    expectedEvidence?: string[];
    tags: string[];
    type?: string;
    sha256?: string;
    sectionId?: string;
    anchor?: string;
    citations?: Array<{ sectionId: string | undefined; anchor: string | undefined; label: string | undefined }>;
    refs?: {
      primarySection?: string;
      sectionAnchor?: string;
      sectionStableId?: string;
      sections: string[];
      tools: string[];
    };
    sourcePath?: string;
  } | null>(null);
  const [ruleDetailLoading, setRuleDetailLoading] = useState(false);
  const [ruleDetailError, setRuleDetailError] = useState<string | null>(null);
  const didInitFromUrl = useRef(false);
  const lastSectionFromQuery = useRef<string | null>(null);
  const lastMethodSelection = useRef<string | null>(null);

  type SectionListItem = {
    id: string;
    title: string;
    level: number;
    anchor?: string;
    page?: number;
    textSnippet?: string;
  };

  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [sections, setSections] = useState<SectionListItem[]>([]);
  const [sectionPreview, setSectionPreview] = useState<SectionListItem | null>(null);
  const [, setEvidenceLinkSelection] = useState<{
    kind: "evidence";
    id: string;
    ruleIds: string[];
    sectionIds: string[];
  } | null>(null);

  const [currentAoi, setCurrentAoi] = useState<AOI | null>(null);
  const [draftAoi, setDraftAoi] = useState<AOI | null>(null);
  const [evidencePins, setEvidencePins] = useState<EvidencePin[]>([]);
  const [evidenceSnapshots, setEvidenceSnapshots] = useState<ProofEvidenceItem[]>([]);
  const [verificationRuns, setVerificationRuns] = useState<VerificationRun[]>([]);
  const [integrityDiffOpen, setIntegrityDiffOpen] = useState(false);
  const [reviewProgress, setReviewProgress] = useState<ReviewProgress | null>(null);
  type WorkspaceSnapshot = {
    currentAoi: AOI | null;
    evidencePins: EvidencePin[];
    evidenceSnapshots: ProofEvidenceItem[];
    verificationRuns: VerificationRun[];
    selectedStacItemId: string | null;
  };
  const [undoSnapshot, setUndoSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [applyToken, setApplyToken] = useState(0);
  type StacEvidenceState = {
    aoiFingerprint: string;
    fc: GeoJSON.FeatureCollection;
    itemsById: Record<string, unknown>;
    runId: string;
    source?: { type: "stac_url" | "unknown"; ref: string };
  };
  const [stacEvidenceByKey, setStacEvidenceByKey] = useState<Record<string, StacEvidenceState>>({});
  const [selectedStacItemId, setSelectedStacItemId] = useState<string | null>(null);
  const [coverageDrawerOpen, setCoverageDrawerOpen] = useState(false);

  const lineageVersions = method.lineage?.lineage?.length ? method.lineage.lineage : method.versions;
  const versionBadges = [
    method.lineage?.previousVersion ? `Previous ${method.lineage.previousVersion}` : null,
    method.lineage?.currentVersion ? `Current ${method.lineage.currentVersion}` : null,
    method.lineage?.nextVersion ? `Next ${method.lineage.nextVersion}` : null,
  ].filter(Boolean);

  const effectiveAoi = draftAoi ?? currentAoi;
  const evidenceKey = useMemo(() => {
    const ver = (activeVersion ?? "").trim();
    const aoiKey = (effectiveAoi?.aoi_fingerprint ?? effectiveAoi?.id ?? "").trim();
    if (!ver || !aoiKey) return null;
    return `${method.code}@${ver}::${aoiKey}`;
  }, [activeVersion, effectiveAoi?.aoi_fingerprint, effectiveAoi?.id, method.code]);

  const stacEvidenceState = evidenceKey ? stacEvidenceByKey[evidenceKey] ?? null : null;

  const tabBase =
    "inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold transition";
  const tabActive = "bg-slate-900 text-white";
  const tabIdle = "bg-slate-100 text-slate-700 hover:bg-slate-200";

  const coverageRules = useMemo(
    () => rules.map((rule) => ({ id: rule.id, title: rule.title, tags: rule.tags ?? [] })),
    [rules],
  );
  const coverageLinkedRuleIds = useMemo(() => linkedRuleIdsFromPins(evidencePins), [evidencePins]);
  const coverageRulesWithStatus = useMemo(() => {
    const linked = new Set(coverageLinkedRuleIds);
    return coverageRules.map((rule) => ({
      ...rule,
      status: linked.has(rule.id) ? ("covered" as const) : ("uncovered" as const),
    }));
  }, [coverageLinkedRuleIds, coverageRules]);
  const coverageSummary = useMemo(() => {
    return buildCoverageQueue({
      rules: coverageRules,
      coveredRuleIds: new Set(coverageLinkedRuleIds),
      limit: 10,
    });
  }, [coverageLinkedRuleIds, coverageRules]);
  const sectionTitleById = useMemo(
    () => new Map(sections.map((section) => [section.id, section.title])),
    [sections],
  );
  const evidenceInventory = useMemo(() => buildEvidenceInventory(evidencePins), [evidencePins]);
  const requirementStatusesByRuleId = useMemo(() => {
    const next = new Map<string, RequirementCoverageStatus>();

    for (const ruleId of coverageLinkedRuleIds) {
      next.set(ruleId, "partial");
    }

    for (const run of verificationRuns) {
      for (const citedId of run.cited_ids ?? []) {
        if (typeof citedId !== "string" || !isRuleLikeId(citedId.trim())) continue;
        next.set(citedId.trim(), run.status === "ok" ? "linked" : "needs-review");
      }
    }

    return next;
  }, [coverageLinkedRuleIds, verificationRuns]);
  const requirementRows = useMemo(() => {
    return buildRequirementCoverageRows({
      rules,
      sectionTitleById,
      inventoryItems: evidenceInventory,
      statusesByRuleId: requirementStatusesByRuleId,
    });
  }, [evidenceInventory, requirementStatusesByRuleId, rules, sectionTitleById]);

  const linkedTraceSections = useMemo(() => {
    if (!traceIndex || !activeRuleId) return [];
    const raw = traceIndex.rule_to_sections?.[activeRuleId] ?? [];
    const seen = new Set<string>();
    const deduped: TraceLink[] = [];
    for (const link of raw) {
      if (seen.has(link.section_id)) continue;
      seen.add(link.section_id);
      deduped.push(link);
    }
    return deduped;
  }, [activeRuleId, traceIndex]);

  const activeRequirementRow = useMemo(
    () => requirementRows.find((row) => row.ruleId === activeRuleId) ?? null,
    [activeRuleId, requirementRows],
  );

  const stacItemsForPanel = useMemo(() => {
    if (!stacEvidenceState?.itemsById) return [];
    return Object.values(stacEvidenceState.itemsById).map((item) => {
      const raw = item as Record<string, unknown>;
      const props = raw.properties && typeof raw.properties === "object" && !Array.isArray(raw.properties)
        ? (raw.properties as Record<string, unknown>)
        : {};
      return {
        id: typeof raw.id === "string" ? raw.id : "",
        datetime: typeof raw.datetime === "string" ? raw.datetime : undefined,
        cloud_cover: typeof raw.cloud_cover === "number" ? raw.cloud_cover : null,
        collection:
          (typeof raw.collection === "string" ? raw.collection : null) ??
          (typeof props.collection === "string" ? props.collection : null) ??
          undefined,
        bbox: Array.isArray(raw.bbox) && raw.bbox.length >= 4
          ? (raw.bbox as [number, number, number, number])
          : undefined,
      };
    }).filter((item) => item.id);
  }, [stacEvidenceState]);

  const documentSupportForPanel = useMemo(() => {
    if (!activeRuleId) return [];
    return deriveDocumentSupport(evidenceInventory, activeRuleId);
  }, [activeRuleId, evidenceInventory]);

  useEffect(() => {
    if (!activeVersion) {
      setReviewProgress(null);
      return;
    }
    const updateProgress = () => {
      setReviewProgress(getReviewProgress(method.code, activeVersion, requirementRows.length));
    };
    updateProgress();
    const handleReviewStoreChange = () => updateProgress();
    window.addEventListener(REVIEW_STORE_EVENT, handleReviewStoreChange);
    return () => window.removeEventListener(REVIEW_STORE_EVENT, handleReviewStoreChange);
  }, [activeVersion, method.code, requirementRows.length]);

  useEffect(() => {
    setRules([]);
    setRulesError(null);
    setRulesLoading(false);
    setRulesDeeplinkWarning(null);
    setActiveRuleId(null);
    setRuleDetail(null);
    setRuleDetailError(null);
    setRuleDetailLoading(false);
    setRuleDetailModalOpen(false);
    setTraceIndex(null);
    setTraceError(null);
    setTraceLoading(false);
  }, [activeVersion, method.code]);

  useEffect(() => {
    if (isEvidenceMode) return;
    if (!pathname) return;
    const mapParams = new URLSearchParams(searchString);
    const rawTab = mapParams.get("tab");
    if (rawTab && rawTab.trim() === "map") {
      mapParams.set("tab", "verify");
      if (!mapParams.get("mode")) mapParams.set("mode", "map");
      const nextQuery = mapParams.toString();
      if (nextQuery !== searchString) {
        router.replace(`${pathname}?${nextQuery}`, { scroll: false });
      }
      return;
    }
    const urlTab = parseDetailTab(new URLSearchParams(searchString).get("tab"));
    if (urlTab && urlTab !== "verify") {
      const next = applyUrlUpdates(new URLSearchParams(searchString), { tab: "rules" });
      if (next !== searchString) {
        router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
      }
      return;
    }
    if (urlTab) return;
    const next = applyUrlUpdates(new URLSearchParams(searchString), { tab });
    if (next === searchString) return;
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [isEvidenceMode, pathname, router, searchString, tab]);

  useEffect(() => {
    setVerifyViewMode(urlVerifyMode);
  }, [urlVerifyMode]);

  useEffect(() => {
    if (!activeVersion) return;
    setCurrentAoi(loadAoi(method.code, activeVersion));
    setDraftAoi(loadDraftAoi(method.code, activeVersion));
    setEvidencePins(coalesceEvidencePins(loadPins(method.code, activeVersion)));
    setEvidenceSnapshots(loadEvidenceSnapshots(method.code, activeVersion));
    setVerificationRuns(loadVerificationRuns(method.code, activeVersion));
    setUndoSnapshot(null);
  }, [activeVersion, method.code]);

  const setCurrentAoiAndPersist = useCallback(
    (nextAoi: AOI | null) => {
      setCurrentAoi(nextAoi);
      if (!activeVersion) return;
      saveAoi(method.code, activeVersion, nextAoi);
    },
    [activeVersion, method.code],
  );

  const setDraftAoiAndPersist = useCallback(
    (nextAoi: AOI | null) => {
      setDraftAoi(nextAoi);
      if (!activeVersion) return;
      saveDraftAoi(method.code, activeVersion, nextAoi);
    },
    [activeVersion, method.code],
  );

  const setActiveAoiAndPersist = useCallback(
    (nextAoi: AOI | null) => {
      if (draftAoi) {
        setDraftAoiAndPersist(nextAoi);
        return;
      }
      setCurrentAoiAndPersist(nextAoi);
    },
    [draftAoi, setCurrentAoiAndPersist, setDraftAoiAndPersist],
  );

  const setEvidencePinsAndPersist = useCallback(
    (nextPins: EvidencePin[] | ((current: EvidencePin[]) => EvidencePin[])) => {
      setEvidencePins((current) => {
        const resolved = typeof nextPins === "function" ? nextPins(current) : nextPins;
        const normalizedPins = coalesceEvidencePins(resolved);
        if (activeVersion) savePins(method.code, activeVersion, normalizedPins);
        return normalizedPins;
      });
    },
    [activeVersion, method.code],
  );
  const handleLinkInventoryItem = useCallback(
    (evidenceId: string, ruleId: string, fragmentId?: string) => {
      setEvidencePinsAndPersist((current) =>
        fragmentId
          ? linkPddFragmentToRequirement(current, evidenceId, fragmentId, ruleId)
          : linkEvidencePinToRequirement(current, evidenceId, ruleId),
      );
    },
    [setEvidencePinsAndPersist],
  );
  const handleUnlinkInventoryItem = useCallback(
    (evidenceId: string, ruleId: string, fragmentId?: string) => {
      setEvidencePinsAndPersist((current) =>
        fragmentId
          ? unlinkPddFragmentFromRequirement(current, evidenceId, fragmentId, ruleId)
          : unlinkEvidencePinFromRequirement(current, evidenceId, ruleId),
      );
    },
    [setEvidencePinsAndPersist],
  );

  const setEvidenceSnapshotsAndPersist = useCallback(
    (nextSnapshots: ProofEvidenceItem[]) => {
      setEvidenceSnapshots(nextSnapshots);
      if (!activeVersion) return;
      saveEvidenceSnapshots(method.code, activeVersion, nextSnapshots);
    },
    [activeVersion, method.code],
  );

  const setVerificationRunsAndPersist = useCallback(
    (nextRuns: VerificationRun[]) => {
      setVerificationRuns(nextRuns);
      if (!activeVersion) return;
      saveVerificationRuns(method.code, activeVersion, nextRuns);
    },
    [activeVersion, method.code],
  );

  const hasWorkspaceState = Boolean(
    currentAoi ||
      draftAoi ||
      evidencePins.length ||
      evidenceSnapshots.length ||
      verificationRuns.length ||
      selectedStacItemId,
  );

  const applyAoiToWorkspace = useCallback(
    (nextAoi: AOI, options?: { resetDerived?: boolean }) => {
      const snapshot: WorkspaceSnapshot = {
        currentAoi,
        evidencePins,
        evidenceSnapshots,
        verificationRuns,
        selectedStacItemId,
      };
      setUndoSnapshot(snapshot);
      const shouldResetDerived = shouldResetDerivedState({
        currentHash: currentAoi?.aoi_fingerprint,
        nextHash: nextAoi.aoi_fingerprint,
        resetDerived: options?.resetDerived,
      });
      setCurrentAoiAndPersist(nextAoi);
      setDraftAoiAndPersist(null);
      if (shouldResetDerived) {
        setEvidencePinsAndPersist([]);
        setEvidenceSnapshotsAndPersist([]);
        setVerificationRunsAndPersist([]);
        setSelectedStacItemId(null);
        setEvidenceLinkSelection(null);
      }
      setApplyToken((value) => value + 1);
      void (async () => {
        try {
          const hash = await aoiFingerprint(nextAoi.geojson);
          appendAuditEvent({
            kind: "evidence.input",
            payload: { aoi_hash: hash, aoi_id: nextAoi.id ?? null },
          });
        } catch {
          // ignore hash failures
        }
      })();
    },
    [
      currentAoi,
      evidencePins,
      evidenceSnapshots,
      verificationRuns,
      selectedStacItemId,
      setCurrentAoiAndPersist,
      setDraftAoiAndPersist,
      setEvidencePinsAndPersist,
      setEvidenceSnapshotsAndPersist,
      setVerificationRunsAndPersist,
      appendAuditEvent,
    ],
  );

  const handleUploadAoi = useCallback(
    (nextAoi: AOI) => {
      if (!hasWorkspaceState) {
        applyAoiToWorkspace(nextAoi);
        return;
      }
      setDraftAoiAndPersist(nextAoi);
    },
    [applyAoiToWorkspace, hasWorkspaceState, setDraftAoiAndPersist],
  );

  const handleApplyDraftAoi = useCallback(
    (options?: { resetDerived?: boolean }) => {
      if (!draftAoi) return;
      applyAoiToWorkspace(draftAoi, options);
    },
    [applyAoiToWorkspace, draftAoi],
  );

  const handleCancelDraftAoi = useCallback(() => {
    if (!draftAoi) return;
    setDraftAoiAndPersist(null);
  }, [draftAoi, setDraftAoiAndPersist]);

  const handleUndoApply = useCallback(() => {
    if (!undoSnapshot) return;
    setCurrentAoiAndPersist(undoSnapshot.currentAoi ?? null);
    setDraftAoiAndPersist(null);
    setEvidencePinsAndPersist(undoSnapshot.evidencePins ?? []);
    setEvidenceSnapshotsAndPersist(undoSnapshot.evidenceSnapshots ?? []);
    setVerificationRunsAndPersist(undoSnapshot.verificationRuns ?? []);
    setSelectedStacItemId(undoSnapshot.selectedStacItemId ?? null);
    setEvidenceLinkSelection(null);
    setUndoSnapshot(null);
  }, [
    setCurrentAoiAndPersist,
    setDraftAoiAndPersist,
    setEvidencePinsAndPersist,
    setEvidenceSnapshotsAndPersist,
    setVerificationRunsAndPersist,
    undoSnapshot,
  ]);

  const startOverProofMap = useCallback(() => {
    if (!activeVersion) return;
    clearProofMapStorage(method.code, activeVersion);
    clearStoredMapView(`${method.code}@${activeVersion}`);

    setCurrentAoi(null);
    setDraftAoi(null);
    setEvidencePins([]);
    setEvidenceSnapshots([]);
    setVerificationRuns([]);
    setSelectedStacItemId(null);
    setEvidenceLinkSelection(null);
    setUndoSnapshot(null);

    const prefix = `${method.code}@${activeVersion}::`;
    setStacEvidenceByKey((prev) => {
      const next: Record<string, StacEvidenceState> = {};
      for (const [key, value] of Object.entries(prev)) {
        if (key.startsWith(prefix)) continue;
        next[key] = value;
      }
      return next;
    });
  }, [activeVersion, method.code]);

  const refreshProofMapFromStorage = useCallback(() => {
    if (!activeVersion) return;
    setCurrentAoi(loadAoi(method.code, activeVersion));
    setDraftAoi(loadDraftAoi(method.code, activeVersion));
    setEvidencePins(coalesceEvidencePins(loadPins(method.code, activeVersion)));
    setEvidenceSnapshots(loadEvidenceSnapshots(method.code, activeVersion));
    setVerificationRuns(loadVerificationRuns(method.code, activeVersion));
  }, [activeVersion, method.code]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => refreshProofMapFromStorage();
    window.addEventListener("proofbundle:imported", handler);
    return () => window.removeEventListener("proofbundle:imported", handler);
  }, [refreshProofMapFromStorage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!activeVersion) return;
    const key = "pending:proof-bundle@1";
    const pending = window.sessionStorage.getItem(key);
    if (!pending) return;
    (async () => {
      const result = await importProofBundleText(pending, { code: method.code, version: activeVersion });
      window.sessionStorage.removeItem(key);
      if (result.ok) {
        window.dispatchEvent(new Event("proofbundle:imported"));
      }
    })();
  }, [activeVersion, method.code]);

  useEffect(() => {
    setSections([]);
    setSectionsLoading(false);
    setSectionPreview(null);
  }, [activeVersion, method.code]);

  const ensureRulesLoaded = useCallback(async (): Promise<RuleListItem[]> => {
    if (!activeVersion) return [];
    if (rules.length) return rules;
    if (rulesLoading) return rules;
    setRulesLoading(true);
    setRulesError(null);
    try {
      const response = await fetch(
        `/api/methods/${encodeURIComponent(method.code)}/v/${encodeURIComponent(activeVersion)}/rules`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(`Rules request failed with ${response.status}`);
      const payload = (await response.json()) as { rules?: unknown };
      const list = Array.isArray(payload.rules) ? payload.rules : [];
      const nextRules: RuleListItem[] = [];

      for (const item of list) {
        if (!item || typeof item !== "object") continue;
        const record = item as Record<string, unknown>;
        const id = typeof record.id === "string" ? record.id : "";
        if (!id) continue;
        const title = typeof record.title === "string" ? record.title : id;
        const snippet = typeof record.snippet === "string" ? record.snippet : "";
        const text = typeof record.text === "string" ? record.text : undefined;
        const tags = Array.isArray(record.tags)
          ? record.tags.map((t: unknown) => String(t)).filter(Boolean)
          : [];
        const when = Array.isArray(record.when)
          ? record.when.map((item: unknown) => String(item).trim()).filter(Boolean)
          : [];
        const expectedEvidence = Array.isArray(record.expectedEvidence)
          ? record.expectedEvidence.map((item: unknown) => String(item).trim()).filter(Boolean)
          : [];
        const type = typeof record.type === "string" ? record.type : undefined;
        const sectionId = typeof record.sectionId === "string" ? record.sectionId : undefined;
        const anchor = typeof record.anchor === "string" ? record.anchor : undefined;
        const citations = Array.isArray(record.citations)
          ? record.citations
              .map((item: unknown) => {
                if (!item || typeof item !== "object") return null;
                const citation = item as Record<string, unknown>;
                const citedSectionId = typeof citation.sectionId === "string" ? citation.sectionId : undefined;
                const citedAnchor = typeof citation.anchor === "string" ? citation.anchor : undefined;
                const label = typeof citation.label === "string" ? citation.label : undefined;
                if (!citedSectionId && !citedAnchor && !label) return null;
                return { sectionId: citedSectionId, anchor: citedAnchor, label };
              })
              .filter(
                (
                  value,
                ): value is { sectionId: string | undefined; anchor: string | undefined; label: string | undefined } =>
                  value !== null,
              )
          : undefined;
        const refs =
          record.refs && typeof record.refs === "object"
            ? {
                primarySection:
                  typeof (record.refs as Record<string, unknown>).primarySection === "string"
                    ? ((record.refs as Record<string, unknown>).primarySection as string)
                    : undefined,
                sectionAnchor:
                  typeof (record.refs as Record<string, unknown>).sectionAnchor === "string"
                    ? ((record.refs as Record<string, unknown>).sectionAnchor as string)
                    : undefined,
                sectionStableId:
                  typeof (record.refs as Record<string, unknown>).sectionStableId === "string"
                    ? ((record.refs as Record<string, unknown>).sectionStableId as string)
                    : undefined,
                sections: Array.isArray((record.refs as Record<string, unknown>).sections)
                  ? ((record.refs as Record<string, unknown>).sections as unknown[]).map((item) => String(item))
                  : [],
                tools: Array.isArray((record.refs as Record<string, unknown>).tools)
                  ? ((record.refs as Record<string, unknown>).tools as unknown[]).map((item) => String(item))
                  : [],
              }
            : undefined;
        nextRules.push({
          id,
          title,
          snippet,
          text,
          summary: typeof record.summary === "string" ? record.summary : undefined,
          logic: typeof record.logic === "string" ? record.logic : undefined,
          notes: typeof record.notes === "string" ? record.notes : undefined,
          when,
          expectedEvidence,
          tags,
          type,
          sectionId,
          anchor,
          citations,
          refs,
        });
      }

      setRules(nextRules);
      return nextRules;
    } catch (error) {
      setRules([]);
      setRulesError(error instanceof Error ? error.message : String(error));
      return [];
    } finally {
      setRulesLoading(false);
    }
  }, [activeVersion, method.code, rules, rulesLoading]);

  const buildRuleLink = useCallback(
    (ruleId: string) => {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const path = `/m/${encodeURIComponent(method.code)}/v/${encodeURIComponent(activeVersion ?? "")}`;
      const { tab, rule, section, hash } = encodeShareState({ tab: "rules", rule: ruleId });
      const params = new URLSearchParams();
      if (tab) params.set("tab", tab);
      if (rule) params.set("rule", rule);
      if (section) params.set("section", section);
      const query = params.toString();
      const suffix = `${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
      return `${origin}${path}${suffix}`;
    },
    [activeVersion, method.code],
  );

  const loadRuleDetail = useCallback(async (ruleId: string) => {
    if (!activeVersion) return;
    setRuleDetailLoading(true);
    setRuleDetailError(null);
    try {
      const response = await fetch(
        `/api/methods/${encodeURIComponent(method.code)}/v/${encodeURIComponent(activeVersion)}/rules?id=${encodeURIComponent(
          ruleId,
        )}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(`Rule request failed with ${response.status}`);
      const payload = (await response.json()) as { rule?: unknown };
      const rule = payload.rule;
      if (!rule || typeof rule !== "object") throw new Error("Rule payload missing");
      const record = rule as Record<string, unknown>;
      const citations = Array.isArray(record.citations)
        ? record.citations
            .map((item: unknown) => {
              if (!item || typeof item !== "object") return null;
              const citation = item as Record<string, unknown>;
              const sectionId = typeof citation.sectionId === "string" ? citation.sectionId : undefined;
              const anchor = typeof citation.anchor === "string" ? citation.anchor : undefined;
              const label = typeof citation.label === "string" ? citation.label : undefined;
              if (!sectionId && !anchor && !label) return null;
              return { sectionId, anchor, label };
            })
            .filter(
              (
                value,
              ): value is { sectionId: string | undefined; anchor: string | undefined; label: string | undefined } =>
                value !== null,
            )
        : undefined;
      const refs =
        record.refs && typeof record.refs === "object"
          ? {
              primarySection:
                typeof (record.refs as Record<string, unknown>).primarySection === "string"
                  ? ((record.refs as Record<string, unknown>).primarySection as string)
                  : undefined,
              sectionAnchor:
                typeof (record.refs as Record<string, unknown>).sectionAnchor === "string"
                  ? ((record.refs as Record<string, unknown>).sectionAnchor as string)
                  : undefined,
              sectionStableId:
                typeof (record.refs as Record<string, unknown>).sectionStableId === "string"
                  ? ((record.refs as Record<string, unknown>).sectionStableId as string)
                  : undefined,
              sections: Array.isArray((record.refs as Record<string, unknown>).sections)
                ? ((record.refs as Record<string, unknown>).sections as unknown[]).map((item) => String(item))
                : [],
              tools: Array.isArray((record.refs as Record<string, unknown>).tools)
                ? ((record.refs as Record<string, unknown>).tools as unknown[]).map((item) => String(item))
                : [],
            }
          : undefined;
      setRuleDetail({
        id: typeof record.id === "string" ? record.id : ruleId,
        title:
          typeof record.title === "string"
            ? record.title
            : typeof record.id === "string"
              ? record.id
              : ruleId,
        text: typeof record.text === "string" ? record.text : "",
        summary: typeof record.summary === "string" ? record.summary : undefined,
        logic: typeof record.logic === "string" ? record.logic : undefined,
        notes: typeof record.notes === "string" ? record.notes : undefined,
        when: Array.isArray(record.when) ? record.when.map((item: unknown) => String(item)).filter(Boolean) : [],
        expectedEvidence: Array.isArray(record.expectedEvidence)
          ? record.expectedEvidence.map((item: unknown) => String(item)).filter(Boolean)
          : [],
        tags: Array.isArray(record.tags)
          ? record.tags.map((t: unknown) => String(t)).filter(Boolean)
          : [],
        type: typeof record.type === "string" ? record.type : undefined,
        sha256: typeof record.sha256 === "string" ? record.sha256 : undefined,
        sectionId: typeof record.sectionId === "string" ? record.sectionId : undefined,
        anchor: typeof record.anchor === "string" ? record.anchor : undefined,
        citations,
        refs,
        sourcePath: typeof record.sourcePath === "string" ? record.sourcePath : undefined,
      });
    } catch (error) {
      setRuleDetail(null);
      setRuleDetailError(error instanceof Error ? error.message : String(error));
    } finally {
      setRuleDetailLoading(false);
    }
  }, [activeVersion, method.code]);

  const setRuleParam = useCallback((ruleId?: string) => {
    if (!pathname) return;
    if (isEvidenceMode) return;
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    if (ruleId) {
      params.set("rule", ruleId);
      params.delete("section");
    } else {
      params.delete("rule");
    }
    const search = params.toString();
    const hash = ruleId ? `#r-${ruleId}` : "";
    router.replace(search ? `${pathname}?${search}${hash}` : `${pathname}${hash}`, { scroll: false });
  }, [isEvidenceMode, pathname, router]);

  const setSectionParam = useCallback(
    (sectionId?: string) => {
      if (!pathname) return;
      if (isEvidenceMode) return;
      const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      if (sectionId) {
        params.set("section", sectionId);
        params.delete("rule");
        params.set("tab", "sections");
      } else {
        params.delete("section");
      }
      const search = params.toString();
      const hash = sectionId ? `#s-${sectionId}` : "";
      router.replace(search ? `${pathname}?${search}${hash}` : `${pathname}${hash}`, { scroll: false });
    },
    [isEvidenceMode, pathname, router],
  );

  const setTabParam = useCallback(
    (nextTab: DetailTab) => {
      if (!pathname) return;
      if (isEvidenceMode) return;
      const params = new URLSearchParams(searchString);
      const next = applyUrlUpdates(params, {
        tab: nextTab,
        focus: null,
      });
      if (next === searchString) return;
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [isEvidenceMode, pathname, router, searchString],
  );

  const ensureSectionsLoaded = useCallback(async (): Promise<SectionListItem[]> => {
    if (!activeVersion) return [];
    if (sections.length) return sections;
    if (sectionsLoading) return sections;
    setSectionsLoading(true);
    try {
      const response = await fetch(
        `/api/methods/${encodeURIComponent(method.code)}/v/${encodeURIComponent(activeVersion)}/sections`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(`Sections request failed with ${response.status}`);
      const payload = (await response.json()) as { sections?: unknown };
      const list = Array.isArray(payload.sections) ? payload.sections : [];
      const next: SectionListItem[] = [];
      for (const item of list) {
        if (!item || typeof item !== "object") continue;
        const record = item as Record<string, unknown>;
        const id = typeof record.id === "string" ? record.id : "";
        if (!id) continue;
        const title = typeof record.title === "string" ? record.title : id;
        const level = typeof record.level === "number" ? record.level : 1;
        const anchor = typeof record.anchor === "string" ? record.anchor : undefined;
        const page = typeof record.page === "number" ? record.page : undefined;
        const textSnippet = typeof record.textSnippet === "string" ? record.textSnippet : undefined;
        next.push({ id, title, level, anchor, page, textSnippet });
      }
      setSections(next);
      return next;
    } catch {
      setSections([]);
      return [];
    } finally {
      setSectionsLoading(false);
    }
  }, [activeVersion, method.code, sections, sectionsLoading]);

  const ensureTraceLoaded = useCallback(async (): Promise<TraceIndex | null> => {
    if (!activeVersion) return null;
    if (traceIndex) return traceIndex;
    if (traceLoading) return traceIndex;
    setTraceLoading(true);
    setTraceError(null);
    try {
      const response = await fetch(
        `/api/methods/${encodeURIComponent(method.code)}/v/${encodeURIComponent(activeVersion)}/trace`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(`Trace request failed with ${response.status}`);
      const payload = (await response.json()) as { trace?: unknown };
      const trace = payload?.trace;
      if (!trace || typeof trace !== "object") throw new Error("Trace payload missing");
      setTraceIndex(trace as TraceIndex);
      return trace as TraceIndex;
    } catch (error) {
      setTraceIndex(null);
      setTraceError(error instanceof Error ? error.message : String(error));
      return null;
    } finally {
      setTraceLoading(false);
    }
  }, [activeVersion, method.code, traceIndex, traceLoading]);

  useEffect(() => {
    if (effectiveTab === "rules") void ensureRulesLoaded();
  }, [effectiveTab, ensureRulesLoaded]);

  useEffect(() => {
    if (effectiveTab !== "rules") return;
    void ensureSectionsLoaded();
  }, [effectiveTab, ensureSectionsLoaded]);

  useEffect(() => {
    if (effectiveTab !== "verify") return;
    void ensureRulesLoaded();
  }, [effectiveTab, ensureRulesLoaded]);

  useEffect(() => {
    if (!activeRuleId) return;
    void ensureTraceLoaded();
  }, [activeRuleId, ensureTraceLoaded]);

  useEffect(() => {
    if (!activeRuleId) return;
    if (ruleDetail?.id === activeRuleId || ruleDetailLoading) return;
    void loadRuleDetail(activeRuleId);
  }, [activeRuleId, loadRuleDetail, ruleDetail?.id, ruleDetailLoading]);

  useEffect(() => {
    if (!activeRuleId) return;
    void ensureSectionsLoaded();
  }, [activeRuleId, ensureSectionsLoaded]);

  const openRule = useCallback(async (ruleId: string) => {
    setTabParam("rules");
    setRulesDeeplinkWarning(null);
    const list = await ensureRulesLoaded();
    if (list.length === 0) return false;
    if (!list.some((rule) => rule.id === ruleId)) {
      setRulesDeeplinkWarning(`Unknown rule id "${ruleId}".`);
      return false;
    }
    setActiveRuleId(ruleId);
    setRuleParam(ruleId);
    await loadRuleDetail(ruleId);
    return true;
  }, [ensureRulesLoaded, loadRuleDetail, setRuleParam, setTabParam]);

  const openRuleModal = useCallback(
    async (ruleId: string) => {
      setRulesDeeplinkWarning(null);
      const list = await ensureRulesLoaded();
      if (list.length === 0) return false;
      if (!list.some((rule) => rule.id === ruleId)) {
        setRulesDeeplinkWarning(`Unknown rule id "${ruleId}".`);
        return false;
      }
      setActiveRuleId(ruleId);
      await Promise.all([loadRuleDetail(ruleId), ensureTraceLoaded(), ensureSectionsLoaded()]);
      setRuleDetailModalOpen(true);
      return true;
    },
    [ensureRulesLoaded, ensureSectionsLoaded, ensureTraceLoaded, loadRuleDetail],
  );

  useEffect(() => {
    if (didInitFromUrl.current) return;
    didInitFromUrl.current = true;
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const initial = (url.searchParams.get("rule") ?? "").trim();
    if (initial) setActiveRuleId(initial);
  }, []);

  useEffect(() => {
    if (surfaceTab !== "verify" && !isEvidenceMode) return;
    updateRuleParamNoNav(activeRuleId);
  }, [activeRuleId, isEvidenceMode, surfaceTab]);

  useEffect(() => {
    if (isEvidenceMode) return;
    if (typeof window === "undefined") return;
    const { section } = decodeShareState(searchParams, window.location.hash);
    if (!section) {
      lastSectionFromQuery.current = null;
      return;
    }
    if (lastSectionFromQuery.current === section) return;
    lastSectionFromQuery.current = section;
    void (async () => {
      const list = await ensureSectionsLoaded();
      const match = list.find((item) => item.id === section) ?? null;
      if (match) {
        setSectionPreview(match);
      } else {
        lastSectionFromQuery.current = null;
      }
    })();
  }, [ensureSectionsLoaded, isEvidenceMode, searchParams]);

  const sectionsById = useMemo(() => new Map(sections.map((section) => [section.id, section])), [sections]);

  const navigateToRule = useCallback(
    async (ruleId: string) => {
      const ok = await openRule(ruleId);
      if (!ok) return false;
      appendAuditEvent({ kind: "rule.jump", payload: { rule_id: ruleId } });
      return true;
    },
    [appendAuditEvent, openRule],
  );

  const navigateToSection = useCallback(
    async (sectionId: string) => {
      const list = await ensureSectionsLoaded();
      const match = list.find((section) => section.id === sectionId) ?? null;
      if (!match) return false;
      setSectionPreview(match);
      setSectionParam(sectionId);
      return true;
    },
    [ensureSectionsLoaded, setSectionParam],
  );

  const navigateToVerify = useCallback(
    (view: "list" | "map") => {
      if (!pathname) return;
      const params = new URLSearchParams(searchString);
      params.set("tab", "verify");
      if (verifierMode) {
        params.set("mode", "verify");
        params.set("view", view);
      } else {
        params.set("mode", view);
        params.delete("view");
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchString, verifierMode],
  );

  const handleJumpToRule = useCallback(
    (ruleId: string) => {
      jumpToRule(router, ruleId);
      appendAuditEvent({ kind: "rule.jump", payload: { rule_id: ruleId } });
    },
    [appendAuditEvent, router],
  );

  const handleCoverageTask = useCallback(
    (ruleId: string) => {
      if (!activeVersion) return { storedIn: "coverage", action: "added" as const };
      return addCoverageTask({ methodCode: method.code, version: activeVersion, ruleId });
    },
    [activeVersion, method.code],
  );

  const handleExportAuditTrail = useCallback(() => {
    if (!exportSha256) return;
    appendAuditEvent({ kind: "export.audit_trail", payload: { audit_trail_sha256: exportSha256 } });
  }, [appendAuditEvent, exportSha256]);

  const handleHeaderViewModeChange = useCallback((nextMode: "list" | "map") => {
    setVerifyViewMode(nextMode);
  }, []);

  const handleToggleVerifierMode = useCallback(() => {
    if (!pathname) return;
    const params = new URLSearchParams(searchString);
    if (verifierMode) {
      params.delete("mode");
      params.delete("view");
      params.set("mode", verifyViewMode);
    } else {
      params.set("mode", "verify");
      params.set("view", verifyViewMode);
    }
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [pathname, router, searchString, verifierMode, verifyViewMode]);

  useEffect(() => {
    if (!isEvidenceMode) return;
    setSelectedStacItemId((searchParams.get("evidence") ?? "").trim() || null);
  }, [isEvidenceMode, searchParams, searchString]);

  const proofMapSurface = (
    <ProofMapTab
      methodCode={method.code}
      version={activeVersion ?? ""}
      provenanceJson={provenanceJson}
      mode={isEvidenceMode ? "evidence" : undefined}
      viewMode={verifyViewMode}
      verifierMode={verifierMode}
      activeRuleId={activeRuleId}
      ruleOptions={rules.map((rule) => ({ id: rule.id, title: rule.title }))}
      onSelectRuleId={(ruleId) => {
        if (!ruleId) {
          setActiveRuleId(null);
          return;
        }
        void openRule(ruleId);
      }}
      onViewRule={(ruleId) => {
        void openRuleModal(ruleId);
      }}
      totalRules={activeVersion ? method.ruleCountByVersion[activeVersion] ?? null : null}
      aoi={effectiveAoi}
      currentAoi={currentAoi}
      draftAoi={draftAoi}
      evidencePins={evidencePins}
      verificationRuns={verificationRuns}
      stacEvidenceState={stacEvidenceState}
      selectedStacItemId={selectedStacItemId}
      evidenceSnapshots={evidenceSnapshots}
      onSetAoi={setActiveAoiAndPersist}
      onUploadAoi={handleUploadAoi}
      onApplyDraftAoi={handleApplyDraftAoi}
      onCancelDraftAoi={handleCancelDraftAoi}
      onUndoApplyAoi={handleUndoApply}
      applyToken={applyToken}
      onStartOver={startOverProofMap}
      onSetEvidencePins={setEvidencePinsAndPersist}
      onSetVerificationRuns={setVerificationRunsAndPersist}
      onAuditEvent={appendAuditEvent}
      auditTrail={
        verifierMode
          ? {
              events: auditEvents,
              exportJson,
              exportSha256,
              onClear: clearTrail,
              onExport: handleExportAuditTrail,
              onJumpToRule: handleJumpToRule,
              onOpenEvidence: () => navigateToVerify("map"),
            }
          : null
      }
      onSetStacEvidenceState={(next) => {
        if (!evidenceKey) return;
        setStacEvidenceByKey((prev) => {
          if (!next) {
            const out = { ...prev };
            delete out[evidenceKey];
            return out;
          }
          return { ...prev, [evidenceKey]: next };
        });
      }}
      onSelectStacItemId={setSelectedStacItemId}
      onEvidenceSelectionChange={setEvidenceLinkSelection}
      onNavigateEvidence={async (type, id) => {
        if (type === "rule") return await navigateToRule(id);
        if (type === "section") return await navigateToSection(id);
        return false;
      }}
      onOpenCoverageDrawer={() => setCoverageDrawerOpen(true)}
    />
  );

  const verifySurface = (
    <div className="mt-4 grid gap-4">
      <VerifyHeader
        mode={verifyViewMode}
        verifierMode={verifierMode}
        onChangeMode={handleHeaderViewModeChange}
        onToggleVerifierMode={handleToggleVerifierMode}
      />
      {proofMapSurface}
    </div>
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-slate-900">{method.code}</h2>
          <p className="text-sm text-slate-600">
            {method.program} • {method.sector}
          </p>
          <p className="text-xs text-slate-500">
            Latest: {method.latestVersion ?? "—"} • Versions: {method.versionCount}
          </p>
          {versionBadges.length ? (
            <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-600">
              {versionBadges.map((label) => (
                <span key={label} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                  {label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="w-full sm:max-w-xs">
          <VersionSelector
            methodCode={method.code}
            versions={[...lineageVersions].reverse()}
            selectedVersion={activeVersion}
            lineage={method.lineage}
          />
        </div>
      </div>

      <div className="mt-3">
        <TrustStrip
          methodCode={method.code}
          version={activeVersion}
          packTag={packTag}
          provenanceJson={provenanceJson}
          manifestRulesPath={manifestRulesPath}
          onOpenIntegrityDiff={() => setIntegrityDiffOpen(true)}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {isEvidenceMode ? (
          <Link
            href={buildVerifyHref()}
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
          >
            Back to Method
          </Link>
        ) : null}
      </div>

      {integrityDiffOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
              <div className="text-sm font-semibold text-slate-900">Integrity Diff</div>
              <button
                type="button"
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={() => setIntegrityDiffOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
              <IntegrityDiffPanel />
            </div>
          </div>
        </div>
      ) : null}

      <RuleDetailModal
        open={ruleDetailModalOpen}
        row={activeRequirementRow}
        canonicalRuleId={ruleDetail?.id ?? null}
        ruleText={
          ruleDetailLoading && activeRuleId && ruleDetail?.id !== activeRuleId
            ? "Loading requirement details…"
            : (ruleDetail?.summary ?? activeRequirementRow?.ruleSummary.summary ?? activeRequirementRow?.ruleSummary.snippet ?? null)
        }
        ruleLogic={ruleDetail?.logic ?? activeRequirementRow?.ruleSummary.logic ?? null}
        ruleNotes={ruleDetail?.notes ?? activeRequirementRow?.ruleSummary.notes ?? null}
        ruleWhen={ruleDetail?.when ?? activeRequirementRow?.ruleSummary.when ?? null}
        methodologyLabel={`${method.program} ${method.sector} · ${method.code} · ${activeVersion ?? "unknown version"}`}
        reviewMethodology={method.code}
        reviewVersion={activeVersion ?? null}
        sourcePath={ruleDetail?.sourcePath ?? null}
        sha256={ruleDetail?.sha256 ?? null}
        ruleTags={activeRequirementRow?.ruleSummary.tags ?? []}
        stacItems={stacItemsForPanel}
        hasAoi={!!effectiveAoi}
        documentSupport={documentSupportForPanel}
        traceSections={linkedTraceSections.map((link) => {
          const section = sectionsById.get(link.section_id);
          return {
            sectionId: link.section_id,
            title: section?.title ?? link.title ?? null,
            textSnippet: section?.textSnippet ?? null,
            page: section?.page ?? null,
            match: link.match,
          };
        })}
        onClose={() => setRuleDetailModalOpen(false)}
        onOpenSourceContext={(sectionId) => {
          void navigateToSection(sectionId);
          setRuleDetailModalOpen(false);
        }}
      />

      {sectionPreview ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Section preview
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900" id={`s-${sectionPreview.id}`}>
                  {sectionPreview.title}
                </div>
                <div className="mt-1 font-mono text-[11px] text-slate-600">{sectionPreview.id}</div>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={() => {
                  setSectionPreview(null);
                  setSectionParam(undefined);
                }}
              >
                Close
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
                {sectionPreview.textSnippet ?? "No preview available."}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isEvidenceMode ? null : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTabParam("rules")}
            className={`${tabBase} ${surfaceTab === "rules" ? tabActive : tabIdle}`}
            aria-pressed={surfaceTab === "rules"}
          >
            Coverage
          </button>
          <button
            type="button"
            onClick={() => setTabParam("verify")}
            className={`${tabBase} ${surfaceTab === "verify" ? tabActive : tabIdle}`}
            aria-pressed={surfaceTab === "verify"}
          >
            Verify
          </button>
          {methodsLayout?.isVerifyTab && surfaceTab === "verify" ? (
            <button
              type="button"
              onClick={() => methodsLayout.setMethodsCollapsed(!methodsLayout.methodsCollapsed)}
              className="hidden items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 lg:inline-flex"
            >
              {methodsLayout.methodsCollapsed ? "Show methods" : "Hide methods"}
            </button>
          ) : null}
        </div>
      )}

      {isEvidenceMode ? (
        verifySurface
      ) : surfaceTab === "verify" ? (
        verifySurface
      ) : (
        <div className="mt-4 grid gap-3">
          {activeVersion ? (
            <CoveragePanel
              summary={coverageSummary}
              onView={() => setCoverageDrawerOpen(true)}
            />
          ) : null}

          {activeVersion ? (
            <CoverageDrawer
              open={coverageDrawerOpen}
              title={`${coverageSummary.uncovered} unresolved requirements`}
              rules={coverageRulesWithStatus}
              activeRuleId={activeRuleId}
              onClose={() => setCoverageDrawerOpen(false)}
              onOpenRule={openRule}
              onAddTask={handleCoverageTask}
            />
          ) : null}

          {rulesDeeplinkWarning ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {rulesDeeplinkWarning}
            </div>
          ) : null}

          {rulesError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {rulesError}
            </div>
          ) : null}

          {ruleDetailError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              Failed to load selected requirement detail: {ruleDetailError}
            </div>
          ) : null}

          {rulesLoading ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Loading requirement coverage…
            </div>
          ) : null}

          {!rulesLoading && !rulesError && requirementRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              No requirements found for this version.
            </div>
          ) : null}

          {!rulesLoading && !rulesError && requirementRows.length ? (
            <>
              {activeVersion && reviewProgress ? (
                <ReviewProgressIndicator progress={reviewProgress} />
              ) : null}

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Methodology detail
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      Keep the workflow simple and open richer methodology detail only when needed.
                    </h3>
                    <p className="text-sm text-slate-600">
                      View rule now opens a richer modal from the existing verification flow without sending the reviewer to a separate workspace.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
                    <span className="rounded-full bg-slate-100 px-3 py-1">Rules {requirementRows.length}</span>
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">
                      Unresolved {requirementRows.filter((row) => row.status === "missing" || row.status === "partial").length}
                    </span>
                  </div>
                </div>

                {activeRequirementRow ? (
                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-mono text-xs font-semibold text-slate-700">{activeRequirementRow.ruleId}</div>
                          <h4 className="mt-2 text-base font-semibold text-slate-900">
                            {ruleDetail?.title ?? activeRequirementRow.ruleSummary.title}
                          </h4>
                        </div>
                        <button
                          type="button"
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
                          onClick={() => setRuleDetailModalOpen(true)}
                        >
                          View rule
                        </button>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-700">
                        {ruleDetailLoading && activeRuleId && ruleDetail?.id !== activeRuleId
                          ? "Loading requirement details…"
                          : (ruleDetail?.summary ?? activeRequirementRow.ruleSummary.summary ?? activeRequirementRow.ruleSummary.snippet)}
                      </p>
                    </div>

                    <div className="grid gap-3">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Provenance</div>
                        <div className="mt-2 text-sm text-slate-700">
                          {requirementProvenanceHint(activeRequirementRow)}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Expected evidence</div>
                        <div className="mt-2 text-sm text-slate-700">
                          {summarizeExpectedEvidence(activeRequirementRow.expectedEvidenceTypes)}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Linked evidence</div>
                        <div className="mt-2 text-sm text-slate-700">
                          {summarizeLinkedEvidence(activeRequirementRow.linkedEvidence)}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    Select a rule from the verification workflow to inspect richer methodology detail.
                  </div>
                )}
              </section>

              <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-900">
                  Requirement coverage workspace
                  <span className="ml-2 text-xs font-normal text-slate-500">Secondary review surface</span>
                </summary>
                <div className="border-t border-slate-100 px-4 py-4">
                  <RequirementCoverageWorkspace
                    rows={requirementRows}
                    activeRuleId={activeRuleId}
                    selectedRequirementText={
                      ruleDetailLoading && activeRuleId && ruleDetail?.id !== activeRuleId
                        ? "Loading requirement details…"
                        : (ruleDetail?.summary ?? null)
                    }
                    selectedRequirementSourcePath={ruleDetail?.sourcePath ?? null}
                    selectedRequirementSha256={ruleDetail?.sha256 ?? null}
                    selectedTraceSections={linkedTraceSections.map((link) => {
                      const section = sectionsById.get(link.section_id);
                      return {
                        sectionId: link.section_id,
                        title: section?.title ?? link.title ?? null,
                        textSnippet: section?.textSnippet ?? null,
                        match: link.match,
                      };
                    })}
                    onSelectRule={(ruleId) => {
                      void openRule(ruleId);
                    }}
                    onOpenSourceContext={(sectionId) => {
                      void navigateToSection(sectionId);
                    }}
                    onCopyRequirementLink={async (ruleId) => {
                      if (!activeVersion) return;
                      try {
                        await navigator.clipboard.writeText(buildRuleLink(ruleId));
                      } catch {
                        // ignore
                      }
                    }}
                    inventoryItems={evidenceInventory}
                    onLinkInventoryItem={handleLinkInventoryItem}
                    onUnlinkInventoryItem={handleUnlinkInventoryItem}
                    supportingEvidence={
                      <div className="grid gap-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-sm text-slate-600">
                            Supporting views stay attached to the selected requirement while verify, finalize, and export stay available.
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-semibold text-slate-600">
                              {(["list", "map"] as const).map((modeOption) => (
                                <button
                                  key={modeOption}
                                  type="button"
                                  className={`rounded-full px-3 py-1 ${
                                    verifyViewMode === modeOption ? "bg-white text-slate-900 shadow-sm" : ""
                                  }`}
                                  onClick={() => setVerifyViewMode(modeOption)}
                                  aria-pressed={verifyViewMode === modeOption}
                                >
                                  {modeOption === "list" ? "Evidence" : "Map"}
                                </button>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => navigateToVerify(verifyViewMode)}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
                            >
                              Open full verify workspace
                            </button>
                          </div>
                        </div>
                        {proofMapSurface}
                      </div>
                    }
                  />
                </div>
              </details>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
