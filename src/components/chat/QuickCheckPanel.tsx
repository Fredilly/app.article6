"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Loader2,
  SearchCheck,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import type { RuleSummary } from "@/app/m/_lib/methodRules";
import { retrieveQuery, type QueryResponse } from "@/lib/chat/client";
import {
  analyzeQuickCheckEvidence,
  buildLocalRuleCandidates,
  buildQuickCheckQueryTexts,
  classifyQuickCheckClaimIntents,
  type QuickCheckClaimIntent,
  type QuickCheckEvidenceAnalysis,
} from "@/lib/chat/quickCheckEvidence";
import {
  buildQuickCheckResult,
  ensureQuickCheckWorkspaceHandoff,
  loadQuickCheckInventory,
  loadQuickCheckSession,
  saveQuickCheckSession,
  validateQuickCheckDraft,
  type QuickCheckDraft,
  type QuickCheckExtractionSnapshot,
  type QuickCheckResult,
  type QuickCheckSourceMode,
  type QuickCheckStagedUpload,
} from "@/lib/chat/quickCheck";
import { buildQuickCheckDemoCandidate, prepareQuickCheckDemo, QUICK_CHECK_DEMO } from "@/lib/chat/quickCheckDemo";
import {
  resolveQuickCheckCandidate,
  resolveQuickCheckCandidates,
  type QuickCheckResolvedCandidate,
} from "@/lib/chat/quickCheckResolver";
import { buildQuickCheckExtractionSnapshot, deriveQuickCheckExtractionState, normalizeQuickCheckUiResult } from "@/lib/chat/quickCheckUi";
import { coalesceEvidencePins, type EvidenceInventoryItem } from "@/lib/evidence/inventory";
import { createAndStoreEvidenceAttachment } from "@/lib/proofMap/attachments";
import { isRuleLikeId } from "@/lib/proofMap/pins";
import { loadPins, savePins } from "@/lib/proofMap/storage";
import type { EvidencePin, PddFragment } from "@/lib/proofMap/types";

type MethodInventoryRecord = {
  code: string;
  versions: string[];
  latestVersion?: string;
};

type QuickCheckPanelProps = {
  initialMethod?: string | null;
  initialVersion?: string | null;
  onContinueToWorkspace?: (url: string) => void;
};

type MatchCandidate = {
  key: string;
  methodologyId: string;
  methodologyVersion: string;
  requirementId: string;
  requirementLabel: string;
  score: number | null;
};

type ResolvedMatchCandidate = QuickCheckResolvedCandidate<MatchCandidate>;

type QuickCheckSessionState = {
  draft: QuickCheckDraft;
  result: QuickCheckResult | null;
  stagedUploads: QuickCheckStagedUpload[];
};

type ExtractionState = {
  loading: boolean;
  analysis: QuickCheckEvidenceAnalysis | null;
  error: string | null;
};

type FieldErrors = {
  claim?: string;
  evidence?: string;
  general?: string;
};

type RecoveryState =
  | {
      kind: "no-match";
      title: string;
      description: string;
      note?: string;
    }
  | {
      kind: "weak-extraction";
      title: string;
      description: string;
      note?: string;
    }
  | null;

type QueryResultWithSignals = QueryResponse["results"][number] & {
  _signalBoost: number;
  _matchedQueries: string[];
};

type MethodologyEvidenceSignals =
  | Pick<QuickCheckEvidenceAnalysis, "methodologyMentions">
  | Pick<QuickCheckExtractionSnapshot, "methodologyMentions">
  | null
  | undefined;

const CLAIM_SUGGESTIONS = [
  "The monitoring report covers the full reporting period.",
  "The boundary description matches the mapped project area.",
  "The baseline methodology is clearly justified by the evidence.",
];

function nowIso(): string {
  return new Date().toISOString();
}

function newPinId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `pin-${nowIso()}-${Math.random().toString(16).slice(2)}`;
}

function pickVersion(method: MethodInventoryRecord | undefined, preferred?: string | null): string {
  if (!method) return preferred?.trim() ?? "";
  if (preferred?.trim() && method.versions.includes(preferred.trim())) return preferred.trim();
  return method.latestVersion ?? method.versions[0] ?? "";
}

function pickRequirementLabel(result: QueryResponse["results"][number]): string {
  const explicit =
    (typeof result.section_title === "string" && result.section_title.trim()) ||
    (typeof result.sectionTitle === "string" && result.sectionTitle.trim()) ||
    (typeof result.text === "string" && result.text.trim()) ||
    "";
  return explicit || result.id;
}

function boostForEvidenceFacts(
  result: QueryResultWithSignals,
  analysis: QuickCheckEvidenceAnalysis,
  claimIntents: QuickCheckClaimIntent[],
): number {
  const haystack = `${pickRequirementLabel(result)} ${result.text ?? ""} ${(result.tags ?? []).join(" ")} ${(result.refs ?? []).join(" ")}`.toLowerCase();
  let boost = 0;
  const prefersBoundaryLocation = claimIntents.some((intent) =>
    intent === "boundary" ||
    intent === "project-area" ||
    intent === "mapped-area" ||
    intent === "aoi" ||
    intent === "coordinates" ||
    intent === "location",
  );
  const prefersMonitoring = claimIntents.includes("monitoring-plan");
  for (const fact of analysis.facts) {
    if (fact.category === "boundary" && haystack.includes("boundary")) boost += prefersMonitoring ? 0.04 : 0.16;
    if (fact.category === "coordinates" && (haystack.includes("coordinate") || haystack.includes("location") || haystack.includes("boundary"))) boost += prefersMonitoring ? 0.04 : 0.16;
    if (fact.category === "mapped-area" && (haystack.includes("mapped area") || haystack.includes("project area") || haystack.includes("aoi") || haystack.includes("polygon") || haystack.includes("map") || haystack.includes("boundary"))) boost += prefersMonitoring ? 0.05 : 0.18;
    if (fact.category === "project-location" && (haystack.includes("location") || haystack.includes("boundary") || haystack.includes("area") || haystack.includes("map"))) boost += prefersMonitoring ? 0.04 : 0.14;
    if (fact.category === "monitoring-plan" && haystack.includes("monitoring")) boost += prefersBoundaryLocation ? 0.1 : 0.16;
    if (fact.category === "workbook-reference" && (haystack.includes("workbook") || haystack.includes("spreadsheet"))) boost += prefersBoundaryLocation ? 0.08 : 0.12;
    if (fact.category === "monitoring-evidence" && haystack.includes("monitoring")) boost += prefersBoundaryLocation ? 0.06 : 0.1;
    if (fact.category === "plot-count" && (haystack.includes("plot") || haystack.includes("sampling") || haystack.includes("monitoring"))) boost += 0.12;
    if (fact.category === "reporting-period" && (haystack.includes("period") || haystack.includes("monitoring"))) boost += 0.12;
    if (fact.category === "monitoring-records" && (haystack.includes("monitoring") || haystack.includes("workbook"))) boost += prefersBoundaryLocation ? 0.06 : 0.1;
    if (fact.category === "qa-summary" && (haystack.includes("quality") || haystack.includes("review") || haystack.includes("qa"))) boost += 0.08;
  }
  return Math.min(boost, 0.4);
}

function boostForClaimIntents(result: QueryResultWithSignals, claimIntents: QuickCheckClaimIntent[]): number {
  const haystack = `${pickRequirementLabel(result)} ${result.text ?? ""} ${(result.tags ?? []).join(" ")} ${(result.refs ?? []).join(" ")}`.toLowerCase();
  let boost = 0;
  for (const intent of claimIntents) {
    if (intent === "boundary" && haystack.includes("boundary")) boost += 0.16;
    if (intent === "project-area" && (haystack.includes("project area") || haystack.includes("boundary") || haystack.includes("area"))) boost += 0.12;
    if (intent === "mapped-area" && (haystack.includes("mapped area") || haystack.includes("map") || haystack.includes("boundary") || haystack.includes("aoi"))) boost += 0.15;
    if (intent === "aoi" && (haystack.includes("aoi") || haystack.includes("area of interest") || haystack.includes("polygon") || haystack.includes("boundary"))) boost += 0.14;
    if (intent === "coordinates" && (haystack.includes("coordinate") || haystack.includes("location") || haystack.includes("boundary"))) boost += 0.14;
    if (intent === "location" && (haystack.includes("location") || haystack.includes("site") || haystack.includes("boundary"))) boost += 0.12;
    if (intent === "monitoring-plan" && haystack.includes("monitoring")) boost += 0.12;
  }
  return Math.min(boost, 0.36);
}

function boostForClaimPhrases(result: QueryResultWithSignals, claimText: string): number {
  const haystack = `${pickRequirementLabel(result)} ${result.text ?? ""} ${(result.tags ?? []).join(" ")} ${(result.refs ?? []).join(" ")}`.toLowerCase();
  const claim = claimText.trim().toLowerCase();
  let boost = 0;

  if (claim.includes("monitoring report") && haystack.includes("report")) boost += 0.12;
  if (claim.includes("reporting period") && (haystack.includes("period") || haystack.includes("frequency"))) boost += 0.09;
  if (claim.includes("mapped project area") && (haystack.includes("mapped area") || haystack.includes("boundary"))) boost += 0.06;

  return Math.min(boost, 0.24);
}

