"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import VersionSelector from "@/app/m/_components/VersionSelector";
import { IntegrityDiffPanel } from "@/app/m/_components/IntegrityDiffPanel";
import TrustStrip from "@/components/TrustStrip";
import AssistantPanel from "@/components/assistant/AssistantPanel";
import ProofMapTab from "@/components/map/ProofMapTab";
import { normalizeRichEvidence, type NormalizedRichEvidence } from "@/lib/rich/normalize";
import {
  clearProofMapStorage,
  clearStoredMapView,
  loadAoi,
  loadEvidenceSnapshots,
  loadPins,
  loadVerificationRuns,
  saveAoi,
  savePins,
  saveVerificationRuns,
} from "@/lib/proofMap/storage";
import type { AOI, EvidencePin } from "@/lib/proofMap/types";
import type { VerificationRun } from "@/lib/proofMap/types";
import type { ProofEvidenceItem } from "@/lib/proof/bundle";
import { importProofBundleText } from "@/lib/proof/import";
import { applyUrlUpdates, parseDetailTab } from "@/lib/nav/urlState";

type DetailTab = "overview" | "assistant" | "map" | "versions" | "rules" | "sections" | "rich";

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
  initialSectionId?: string;
  packTag?: string | null;
  provenanceJson?: unknown | null;
  manifestRulesPath?: string | null;
};

function buildDeepLink(basePath: string, methodCode: string, version?: string) {
  const params = new URLSearchParams({ method: methodCode });
  if (version) params.set("version", version);
  return `${basePath}?${params.toString()}`;
}

function sectionIdFromText(value?: string): string | undefined {
  if (!value) return undefined;
  const match = value.match(/S-\d{1,6}/i);
  return match ? match[0] : undefined;
}

