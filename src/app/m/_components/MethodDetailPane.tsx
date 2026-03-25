"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import VersionSelector from "@/app/m/_components/VersionSelector";
import { IntegrityDiffPanel } from "@/app/m/_components/IntegrityDiffPanel";
import TrustStrip from "@/components/TrustStrip";
import ProofMapTab from "@/components/map/ProofMapTab";
import VerifyHeader from "@/app/m/_components/VerifyHeader";
import { useMethodsLayout } from "@/app/m/_components/MethodsLayoutContext";
import ShareLinkButton from "@/components/actions/ShareLinkButton";
import CoveragePanel from "@/components/coverage/CoveragePanel";
import CoverageDrawer from "@/components/coverage/CoverageDrawer";
import { buildCoverageQueue } from "@/lib/coverage/queue";
import { addCoverageTask } from "@/lib/coverage/tasks";
import { linkedRuleIdsFromPins } from "@/lib/kpis/computeKpis";
import { normalizeRichEvidence, type NormalizedRichEvidence } from "@/lib/rich/normalize";
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
import type { ProofEvidenceItem } from "@/lib/proof/bundle";
import { importProofBundleText } from "@/lib/proof/import";
import { applyUrlUpdates, parseDetailTab, type DetailTab } from "@/lib/nav/urlState";

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

function ruleStatusFromState(input: {
  activeRuleId: string | null;
  linkedRuleIds: Set<string>;
  evidencePins: EvidencePin[];
  verificationRuns: VerificationRun[];
}): { label: string; tone: string; detail: string } {
  const { activeRuleId, linkedRuleIds, evidencePins, verificationRuns } = input;
  if (!activeRuleId) {
    return {
      label: "No rule selected",
      tone: "bg-slate-100 text-slate-700",
      detail: "Select a rule to review its method grounding, project evidence, and provenance.",
    };
  }
  const matchingPins = evidencePins.filter(
    (pin) => pin.ruleId === activeRuleId || pin.cited_ids.includes(activeRuleId),
  );
  const matchingRuns = verificationRuns.filter((run) => {
    if (matchingPins.some((pin) => pin.id === run.pin_id)) return true;
    return run.cited_ids.includes(activeRuleId);
  });
  if (matchingRuns.length) {
    const latestRun = [...matchingRuns].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return {
      label: latestRun.status === "ok" ? "Evidence grounded" : "Evidence under review",
      tone: latestRun.status === "ok" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800",
      detail:
        latestRun.summary?.trim() ||
        `${matchingRuns.length} verification run${matchingRuns.length === 1 ? "" : "s"} linked to this rule.`,
    };
  }
  if (linkedRuleIds.has(activeRuleId) || matchingPins.length) {
    return {
      label: "Evidence linked",
      tone: "bg-sky-100 text-sky-800",
      detail: `${matchingPins.length} project evidence item${matchingPins.length === 1 ? "" : "s"} linked so far.`,
    };
  }
  return {
    label: "No project evidence yet",
    tone: "bg-slate-100 text-slate-700",
    detail: "This rule is readable now, but it does not yet have linked evidence or a verification assessment.",
  };
}

type RuleGroundedPassage = {
  sectionId?: string;
  title: string;
  text: string;
  source: "rich-passage" | "section-excerpt" | "lean-fallback";
};

function buildGroundedPassages(input: {
  ruleDetail: {
    text: string;
    summary?: string;
    sectionId?: string;
  } | null;
  sectionOrder: string[];
  sectionSummaries: Map<string, { title: string; textSnippet?: string }>;
  sectionDetails: Map<string, { title: string; text?: string; textSnippet?: string }>;
}): RuleGroundedPassage[] {
  const { ruleDetail, sectionOrder, sectionSummaries, sectionDetails } = input;
  if (!ruleDetail) return [];

  const passages: RuleGroundedPassage[] = [];
  for (const sectionId of sectionOrder) {
    const detail = sectionDetails.get(sectionId);
    const summary = sectionSummaries.get(sectionId);
    const title = detail?.title ?? summary?.title ?? sectionId;
    const richPassage = detail?.text?.trim();
    const sectionExcerpt = detail?.textSnippet?.trim() ?? summary?.textSnippet?.trim();
    if (richPassage) {
      passages.push({ sectionId, title, text: richPassage, source: "rich-passage" });
      continue;
    }
    if (sectionExcerpt) {
      passages.push({ sectionId, title, text: sectionExcerpt, source: "section-excerpt" });
    }
  }

  if (passages.length) return passages;

  const fallbackText = ruleDetail.summary?.trim() || ruleDetail.text.trim();
  if (!fallbackText) return [];
  return [
    {
      sectionId: ruleDetail.sectionId ?? sectionOrder[0],
      title: ruleDetail.sectionId ?? sectionOrder[0] ?? "Method grounding",
      text: fallbackText,
      source: "lean-fallback",
    },
  ];
}