function buildMatchCandidates(
  results: QueryResultWithSignals[],
  methods: MethodInventoryRecord[],
  selectedMethodologyId: string,
  selectedMethodologyVersion: string,
  claimText: string,
  analysis: QuickCheckEvidenceAnalysis,
  claimIntents: QuickCheckClaimIntent[],
): MatchCandidate[] {
  const selectedMethod = selectedMethodologyId.trim();
  const selectedVersion = selectedMethodologyVersion.trim();
  const unique = new Map<string, MatchCandidate>();

  for (const result of results) {
    const methodologyId =
      (typeof result.methodology_id === "string" && result.methodology_id.trim()) ||
      (typeof result.methodologyId === "string" && result.methodologyId.trim()) ||
      "";
    if (!methodologyId) continue;
    if (selectedMethod && methodologyId !== selectedMethod) continue;

    const methodRecord = methods.find((item) => item.code === methodologyId);
    const methodologyVersion =
      (typeof result.methodology_version === "string" && result.methodology_version.trim()) ||
      (typeof result.methodologyVersion === "string" && result.methodologyVersion.trim()) ||
      pickVersion(methodRecord);
    if (!methodologyVersion) continue;
    if (selectedMethod && selectedVersion && methodologyVersion !== selectedVersion) continue;

    const requirementId = result.id?.trim();
    if (!requirementId) continue;
    if (!isRuleLikeId(requirementId)) continue;

    const key = `${methodologyId}@@${methodologyVersion}@@${requirementId}`;
    if (unique.has(key)) continue;
    const baseScore = typeof result.score === "number" ? result.score : 0;
    const score = Number(
      (
        baseScore +
        result._signalBoost +
        boostForEvidenceFacts(result, analysis, claimIntents) +
        boostForClaimIntents(result, claimIntents) +
        boostForClaimPhrases(result, claimText)
      ).toFixed(4),
    );
    unique.set(key, {
      key,
      methodologyId,
      methodologyVersion,
      requirementId,
      requirementLabel: `${requirementId} · ${pickRequirementLabel(result)}`,
      score,
    });
  }

  return Array.from(unique.values())
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.requirementLabel.localeCompare(b.requirementLabel))
    .slice(0, 4);
}

function claimPrefersMonitoringRequirement(claimText: string, claimIntents: QuickCheckClaimIntent[]): boolean {
  const normalized = claimText.toLowerCase();
  return claimIntents.includes("monitoring-plan") || /monitoring\s+(report|plan|approach|procedure|evidence)|reporting period/.test(normalized);
}

function candidateLooksMonitoringAligned(candidate: MatchCandidate): boolean {
  return /monitoring|reporting period|report\b|workbook|sampling|plot/.test(candidate.requirementLabel.toLowerCase());
}

function isAmbiguousMatch(candidates: MatchCandidate[]): boolean {
  if (candidates.length <= 1) return false;
  const [first, second] = candidates;
  if (!first || !second) return false;
  if (first.score == null || second.score == null) return true;
  return Math.abs(first.score - second.score) < 0.035;
}

function requiresMethodologyConfirmation(candidates: MatchCandidate[]): boolean {
  if (candidates.length <= 1) return false;
  const [first] = candidates;
  if (!first) return false;
  const closestOtherMethod = candidates.find((candidate) => candidate.methodologyId !== first.methodologyId) ?? null;
  if (!closestOtherMethod) return false;
  if (first.score == null || closestOtherMethod.score == null) return true;
  return Math.abs(first.score - closestOtherMethod.score) < 0.12;
}

function methodOptionLabel(method: MethodInventoryRecord): string {
  return `${method.code} · ${pickVersion(method, null)}`;
}

function splitRequirementLabel(label: string): { title: string; id: string | null } {
  const trimmed = label.trim();
  if (!trimmed) return { title: "", id: null };
  const parts = trimmed.split("·").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const [first, ...rest] = parts;
    if (/^R-\d/i.test(first)) {
      return { title: rest.join(" · "), id: first };
    }
  }
  return { title: trimmed, id: null };
}

function mergeQueryResults(responses: Array<{ query: string; results: QueryResponse["results"] }>): QueryResultWithSignals[] {
  const merged = new Map<string, QueryResultWithSignals>();
  for (const [index, response] of responses.entries()) {
    const queryBoost = index === 0 ? 0 : Math.max(0.08 - (index - 1) * 0.01, 0.05);
    for (const result of response.results) {
      const methodologyId =
        (typeof result.methodology_id === "string" && result.methodology_id.trim()) ||
        (typeof result.methodologyId === "string" && result.methodologyId.trim()) ||
        "";
      const methodologyVersion =
        (typeof result.methodology_version === "string" && result.methodology_version.trim()) ||
        (typeof result.methodologyVersion === "string" && result.methodologyVersion.trim()) ||
        "";
      const key = `${methodologyId}@@${methodologyVersion}@@${result.id}`;
      const existing = merged.get(key);
      if (existing) {
        existing._signalBoost = Number((existing._signalBoost + queryBoost).toFixed(4));
        if (!existing._matchedQueries.includes(response.query)) existing._matchedQueries.push(response.query);
        if ((typeof result.score === "number" ? result.score : -1) > (typeof existing.score === "number" ? existing.score : -1)) {
          existing.score = result.score;
          existing.section_title = result.section_title ?? existing.section_title;
          existing.sectionTitle = result.sectionTitle ?? existing.sectionTitle;
          existing.text = result.text ?? existing.text;
          existing.tags = result.tags ?? existing.tags;
          existing.refs = result.refs ?? existing.refs;
        }
        continue;
      }
      merged.set(key, {
        ...result,
        _signalBoost: queryBoost,
        _matchedQueries: [response.query],
      });
    }
  }
  return Array.from(merged.values());
}

function buildRecoveryState(input: {
  selectedMethodologyId: string;
  evidenceAnalysis?: QuickCheckEvidenceAnalysis;
  claimIntents?: QuickCheckClaimIntent[];
}): RecoveryState {
  const evidenceFacts = input.evidenceAnalysis?.facts ?? [];
  const claimIntents = input.claimIntents ?? [];
  const hasBoundaryLocationSignals =
    evidenceFacts.some((fact) =>
      fact.category === "boundary" ||
      fact.category === "coordinates" ||
      fact.category === "mapped-area" ||
      fact.category === "project-location",
    ) ||
    claimIntents.some((intent) =>
      intent === "boundary" ||
      intent === "project-area" ||
      intent === "mapped-area" ||
      intent === "aoi" ||
      intent === "coordinates" ||
      intent === "location",
    );

  if (input.selectedMethodologyId.trim()) {
    if (hasBoundaryLocationSignals) {
      return {
        kind: "no-match",
        title: `No clear match in ${input.selectedMethodologyId} yet`,
        description: `We found project boundary/location evidence in your uploaded PDD, but no confident ${input.selectedMethodologyId} requirement match yet.`,
        note: "Try another methodology, edit the claim, or open the full review to inspect the evidence in context.",
      };
    }
    return {
      kind: "no-match",
      title: `No clear match in ${input.selectedMethodologyId} yet`,
      description: "The current methodology narrowing is stricter than the evidence signals we found.",
      note: "Try another methodology or keep the claim and broaden the check.",
    };
  }
  if (hasBoundaryLocationSignals) {
    return {
      kind: "no-match",
      title: "No clear match yet",
      description: "We found project boundary/location evidence in your uploaded PDD, but no confident requirement match yet.",
      note: "Edit the claim or try another methodology to guide the check.",
    };
  }
  return {
    kind: "no-match",
    title: "No clear match yet",
    description: "We couldn't find a requirement to check from this claim and evidence yet.",
    note: "Edit the claim or try another methodology to guide the check.",
  };
}

function buildUnsupportedMethodRecoveryState(methodologyId: string): RecoveryState {
  return {
    kind: "no-match",
    title: `Unsupported methodology: ${methodologyId}`,
    description: "We extracted usable evidence, but this methodology is not available in the supported Quick Check methods for this workspace.",
    note: "Choose a supported methodology, clear the methodology filter, or open the full review to inspect the evidence without a preliminary match.",
  };
}

function buildMismatchedMethodRecoveryState(methodologyId: string): RecoveryState {
  return {
    kind: "no-match",
    title: `No valid match in ${methodologyId}`,
    description: "We extracted usable evidence, but the selected methodology did not produce a valid requirement match.",
    note: "The likely matches shown below are from other supported methodologies. Pick one only if it is the intended methodology, or change the methodology filter.",
  };
}