export default function MethodDetailPane({
  method,
  activeVersion,
  initialRuleId,
  initialSectionId,
  packTag,
  provenanceJson,
  manifestRulesPath,
}: MethodDetailPaneProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchString = searchParams.toString();
  const defaultTab: DetailTab = useMemo(
    () => (initialSectionId ? "sections" : initialRuleId ? "rules" : "overview"),
    [initialRuleId, initialSectionId],
  );
  const focusSectionParam = searchParams.get("section")?.trim() || null;
  const tab = useMemo(() => {
    const parsed = parseDetailTab(new URLSearchParams(searchString).get("tab"));
    return parsed ?? defaultTab;
  }, [defaultTab, searchString]);

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
  const [drawerOpen, setDrawerOpen] = useState(Boolean(initialRuleId));
  const [activeRuleId, setActiveRuleId] = useState<string | null>(initialRuleId ?? null);
  const [traceIndex, setTraceIndex] = useState<TraceIndex | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [ruleDetail, setRuleDetail] = useState<{
    id: string;
    title: string;
    text: string;
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
  const didOpenFromQuery = useRef(false);

  type SectionListItem = {
    id: string;
    title: string;
    level: number;
    anchor?: string;
    page?: number;
    textSnippet?: string;
  };

  const [sectionQuery, setSectionQuery] = useState("");
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [sectionsError, setSectionsError] = useState<string | null>(null);
  const [sectionsDeeplinkWarning, setSectionsDeeplinkWarning] = useState<string | null>(null);
  const [sections, setSections] = useState<SectionListItem[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(initialSectionId ?? null);
  const sectionIds = useMemo(() => new Set(sections.map((s) => s.id)), [sections]);
  const didSelectSectionFromQuery = useRef(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [evidenceLinkSelection, setEvidenceLinkSelection] = useState<{
    kind: "evidence";
    id: string;
    ruleIds: string[];
    sectionIds: string[];
  } | null>(null);
  const lastAppliedFocusFromUrl = useRef<string | null>(null);

  const [aoi, setAoi] = useState<AOI | null>(null);
  const [evidencePins, setEvidencePins] = useState<EvidencePin[]>([]);
  const [evidenceSnapshots, setEvidenceSnapshots] = useState<ProofEvidenceItem[]>([]);
  const [verificationRuns, setVerificationRuns] = useState<VerificationRun[]>([]);
  type StacEvidenceState = {
    aoiFingerprint: string;
    fc: GeoJSON.FeatureCollection;
    itemsById: Record<string, unknown>;
    runId: string;
    source?: { type: "stac_url" | "unknown"; ref: string };
  };
  const [stacEvidenceByKey, setStacEvidenceByKey] = useState<Record<string, StacEvidenceState>>({});
  const [selectedStacItemId, setSelectedStacItemId] = useState<string | null>(null);

  const [richLoading, setRichLoading] = useState(false);
  const [richError, setRichError] = useState<string | null>(null);
  const [richEvidence, setRichEvidence] = useState<NormalizedRichEvidence | null>(null);
  const [richRaw, setRichRaw] = useState<unknown>(null);
  type RichAttempt = {
    name: string;
    url: string;
    resolvedUrl?: string;
    status?: number;
    ok: boolean;
    bytes?: number;
    error?: string;
  };
  const [richProbe, setRichProbe] = useState<{
    ok: boolean;
    sources: string[];
    missing: string[];
    attempts: RichAttempt[];
  } | null>(null);
  const [richRawOpen, setRichRawOpen] = useState(false);
  const [richOpenBlocks, setRichOpenBlocks] = useState({
    entities: false,
    tables: false,
    citations: false,
    diffs: false,
  });

  const sortedVersionsNewestFirst = useMemo(() => {
    return [...method.versions].reverse();
  }, [method.versions]);

  const evidenceKey = useMemo(() => {
    const ver = (activeVersion ?? "").trim();
    const aoiKey = (aoi?.aoi_fingerprint ?? aoi?.id ?? "").trim();
    if (!ver || !aoiKey) return null;
    return `${method.code}@${ver}::${aoiKey}`;
  }, [activeVersion, aoi?.aoi_fingerprint, aoi?.id, method.code]);

  const stacEvidenceState = evidenceKey ? stacEvidenceByKey[evidenceKey] ?? null : null;

  const activeRuleCount =
    (activeVersion ? method.ruleCountByVersion[activeVersion] : undefined) ?? undefined;

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
    didOpenFromQuery.current = false;
  }, [activeVersion, method.code]);

  useEffect(() => {
    if (!pathname) return;
    const urlTab = parseDetailTab(new URLSearchParams(searchString).get("tab"));
    if (urlTab) return;
    const next = applyUrlUpdates(new URLSearchParams(searchString), { tab });
    if (next === searchString) return;
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [pathname, router, searchString, tab]);

  useEffect(() => {
    if (!activeVersion) return;
    setAoi(loadAoi(method.code, activeVersion));
    setEvidencePins(loadPins(method.code, activeVersion));
    setEvidenceSnapshots(loadEvidenceSnapshots(method.code, activeVersion));
    setVerificationRuns(loadVerificationRuns(method.code, activeVersion));
  }, [activeVersion, method.code]);

  const setAoiAndPersist = useCallback(
    (nextAoi: AOI | null) => {
      setAoi(nextAoi);
      if (!activeVersion) return;
      saveAoi(method.code, activeVersion, nextAoi);
    },
    [activeVersion, method.code],
  );

  const setEvidencePinsAndPersist = useCallback(
    (nextPins: EvidencePin[]) => {
      setEvidencePins(nextPins);
      if (!activeVersion) return;
      savePins(method.code, activeVersion, nextPins);
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

  const startOverProofMap = useCallback(() => {
    if (!activeVersion) return;
    clearProofMapStorage(method.code, activeVersion);
    clearStoredMapView(`${method.code}@${activeVersion}`);

    setAoi(null);
    setEvidencePins([]);
    setEvidenceSnapshots([]);
    setVerificationRuns([]);
    setSelectedStacItemId(null);
    setEvidenceLinkSelection(null);

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
    setAoi(loadAoi(method.code, activeVersion));
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
    setSectionsError(null);
    setSectionsLoading(false);
    setSectionsDeeplinkWarning(null);
    setSectionQuery("");
    setActiveSectionId(null);
    didSelectSectionFromQuery.current = false;
  }, [activeVersion, method.code]);

  useEffect(() => {
    if (tab !== "sections") return;
    if (!focusSectionParam) return;
    if (!sectionIds.has(focusSectionParam)) return;
    if (activeSectionId === focusSectionParam) return;
    setActiveSectionId(focusSectionParam);
  }, [tab, focusSectionParam, sectionIds, activeSectionId]);

  useLayoutEffect(() => {
    if (!focusSectionParam) return;
    if (tab !== "sections") return;

    let cancelled = false;
    let tries = 0;

    const tick = () => {
      if (cancelled) return;
      const el = document.getElementById(`section-${focusSectionParam}`);
      if (el) {
        el.scrollIntoView({ block: "start" });
        return;
      }
      tries += 1;
      if (tries < 10) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
    return () => {
      cancelled = true;
    };
  }, [focusSectionParam, tab]);

  useEffect(() => {
    setRichEvidence(null);
    setRichRaw(null);
    setRichProbe(null);
    setRichError(null);
    setRichLoading(false);
    setRichRawOpen(false);
    setRichOpenBlocks({ entities: false, tables: false, citations: false, diffs: false });
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
      const path = `/m/${encodeURIComponent(method.code)}/v/${encodeURIComponent(
        activeVersion ?? "",
      )}?rule=${encodeURIComponent(ruleId)}`;
      return `${origin}${path}`;
    },
    [activeVersion, method.code],
  );

  const buildSectionLink = useCallback(
    (sectionId: string) => {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const path = `/m/${encodeURIComponent(method.code)}/v/${encodeURIComponent(
        activeVersion ?? "",
      )}?section=${encodeURIComponent(sectionId)}`;
      return `${origin}${path}`;
    },
    [activeVersion, method.code],
  );

  const buildAuditLink = useCallback(
    (ruleId: string) => {
      const params = new URLSearchParams({ method: method.code });
      if (activeVersion) params.set("version", activeVersion);
      params.set("rule", ruleId);
      const relative = `/audit?${params.toString()}`;
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      return { relative, absolute: `${origin}${relative}` };
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

  const setRuleParam = useCallback((ruleId?: string) => {
    if (!pathname) return;
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    if (ruleId) params.set("rule", ruleId);
    else params.delete("rule");
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }, [pathname, router]);

  const setSectionParam = useCallback(
    (sectionId?: string) => {
      if (!pathname) return;
      const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      if (sectionId) params.set("section", sectionId);
      else params.delete("section");
      const search = params.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const setFocusParam = useCallback((focusTab: "rules" | "sections", focusId: string) => {
    if (typeof window === "undefined") return;
    if (!pathname) return;
    const next = applyUrlUpdates(new URLSearchParams(searchString), { tab: focusTab, focus: focusId });
    if (next === searchString) return;
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [pathname, router, searchString]);

  const setTabParam = useCallback(
    (nextTab: DetailTab) => {
      if (!pathname) return;
      const params = new URLSearchParams(searchString);
      if (nextTab === "rules") params.delete("section");
      const next = applyUrlUpdates(params, {
        tab: nextTab,
        focus: null,
      });
      if (next === searchString) return;
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [pathname, router, searchString],
  );

  const onSelectSection = useCallback(
    (id: string) => {
      setActiveSectionId(id);
      if (!pathname) return;
      const params = new URLSearchParams(searchString);
      params.set("tab", "sections");
      params.set("section", id);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchString],
  );

  const goToSectionFromTrace = useCallback(
    (event: MouseEvent<HTMLButtonElement>, sectionId: string) => {
      event.preventDefault();
      event.stopPropagation();
      if (!pathname) return;
      const params = new URLSearchParams(searchString);
      params.set("tab", "sections");
      params.set("section", sectionId);
      params.delete("rule");
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
      setDrawerOpen(false);
      setActiveRuleId(null);
      setRuleDetail(null);
      setRuleDetailError(null);
      setRuleDetailLoading(false);
    },
    [pathname, router, searchString],
  );

  const ensureSectionsLoaded = useCallback(async (): Promise<SectionListItem[]> => {
    if (!activeVersion) return [];
    if (sections.length) return sections;
    if (sectionsLoading) return sections;
    setSectionsLoading(true);
    setSectionsError(null);
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
    } catch (error) {
      setSections([]);
      setSectionsError(error instanceof Error ? error.message : String(error));
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

  const ensureRichLoaded = useCallback(async (): Promise<NormalizedRichEvidence | null> => {
    if (!activeVersion) return null;
    if (richEvidence) return richEvidence;
    if (richLoading) return richEvidence;
    setRichLoading(true);
    setRichError(null);
    try {
      const ensureLeadingSlash = (value: string) => (value.startsWith("/") ? value : `/${value}`);
      const segment = (value: string) => encodeURIComponent(value);

      const program = method.program?.trim();
      const sector = method.sector?.trim();
      const code = method.code.trim();
      const version = activeVersion.trim();

      if (!program || program === "—" || !sector || sector === "—" || !code || !version) {
        setRichProbe({
          ok: false,
          sources: [],
          missing: ["rules.rich.json", "sections.rich.json", "rich.json"],
          attempts: [
            {
              name: "precheck",
              url: "/methodologies/<program>/<sector>/<code>/<ver>",
              ok: false,
              error: "Missing program/sector/code/version to resolve methodology asset URLs.",
            },
          ],
        });
        setRichRaw(null);
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
        candidates.map(async (candidate): Promise<RichAttempt & { data?: unknown }> => {
          try {
            const response = await fetch(candidate.url, { cache: "no-store" });
            const resolvedUrl = response.url || candidate.url;
            const status = response.status;
            if (!response.ok) {
              return { name: candidate.name, url: candidate.url, resolvedUrl, status, ok: false };
            }
            const text = await response.text();
            const bytes = text.length;
            const parsed = text ? JSON.parse(text) : null;
            return { name: candidate.name, url: candidate.url, resolvedUrl, status, ok: true, bytes, data: parsed };
          } catch (error) {
            return {
              name: candidate.name,
              url: candidate.url,
              resolvedUrl: candidate.url,
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }),
      );

      const sources = attempts.filter((a) => a.ok).map((a) => a.name);
      const missing = attempts
        .filter((a) => !a.ok && typeof a.status === "number" && a.status === 404)
        .map((a) => a.name);

      const data: { rulesRich?: unknown; sectionsRich?: unknown; rich?: unknown } = {};
      for (const attempt of attempts) {
        if (!attempt.ok) continue;
        if (attempt.name === "rules.rich.json") data.rulesRich = attempt.data;
        if (attempt.name === "sections.rich.json") data.sectionsRich = attempt.data;
        if (attempt.name === "rich.json") data.rich = attempt.data;
      }

      const ok = Boolean(sources.length);
      setRichProbe({
        ok,
        sources,
        missing,
        attempts: attempts.map((attempt) => ({
          name: attempt.name,
          url: attempt.url,
          resolvedUrl: attempt.resolvedUrl,
          status: attempt.status,
          ok: attempt.ok,
          bytes: attempt.bytes,
          error: attempt.error,
        })),
      });
      setRichRaw(ok ? data : null);

      const normalized = normalizeRichEvidence(ok ? data : null);
      setRichEvidence(normalized);
      return normalized;
    } catch (error) {
      setRichEvidence(null);
      setRichRaw(null);
      setRichProbe(null);
      setRichError(error instanceof Error ? error.message : String(error));
      return null;
    } finally {
      setRichLoading(false);
    }
  }, [activeVersion, method.code, method.program, method.sector, richEvidence, richLoading]);

  useEffect(() => {
    if (tab === "rules") void ensureRulesLoaded();
    if (tab === "sections") void ensureSectionsLoaded();
    if (tab === "rich") void ensureRichLoaded();
    if (tab === "assistant") void Promise.all([ensureRulesLoaded(), ensureSectionsLoaded()]);
  }, [ensureRichLoaded, ensureRulesLoaded, ensureSectionsLoaded, tab]);

  useEffect(() => {
    if (!activeRuleId) return;
    void ensureTraceLoaded();
  }, [activeRuleId, ensureTraceLoaded]);

  const openRule = useCallback(async (ruleId: string) => {
    setTabParam("rules");
    setRulesDeeplinkWarning(null);
    const list = await ensureRulesLoaded();
    if (list.length === 0) return;
    if (!list.some((rule) => rule.id === ruleId)) {
      setRulesDeeplinkWarning(`Unknown rule id "${ruleId}".`);
      return;
    }
    setActiveRuleId(ruleId);
    setDrawerOpen(true);
    setRuleParam(ruleId);
    await loadRuleDetail(ruleId);
  }, [ensureRulesLoaded, loadRuleDetail, setRuleParam, setTabParam]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setActiveRuleId(null);
    setRuleDetail(null);
    setRuleDetailError(null);
    setRuleParam(undefined);
  }, [setRuleParam]);

  const jumpToSection = useCallback(
    async (
      target: string,
      options?: {
        closeRuleDrawer?: boolean;
        missingLabel?: string;
      },
    ) => {
      if (!target) return;
      if (options?.closeRuleDrawer) closeDrawer();
      setTabParam("sections");
      const list = await ensureSectionsLoaded();
      if (!list.length) return;
      const exists = list.some((section) => section.id === target);
      if (!exists) {
        setSectionsDeeplinkWarning(`${options?.missingLabel ?? "Unknown section"}: ${target}`);
        return;
      }
      setSectionsDeeplinkWarning(null);
      setActiveSectionId(target);
      setSectionParam(target);
    },
    [closeDrawer, ensureSectionsLoaded, setSectionParam, setTabParam],
  );

  useEffect(() => {
    if (didOpenFromQuery.current) return;
    if (!initialRuleId) return;
    if (!activeVersion) return;
    didOpenFromQuery.current = true;
    (async () => {
      setTabParam("rules");
      const list = await ensureRulesLoaded();
      if (list.length === 0) {
        return;
      }
      const exists = list.some((rule) => rule.id === initialRuleId);
      if (!exists) {
        setRulesDeeplinkWarning(`Unknown rule id "${initialRuleId}".`);
        return;
      }
      await openRule(initialRuleId);
    })();
  }, [activeVersion, ensureRulesLoaded, initialRuleId, openRule, setTabParam]);

  const filteredSections = useMemo(() => {
    const q = sectionQuery.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter((section) => {
      const haystack = `${section.id} ${section.title} ${section.anchor ?? ""} ${section.page ?? ""} ${section.textSnippet ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [sectionQuery, sections]);

  useEffect(() => {
    if (!activeSectionId) return;
    const el = document.getElementById(`section-${activeSectionId}`);
    el?.scrollIntoView({ block: "start" });
  }, [activeSectionId, tab]);

  useEffect(() => {
    if (tab !== "rules") return;
    if (!activeRuleId) return;
    const el = document.getElementById(activeRuleId);
    el?.scrollIntoView({ block: "start" });
  }, [activeRuleId, tab]);

  const focusRuleInView = useCallback(
    async (ruleId: string) => {
      const list = await ensureRulesLoaded();
      if (!list.some((rule) => rule.id === ruleId)) return false;
      window.setTimeout(() => {
        document.getElementById(ruleId)?.scrollIntoView({ block: "start" });
        setHighlightId(ruleId);
        window.setTimeout(() => setHighlightId((current) => (current === ruleId ? null : current)), 1500);
      }, 0);
      return true;
    },
    [ensureRulesLoaded],
  );

  const focusSectionInView = useCallback(
    async (sectionId: string) => {
      const list = await ensureSectionsLoaded();
      if (!list.some((section) => section.id === sectionId)) return false;
      setSectionsDeeplinkWarning(null);
      setActiveSectionId(sectionId);
      setSectionParam(sectionId);
      window.setTimeout(() => {
        document.getElementById(`section-${sectionId}`)?.scrollIntoView({ block: "start" });
        setHighlightId(sectionId);
        window.setTimeout(() => setHighlightId((current) => (current === sectionId ? null : current)), 1500);
      }, 0);
      return true;
    },
    [ensureSectionsLoaded, setSectionParam],
  );

  const navigateToRule = useCallback(
    async (ruleId: string) => {
      const ok = await focusRuleInView(ruleId);
      if (!ok) return false;
      setFocusParam("rules", ruleId);
      return true;
    },
    [focusRuleInView, setFocusParam],
  );

  const navigateToSection = useCallback(
    async (sectionId: string) => {
      const ok = await focusSectionInView(sectionId);
      if (!ok) return false;
      setFocusParam("sections", sectionId);
      return true;
    },
    [focusSectionInView, setFocusParam],
  );

  const linkedRuleIds = useMemo(() => new Set(evidenceLinkSelection?.ruleIds ?? []), [evidenceLinkSelection]);
  const linkedSectionIds = useMemo(() => new Set(evidenceLinkSelection?.sectionIds ?? []), [evidenceLinkSelection]);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const focusTab = (params.get("tab") ?? "").trim();
    const focusId = (params.get("focus") ?? "").trim();
    const focusKey = focusId && (focusTab === "rules" || focusTab === "sections") ? `${focusTab}:${focusId}` : null;
    if (!focusKey) return;
    if (focusKey === lastAppliedFocusFromUrl.current) return;
    lastAppliedFocusFromUrl.current = focusKey;
    if (focusTab === "rules") void focusRuleInView(focusId);
    if (focusTab === "sections") void focusSectionInView(focusId);
  }, [focusRuleInView, focusSectionInView, searchString]);

  useEffect(() => {
    if (didSelectSectionFromQuery.current) return;
    if (!initialSectionId) return;
    if (!activeVersion) return;
    didSelectSectionFromQuery.current = true;
    (async () => {
      setTabParam("sections");
      const list = await ensureSectionsLoaded();
      if (list.length === 0) return;
      const exists = list.some((section) => section.id === initialSectionId);
      if (!exists) {
        setSectionsDeeplinkWarning(`Unknown section: ${initialSectionId}`);
        return;
      }
      setSectionsDeeplinkWarning(null);
      setActiveSectionId(initialSectionId);
      setSectionParam(initialSectionId);
    })();
  }, [activeVersion, ensureSectionsLoaded, initialSectionId, setSectionParam, setTabParam]);

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
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTabParam("overview")}
          className={`${tabBase} ${tab === "overview" ? tabActive : tabIdle}`}
          aria-pressed={tab === "overview"}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setTabParam("versions")}
          className={`${tabBase} ${tab === "versions" ? tabActive : tabIdle}`}
          aria-pressed={tab === "versions"}
        >
          Versions
        </button>
        <button
          type="button"
          onClick={() => setTabParam("rules")}
          className={`${tabBase} ${tab === "rules" ? tabActive : tabIdle}`}
          aria-pressed={tab === "rules"}
        >
          Rules
        </button>
        <button
          type="button"
          onClick={() => setTabParam("sections")}
          className={`${tabBase} ${tab === "sections" ? tabActive : tabIdle}`}
          aria-pressed={tab === "sections"}
        >
          Sections
        </button>
        <button
          type="button"
          onClick={() => setTabParam("rich")}
          className={`${tabBase} ${tab === "rich" ? tabActive : tabIdle}`}
          aria-pressed={tab === "rich"}
        >
          Rich
        </button>
        <button
          type="button"
          onClick={() => setTabParam("assistant")}
          className={`${tabBase} ${tab === "assistant" ? tabActive : tabIdle}`}
          aria-pressed={tab === "assistant"}
        >
          Assistant
        </button>
        <button
          type="button"
          onClick={() => setTabParam("map")}
          className={`${tabBase} ${tab === "map" ? tabActive : tabIdle}`}
          aria-pressed={tab === "map"}
        >
          Map
        </button>
      </div>

      {tab === "overview" ? (
        <div className="mt-4 grid gap-4">
          <div className="grid gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-slate-900">Selected version</span>
              <span className="font-mono text-xs text-slate-700">{activeVersion ?? "—"}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span>Rules: {typeof activeRuleCount === "number" ? activeRuleCount : "—"}</span>
              <span>Rich: {method.hasRich ? "Yes" : "No"} • Previous: {method.hasPrevious ? "Yes" : "No"}</span>
            </div>
          </div>

          <div className="grid gap-2 text-xs text-slate-600">
            <span className="text-xs text-slate-500">Provenance details are available in the TrustStrip.</span>
          </div>

          <IntegrityDiffPanel />

          <div className="flex flex-wrap gap-2">
            <Link
              href={buildDeepLink("/", method.code, activeVersion)}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
            >
              Open in Chat
            </Link>
            <Link
              href={buildDeepLink("/manifest", method.code, activeVersion)}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
            >
              Open in Manifest
            </Link>
            <Link
              href={buildDeepLink("/audit", method.code, activeVersion)}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
            >
              Open in Audit
            </Link>
          </div>
        </div>
      ) : tab === "assistant" ? (
        <AssistantPanel
          program={method.program}
          sector={method.sector}
          methodCode={method.code}
          version={activeVersion ?? ""}
          hasPrevious={method.hasPrevious}
          rules={rules}
          sections={sections}
          rich={richEvidence}
          manifestRulesPath={manifestRulesPath}
          packTag={packTag}
          provenanceJson={provenanceJson}
          aoi={aoi}
          evidencePins={evidencePins}
          onAddEvidencePin={(pin) => setEvidencePinsAndPersist([pin, ...evidencePins])}
          onNavigateEvidence={(type, id) => {
            if (type === "rule") return void navigateToRule(id);
            if (type === "section") return void navigateToSection(id);
          }}
        />
      ) : tab === "map" ? (
        <ProofMapTab
          methodCode={method.code}
          version={activeVersion ?? ""}
          provenanceJson={provenanceJson}
          aoi={aoi}
          evidencePins={evidencePins}
          verificationRuns={verificationRuns}
          stacEvidenceState={stacEvidenceState}
          selectedStacItemId={selectedStacItemId}
          evidenceSnapshots={evidenceSnapshots}
          onSetAoi={setAoiAndPersist}
          onStartOver={startOverProofMap}
          onSetEvidencePins={setEvidencePinsAndPersist}
          onSetVerificationRuns={setVerificationRunsAndPersist}
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
        />
      ) : tab === "versions" ? (
        <div className="mt-4 grid gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Available versions
          </div>
          <ul className="grid gap-2">
            {sortedVersionsNewestFirst.map((version) => {
              const selected = Boolean(activeVersion) && version === activeVersion;
              const count = method.ruleCountByVersion[version];
              return (
                <li key={version}>
                  <Link
                    href={`/m/${encodeURIComponent(method.code)}/v/${encodeURIComponent(version)}`}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                      selected
                        ? "border-slate-300 bg-slate-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                    aria-current={selected ? "page" : undefined}
                  >
                    <span className="font-mono text-sm text-slate-900">{version}</span>
                    <span className="text-xs text-slate-500">
                      rules: {typeof count === "number" ? count : "—"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        ) : tab === "rules" ? (
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
                  id={rule.id}
                  className={
                    highlightId === rule.id
                      ? "assistant-focus-highlight rounded-2xl ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-50"
                      : linkedRuleIds.has(rule.id)
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
              >
                <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Rule{" "}
                        <span className="break-words font-mono text-xs text-slate-600">
                          {activeRuleId ?? "—"}
                        </span>
                      </div>
                      <div className="mt-2 text-base font-semibold text-slate-900">
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

                  <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
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
                        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                          {ruleDetail.tags.length ? (
                            <span className="rounded-full bg-slate-100 px-3 py-1 font-medium">
                              tags: {ruleDetail.tags.slice(0, 4).join(", ")}
                            </span>
                          ) : null}
                          {ruleDetail.type ? (
                            <span className="rounded-full bg-slate-100 px-3 py-1 font-medium">
                              type: {ruleDetail.type}
                            </span>
                          ) : null}
                          {ruleDetail.sectionId ? (
                            <span className="rounded-full bg-slate-100 px-3 py-1 font-medium">
                              section: {ruleDetail.sectionId}
                            </span>
                          ) : null}
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">
                          {ruleDetail.text || "—"}
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Linked sections
                          </div>
                          <div className="mt-2 space-y-2">
                            {traceError ? (
                              <div className="text-xs text-rose-700">Trace unavailable: {traceError}</div>
                            ) : traceLoading ? (
                              <div className="text-xs text-slate-600">Loading links…</div>
                            ) : linkedTraceSections.length ? (
                              <div className="flex flex-wrap gap-2">
                                {linkedTraceSections.slice(0, 6).map((link) => (
                                  <button
                                    key={link.section_id}
                                    type="button"
                                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
                                    onClick={(event) => goToSectionFromTrace(event, link.section_id)}
                                  >
                                    <span className="font-mono">{link.section_id}</span>
                                    {link.title ? <span className="truncate">{link.title}</span> : null}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-slate-600">No linked sections yet.</div>
                            )}
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Evidence needed
                          </div>
                          <div className="mt-2 space-y-3">
                            {ruleCitationSectionIds.length ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                  Citations
                                </span>
                                {ruleCitationSectionIds.map((target) => (
                                  <button
                                    key={target}
                                    type="button"
                                    className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
                                    onClick={() =>
                                      void jumpToSection(target, {
                                        closeRuleDrawer: true,
                                        missingLabel: "Unresolved citation",
                                      })
                                    }
                                  >
                                    {target}
                                  </button>
                                ))}
                              </div>
                            ) : null}

                            {ruleCitationSectionIds.length || ruleDetail.sourcePath || ruleDetail.sha256 ? (
                              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                                {ruleCitationSectionIds.length ? (
                                  <li>
                                    Evidence anchor/section:{" "}
                                    {ruleCitationSectionIds.map((sectionId) => (
                                      <span
                                        key={sectionId}
                                        className="mr-2 inline-flex font-mono text-xs text-slate-700"
                                      >
                                        {sectionId}
                                      </span>
                                    ))}
                                  </li>
                                ) : null}
                                {ruleDetail.sourcePath ? (
                                  <li>
                                    Source file:{" "}
                                    <span className="break-all font-mono text-xs text-slate-700">
                                      {ruleDetail.sourcePath}
                                    </span>
                                  </li>
                                ) : null}
                                {ruleDetail.sha256 ? (
                                  <li>
                                    Rule hash:{" "}
                                    <span className="break-all font-mono text-xs text-slate-700">
                                      {ruleDetail.sha256}
                                    </span>
                                  </li>
                                ) : null}
                              </ul>
                            ) : (
                              <p className="text-sm text-slate-600">
                                Add evidence requirements for this rule (coming next).
                              </p>
                            )}

                            {activeRuleId ? (
                              <div className="flex flex-wrap gap-2">
                                <Link
                                  href={buildAuditLink(activeRuleId).relative}
                                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
                                >
                                  Open in Audit (scoped)
                                </Link>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(
                                        buildAuditLink(activeRuleId).absolute,
                                      );
                                    } catch {
                                      // ignore
                                    }
                                  }}
                                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
                                >
                                  Copy Audit link
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="grid gap-2 text-xs text-slate-600">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-slate-700">sha256</span>
                            <span className="break-all font-mono text-slate-700">
                              {ruleDetail.sha256 ?? "—"}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-slate-700">source</span>
                            <span className="break-all font-mono text-slate-700">
                              {ruleDetail.sourcePath ?? "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : tab === "sections" ? (
          <div className="mt-4 grid gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Sections for {activeVersion ?? "—"}
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                {activeSectionId ? (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(buildSectionLink(activeSectionId));
                      } catch {
                        // ignore
                      }
                    }}
                  >
                    Copy section link
                  </button>
                ) : null}
                <input
                  type="search"
                  value={sectionQuery}
                  onChange={(event) => setSectionQuery(event.target.value)}
                  placeholder="Search sections…"
                  className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none sm:max-w-xs"
                />
              </div>
            </div>

            {sectionsDeeplinkWarning ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {sectionsDeeplinkWarning}
              </div>
            ) : null}

            {sectionsError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {sectionsError}
              </div>
            ) : null}

            {sectionsLoading ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Loading sections…
              </div>
            ) : null}

            {!sectionsLoading && !sectionsError && filteredSections.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
                No sections found for this version.
              </div>
            ) : null}

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="max-h-[22rem] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
                <ul className="grid gap-2">
                  {filteredSections.map((section) => {
                    const selected = section.id === activeSectionId;
                    const linked = linkedSectionIds.has(section.id);
                    return (
                      <li
                        key={section.id}
                        id={`section-${section.id}`}
                        className={
                          highlightId === section.id
                            ? "assistant-focus-highlight rounded-xl ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-50"
                            : linked
                              ? "rounded-xl ring-1 ring-sky-200 ring-offset-2 ring-offset-slate-50"
                            : ""
                        }
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSectionsDeeplinkWarning(null);
                            onSelectSection(section.id);
                            setSectionParam(section.id);
                          }}
                          className={`flex w-full flex-col gap-1 rounded-lg border px-3 py-2 text-left transition-colors ${
                            selected
                              ? "border-slate-300 bg-slate-50"
                              : linked
                                ? "border-sky-200 bg-sky-50/30 hover:bg-slate-50"
                                : "border-slate-200 bg-white hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-slate-900">{section.title}</span>
                            <span className="text-xs text-slate-500">
                              {section.page ? `p.${section.page}` : section.anchor ? "anchor" : "—"}
                            </span>
                          </div>
                          <div className="font-mono text-xs text-slate-500">{section.id}</div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Section preview
                </div>
                {activeSectionId ? (
                  <>
                    <div className="mt-2 font-mono text-xs text-slate-600">{activeSectionId}</div>
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
                      {sections.find((section) => section.id === activeSectionId)?.textSnippet ?? "—"}
                    </div>
                  </>
                ) : (
                  <div className="mt-3 text-sm text-slate-600">
                    Select a section to preview its snippet.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Rich evidence for {activeVersion ?? "—"}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
                  onClick={() => setRichRawOpen(true)}
                  disabled={!richRaw}
                >
                  View raw JSON
                </button>
              </div>
            </div>

            {richProbe ? (
              <div className="text-xs text-slate-500">
                {richProbe.ok && richProbe.sources.length
                  ? `Rich sources: ${richProbe.sources.join(", ")}`
                  : richProbe.missing.length
                    ? `Rich sources missing: ${richProbe.missing.join(", ")}`
                    : "Rich sources missing."}
              </div>
            ) : null}

            {richError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {richError}
              </div>
            ) : null}

            {richLoading ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Loading rich evidence…
              </div>
            ) : null}

            {!richLoading && !richError && richEvidence ? (
              <div className="grid gap-3">
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["Entities", richEvidence.entities.length, "entities"],
                      ["Tables", richEvidence.tables.length, "tables"],
                      ["Citations", richEvidence.citations.length, "citations"],
                      ["Diffs", richEvidence.diffs.length, "diffs"],
                    ] as const
                  ).map(([label, count, key]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setRichOpenBlocks((prev) => ({ ...prev, [key]: !prev[key] }))
                      }
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm ${
                        richOpenBlocks[key]
                          ? "border-slate-300 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900"
                      }`}
                    >
                      <span>{label}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] ${
                          richOpenBlocks[key] ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  ))}
                </div>

                {richEvidence.entities.length === 0 &&
                richEvidence.tables.length === 0 &&
                richEvidence.citations.length === 0 &&
                richEvidence.diffs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
                    No rich evidence for this version yet.
                    <div className="mt-1 text-xs text-slate-400">
                      Run rich extraction in the pipeline to populate.
                    </div>
                    {richProbe && (richProbe.missing.length || richProbe.attempts.length) ? (
                      <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left">
                        <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                          Why empty?
                        </summary>
                        <div className="mt-3 grid gap-3 text-xs text-slate-600">
                          {richProbe.missing.length ? (
                            <div>
                              <div className="font-semibold text-slate-700">Missing</div>
                              <div className="mt-1">{richProbe.missing.join(", ")}</div>
                            </div>
                          ) : null}
                          {richProbe.attempts.length ? (
                            <div>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="font-semibold text-slate-700">Attempted URLs</div>
                                <button
                                  type="button"
                                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(
                                        richProbe.attempts
                                          .map((attempt) => {
                                            const status = typeof attempt.status === "number" ? attempt.status : "—";
                                            const resolved = attempt.resolvedUrl ?? attempt.url;
                                            return `${attempt.name} ${status} ${resolved}`;
                                          })
                                          .join("\n"),
                                      );
                                    } catch {
                                      // ignore
                                    }
                                  }}
                                >
                                  Copy attempted status
                                </button>
                              </div>
                              <ul className="mt-2 grid gap-2 rounded-lg bg-white px-3 py-2 text-[11px] text-slate-700">
                                {richProbe.attempts.map((attempt) => (
                                  <li key={attempt.name} className="grid gap-1">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <span className="font-mono font-semibold">{attempt.name}</span>
                                      <span className="font-mono">
                                        {typeof attempt.status === "number" ? attempt.status : attempt.ok ? "ok" : "—"}
                                      </span>
                                    </div>
                                    <div className="break-all font-mono text-slate-600">
                                      {attempt.resolvedUrl ?? attempt.url}
                                    </div>
                                    {attempt.error ? (
                                      <div className="break-all font-mono text-rose-700">{attempt.error}</div>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      </details>
                    ) : null}
                  </div>
                ) : null}

                {richOpenBlocks.entities ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900">Entities</div>
                    {richEvidence.entities.length ? (
                      <div className="mt-3 grid gap-4">
                        {Object.entries(
                          richEvidence.entities.reduce<Record<string, typeof richEvidence.entities>>(
                            (acc, entity) => {
                              const key = entity.type || "Unknown";
                              acc[key] = acc[key] ? [...acc[key], entity] : [entity];
                              return acc;
                            },
                            {},
                          ),
                        )
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([type, items]) => (
                            <div key={type}>
                              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                {type} ({items.length})
                              </div>
                              <ul className="mt-2 grid gap-1 text-sm text-slate-700">
                                {items.slice(0, 12).map((entity, index) => (
                                  <li key={`${type}-${index}`} className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700">
                                      {entity.value}
                                    </span>
                                    {typeof entity.confidence === "number" ? (
                                      <span className="text-xs text-slate-500">
                                        conf: {entity.confidence.toFixed(2)}
                                      </span>
                                    ) : null}
                                    {entity.sectionId ? (
                                      <button
                                        type="button"
                                        className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900"
                                        onClick={() => void jumpToSection(entity.sectionId ?? "")}
                                      >
                                        {entity.sectionId}
                                      </button>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-slate-600">No entities extracted.</div>
                    )}
                  </div>
                ) : null}

                {richOpenBlocks.tables ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900">Tables</div>
                    {richEvidence.tables.length ? (
                      <div className="mt-3 grid gap-4">
                        {richEvidence.tables.map((table, index) => (
                          <div key={`table-${index}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-sm font-semibold text-slate-900">
                                {table.title ?? `Table ${index + 1}`}
                              </div>
                              <div className="text-xs text-slate-500">rows: {table.rows.length}</div>
                            </div>
                            {table.sectionId ? (
                              <button
                                type="button"
                                className="mt-2 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900"
                                onClick={() => void jumpToSection(table.sectionId ?? "")}
                              >
                                section {table.sectionId}
                              </button>
                            ) : null}
                            <div className="mt-3 overflow-auto rounded-lg bg-white">
                              <pre className="min-w-full whitespace-pre-wrap px-3 py-2 text-xs text-slate-700">
                                {JSON.stringify(table.rows.slice(0, 12), null, 2)}
                              </pre>
                              {table.rows.length > 12 ? (
                                <div className="px-3 pb-2 text-xs text-slate-500">
                                  Showing first 12 rows (expand extraction for full data).
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-slate-600">No tables extracted.</div>
                    )}
                  </div>
                ) : null}

                {richOpenBlocks.citations ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900">Citations</div>
                    {richEvidence.citations.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {richEvidence.citations.slice(0, 60).map((citation, index) => (
                          <button
                            key={`citation-${index}`}
                            type="button"
                            disabled={!citation.sectionId}
                            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm ${
                              citation.sectionId
                                ? "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900"
                                : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
                            }`}
                            onClick={async () => {
                              const target = citation.sectionId;
                              if (!target) return;
                              await jumpToSection(target);
                            }}
                          >
                            {citation.sectionId ? `${citation.label} (${citation.sectionId})` : citation.label}
                          </button>
                        ))}
                        {richEvidence.citations.length > 60 ? (
                          <div className="text-xs text-slate-500">
                            Showing first 60 citations.
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-slate-600">No citations extracted.</div>
                    )}
                  </div>
                ) : null}

                {richOpenBlocks.diffs ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900">Diffs / Changes</div>
                    {richEvidence.diffs.length ? (
                      <ul className="mt-3 grid gap-2">
                        {richEvidence.diffs.slice(0, 40).map((diff, index) => (
                          <li key={`diff-${index}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-sm font-semibold text-slate-900">{diff.label}</div>
                              {diff.sectionId ? (
                                <button
                                  type="button"
                                  className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900"
                                  onClick={() => void jumpToSection(diff.sectionId ?? "")}
                                >
                                  section {diff.sectionId}
                                </button>
                              ) : null}
                            </div>
                            {diff.from || diff.to ? (
                              <div className="mt-2 grid gap-1 text-xs text-slate-700">
                                {diff.from ? <div>from: {diff.from}</div> : null}
                                {diff.to ? <div>to: {diff.to}</div> : null}
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="mt-2 text-sm text-slate-600">No diffs available.</div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            {richRawOpen ? (
              <div
                className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
                role="dialog"
                aria-modal="true"
                aria-label="Raw rich JSON"
                onClick={() => setRichRawOpen(false)}
              >
                <div
                  className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Raw JSON</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {method.code} · {activeVersion ?? "—"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRichRawOpen(false)}
                      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
                    >
                      Close
                    </button>
                  </div>
                  <div className="max-h-[70vh] overflow-auto px-5 py-4">
                    <pre className="whitespace-pre-wrap text-xs text-slate-800">
                      {JSON.stringify(richRaw, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
    </div>
  );
}