function sectionIdFromText(value?: string): string | undefined {
  if (!value) return undefined;
  const match = value.match(/S-\d{1,6}/i);
  return match ? match[0] : undefined;
}

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
  const [ruleQuery, setRuleQuery] = useState("");
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [rulesDeeplinkWarning, setRulesDeeplinkWarning] = useState<string | null>(null);
  type RuleListItem = { id: string; title: string; snippet: string; tags: string[]; type?: string };
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeRuleId, setActiveRuleId] = useState<string | null>(initialRuleId ?? null);
  const [traceIndex, setTraceIndex] = useState<TraceIndex | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [ruleDetail, setRuleDetail] = useState<{
    id: string;
    title: string;
    text: string;
    logic?: string;
    summary?: string;
    tags: string[];
    type?: string;
    sha256?: string;
    sectionId?: string;
    anchor?: string;
    citations?: Array<{ sectionId: string | undefined; anchor: string | undefined; label: string | undefined }>;
    sourcePath?: string;
  } | null>(null);
  const [ruleDetailLoading, setRuleDetailLoading] = useState(false);
  const [ruleDetailError, setRuleDetailError] = useState<string | null>(null);
  const lastSectionFromQuery = useRef<string | null>(null);
  const lastMethodSelection = useRef<string | null>(null);
  const ruleHeaderRef = useRef<HTMLDivElement | null>(null);

  type SectionListItem = {
    id: string;
    title: string;
    level: number;
    anchor?: string;
    page?: number;
    textSnippet?: string;
    text?: string;
    sourcePath?: string;
  };

  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [sections, setSections] = useState<SectionListItem[]>([]);
  const [sectionDetailsById, setSectionDetailsById] = useState<Record<string, SectionListItem>>({});
  const [sectionPreview, setSectionPreview] = useState<SectionListItem | null>(null);
  const [evidenceLinkSelection, setEvidenceLinkSelection] = useState<{
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

  const [richLoading, setRichLoading] = useState(false);
  const [richEvidence, setRichEvidence] = useState<NormalizedRichEvidence | null>(null);

  const sortedVersionsNewestFirst = useMemo(() => {
    return [...method.versions].reverse();
  }, [method.versions]);

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

  const filteredRules = useMemo(() => {
    const q = ruleQuery.trim().toLowerCase();
    if (!q) return rules;
    return rules.filter((rule) => {
      const haystack = `${rule.id} ${rule.title} ${rule.snippet} ${(rule.tags ?? []).join(" ")}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [ruleQuery, rules]);
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

  const ruleCitationSectionIds = useMemo(() => {
    if (!ruleDetail) return [];
    const ids = new Set<string>();
    if (ruleDetail.sectionId) ids.add(ruleDetail.sectionId);
    const fromAnchor = sectionIdFromText(ruleDetail.anchor);
    if (fromAnchor) ids.add(fromAnchor);
    for (const citation of ruleDetail.citations ?? []) {
      const value = citation.sectionId ?? sectionIdFromText(citation.anchor);
      if (value) ids.add(value);
    }
    return Array.from(ids);
  }, [ruleDetail]);

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

  const activeRuleStatus = useMemo(
    () =>
      ruleStatusFromState({
        activeRuleId,
        linkedRuleIds: new Set(coverageLinkedRuleIds),
        evidencePins,
        verificationRuns,
      }),
    [activeRuleId, coverageLinkedRuleIds, evidencePins, verificationRuns],
  );

  const ruleEvidencePins = useMemo(() => {
    if (!activeRuleId) return [];
    return evidencePins.filter((pin) => pin.ruleId === activeRuleId || pin.cited_ids.includes(activeRuleId));
  }, [activeRuleId, evidencePins]);

  const ruleEvidenceRuns = useMemo(() => {
    if (!activeRuleId) return [];
    return verificationRuns
      .filter((run) => {
        if (ruleEvidencePins.some((pin) => pin.id === run.pin_id)) return true;
        return run.cited_ids.includes(activeRuleId);
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [activeRuleId, ruleEvidencePins, verificationRuns]);

  const groundedPassages = useMemo(
    () =>
      buildGroundedPassages({
        ruleDetail,
        sectionOrder: ruleCitationSectionIds.length
          ? ruleCitationSectionIds
          : linkedTraceSections.map((link) => link.section_id),
        sectionSummaries: new Map(
          sections.map((section) => [section.id, { title: section.title, textSnippet: section.textSnippet }]),
        ),
        sectionDetails: new Map(
          Object.values(sectionDetailsById).map((section) => [
            section.id,
            { title: section.title, text: section.text, textSnippet: section.textSnippet },
          ]),
        ),
      }),
    [linkedTraceSections, ruleCitationSectionIds, ruleDetail, sectionDetailsById, sections],
  );

  useEffect(() => {
    setRules([]);
    setRulesError(null);
    setRulesLoading(false);
    setRulesDeeplinkWarning(null);
    setRuleQuery("");
    setDrawerOpen(false);
    setActiveRuleId(null);
    setRuleDetail(null);
    setRuleDetailError(null);
    setRuleDetailLoading(false);
    setTraceIndex(null);
    setTraceError(null);
    setTraceLoading(false);
    setSectionDetailsById({});
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
    setEvidencePins(loadPins(method.code, activeVersion));
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
    (nextPins: EvidencePin[]) => {
      setEvidencePins(nextPins);
      if (!activeVersion) return;
      savePins(method.code, activeVersion, nextPins);
    },
    [activeVersion, method.code],
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
    setEvidencePins(loadPins(method.code, activeVersion));
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

  useEffect(() => {
    setRichEvidence(null);
    setRichLoading(false);
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
        const tags = Array.isArray(record.tags)
          ? record.tags.map((t: unknown) => String(t)).filter(Boolean)
          : [];
        const type = typeof record.type === "string" ? record.type : undefined;
        nextRules.push({ id, title, snippet, tags, type });
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
      setRuleDetail({
        id: typeof record.id === "string" ? record.id : ruleId,
        title:
          typeof record.title === "string"
            ? record.title
            : typeof record.id === "string"
              ? record.id
              : ruleId,
        text: typeof record.text === "string" ? record.text : "",
        logic: typeof record.logic === "string" ? record.logic : undefined,
        summary: typeof record.summary === "string" ? record.summary : undefined,
        tags: Array.isArray(record.tags)
          ? record.tags.map((t: unknown) => String(t)).filter(Boolean)
          : [],
        type: typeof record.type === "string" ? record.type : undefined,
        sha256: typeof record.sha256 === "string" ? record.sha256 : undefined,
        sectionId: typeof record.sectionId === "string" ? record.sectionId : undefined,
        anchor: typeof record.anchor === "string" ? record.anchor : undefined,
        citations,
        sourcePath: typeof record.sourcePath === "string" ? record.sourcePath : undefined,
      });
    } catch (error) {
      setRuleDetail(null);
      setRuleDetailError(error instanceof Error ? error.message : String(error));
    } finally {
      setRuleDetailLoading(false);
    }
  }, [activeVersion, method.code]);

  const setRuleParam = useCallback((
    ruleId?: string,
    options?: { history?: "push" | "replace"; nextTab?: DetailTab | null; openModal?: boolean },
  ) => {
    if (!pathname) return;
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    if (ruleId) {
      params.set("rule", ruleId);
      params.delete("section");
      if (options?.openModal) params.set("focus", "rule-detail");
      else params.delete("focus");
    } else {
      params.delete("rule");
      params.delete("focus");
    }
    if (options?.nextTab) {
      params.set("tab", options.nextTab);
    }
    const search = params.toString();
    const hash = options?.openModal && ruleId ? `#r-${ruleId}` : "";
    const href = search ? `${pathname}?${search}${hash}` : `${pathname}${hash}`;
    if (options?.history === "push") {
      router.push(href, { scroll: false });
      return;
    }
    router.replace(href, { scroll: false });
  }, [pathname, router]);

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

  const ensureSectionDetailLoaded = useCallback(async (sectionId: string): Promise<SectionListItem | null> => {
    const normalizedSectionId = sectionId.trim();
    if (!normalizedSectionId || !activeVersion) return null;
    if (sectionDetailsById[normalizedSectionId]) return sectionDetailsById[normalizedSectionId];
    try {
      const response = await fetch(
        `/api/methods/${encodeURIComponent(method.code)}/v/${encodeURIComponent(activeVersion)}/sections?id=${encodeURIComponent(
          normalizedSectionId,
        )}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(`Section request failed with ${response.status}`);
      const payload = (await response.json()) as { section?: unknown };
      const section = payload.section;
      if (!section || typeof section !== "object") throw new Error("Section payload missing");
      const record = section as Record<string, unknown>;
      const next: SectionListItem = {
        id: typeof record.id === "string" ? record.id : normalizedSectionId,
        title: typeof record.title === "string" ? record.title : normalizedSectionId,
        level: typeof record.level === "number" ? record.level : 1,
        anchor: typeof record.anchor === "string" ? record.anchor : undefined,
        page: typeof record.page === "number" ? record.page : undefined,
        textSnippet: typeof record.textSnippet === "string" ? record.textSnippet : undefined,
        text: typeof record.text === "string" ? record.text : undefined,
        sourcePath: typeof record.sourcePath === "string" ? record.sourcePath : undefined,
      };
      setSectionDetailsById((prev) => ({ ...prev, [next.id]: next }));
      return next;
    } catch {
      return null;
    }
  }, [activeVersion, method.code, sectionDetailsById]);

  const goToSectionFromTrace = useCallback(
    (event: MouseEvent<HTMLButtonElement>, sectionId: string) => {
      event.preventDefault();
      event.stopPropagation();
      void (async () => {
        const list = await ensureSectionsLoaded();
        const match = list.find((section) => section.id === sectionId) ?? null;
        if (match) {
          setSectionPreview(match);
          setSectionParam(sectionId);
        }
      })();
    },
    [ensureSectionsLoaded, setSectionParam],
  );

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

  const ensureRichLoaded = useCallback(async (): Promise<NormalizedRichEvidence | null> => {
    if (!activeVersion) return null;
    if (richEvidence) return richEvidence;
    if (richLoading) return richEvidence;
    setRichLoading(true);
    try {
      const ensureLeadingSlash = (value: string) => (value.startsWith("/") ? value : `/${value}`);
      const segment = (value: string) => encodeURIComponent(value);

      const program = method.program?.trim();
      const sector = method.sector?.trim();
      const code = method.code.trim();
      const version = activeVersion.trim();

      if (!program || program === "—" || !sector || sector === "—" || !code || !version) {
        const normalized = normalizeRichEvidence(null);
        setRichEvidence(normalized);
        return normalized;
      }

      const basePath = ensureLeadingSlash(
        `methodologies/${segment(program)}/${segment(sector)}/${segment(code)}/${segment(version)}`,
      );

      const candidates = [
        { name: "rules.rich.json", url: `${basePath}/rules.rich.json` },
        { name: "sections.rich.json", url: `${basePath}/sections.rich.json` },
        { name: "rich.json", url: `${basePath}/rich.json` },
      ];

      const attempts = await Promise.all(
        candidates.map(async (candidate): Promise<{ name: string; ok: boolean; data?: unknown }> => {
          try {
            const response = await fetch(candidate.url, { cache: "no-store" });
            if (!response.ok) return { name: candidate.name, ok: false };
            const text = await response.text();
            const parsed = text ? JSON.parse(text) : null;
            return { name: candidate.name, ok: true, data: parsed };
          } catch {
            return { name: candidate.name, ok: false };
          }
        }),
      );

      const data: { rulesRich?: unknown; sectionsRich?: unknown; rich?: unknown } = {};
      for (const attempt of attempts) {
        if (!attempt.ok) continue;
        if (attempt.name === "rules.rich.json") data.rulesRich = attempt.data;
        if (attempt.name === "sections.rich.json") data.sectionsRich = attempt.data;
        if (attempt.name === "rich.json") data.rich = attempt.data;
      }

      const hasData = Object.keys(data).length > 0;
      const normalized = normalizeRichEvidence(hasData ? data : null);
      setRichEvidence(normalized);
      return normalized;
    } catch {
      setRichEvidence(null);
      return null;
    } finally {
      setRichLoading(false);
    }
  }, [activeVersion, method.code, method.program, method.sector, richEvidence, richLoading]);

  useEffect(() => {
    if (effectiveTab === "rules") void ensureRulesLoaded();
  }, [effectiveTab, ensureRulesLoaded]);

  useEffect(() => {
    if (effectiveTab !== "verify") return;
    void ensureRulesLoaded();
  }, [effectiveTab, ensureRulesLoaded]);

  useEffect(() => {
    if (!activeRuleId) return;
    void ensureTraceLoaded();
  }, [activeRuleId, ensureTraceLoaded]);

  useEffect(() => {
    if (!drawerOpen) return;
    void ensureSectionsLoaded();
    if (method.hasRich) void ensureRichLoaded();
    const sectionIds = ruleCitationSectionIds.length
      ? ruleCitationSectionIds
      : linkedTraceSections.map((link) => link.section_id);
    sectionIds.slice(0, 4).forEach((sectionId) => {
      void ensureSectionDetailLoaded(sectionId);
    });
  }, [
    drawerOpen,
    ensureRichLoaded,
    ensureSectionDetailLoaded,
    ensureSectionsLoaded,
    linkedTraceSections,
    method.hasRich,
    ruleCitationSectionIds,
  ]);

  const openRule = useCallback(async (ruleId: string) => {
    setRulesDeeplinkWarning(null);
    const list = await ensureRulesLoaded();
    if (list.length === 0) return false;
    if (!list.some((rule) => rule.id === ruleId)) {
      setRulesDeeplinkWarning(`Unknown rule id "${ruleId}".`);
      return false;
    }
    setActiveRuleId(ruleId);
    setDrawerOpen(true);
    setRuleParam(ruleId, { history: "push", nextTab: "rules", openModal: true });
    await loadRuleDetail(ruleId);
    return true;
  }, [ensureRulesLoaded, loadRuleDetail, setRuleParam]);

  const openRuleFromVerify = useCallback(
    async (ruleId: string) => {
      setRulesDeeplinkWarning(null);
      const list = await ensureRulesLoaded();
      if (list.length === 0) return;
      if (!list.some((rule) => rule.id === ruleId)) {
        setRulesDeeplinkWarning(`Unknown rule id "${ruleId}".`);
        return;
      }
      setActiveRuleId(ruleId);
      setDrawerOpen(true);
      setRuleParam(ruleId, { history: "push", openModal: true });
      await loadRuleDetail(ruleId);
    },
    [ensureRulesLoaded, loadRuleDetail, setRuleParam],
  );

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setRuleParam(activeRuleId ?? undefined, { history: "replace", openModal: false });
  }, [activeRuleId, setRuleParam]);

  useEffect(() => {
    if (!drawerOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [closeDrawer, drawerOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const nextRuleId = (url.searchParams.get("rule") ?? "").trim() || null;
    const focus = (url.searchParams.get("focus") ?? "").trim();
    const wantsModal = Boolean(nextRuleId && focus === "rule-detail");
    setDrawerOpen(wantsModal);
    if (nextRuleId !== activeRuleId) {
      setActiveRuleId(nextRuleId);
      if (!nextRuleId) {
        setRuleDetail(null);
        setRuleDetailError(null);
      }
    }
  }, [activeRuleId, searchString]);

  useEffect(() => {
    if (!drawerOpen || !activeRuleId) return;
    void (async () => {
      setRulesDeeplinkWarning(null);
      const list = await ensureRulesLoaded();
      if (!list.some((rule) => rule.id === activeRuleId)) {
        setRulesDeeplinkWarning(`Unknown rule id "${activeRuleId}".`);
        setDrawerOpen(false);
        setActiveRuleId(null);
        setRuleDetail(null);
        setRuleDetailError(null);
        setRuleParam(undefined, { history: "replace" });
        return;
      }
      await loadRuleDetail(activeRuleId);
    })();
  }, [activeRuleId, drawerOpen, ensureRulesLoaded, loadRuleDetail, setRuleParam]);

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

  useEffect(() => {
    if (tab !== "rules") return;
    if (!activeRuleId) return;
    const el = document.getElementById(`r-${activeRuleId}`) ?? document.getElementById(activeRuleId);
    el?.scrollIntoView({ block: "start" });
  }, [activeRuleId, tab]);

  useEffect(() => {
    if (!drawerOpen) return;
    const node = ruleHeaderRef.current;
    if (!node) return;
    node.scrollIntoView({ block: "start" });
    node.focus();
  }, [activeRuleId, drawerOpen, ruleDetail?.title]);

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

  const linkedRuleIds = useMemo(() => new Set(evidenceLinkSelection?.ruleIds ?? []), [evidenceLinkSelection]);

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

  const verifySurface = (
    <div className="mt-4 grid gap-4">
      <VerifyHeader
        mode={verifyViewMode}
        verifierMode={verifierMode}
        onChangeMode={handleHeaderViewModeChange}
        onToggleVerifierMode={handleToggleVerifierMode}
      />
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
          setActiveRuleId(ruleId);
        }}
        onViewRule={(ruleId) => {
          void openRuleFromVerify(ruleId);
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
        exportRules={rules.map((rule) => ({
          id: rule.id,
          title: rule.title,
          snippet: rule.snippet,
          tags: rule.tags ?? [],
        }))}
        exportSections={sections.map((section) => ({
          id: section.id,
          title: section.title,
          anchor: section.anchor,
          textSnippet: section.textSnippet,
        }))}
        onOpenCoverageDrawer={() => setCoverageDrawerOpen(true)}
      />
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
        </div>
        <div className="w-full sm:max-w-xs">
          <VersionSelector
            methodCode={method.code}
            versions={sortedVersionsNewestFirst}
            selectedVersion={activeVersion}
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
        <ShareLinkButton
          tab={isEvidenceMode ? "verify" : tab}
          view={verifyViewMode}
          ruleId={activeRuleId}
          sectionId={sectionPreview?.id ?? null}
        />
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
            Read
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Rules for {activeVersion ?? "—"}
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                {filteredRules.length ? (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
                    onClick={async () => {
                      const first = filteredRules[0];
                      if (!first || !activeVersion) return;
                      try {
                        await navigator.clipboard.writeText(buildRuleLink(first.id));
                      } catch {
                        // ignore
                      }
                    }}
                  >
                    Copy first rule link
                  </button>
                ) : null}
                <input
                  type="search"
                  value={ruleQuery}
                  onChange={(event) => setRuleQuery(event.target.value)}
                  placeholder="Search rules…"
                  className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none sm:max-w-xs"
                />
              </div>
            </div>

            {activeVersion ? (
              <CoveragePanel
                summary={coverageSummary}
                onView={() => setCoverageDrawerOpen(true)}
              />
            ) : null}

            {activeVersion ? (
              <CoverageDrawer
                open={coverageDrawerOpen}
                title={`${coverageSummary.uncovered} uncovered rules`}
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

            {rulesLoading ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Loading rules…
              </div>
            ) : null}

            {!rulesLoading && !rulesError && filteredRules.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
                No rules found for this version.
              </div>
            ) : null}

            <ul className="grid gap-2">
              {filteredRules.map((rule) => (
                <li
                  key={rule.id}
                  id={`r-${rule.id}`}
                  className={
                    linkedRuleIds.has(rule.id)
                      ? "rounded-2xl ring-1 ring-sky-200 ring-offset-2 ring-offset-slate-50"
                      : ""
                  }
                >
                  <button
                    type="button"
                    onClick={() => openRule(rule.id)}
                    className={`flex w-full flex-col gap-1 rounded-xl border px-4 py-3 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50 ${
                      linkedRuleIds.has(rule.id) ? "border-sky-200 bg-sky-50/30" : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-slate-500">
                        {rule.type ? rule.type : rule.tags.length ? rule.tags.slice(0, 2).join(", ") : "—"}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-slate-900">{rule.title}</div>
                    <div className="font-mono text-xs text-slate-500">{rule.id}</div>
                    <div className="text-sm text-slate-600">{rule.snippet || "—"}</div>
                  </button>
                </li>
              ))}
            </ul>

            {drawerOpen ? (
              <div
                className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
                role="dialog"
                aria-modal="true"
                aria-label="Rule detail"
                onClick={closeDrawer}
              >
                <div
                  className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        <span>
                          Rule{" "}
                          <span className="break-words font-mono text-xs text-slate-600">
                            {activeRuleId ?? "—"}
                          </span>
                        </span>
                        <span className={`rounded-full px-2.5 py-1 normal-case tracking-normal ${activeRuleStatus.tone}`}>
                          {activeRuleStatus.label}
                        </span>
                      </div>
                      <div
                        ref={ruleHeaderRef}
                        tabIndex={-1}
                        className="mt-2 text-base font-semibold text-slate-900"
                      >
                        {ruleDetail?.title ?? "Loading…"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!activeRuleId || !activeVersion) return;
                          try {
                            await navigator.clipboard.writeText(buildRuleLink(activeRuleId));
                          } catch {}
                        }}
                        className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
                      >
                        Copy link
                      </button>
                      <button
                        type="button"
                        onClick={closeDrawer}
                        className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[78vh] overflow-y-auto px-5 py-4">
                    {ruleDetailError ? (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        <div className="font-semibold text-rose-900">Failed to load rule.</div>
                        <div className="mt-1 text-xs text-rose-700">{ruleDetailError}</div>
                        <button
                          type="button"
                          className="mt-3 inline-flex items-center rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-800 shadow-sm hover:border-rose-300 hover:text-rose-900"
                          onClick={() => {
                            if (activeRuleId) {
                              void loadRuleDetail(activeRuleId);
                            }
                          }}
                        >
                          Retry
                        </button>
                      </div>
                    ) : null}
                    {ruleDetailLoading ? (
                      <div className="text-sm text-slate-600">Loading rule…</div>
                    ) : null}

                    {ruleDetail ? (
                      <div className="space-y-4">
                        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                            {ruleDetail.tags.length ? (
                              <span className="rounded-full bg-white px-3 py-1 font-medium shadow-sm">
                                tags: {ruleDetail.tags.slice(0, 4).join(", ")}
                              </span>
                            ) : null}
                            {ruleDetail.type ? (
                              <span className="rounded-full bg-white px-3 py-1 font-medium shadow-sm">
                                type: {ruleDetail.type}
                              </span>
                            ) : null}
                            {ruleDetail.sectionId ? (
                              <span className="rounded-full bg-white px-3 py-1 font-medium shadow-sm">
                                section: {ruleDetail.sectionId}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-3 text-sm text-slate-700">{activeRuleStatus.detail}</div>
                        </section>

                        <section className="rounded-2xl border border-slate-200 bg-white p-5">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Rule text</div>
                          <div className="mt-3 text-sm leading-relaxed text-slate-800">
                            {ruleDetail.logic?.trim() || ruleDetail.text || "—"}
                          </div>
                        </section>

                        <section className="rounded-2xl border border-slate-200 bg-white p-5">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Grounded method passage
                          </div>
                          <div className="mt-3 space-y-3">
                            {traceError ? (
                              <div className="text-xs text-rose-700">Trace unavailable: {traceError}</div>
                            ) : traceLoading && groundedPassages.length === 0 ? (
                              <div className="text-sm text-slate-600">Loading linked method sections…</div>
                            ) : groundedPassages.length ? (
                              groundedPassages.slice(0, 4).map((passage) => (
                                <div
                                  key={`${passage.sectionId ?? "fallback"}-${passage.source}`}
                                  className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                      <div className="font-mono text-xs text-slate-700">
                                        {passage.sectionId ?? "method"}
                                      </div>
                                      <div className="mt-1 text-sm font-semibold text-slate-900">
                                        {passage.title}
                                      </div>
                                    </div>
                                    {passage.sectionId ? (
                                      <button
                                        type="button"
                                        className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                                        onClick={(event) => goToSectionFromTrace(event, passage.sectionId!)}
                                      >
                                        Preview section
                                      </button>
                                    ) : null}
                                  </div>
                                  <div className="mt-2 text-sm leading-relaxed text-slate-700">
                                    {passage.text}
                                  </div>
                                  <div className="mt-3 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                                    {passage.source === "rich-passage"
                                      ? "Rich passage"
                                      : passage.source === "section-excerpt"
                                        ? "Section excerpt"
                                        : "Lean fallback"}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-slate-600">No grounded section links are available yet.</div>
                            )}
                          </div>
                        </section>

                        <section className="rounded-2xl border border-slate-200 bg-white p-5">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Project evidence
                          </div>
                          <div className="mt-3 space-y-3">
                            {ruleEvidencePins.length ? (
                              ruleEvidencePins.slice(0, 6).map((pin) => (
                                <div key={pin.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                      <div className="text-sm font-semibold text-slate-900">{pin.title || pin.id}</div>
                                      <div className="mt-1 text-xs text-slate-500">
                                        {pin.kind} • {pin.created_at}
                                      </div>
                                    </div>
                                    <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
                                      {pin.attachments?.length ?? 0} attachment{(pin.attachments?.length ?? 0) === 1 ? "" : "s"}
                                    </div>
                                  </div>
                                  <div className="mt-2 text-sm text-slate-700">{pin.note?.trim() || "No reviewer note saved."}</div>
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-slate-600">No project evidence is linked to this rule yet.</div>
                            )}
                          </div>
                        </section>

                        <section className="rounded-2xl border border-slate-200 bg-white p-5">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Reasoning and assessment
                          </div>
                          <div className="mt-3 space-y-3">
                            {ruleEvidenceRuns.length ? (
                              ruleEvidenceRuns.slice(0, 4).map((run) => (
                                <div key={run.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="text-sm font-semibold text-slate-900">{run.id}</div>
                                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium uppercase text-slate-700 shadow-sm">
                                      {run.status}
                                    </span>
                                  </div>
                                  <div className="mt-2 text-sm text-slate-700">{run.summary?.trim() || "No assessment summary saved."}</div>
                                  <div className="mt-2 text-xs text-slate-500">
                                    Created {run.created_at}
                                    {run.ended_at ? ` • Ended ${run.ended_at}` : ""}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-slate-600">
                                No verification assessment has been recorded for this rule yet.
                              </div>
                            )}
                          </div>
                        </section>

                        <section className="rounded-2xl border border-slate-200 bg-white p-5">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Provenance</div>
                          <div className="mt-3 grid gap-3 text-sm text-slate-700">
                            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Source metadata
                              </div>
                              <div className="mt-3 grid gap-2 text-xs text-slate-600">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-semibold text-slate-700">sha256</span>
                                  <span className="break-all font-mono text-slate-700">{ruleDetail.sha256 ?? "—"}</span>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-semibold text-slate-700">source</span>
                                  <span className="break-all font-mono text-slate-700">{ruleDetail.sourcePath ?? "—"}</span>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-semibold text-slate-700">anchor</span>
                                  <span className="break-all font-mono text-slate-700">{ruleDetail.anchor ?? "—"}</span>
                                </div>
                              </div>
                            </div>
                            {ruleCitationSectionIds.length ? (
                              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                  Cited sections
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {ruleCitationSectionIds.map((target) => (
                                    <span key={target} className="rounded-full bg-white px-3 py-1 font-mono text-xs text-slate-700 shadow-sm">
                                      {target}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                            {method.hasRich && richEvidence?.citations.length ? (
                              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                  Rich citations
                                </div>
                                <div className="mt-3 grid gap-2">
                                  {richEvidence.citations.slice(0, 6).map((citation, index) => (
                                    <div key={`rich-citation-${index}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                                      <div className="font-semibold text-slate-900">
                                        {citation.sectionId ? `${citation.label} (${citation.sectionId})` : citation.label}
                                      </div>
                                      {citation.sectionId ? (
                                        <div className="mt-1 font-mono text-[11px] text-slate-600">{citation.sectionId}</div>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </section>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
    </div>
  );
}