function evidenceMentionsMethodologyCode(evidenceSignals: MethodologyEvidenceSignals, methodologyId: string): boolean {
  const normalizedMethodologyId = methodologyId.trim().toUpperCase();
  if (!normalizedMethodologyId) return false;
  return (evidenceSignals?.methodologyMentions ?? []).some((mention) => mention.trim().toUpperCase() === normalizedMethodologyId);
}

function buildNoValidAnalysisPathRecoveryState(input: {
  methodologyId: string;
  evidenceSignals?: MethodologyEvidenceSignals;
}): RecoveryState {
  const methodologyId = input.methodologyId.trim();
  const methodConfirmedByEvidence = evidenceMentionsMethodologyCode(input.evidenceSignals, methodologyId);

  return {
    kind: "no-match",
    title: `No valid analysis path in ${methodologyId}`,
    description: methodConfirmedByEvidence
      ? "We extracted usable evidence, but Quick Check could not confirm a valid requirement match for this methodology."
      : `We extracted usable evidence, but the uploaded file did not clearly confirm ${methodologyId} and Quick Check could not confirm a valid requirement match for it.`,
    note: "This narrowing may be unsupported, mismatched, or unrelated to the uploaded evidence. Try another methodology, clear the methodology filter, or open the full review to inspect the file without a preliminary match.",
  };
}

function buildMethodologyConfirmationRecoveryState(): RecoveryState {
  return {
    kind: "no-match",
    title: "Methodology needs confirmation",
    description: "We extracted usable evidence, but the closest supported matches still span multiple methodologies.",
    note: "Quick Check will not auto-narrow to one methodology without clearer evidence. Pick the intended match below or narrow by methodology first.",
  };
}

function inventoryEvidenceLabel(item: EvidenceInventoryItem): string {
  return `${item.display_name} · ${item.type}`;
}

function asPinForUpload(upload: QuickCheckStagedUpload): EvidencePin {
  return {
    id: upload.evidenceId,
    kind: upload.mime === "application/pdf" ? "pdd" : "doc",
    title: upload.filename || "evidence",
    cited_ids: [],
    attachments: [upload.attachment],
    created_at: upload.createdAt,
  };
}

function extractionStateBadgeClass(value: "grounded" | "partial" | "weak"): string {
  if (value === "grounded") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (value === "partial") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-rose-200 bg-rose-50 text-rose-800";
}

function buildUnresolvedItems(input: {
  extraction: QuickCheckExtractionSnapshot | null;
  result: QuickCheckResult;
}): string[] {
  const next = new Set<string>();
  for (const warning of input.extraction?.warnings ?? []) {
    if (warning.trim()) next.add(warning.trim());
  }
  for (const item of input.result.unresolved ?? []) {
    if (item.trim()) next.add(item.trim());
  }
  if (input.result.nextStepHint.trim()) next.add(input.result.nextStepHint.trim());
  return Array.from(next).slice(0, 4);
}

function sourceModeLabel(sourceMode: QuickCheckSourceMode | null | undefined): string {
  if (sourceMode === "uploaded_file") return "Uploaded file";
  if (sourceMode === "saved_evidence") return "Saved evidence";
  if (sourceMode === "demo_evidence") return "Demo evidence";
  return "Unknown source";
}

function buildWeakExtractionRecoveryState(): RecoveryState {
  return {
    kind: "weak-extraction",
    title: "Weak extraction",
    description: "Quick Check couldn't extract enough claim-relevant facts from this file yet.",
    note: "Open full review to inspect the evidence manually or continue with a broader workflow.",
  };
}

export default function QuickCheckPanel({ initialMethod, initialVersion, onContinueToWorkspace }: QuickCheckPanelProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const claimRef = useRef<HTMLTextAreaElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const rulesCache = useRef(new Map<string, RuleSummary[]>());

  const [methods, setMethods] = useState<MethodInventoryRecord[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [recoveryState, setRecoveryState] = useState<RecoveryState>(null);
  const [matchCandidates, setMatchCandidates] = useState<ResolvedMatchCandidate[]>([]);
  const [pendingInventoryId, setPendingInventoryId] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSavedEvidence, setShowSavedEvidence] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const [showExtractionDetails, setShowExtractionDetails] = useState(false);
  const [validatedResultKey, setValidatedResultKey] = useState<string | null>(null);
  const [extractionState, setExtractionState] = useState<ExtractionState>({
    loading: false,
    analysis: null,
    error: null,
  });
  const [session, setSession] = useState<QuickCheckSessionState>(() =>
    loadQuickCheckSession({
      methodologyId: initialMethod?.trim() || undefined,
      methodologyVersion: initialVersion?.trim() || undefined,
    }),
  );

  const draft = session.draft;
  const result = session.result;
  const stagedUploads = session.stagedUploads;

  const inventoryItems = useMemo(
    () => loadQuickCheckInventory(draft.methodologyId, draft.methodologyVersion),
    [draft.methodologyId, draft.methodologyVersion],
  );

  const selectedInventoryEvidence = useMemo(
    () => inventoryItems.filter((item) => draft.evidenceIds.includes(item.evidence_id)),
    [draft.evidenceIds, inventoryItems],
  );

  const selectedPins = useMemo(() => {
    if (!draft.methodologyId.trim() || !draft.methodologyVersion.trim()) return [];
    const selectedIds = new Set(draft.evidenceIds);
    return coalesceEvidencePins(loadPins(draft.methodologyId, draft.methodologyVersion)).filter((pin) => selectedIds.has(pin.id));
  }, [draft.evidenceIds, draft.methodologyId, draft.methodologyVersion]);

  const selectedUploadEvidence = useMemo(
    () => stagedUploads.filter((upload) => draft.evidenceIds.includes(upload.evidenceId)),
    [draft.evidenceIds, stagedUploads],
  );

  const availableInventory = useMemo(
    () => inventoryItems.filter((item) => !draft.evidenceIds.includes(item.evidence_id)),
    [draft.evidenceIds, inventoryItems],
  );

  const updateSession = useCallback((mutator: (current: QuickCheckSessionState) => QuickCheckSessionState) => {
    setSession((current) => {
      const next = mutator(current);
      saveQuickCheckSession(next);
      return next;
    });
  }, []);

  const replaceSession = useCallback((nextSession: QuickCheckSessionState) => {
    saveQuickCheckSession(nextSession);
    setSession(nextSession);
  }, []);

  const updateDraft = useCallback(
    (
      mutator: (draft: QuickCheckDraft, current: QuickCheckSessionState) => QuickCheckDraft,
      nextResult?: QuickCheckResult | null,
    ) => {
      updateSession((current) => {
        const resolvedResult = nextResult === undefined ? current.result : nextResult;
        const mutatedDraft = mutator(current.draft, current);
        const nextDraft: QuickCheckDraft = {
          ...mutatedDraft,
          result: resolvedResult ?? mutatedDraft.result ?? null,
          updatedAt: nowIso(),
        };
        return {
          ...current,
          draft: nextDraft,
          result: resolvedResult ?? null,
        };
      });
    },
    [updateSession],
  );

  const resetMethodologyForUserInput = useCallback(
    (draftState: QuickCheckDraft) => {
      if (draftState.sourceMode !== "demo_evidence") {
        return {
          methodologyId: draftState.methodologyId,
          methodologyVersion: draftState.methodologyVersion,
        };
      }
      if (initialMethod?.trim()) {
        return {
          methodologyId: initialMethod.trim(),
          methodologyVersion: initialVersion?.trim() || draftState.methodologyVersion,
        };
      }
      return {
        methodologyId: "",
        methodologyVersion: "",
      };
    },
    [initialMethod, initialVersion],
  );

  const fetchMethodInventory = useCallback(async (): Promise<MethodInventoryRecord[]> => {
    const response = await fetch("/api/methods/inventory", { cache: "no-store" });
    if (!response.ok) throw new Error(`Method inventory request failed with ${response.status}`);
    const payload = (await response.json()) as { methods?: MethodInventoryRecord[] };
    const nextMethods = Array.isArray(payload.methods) ? payload.methods : [];
    return nextMethods.sort((a, b) => a.code.localeCompare(b.code));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingMethods(true);
    fetchMethodInventory()
      .then((nextMethods) => {
        if (cancelled) return;
        setMethods(nextMethods);
      })
      .catch((error) => {
        if (cancelled) return;
        setFieldErrors({ general: error instanceof Error ? error.message : String(error) });
      })
      .finally(() => {
        if (!cancelled) setLoadingMethods(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchMethodInventory]);

  useEffect(() => {
    if (!methods.length || !initialMethod?.trim()) return;
    const matchedMethod = methods.find((item) => item.code === initialMethod.trim());
    if (!matchedMethod) return;
    const version = pickVersion(matchedMethod, initialVersion);
    if (!version) return;
    if (draft.methodologyId.trim() || draft.methodologyVersion.trim()) return;
    updateDraft((current) => ({
      ...current,
      methodologyId: matchedMethod.code,
      methodologyVersion: version,
    }));
  }, [draft.methodologyId, draft.methodologyVersion, initialMethod, initialVersion, methods, updateDraft]);

  useEffect(() => {
    const stagedIds = new Set(stagedUploads.map((upload) => upload.evidenceId));
    const validInventoryIds = new Set(inventoryItems.map((item) => item.evidence_id));
    const filteredIds = draft.evidenceIds.filter((id) => stagedIds.has(id) || validInventoryIds.has(id));
    if (filteredIds.length === draft.evidenceIds.length) return;
    updateDraft((current) => ({ ...current, evidenceIds: filteredIds }), null);
  }, [draft.evidenceIds, inventoryItems, stagedUploads, updateDraft]);

  const selectedMethodRecord = methods.find((item) => item.code === draft.methodologyId);
  const selectedEvidenceCount = draft.evidenceIds.length;
  const selectedUpload = selectedUploadEvidence[0] ?? null;
  const selectedInventoryItem = selectedInventoryEvidence[0] ?? null;
  const selectedEvidenceLabel = draft.evidenceFileName || (selectedUpload
    ? selectedUpload.filename
    : selectedInventoryItem
    ? selectedInventoryItem.display_name
    : "");
  const activeSourceMode: QuickCheckSourceMode | null =
    draft.sourceMode ??
    (selectedUpload ? "uploaded_file" : selectedInventoryItem ? "saved_evidence" : null);
  const selectedEvidenceMeta = activeSourceMode ? sourceModeLabel(activeSourceMode) : "";
  const canRunQuickCheck = Boolean(draft.claimText.trim()) && selectedEvidenceCount === 1 && !submitting;
  const activeResultKey =
    result && draft.methodologyId.trim() && draft.methodologyVersion.trim() && draft.matchedRequirementId?.trim()
      ? `${draft.methodologyId.trim()}@@${draft.methodologyVersion.trim()}@@${draft.matchedRequirementId.trim()}`
      : null;
  const canRenderResult = Boolean(result && activeResultKey && validatedResultKey === activeResultKey);
  const renderedResult = canRenderResult ? result : null;
  const extractionPreview = useMemo(
    () => (extractionState.analysis ? buildQuickCheckExtractionSnapshot({ claimText: draft.claimText, analysis: extractionState.analysis }) : null),
    [draft.claimText, extractionState.analysis],
  );
  const extractionPreviewState = useMemo(
    () => (extractionPreview ? deriveQuickCheckExtractionState(extractionPreview) : null),
    [extractionPreview],
  );
  const showAdvancedOptions = showAdvanced || showSavedEvidence || showMethodology;
  const extractionHighlights = extractionPreview?.extractedFacts.slice(0, 3) ?? [];
  const normalizedResult = useMemo(
    () =>
      renderedResult
        ? normalizeQuickCheckUiResult({
            claim: renderedResult.claimText,
            evidenceFileName: renderedResult.evidenceFileName || selectedEvidenceLabel || "evidence",
            sourceMode: renderedResult.sourceMode ?? activeSourceMode,
            extraction: renderedResult.extraction ?? extractionPreview,
            methodologyCode: draft.methodologyId,
            methodologyVersion: draft.methodologyVersion,
            result: renderedResult,
          })
        : null,
    [activeSourceMode, draft.methodologyId, draft.methodologyVersion, extractionPreview, renderedResult, selectedEvidenceLabel],
  );
  const normalizedRequirement = normalizedResult?.match ? splitRequirementLabel(normalizedResult.match.requirementLabel) : null;
  const isGroundedResult = normalizedResult?.match?.grounding === "methodology_grounded";
  const resultToneClass = isGroundedResult ? "border-emerald-200 bg-emerald-50/75" : "border-sky-200 bg-sky-50/80";
  const resultIconClass = isGroundedResult ? "text-emerald-700" : "text-sky-700";
  const resultEyebrowClass = isGroundedResult ? "text-emerald-800" : "text-sky-800";
  const resultTitle = isGroundedResult ? "Preliminary match found" : "Candidate from current catalog";
  const resultSignalNote = isGroundedResult
    ? `${normalizedResult?.extractionState.description ?? ""} Quick Check returns a methodology-grounded preliminary requirement match, not a final review decision.`
    : `${normalizedResult?.extractionState.description ?? ""} Evidence was found, but this file did not detect methodology text, so this is only a catalog candidate and not a methodology-grounded preliminary match.`;
  const resultMatchLabel = isGroundedResult ? "What matched" : "Catalog candidate";
  const selectedEvidenceSources = useMemo(() => {
    const sources = new Map<string, { evidenceId: string; sourceLabel: string; attachments: EvidencePin["attachments"]; pddFragments?: PddFragment[] }>();

    for (const item of selectedInventoryEvidence) {
      const pin = selectedPins.find((candidate) => candidate.id === item.evidence_id) ?? null;
      sources.set(item.evidence_id, {
        evidenceId: item.evidence_id,
        sourceLabel: draft.evidenceFileName || item.display_name,
        attachments: pin?.attachments ?? [],
        pddFragments: item.pdd_fragments,
      });
    }

    for (const upload of selectedUploadEvidence) {
      sources.set(upload.evidenceId, {
        evidenceId: upload.evidenceId,
        sourceLabel: draft.evidenceFileName || upload.filename,
        attachments: [upload.attachment],
      });
    }

    return Array.from(sources.values()).map((source) => ({
      evidenceId: source.evidenceId,
      sourceLabel: source.sourceLabel,
      attachments: source.attachments ?? [],
      pddFragments: source.pddFragments,
    }));
  }, [draft.evidenceFileName, selectedInventoryEvidence, selectedPins, selectedUploadEvidence]);

  useEffect(() => {
    if (!selectedEvidenceSources.length) {
      setExtractionState({ loading: false, analysis: null, error: null });
      return;
    }

    let cancelled = false;
    setExtractionState((current) => ({
      loading: true,
      analysis: current.analysis,
      error: null,
    }));

    void analyzeQuickCheckEvidence(selectedEvidenceSources)
      .then((analysis) => {
        if (cancelled) return;
        setExtractionState({ loading: false, analysis, error: null });
      })
      .catch((error) => {
        if (cancelled) return;
        setExtractionState({
          loading: false,
          analysis: null,
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [selectedEvidenceSources]);

  useEffect(() => {
    if (showSavedEvidence || showMethodology) {
      setShowAdvanced(true);
    }
  }, [showMethodology, showSavedEvidence]);

  useEffect(() => {
    if (extractionState.error || extractionPreviewState?.value === "weak") {
      setShowExtractionDetails(true);
    }
  }, [extractionPreviewState, extractionState.error]);

  useEffect(() => {
    if (!result?.id) return;
    resultRef.current?.focus();
  }, [result?.id]);

  function clearDecisionState() {
    setFieldErrors({});
    setRecoveryState(null);
    setMatchCandidates([]);
    setValidatedResultKey(null);
  }

  function resetQuickCheckUi() {
    clearDecisionState();
    setPendingInventoryId("");
    setShowAdvanced(false);
    setShowSavedEvidence(false);
    setShowMethodology(false);
    setShowExtractionDetails(false);
  }

  function openFullReviewFromRecovery() {
    if (draft.methodologyId.trim() && draft.methodologyVersion.trim() && onContinueToWorkspace) {
      onContinueToWorkspace(`/m/${encodeURIComponent(draft.methodologyId)}/v/${encodeURIComponent(draft.methodologyVersion)}?tab=verify&mode=list`);
      return;
    }
    if (draft.methodologyId.trim() && draft.methodologyVersion.trim()) {
      if (typeof window !== "undefined") {
        window.location.assign(`/m/${encodeURIComponent(draft.methodologyId)}/v/${encodeURIComponent(draft.methodologyVersion)}?tab=verify&mode=list`);
      }
      return;
    }
    if (typeof window !== "undefined") window.location.assign("/m");
  }

  const fetchRules = useCallback(async (methodologyId: string, methodologyVersion: string): Promise<RuleSummary[]> => {
    const cacheKey = `${methodologyId}@@${methodologyVersion}`;
    const cached = rulesCache.current.get(cacheKey);
    if (cached) return cached;
    const response = await fetch(
      `/api/methods/${encodeURIComponent(methodologyId)}/v/${encodeURIComponent(methodologyVersion)}/rules`,
      { cache: "no-store" },
    );
    if (!response.ok) throw new Error(`Rules request failed with ${response.status}`);
    const payload = (await response.json()) as { rules?: RuleSummary[] };
    const rules = Array.isArray(payload.rules) ? payload.rules : [];
    rulesCache.current.set(cacheKey, rules);
    return rules;
  }, []);

  const ensureMethodsReady = useCallback(
    async (methodologyId: string, methodologyVersion: string): Promise<MethodInventoryRecord[]> => {
      const hasMethod = methods.some(
        (method) => method.code === methodologyId && Array.isArray(method.versions) && method.versions.includes(methodologyVersion),
      );
      if (hasMethod) return methods;
      const nextMethods = await fetchMethodInventory();
      setMethods(nextMethods);
      return nextMethods;
    },
    [fetchMethodInventory, methods],
  );

  useEffect(() => {
    if (!activeResultKey || !result) {
      setValidatedResultKey(null);
      return;
    }
    if (validatedResultKey === activeResultKey) return;
    if (!methods.length) return;

    let cancelled = false;
    const candidate: MatchCandidate = {
      key: activeResultKey,
      methodologyId: draft.methodologyId,
      methodologyVersion: draft.methodologyVersion,
      requirementId: draft.matchedRequirementId ?? result.requirementId,
      requirementLabel: result.requirementLabel,
      score: null,
    };

    void resolveQuickCheckCandidate({
      candidate,
      methods,
      loadRules: fetchRules,
    }).then((resolved) => {
      if (cancelled) return;
      if (resolved) {
        setValidatedResultKey(activeResultKey);
        return;
      }
      setValidatedResultKey(null);
      updateDraft(
        (current) => ({
          ...current,
          matchedRequirementId: undefined,
          matchedRequirementLabel: undefined,
          status: "draft",
          resultId: undefined,
        }),
        null,
      );
      if (draft.methodologyId.trim()) {
        setShowMethodology(true);
        setRecoveryState(
          buildNoValidAnalysisPathRecoveryState({
            methodologyId: draft.methodologyId,
            evidenceSignals: result.extraction ?? extractionPreview,
          }),
        );
      } else {
        setRecoveryState(
          buildRecoveryState({
            selectedMethodologyId: draft.methodologyId,
            evidenceAnalysis: undefined,
            claimIntents: classifyQuickCheckClaimIntents(draft.claimText.trim()),
          }),
        );
      }
      setFieldErrors({});
    });

    return () => {
      cancelled = true;
    };
  }, [
    activeResultKey,
    draft.claimText,
    draft.matchedRequirementId,
    draft.methodologyId,
    draft.methodologyVersion,
    extractionPreview,
    fetchRules,
    methods,
    result,
    updateDraft,
    validatedResultKey,
  ]);

  async function buildLocalFallbackCandidates(methodSubset: MethodInventoryRecord[], analysis: QuickCheckEvidenceAnalysis): Promise<MatchCandidate[]> {
    const claimIntents = classifyQuickCheckClaimIntents(draft.claimText.trim());
    const hasBoundaryLocationSignals =
      analysis.facts.some((fact) =>
        fact.category === "boundary" ||
        fact.category === "coordinates" ||
        fact.category === "mapped-area" ||
        fact.category === "project-location",
      ) ||
      claimIntents.some((intent) =>
        intent === "boundary" ||
        intent === "project-area" ||
        intent === "mapped-area" ||
        intent === "aoi" ||
        intent === "coordinates" ||
        intent === "location",
      );
    const perMethodCandidates = await Promise.all(
      methodSubset.map(async (method) => {
        const methodologyVersion = pickVersion(method, draft.methodologyId === method.code ? draft.methodologyVersion : null);
        if (!methodologyVersion) return [];
        const rules = await fetchRules(method.code, methodologyVersion);
        return buildLocalRuleCandidates({
          claimText: draft.claimText.trim(),
          facts: analysis.facts,
          rules,
          claimIntents,
          minimumScore: hasBoundaryLocationSignals ? 0.85 : 1.2,
        }).map((candidate) => ({
          key: `${method.code}@@${methodologyVersion}@@${candidate.requirementId}`,
          methodologyId: method.code,
          methodologyVersion,
          requirementId: candidate.requirementId,
          requirementLabel: candidate.requirementLabel,
          score: candidate.score,
        }));
      }),
    );

    return perMethodCandidates
      .flat()
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.requirementLabel.localeCompare(b.requirementLabel))
      .slice(0, 4);
  }

  async function materializeUploads(
    methodologyId: string,
    methodologyVersion: string,
    activeSession: QuickCheckSessionState = session,
  ): Promise<string[]> {
    if (!activeSession.stagedUploads.length) return activeSession.draft.evidenceIds;
    const currentPins = coalesceEvidencePins(loadPins(methodologyId, methodologyVersion));
    const existingIds = new Set(currentPins.map((item) => item.id));
    const nextPins = coalesceEvidencePins([
      ...currentPins,
      ...activeSession.stagedUploads.filter((upload) => !existingIds.has(upload.evidenceId)).map(asPinForUpload),
    ]);
    savePins(methodologyId, methodologyVersion, nextPins);
    updateSession((current) => ({
      ...current,
      stagedUploads: current.stagedUploads.filter((upload) => !activeSession.draft.evidenceIds.includes(upload.evidenceId)),
    }));
    return activeSession.draft.evidenceIds;
  }

  async function completeQuickCheck(
    candidate: ResolvedMatchCandidate,
    activeSession: QuickCheckSessionState = session,
    options?: { manageSubmitting?: boolean; analysis?: QuickCheckEvidenceAnalysis | null },
  ) {
    const shouldManageSubmitting = options?.manageSubmitting !== false;
    const activeDraft = activeSession.draft;
    if (shouldManageSubmitting) setSubmitting(true);
    setFieldErrors({});
    setRecoveryState(null);
    try {
      await materializeUploads(candidate.methodologyId, candidate.methodologyVersion, activeSession);

      const nextDraft: QuickCheckDraft = {
        ...activeDraft,
        methodologyId: candidate.methodologyId,
        methodologyVersion: candidate.methodologyVersion,
        matchedRequirementId: candidate.requirementId,
        matchedRequirementLabel: candidate.requirementLabel,
        status: "draft",
      };

      const inventory = loadQuickCheckInventory(candidate.methodologyId, candidate.methodologyVersion);
      const extraction = options?.analysis
        ? buildQuickCheckExtractionSnapshot({
            claimText: activeDraft.claimText,
            analysis: options.analysis,
          })
        : null;
      const nextResult = buildQuickCheckResult({
        draft: nextDraft,
        rule: {
          id: candidate.rule.id,
          title: candidate.rule.title,
          snippet: candidate.rule.snippet,
          text: candidate.rule.text,
          summary: candidate.rule.summary,
          logic: candidate.rule.logic,
          notes: candidate.rule.notes,
          when: candidate.rule.when,
          expectedEvidence: candidate.rule.expectedEvidence,
          type: candidate.rule.type,
          tags: candidate.rule.tags,
          sectionId: candidate.rule.sectionId,
          anchor: candidate.rule.anchor,
          refs: candidate.rule.refs,
          citations: candidate.rule.citations,
        },
        inventoryItems: inventory,
        unresolved: extraction
          ? [
              ...extraction.warnings,
              "Quick Check is preliminary. Open full review to confirm the requirement against the full methodology context.",
            ]
          : ["Quick Check is preliminary. Open full review to confirm the requirement against the full methodology context."],
        extraction,
      });

      const checkedDraft: QuickCheckDraft = {
        ...nextDraft,
        status: "checked",
        result: nextResult,
        resultId: nextResult.id,
        updatedAt: nowIso(),
      };
      const nextSession = {
        draft: checkedDraft,
        result: nextResult,
        stagedUploads: [] as QuickCheckStagedUpload[],
      };
      saveQuickCheckSession(nextSession);
      setSession(nextSession);
      setValidatedResultKey(candidate.key);
      setMatchCandidates([]);
      setRecoveryState(null);
    } catch (error) {
      setFieldErrors({ general: error instanceof Error ? error.message : String(error) });
    } finally {
      if (shouldManageSubmitting) setSubmitting(false);
    }
  }

  async function handleUpload(file: File | null) {
    if (!file) return;

    setSubmitting(true);
    setFieldErrors((current) => ({ ...current, evidence: undefined, general: undefined }));
    setRecoveryState(null);
    try {
      const evidenceId = newPinId();
      const attachmentResult = await createAndStoreEvidenceAttachment({ pin_id: evidenceId, file });
      if (!attachmentResult.ok) {
        setFieldErrors({ evidence: attachmentResult.message });
        return;
      }
      updateSession((current) => ({
        ...current,
        draft: (() => {
          const nextMethodology = resetMethodologyForUserInput(current.draft);
          return {
            ...current.draft,
            ...nextMethodology,
            sourceMode: "uploaded_file",
            evidenceFileName: attachmentResult.attachment.filename,
            evidenceIds: [evidenceId],
            status: "draft",
            result: null,
            resultId: undefined,
            updatedAt: nowIso(),
          };
        })(),
        result: null,
        stagedUploads: [
          {
            evidenceId,
            filename: attachmentResult.attachment.filename,
            mime: attachmentResult.attachment.mime,
            createdAt: attachmentResult.attachment.created_at,
            attachment: attachmentResult.attachment,
          },
        ],
      }));
    } finally {
      setSubmitting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function selectExistingEvidence(evidenceId: string) {
    if (!evidenceId) return;
    const selectedItem = inventoryItems.find((item) => item.evidence_id === evidenceId) ?? null;
    const selectedPin = selectedPins.find((item) => item.id === evidenceId) ?? null;
    const evidenceFileName = selectedPin?.attachments?.[0]?.filename ?? selectedItem?.display_name ?? evidenceId;
    updateSession((current) => ({
      ...current,
      draft: (() => {
        const nextMethodology = resetMethodologyForUserInput(current.draft);
        return {
          ...current.draft,
          ...nextMethodology,
          sourceMode: "saved_evidence",
          evidenceFileName,
          evidenceIds: [evidenceId],
          status: "draft",
          result: null,
          resultId: undefined,
          updatedAt: nowIso(),
        };
      })(),
      result: null,
      stagedUploads: [],
    }));
    setPendingInventoryId("");
    clearDecisionState();
    setShowSavedEvidence(false);
  }

  function removeEvidence(evidenceId: string) {
    updateSession((current) => ({
      ...current,
      draft: {
        ...current.draft,
        sourceMode: undefined,
        evidenceFileName: undefined,
        evidenceIds: current.draft.evidenceIds.filter((id) => id !== evidenceId),
        status: "draft",
        result: null,
        resultId: undefined,
        updatedAt: nowIso(),
      },
      result: null,
      stagedUploads: current.stagedUploads.filter((upload) => upload.evidenceId !== evidenceId),
    }));
    clearDecisionState();
  }

  async function runQuickCheck() {
    const validationErrors = validateQuickCheckDraft(draft, { stagedEvidenceCount: stagedUploads.length });
    if (validationErrors.length) {
      setFieldErrors({
        claim: validationErrors.find((item) => item.includes("claim")),
        evidence: validationErrors.find((item) => item.includes("evidence")),
      });
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    setRecoveryState(null);
    setMatchCandidates([]);
    try {
      const evidenceAnalysis = await analyzeQuickCheckEvidence(selectedEvidenceSources);
      const claimIntents = classifyQuickCheckClaimIntents(draft.claimText.trim());
      if (!evidenceAnalysis.facts.length) {
        setFieldErrors({});
        setRecoveryState(buildWeakExtractionRecoveryState());
        return;
      }
      const selectedMethodologyId = draft.methodologyId.trim();
      if (selectedMethodologyId && !methods.some((method) => method.code === selectedMethodologyId)) {
        setShowMethodology(true);
        setFieldErrors({});
        setRecoveryState(buildUnsupportedMethodRecoveryState(selectedMethodologyId));
        return;
      }
      const queryTexts = buildQuickCheckQueryTexts(draft.claimText.trim(), evidenceAnalysis.facts, claimIntents);
      const responses = await Promise.all(
        queryTexts.map(async (query) => ({
          query,
          results: (await retrieveQuery(query)).results ?? [],
        })),
      );
      const mergedResults = mergeQueryResults(responses);
      const allCandidates = buildMatchCandidates(mergedResults, methods, "", "", draft.claimText.trim(), evidenceAnalysis, claimIntents);
      let candidates = buildMatchCandidates(
        mergedResults,
        methods,
        draft.methodologyId,
        draft.methodologyVersion,
        draft.claimText.trim(),
        evidenceAnalysis,
        claimIntents,
      );

      if (draft.methodologyId.trim() && !candidates.length && allCandidates.length) {
        const broaderResolvedCandidates = await resolveQuickCheckCandidates({
          candidates: allCandidates,
          methods,
          loadRules: fetchRules,
        });
        if (broaderResolvedCandidates.length) {
          setShowMethodology(true);
          setMatchCandidates(broaderResolvedCandidates);
          setRecoveryState(buildMismatchedMethodRecoveryState(draft.methodologyId.trim()));
          setFieldErrors({});
          return;
        }
      }

      if (
        draft.methodologyId.trim() &&
        candidates.length &&
        claimPrefersMonitoringRequirement(draft.claimText.trim(), claimIntents) &&
        !candidates.some(candidateLooksMonitoringAligned)
      ) {
        const broaderMonitoringCandidates = allCandidates.filter(
          (candidate) => candidate.methodologyId !== draft.methodologyId.trim() && candidateLooksMonitoringAligned(candidate),
        );
        if (broaderMonitoringCandidates.length) {
          const broaderResolvedCandidates = await resolveQuickCheckCandidates({
            candidates: broaderMonitoringCandidates,
            methods,
            loadRules: fetchRules,
          });
          if (broaderResolvedCandidates.length) {
            setShowMethodology(true);
            setMatchCandidates(broaderResolvedCandidates);
            setRecoveryState(buildMismatchedMethodRecoveryState(draft.methodologyId.trim()));
            setFieldErrors({});
            return;
          }
        }
      }

      if (!candidates.length) {
        const methodSubset = draft.methodologyId.trim()
          ? methods.filter((method) => method.code === draft.methodologyId)
          : methods;
        candidates = await buildLocalFallbackCandidates(methodSubset, evidenceAnalysis);
      }

      let resolvedCandidates = await resolveQuickCheckCandidates({
        candidates,
        methods,
        loadRules: fetchRules,
      });

      if (!resolvedCandidates.length && draft.methodologyId.trim()) {
        const broaderCandidates =
          allCandidates.length > 0 ? allCandidates : await buildLocalFallbackCandidates(methods, evidenceAnalysis);
        const broaderResolvedCandidates = await resolveQuickCheckCandidates({
          candidates: broaderCandidates,
          methods,
          loadRules: fetchRules,
        });
        if (broaderResolvedCandidates.length) {
          setShowMethodology(true);
          setMatchCandidates(broaderResolvedCandidates);
          setRecoveryState(buildMismatchedMethodRecoveryState(draft.methodologyId.trim()));
          setFieldErrors({});
          return;
        }
      }

      if (!resolvedCandidates.length && draft.methodologyId.trim()) {
        setShowMethodology(true);
        setFieldErrors({});
        setRecoveryState(
          buildNoValidAnalysisPathRecoveryState({
            methodologyId: draft.methodologyId.trim(),
            evidenceSignals: evidenceAnalysis,
          }),
        );
        return;
      }

      if (!resolvedCandidates.length && !draft.methodologyId.trim()) {
        const broaderCandidates =
          allCandidates.length > 0 ? allCandidates : await buildLocalFallbackCandidates(methods, evidenceAnalysis);
        resolvedCandidates = await resolveQuickCheckCandidates({
          candidates: broaderCandidates,
          methods,
          loadRules: fetchRules,
        });
        if (resolvedCandidates.length) {
          setMatchCandidates(resolvedCandidates);
          setRecoveryState(null);
          setFieldErrors({
            general: "This methodology filter removed closer matches. Pick a likely match below or try another methodology.",
          });
          return;
        }
      }

      if (!resolvedCandidates.length) {
        if (!draft.methodologyId.trim()) setShowMethodology(true);
        setFieldErrors({});
        setRecoveryState(
          buildRecoveryState({
            selectedMethodologyId: draft.methodologyId,
            evidenceAnalysis,
            claimIntents,
          }),
        );
        return;
      }

      if (!draft.methodologyId.trim() && requiresMethodologyConfirmation(resolvedCandidates)) {
        setShowMethodology(true);
        setMatchCandidates(resolvedCandidates);
        setFieldErrors({});
        setRecoveryState(buildMethodologyConfirmationRecoveryState());
        return;
      }

      if (isAmbiguousMatch(resolvedCandidates)) {
        setMatchCandidates(resolvedCandidates);
        if (!draft.methodologyId.trim()) setShowMethodology(true);
        setRecoveryState(null);
        setFieldErrors({
          general: "Multiple requirements could fit this claim. Pick the closest match or narrow by methodology.",
        });
        return;
      }

      await completeQuickCheck(resolvedCandidates[0]!, session, {
        analysis: evidenceAnalysis,
      });
    } catch (error) {
      setFieldErrors({ general: error instanceof Error ? error.message : String(error) });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTryDemoCheck() {
    setSubmitting(true);
    resetQuickCheckUi();
    try {
      const demo = await prepareQuickCheckDemo();
      const readyMethods = await ensureMethodsReady(QUICK_CHECK_DEMO.methodologyId, QUICK_CHECK_DEMO.methodologyVersion);
      const nextSession: QuickCheckSessionState = {
        draft: demo.draft,
        result: null,
        stagedUploads: [demo.stagedUpload],
      };
      const demoAnalysis = await analyzeQuickCheckEvidence([
        {
          evidenceId: demo.stagedUpload.evidenceId,
          sourceLabel: demo.stagedUpload.filename,
          attachments: [demo.stagedUpload.attachment],
        },
      ]);
      replaceSession(nextSession);
      const resolvedDemoCandidate = await resolveQuickCheckCandidate({
        candidate: buildQuickCheckDemoCandidate(),
        methods: readyMethods,
        loadRules: fetchRules,
      });
      if (!resolvedDemoCandidate) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Quick Check demo fixture could not be resolved.", buildQuickCheckDemoCandidate());
        }
        setRecoveryState(
          buildRecoveryState({
            selectedMethodologyId: QUICK_CHECK_DEMO.methodologyId,
            claimIntents: classifyQuickCheckClaimIntents(QUICK_CHECK_DEMO.claimText),
          }),
        );
        setFieldErrors({
          general: "Demo check is unavailable right now. Try your own claim or upload evidence.",
        });
        return;
      }
      await completeQuickCheck(
        resolvedDemoCandidate,
        nextSession,
        {
          manageSubmitting: false,
          analysis: demoAnalysis,
        },
      );
    } catch (error) {
      setFieldErrors({ general: error instanceof Error ? error.message : String(error) });
    } finally {
      setSubmitting(false);
    }
  }

  function handleContinueToWorkspace() {
    const handoff = ensureQuickCheckWorkspaceHandoff(draft);
    const nextSession = { draft: handoff.draft, result, stagedUploads };
    saveQuickCheckSession(nextSession);
    setSession(nextSession);
    if (onContinueToWorkspace) {
      onContinueToWorkspace(handoff.url);
      return;
    }
    if (typeof window !== "undefined") window.location.assign(handoff.url);
  }

  function handleTryAnotherMethodology() {
    setShowMethodology(true);
    setRecoveryState(null);
    setFieldErrors({});
  }

  function handleEditClaim() {
    setRecoveryState(null);
    setFieldErrors({});
    claimRef.current?.focus();
  }

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-4xl rounded-[2.2rem] border border-[#d7d3ca] bg-[linear-gradient(180deg,rgba(252,251,247,0.98),rgba(255,255,255,0.96))] px-5 py-5 shadow-[0_38px_120px_-46px_rgba(15,23,42,0.45)] md:px-7 md:py-7">
        <div className="rounded-[1.9rem] border border-slate-900/10 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.24),_rgba(15,23,42,0.96)_60%)] px-5 py-5 text-white md:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-200">
                <Sparkles className="h-3.5 w-3.5" />
                First win flow
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-[2.4rem]">
                Check one claim
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 md:text-[15px]">
                Start with one claim and one file. Quick Check returns a clean preliminary match, then opens the full review only if you want to keep going.
              </p>
            </div>
            {loadingMethods || submitting ? <Loader2 className="mt-1 h-5 w-5 animate-spin text-slate-300" /> : null}
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/7 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Beat 01</div>
              <div className="mt-1 text-sm font-medium text-white">Write the claim</div>
              <div className="mt-1 text-sm text-slate-300">Keep it short and concrete.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/7 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Beat 02</div>
              <div className="mt-1 text-sm font-medium text-white">Add one file</div>
              <div className="mt-1 text-sm text-slate-300">PDF, photo, workbook, or CSV.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/7 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Beat 03</div>
              <div className="mt-1 text-sm font-medium text-white">Get the next step</div>
              <div className="mt-1 text-sm text-slate-300">Preliminary match first, full review second.</div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="rounded-[1.8rem] border border-[#e3ddd2] bg-white/90 p-4 md:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">01 Claim</div>
                <div className="mt-1 text-lg font-semibold text-slate-950">Say the thing you want checked</div>
              </div>
              <div className="hidden rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 md:block">
                Keep it to one sentence
              </div>
            </div>
            <label className="mt-4 grid gap-2 text-sm text-slate-700">
              <span className="font-medium text-slate-900">Claim</span>
              <textarea
                value={draft.claimText}
                onChange={(event) => {
                  const value = event.target.value;
                  updateDraft(
                    (current) => {
                      const nextMethodology = resetMethodologyForUserInput(current);
                      return {
                        ...current,
                        ...nextMethodology,
                        claimText: value,
                        matchedRequirementId: undefined,
                        matchedRequirementLabel: undefined,
                        status: "draft",
                        resultId: undefined,
                      };
                    },
                    null,
                  );
                  clearDecisionState();
                }}
                rows={3}
                placeholder="Example: The monitoring report covers the full reporting period."
                className="w-full rounded-[1.4rem] border border-slate-200 bg-[#fbfaf6] px-4 py-4 text-base leading-7 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
                ref={claimRef}
              />
              {fieldErrors.claim ? <span className="text-sm text-rose-700">{fieldErrors.claim}</span> : null}
            </label>
            <div className="mt-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Example claims</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {CLAIM_SUGGESTIONS.slice(0, 2).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      updateDraft(
                        (current) => {
                          const nextMethodology = resetMethodologyForUserInput(current);
                          return {
                            ...current,
                            ...nextMethodology,
                            claimText: suggestion,
                            matchedRequirementId: undefined,
                            matchedRequirementLabel: undefined,
                            status: "draft",
                            resultId: undefined,
                          };
                        },
                        null,
                      );
                      clearDecisionState();
                    }}
                    className="rounded-full border border-slate-200 bg-[#f7f4eb] px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-[#e3ddd2] bg-[#f8f5ed] p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">02 Evidence</div>
                <div className="mt-1 text-lg font-semibold text-slate-950">Add one piece of evidence</div>
                <div className="mt-1 text-sm text-slate-600">
                  Upload one file to run the check.
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx"
                onChange={(event) => void handleUpload(event.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-full border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <Upload className="h-4 w-4" />
                Upload evidence
              </button>
            </div>

            {!selectedEvidenceLabel ? (
              <div className="mt-4 rounded-[1.5rem] border border-dashed border-slate-300 bg-white/80 px-4 py-5 text-sm text-slate-600">
                Drop in one file or use the upload button. Quick Check works best when the file directly supports the claim you wrote above.
              </div>
            ) : (
              <>
                <div className="mt-4 flex items-center justify-between gap-3 rounded-[1.4rem] border border-slate-200 bg-white px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-900">{selectedEvidenceLabel}</div>
                    <div className="mt-1 text-xs text-slate-500">{selectedEvidenceMeta}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeEvidence(draft.evidenceIds[0] ?? "")}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-800"
                    aria-label="Remove selected evidence"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900">Extraction preview</div>
                      <div className="mt-1 text-sm text-slate-600">
                        Review the evidence signal before you run the check.
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {extractionPreviewState ? (
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${extractionStateBadgeClass(extractionPreviewState.value)}`}>
                          {extractionPreviewState.label}
                        </span>
                      ) : null}
                      {extractionState.loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
                    </div>
                  </div>

                  {extractionState.error ? (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                      Extraction preview is unavailable right now. {extractionState.error}
                    </div>
                  ) : extractionPreview ? (
                    <>
                      <div className="mt-4 grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
                        <div className="rounded-2xl border border-slate-200 bg-[#fbfaf6] px-4 py-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">What we found first</div>
                          {extractionHighlights.length ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {extractionHighlights.map((fact) => (
                                <span key={fact} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700">
                                  {fact}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-2 text-sm text-amber-900">
                              We couldn&apos;t extract enough usable data from this file for a reliable preliminary match yet.
                            </div>
                          )}
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-[#fbfaf6] px-4 py-3">
                          <div className="grid gap-2 text-sm text-slate-700">
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Source</div>
                              <div className="mt-1 font-medium text-slate-900">{sourceModeLabel(activeSourceMode)}</div>
                            </div>
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Document type</div>
                              <div className="mt-1 font-medium text-slate-900">{extractionPreview.documentType}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowExtractionDetails((value) => !value)}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                        aria-expanded={showExtractionDetails}
                      >
                        {showExtractionDetails ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        {showExtractionDetails ? "Hide extraction details" : "Show extraction details"}
                      </button>

                      {showExtractionDetails ? (
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Extraction signal</div>
                            {extractionPreviewState ? (
                              <>
                                <span className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${extractionStateBadgeClass(extractionPreviewState.value)}`}>
                                  {extractionPreviewState.label}
                                </span>
                                <div className="mt-2 text-xs text-slate-500">{extractionPreviewState.description}</div>
                              </>
                            ) : null}
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Methodology mentions</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {(extractionPreview.methodologyMentions.length ? extractionPreview.methodologyMentions : ["None detected"]).map((mention) => (
                                <span key={mention} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700">
                                  {mention}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="md:col-span-2">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Warnings</div>
                            <div className="mt-2 grid gap-2">
                              {(extractionPreview.warnings.length ? extractionPreview.warnings : ["No extraction warnings from the active source."]).map((warning) => (
                                <div key={warning} className="text-sm text-slate-600">
                                  {warning}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </>
            )}
            {fieldErrors.evidence ? <div className="mt-3 text-sm text-rose-700">{fieldErrors.evidence}</div> : null}
          </div>

          <div className="rounded-[1.6rem] border border-[#e3ddd2] bg-white/90 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleTryDemoCheck()}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-[#f7f4eb] px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Try demo check
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextValue = !showAdvancedOptions;
                    setShowAdvanced(nextValue);
                    if (!nextValue) {
                      setShowSavedEvidence(false);
                      setShowMethodology(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  aria-expanded={showAdvancedOptions}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Options
                  {showAdvancedOptions ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
              </div>

              <button
                type="button"
                disabled={!canRunQuickCheck}
                onClick={() => void runQuickCheck()}
                className="inline-flex min-w-[15rem] items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Run quick check
              </button>
            </div>
          </div>

          {showAdvancedOptions ? (
            <div className="rounded-[1.6rem] border border-slate-200 bg-white px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Options</div>
              <div className="mt-1 text-sm text-slate-600">
                Reuse saved evidence or narrow the methodology only when you want a stricter check.
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className={`rounded-2xl border px-4 py-3 ${showSavedEvidence ? "border-slate-300 bg-[#fbfaf6]" : "border-slate-200 bg-white"}`}>
                  <div className="text-sm font-medium text-slate-900">Saved evidence</div>
                  {!draft.methodologyId || !draft.methodologyVersion ? (
                    <div className="mt-2 text-sm text-slate-600">Choose a methodology first to reuse saved evidence.</div>
                  ) : (
                    <div className="mt-3">
                      <select
                        value={pendingInventoryId}
                        onChange={(event) => {
                          const value = event.target.value;
                          setPendingInventoryId(value);
                          setShowSavedEvidence(true);
                          if (value) selectExistingEvidence(value);
                        }}
                        className="min-w-0 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                      >
                        <option value="">Select saved evidence</option>
                        {availableInventory.map((item) => (
                          <option key={item.evidence_id} value={item.evidence_id}>
                            {inventoryEvidenceLabel(item)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className={`rounded-2xl border px-4 py-3 ${showMethodology ? "border-slate-300 bg-[#fbfaf6]" : "border-slate-200 bg-white"}`}>
                  <label className="grid gap-2 text-sm text-slate-700">
                    <span className="font-medium text-slate-900">Methodology</span>
                    <select
                      value={draft.methodologyId}
                      onChange={(event) => {
                        const methodologyId = event.target.value;
                        const method = methods.find((item) => item.code === methodologyId);
                        const methodologyVersion = methodologyId ? pickVersion(method, initialVersion) : "";
                        setShowMethodology(Boolean(methodologyId));
                        updateSession((current) => {
                          const stagedIds = new Set(current.stagedUploads.map((upload) => upload.evidenceId));
                          return {
                            ...current,
                            draft: {
                              ...current.draft,
                              methodologyId,
                              methodologyVersion,
                              evidenceIds: current.draft.evidenceIds.filter((id) => stagedIds.has(id)),
                              matchedRequirementId: undefined,
                              matchedRequirementLabel: undefined,
                              status: "draft",
                              result: null,
                              resultId: undefined,
                              updatedAt: nowIso(),
                            },
                            result: null,
                          };
                        });
                        setPendingInventoryId("");
                        clearDecisionState();
                      }}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                    >
                      <option value="">Any methodology</option>
                      {methods.map((method) => (
                        <option key={method.code} value={method.code}>
                          {methodOptionLabel(method)}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs text-slate-500">Optional. Use this only when you want to narrow the match.</span>
                  </label>
                </div>
              </div>
            </div>
          ) : null}

          {recoveryState ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4">
              <div className="text-sm font-semibold text-slate-900">{recoveryState.title}</div>
              <div className="mt-1 text-sm text-slate-700">{recoveryState.description}</div>
              {recoveryState.note ? <div className="mt-3 text-sm text-slate-600">{recoveryState.note}</div> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {recoveryState.kind === "weak-extraction" ? (
                  <button
                    type="button"
                    onClick={openFullReviewFromRecovery}
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Open full review
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleTryAnotherMethodology}
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Try another methodology
                    </button>
                    <button
                      type="button"
                      onClick={handleEditClaim}
                      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                    >
                      Edit claim
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== "undefined") window.location.assign("/m");
                      }}
                      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                    >
                      Open Methods
                    </button>
                    <button
                      type="button"
                      onClick={openFullReviewFromRecovery}
                      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                    >
                      Open full review
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : null}

          {fieldErrors.general ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900" role="status" aria-live="polite">
              <div className="flex items-start gap-2.5">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div>{fieldErrors.general}</div>
              </div>
            </div>
          ) : null}

          {matchCandidates.length ? (
            <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4">
              <div className="flex items-start gap-3">
                <SearchCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">Likely requirement matches</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Choose the best match for this claim.
                  </div>
                  <div className="mt-3 grid gap-2">
                    {matchCandidates.map((candidate) => (
                      <button
                        key={candidate.key}
                        type="button"
                        onClick={() => void completeQuickCheck(candidate)}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-white px-3 py-3 text-left transition hover:border-sky-300"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900">
                            {splitRequirementLabel(candidate.requirementLabel).title}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {candidate.methodologyId} · {candidate.methodologyVersion}
                            {splitRequirementLabel(candidate.requirementLabel).id
                              ? ` · ${splitRequirementLabel(candidate.requirementLabel).id}`
                              : ""}
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700">
                          Use match
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {renderedResult && normalizedResult?.match ? (
            <div
              ref={resultRef}
              tabIndex={-1}
              className={`rounded-[1.6rem] border p-5 outline-none ${resultToneClass}`}
              role="status"
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                <CheckCircle2 className={`mt-0.5 h-5 w-5 shrink-0 ${resultIconClass}`} />
                <div className="min-w-0">
                  <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${resultEyebrowClass}`}>Result</div>
                  <div className="mt-2 text-lg font-semibold text-slate-950">{resultTitle}</div>
                  <div className="mt-2 text-sm text-slate-700">{normalizedResult.claim}</div>
                  {!isGroundedResult ? (
                    <div className="mt-3 text-sm text-slate-700">
                      Evidence found, but not grounded to detected methodology.
                    </div>
                  ) : null}
                  <div className={`mt-4 grid gap-4 rounded-2xl border bg-white/75 p-4 md:grid-cols-3 ${isGroundedResult ? "border-emerald-200/80" : "border-sky-200/80"}`}>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{resultMatchLabel}</div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {normalizedRequirement?.title || normalizedResult.match.requirementLabel}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {normalizedResult.match.methodologyCode}
                        {normalizedResult.match.methodologyVersion ? ` · ${normalizedResult.match.methodologyVersion}` : ""}
                        {(normalizedRequirement?.id || normalizedResult.match.requirementId)
                          ? ` · ${normalizedRequirement?.id || normalizedResult.match.requirementId}`
                          : ""}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Source</div>
                      <div className="mt-1 text-sm font-medium text-slate-900">{sourceModeLabel(normalizedResult.sourceMode)}</div>
                      <div className="mt-1 text-xs text-slate-500">{normalizedResult.evidenceFileName || "1 item selected"}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Evidence signal</div>
                      <span className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${extractionStateBadgeClass(normalizedResult.extractionState.value)}`}>
                        {normalizedResult.extractionState.label}
                      </span>
                      <div className="mt-2 text-xs text-slate-500">
                        {resultSignalNote}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Evidence</div>
                      <div className="mt-1 text-sm font-medium text-slate-900">{normalizedResult.evidenceFileName || "1 item selected"}</div>
                      <div className="mt-1 text-xs text-slate-500">{normalizedResult.extraction.documentType}</div>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{resultMatchLabel}</div>
                      <div className="mt-2 text-sm text-slate-700">{normalizedResult.match.rationale}</div>
                      {renderedResult.citations.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {renderedResult.citations.map((citation) => (
                            <span key={citation} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700">
                              {citation}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">What we found in the file</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {normalizedResult.extraction.extractedFacts.map((fact) => (
                          <span key={fact} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                            {fact}
                          </span>
                        ))}
                      </div>
                      {normalizedResult.extraction.methodologyMentions.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {normalizedResult.extraction.methodologyMentions.map((citation) => (
                            <span key={citation} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700">
                              {citation}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white/70 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">What remains unresolved</div>
                    <div className="mt-2 grid gap-2">
                      {buildUnresolvedItems({ extraction: normalizedResult.extraction, result: renderedResult }).map((item) => (
                        <div key={item} className="text-sm text-slate-700">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleContinueToWorkspace}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                    >
                      <FolderOpen className="h-4 w-4" />
                      Open full review
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updateDraft(
                          (current) => ({
                            ...current,
                            sourceMode: undefined,
                            evidenceFileName: undefined,
                            matchedRequirementId: undefined,
                            matchedRequirementLabel: undefined,
                            evidenceIds: [],
                            status: "draft",
                            resultId: undefined,
                          }),
                          null,
                        );
                        clearDecisionState();
                      }}
                      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                    >
                      Change evidence
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updateDraft(
                          (current) => ({
                            ...current,
                            sourceMode: undefined,
                            evidenceFileName: undefined,
                            claimText: "",
                            methodologyId: initialMethod?.trim() ?? "",
                            methodologyVersion: initialVersion?.trim() ?? "",
                            matchedRequirementId: undefined,
                            matchedRequirementLabel: undefined,
                            evidenceIds: [],
                            status: "draft",
                            resultId: undefined,
                          }),
                          null,
                        );
                        clearDecisionState();
                      }}
                      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                    >
                      Start your own check
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {selectedMethodRecord && draft.methodologyVersion ? (
            <div className="text-xs text-slate-500" aria-live="polite">
              Narrowing matches to {selectedMethodRecord.code} · {draft.methodologyVersion}.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
