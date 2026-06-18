"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Loader2,
  SearchCheck,
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
  extractPdfText,
  type QuickCheckClaimIntent,
  type QuickCheckEvidenceAnalysis,
} from "@/lib/chat/quickCheckEvidence";
import { resolveQuickCheckMethodology, type QuickCheckMethodologyResolution } from "@/lib/chat/quickCheckMethodology";
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
import {
  buildExtractionPreviewViewModel,
  buildQuickCheckExtractionSnapshot,
  deriveQuickCheckExtractionState,
  normalizeQuickCheckUiResult,
} from "@/lib/chat/quickCheckUi";
import { resolveQuickCheckPdfText } from "@/lib/chat/quickCheckPdfClient";
import { coalesceEvidencePins, type EvidenceInventoryItem } from "@/lib/evidence/inventory";
import { createAndStoreEvidenceAttachment } from "@/lib/proofMap/attachments";
import { isRuleLikeId } from "@/lib/proofMap/pins";
import { loadPins, savePins } from "@/lib/proofMap/storage";
import type { EvidencePin, PddFragment } from "@/lib/proofMap/types";
import {
  buildReviewQuestionResult,
  detectRuntimeReviewPath,
  getStructuredQueryContext,
  reviewAreaLabel,
  type ReviewQuestionResult,
} from "@/lib/chat/quickCheckReviewQuestion";
import { getDocumentQaUiConfig } from "@/lib/quickCheck/documentQa";
import type { DocumentHeading } from "@/lib/chat/quickCheckSectionExtractor";
import { fetchSemanticEvidenceCandidates } from "@/lib/quickCheck/semanticEvidence/client";
import {
  getAllChecks,
  formatEvidenceCheckUiText,
  getContract,
  validateCheck,
  type CheckValidationContext,
  type EvidenceCheckResult,
} from "@/lib/quickCheck/evidenceChecks";
import { getEnabledCheckIds } from "@/lib/quickCheck/evidenceCheckGroups";
import {
  classifyDocumentPurpose,
  documentPurposeLabel,
  type DocumentPurpose,
} from "@/lib/documentClassification/classifyDocumentPurpose";

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

type ExtractionDiagnostic =
  | {
      code:
        | "file-too-large"
        | "invalid-file"
        | "upload-request-failed"
        | "parser-failed"
        | "no-selectable-text"
        | "selected-methodology-mismatch"
        | "methodology-not-detected"
        | "methodology-needs-confirmation"
        | "methodology-pack-unavailable";
      label: string;
      message: string;
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
  "Does the monitoring report cover the full reporting period?",
  "Does the boundary description match the mapped project area?",
  "The baseline methodology is clearly justified by the evidence.",
];

const GENERAL_REVIEW_QUESTION =
  "General evidence check against the selected methodology requirements.";

function nowIso(): string {
  return new Date().toISOString();
}

function newPinId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `pin-${nowIso()}-${Math.random().toString(16).slice(2)}`;
}

function resolveEffectiveClaimText(claimText: string): string {
  const normalized = claimText.trim();
  return normalized || GENERAL_REVIEW_QUESTION;
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
  filters: {
    allowedMethodologyIds?: Set<string>;
    selectedMethodologyId?: string;
    selectedMethodologyVersion?: string;
  },
  claimText: string,
  analysis: QuickCheckEvidenceAnalysis,
  claimIntents: QuickCheckClaimIntent[],
): MatchCandidate[] {
  const selectedMethod = filters.selectedMethodologyId?.trim() ?? "";
  const selectedVersion = filters.selectedMethodologyVersion?.trim() ?? "";
  const allowedMethodologyIds = filters.allowedMethodologyIds;
  const unique = new Map<string, MatchCandidate>();

  for (const result of results) {
    const methodologyId =
      (typeof result.methodology_id === "string" && result.methodology_id.trim()) ||
      (typeof result.methodologyId === "string" && result.methodologyId.trim()) ||
      "";
    if (!methodologyId) continue;
    if (allowedMethodologyIds?.size && !allowedMethodologyIds.has(methodologyId)) continue;
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
    title: "Method pack unavailable",
    description: `Detected ${methodologyId}, but no matching method pack is available.`,
    note: "Quick Check will not fall back to unrelated methods when the detected methodology is unsupported. Open full review or add the matching method pack.",
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

function extractionStateBadgeClass(value: string): string {
  if (value === "grounded") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (value === "recovered" || value === "partial" || value === "needs-review") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-rose-200 bg-rose-50 text-rose-800";
}

function confidenceLabel(value: "high" | "medium" | "low" | "unknown" | undefined): string {
  if (value === "high") return "High";
  if (value === "medium") return "Medium";
  if (value === "low") return "Low";
  return "Unknown";
}

function confidenceBarWidth(value: "high" | "medium" | "low" | "unknown" | undefined): string {
  if (value === "high") return "100%";
  if (value === "medium") return "68%";
  if (value === "low") return "36%";
  return "18%";
}

function confidenceBarTone(value: "high" | "medium" | "low" | "unknown" | undefined): string {
  if (value === "high") return "bg-emerald-500";
  if (value === "medium") return "bg-sky-500";
  if (value === "low") return "bg-amber-500";
  return "bg-slate-300";
}

function formatMethodLabel(id: string, version?: string | null): string {
  return `${id}${version ? ` · ${version}` : ""}`;
}

function renderMethodReferenceSummary(methods: Array<{ id: string; version: string | null }>): string {
  if (!methods.length) return "None detected";
  const [first, ...rest] = methods;
  const summary = formatMethodLabel(first.id, first.version);
  return rest.length > 0 ? `${summary} +${rest.length} more` : summary;
}

function buildWeakExtractionRecoveryState(): RecoveryState {
  return {
    kind: "weak-extraction",
    title: "Weak extraction",
    description: "Quick Check couldn't extract enough claim-relevant facts from this file yet.",
    note: "Open full review to inspect the evidence manually or continue with a broader workflow.",
  };
}

function methodologyMentionsForDetection(input: {
  analysis: QuickCheckEvidenceAnalysis | null;
  extraction: QuickCheckExtractionSnapshot | null;
}): string[] {
  const mentions = input.analysis?.methodologyMentions ?? input.extraction?.methodologyMentions ?? [];
  return Array.from(new Set(mentions.map((mention) => mention.trim()).filter(Boolean)));
}

function joinMethodologyLabels(values: string[]): string {
  return values.join(", ");
}

export default function QuickCheckPanel({ initialMethod, initialVersion, onContinueToWorkspace }: QuickCheckPanelProps) {
  const showReviewRoutingDiagnostic = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_VERCEL_ENV === "preview";
  const fileRef = useRef<HTMLInputElement | null>(null);
  const claimRef = useRef<HTMLTextAreaElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const rulesCache = useRef(new Map<string, RuleSummary[]>());
  const reviewQuestionRunRef = useRef(0);

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
  const [isDragActive, setIsDragActive] = useState(false);
  const [showExtractionDetails, setShowExtractionDetails] = useState(false);
  const [reviewQuestionResult, setReviewQuestionResult] = useState<ReviewQuestionResult | null>(null);
  const [documentPurpose, setDocumentPurpose] = useState<DocumentPurpose | null>(null);
  const [evidenceCheckResults, setEvidenceCheckResults] = useState<EvidenceCheckResult[]>([]);
  const [runningEvidenceChecks, setRunningEvidenceChecks] = useState(false);
  const [selectedHeading, setSelectedHeading] = useState<DocumentHeading | null>(null);
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
    // Only remove evidence IDs that were in staged uploads but the upload was removed.
    // Don't touch IDs that aren't staged — those are saved pins and may not appear
    // in inventory yet due to memo timing or methodology key mismatch.
    const stagedIds = new Set(stagedUploads.map((upload) => upload.evidenceId));
    const validStagedIds = new Set(
      stagedUploads
        .filter((upload) => draft.evidenceIds.includes(upload.evidenceId))
        .map((upload) => upload.evidenceId),
    );
    const hasDroppedStaged = draft.evidenceIds.some((id) => stagedIds.has(id) && !validStagedIds.has(id));
    if (!hasDroppedStaged) return;
    const filteredIds = draft.evidenceIds.filter((id) => !stagedIds.has(id) || validStagedIds.has(id));
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
  const effectiveClaimText = resolveEffectiveClaimText(draft.claimText);
  const canRunQuickCheck = selectedEvidenceCount === 1 && !submitting;
  const activeResultKey =
    result && draft.methodologyId.trim() && draft.methodologyVersion.trim() && draft.matchedRequirementId?.trim()
      ? `${draft.methodologyId.trim()}@@${draft.methodologyVersion.trim()}@@${draft.matchedRequirementId.trim()}`
      : null;
  const canRenderResult = Boolean(result && activeResultKey && validatedResultKey === activeResultKey);
  const renderedResult = canRenderResult ? result : null;
  const extractionPreview = useMemo(
    () => (extractionState.analysis ? buildQuickCheckExtractionSnapshot({ claimText: effectiveClaimText, analysis: extractionState.analysis }) : null),
    [effectiveClaimText, extractionState.analysis],
  );
  const extractionPreviewState = useMemo(
    () => (extractionPreview ? deriveQuickCheckExtractionState(extractionPreview) : null),
    [extractionPreview],
  );
  const detectedMethodologyMentions = useMemo(
    () => methodologyMentionsForDetection({ analysis: extractionState.analysis, extraction: extractionPreview }),
    [extractionPreview, extractionState.analysis],
  );
  const methodologyResolution = useMemo<QuickCheckMethodologyResolution>(
    () => resolveQuickCheckMethodology({ mentions: detectedMethodologyMentions, methods, rawText: extractionState.analysis?.rawPddText }),
    [detectedMethodologyMentions, extractionState.analysis?.rawPddText, methods],
  );
  const resolvedWorkspaceMethod = useMemo(
    () => (methodologyResolution.status === "single" ? methodologyResolution.matchedMethods[0] ?? null : null),
    [methodologyResolution],
  );
  const workspaceMethodologyId = useMemo(() => {
    if (draft.status !== "checked" && resolvedWorkspaceMethod?.methodologyId) {
      return resolvedWorkspaceMethod.methodologyId;
    }
    return draft.methodologyId.trim() || resolvedWorkspaceMethod?.methodologyId || "";
  }, [draft.methodologyId, draft.status, resolvedWorkspaceMethod]);
  const workspaceMethodologyVersion = useMemo(() => {
    if (draft.status !== "checked" && resolvedWorkspaceMethod?.methodologyVersion) {
      return resolvedWorkspaceMethod.methodologyVersion;
    }
    return draft.methodologyVersion.trim() || resolvedWorkspaceMethod?.methodologyVersion || "";
  }, [draft.methodologyVersion, draft.status, resolvedWorkspaceMethod]);
  const methodologyMismatch = useMemo(() => {
    if (!draft.methodologyId.trim()) return null;
    const selected = draft.methodologyId.trim().toUpperCase();
    const detectedMethodIds = new Set(methodologyResolution.matchedMethods.map((method) => method.methodologyId.toUpperCase()));
    if (detectedMethodIds.has(selected)) return null;
    const firstDetectedMethod = methodologyResolution.matchedMethods[0]?.methodologyId ?? null;
    const firstUnsupportedMethod = methodologyResolution.unsupportedCanonicalKeys[0] ?? null;
    const mismatchMethod = firstDetectedMethod ?? firstUnsupportedMethod;
    if (!mismatchMethod) return null;
    return {
      mention: mismatchMethod,
      selectedMethod: draft.methodologyId.trim(),
    };
  }, [draft.methodologyId, methodologyResolution]);
  const extractionDiagnostic = useMemo<ExtractionDiagnostic>(() => {
    if (methodologyMismatch) {
      return {
        code: "selected-methodology-mismatch",
        label: "Selected methodology mismatch",
        message: `Evidence appears to reference ${methodologyMismatch.mention}, but current selected method is ${methodologyMismatch.selectedMethod}.`,
      };
    }
    if (!extractionPreview) return null;
    if (extractionPreview.warnings.some((warning) => /quick check upload limit|file too large|exceeds the quick check upload limit/i.test(warning))) {
      return {
        code: "file-too-large",
        label: "File too large",
        message: "This PDF is too large for Quick Check extraction. Upload a smaller PDF before running Quick Check.",
      };
    }
    if (extractionPreview.warnings.some((warning) => /must be a pdf|not a valid pdf|could not process this upload as a valid pdf|missing pdf bytes/i.test(warning))) {
      return {
        code: "invalid-file",
        label: "Invalid PDF upload",
        message: "Quick Check could not process the uploaded file as a valid PDF. Try a different PDF and upload again.",
      };
    }
    if (extractionPreview.warnings.some((warning) => /request failed|service or network|extraction request failed/i.test(warning))) {
      return {
        code: "upload-request-failed",
        label: "Upload processing issue",
        message: "Quick Check could not complete server-side PDF extraction due to a request, service, or network problem. Using a local fallback (weaker results). Check your connection and try again.",
      };
    }
    if (extractionPreview.warnings.some((warning) => /no selectable text|no extractable text/i.test(warning))) {
      return {
        code: "no-selectable-text",
        label: "No selectable text",
        message: "The file appears readable, but no selectable text could be extracted from the uploaded PDF.",
      };
    }
    if (extractionPreview.warnings.some((warning) => /pdf parser fallback|pdf extraction failed|parser/i.test(warning))) {
      return {
        code: "parser-failed",
        label: "Parser failed",
        message: "Quick Check could not fully parse this PDF upload and had to fall back to a weaker extraction path.",
      };
    }
    if (methodologyResolution.status === "unsupported" && methodologyResolution.unsupportedCanonicalKeys.length) {
      const detected = methodologyResolution.primaryMethodology?.canonicalKey
        ? methodologyResolution.primaryMethodology.canonicalKey
        : joinMethodologyLabels(methodologyResolution.unsupportedCanonicalKeys);
      return {
        code: "methodology-pack-unavailable",
        label: "Method pack unavailable",
        message: `Detected ${detected}, but no matching method pack is available.`,
      };
    }
    if (methodologyResolution.status === "multiple") {
      const detected = joinMethodologyLabels(methodologyResolution.matchedMethods.map((method) => method.methodologyId));
      return {
        code: "methodology-needs-confirmation",
        label: "Methodology needs confirmation",
        message: `Evidence references multiple methodologies. Requirement matches are limited to ${detected}.`,
      };
    }
    if ((extractionPreview.signals?.parsedEvidenceCount ?? 0) > 0 && extractionPreview.methodologyMentions.length === 0) {
      return {
        code: "methodology-not-detected",
        label: "Methodology not detected",
        message: "We extracted text from the file, but did not detect a methodology reference in the uploaded evidence.",
      };
    }
    return null;
  }, [extractionPreview, methodologyMismatch, methodologyResolution]);
  const showAdvancedOptions = showAdvanced || showSavedEvidence || showMethodology;
  const extractionPreviewView = useMemo(
    () =>
      extractionState.analysis
        ? buildExtractionPreviewViewModel({
            analysis: extractionState.analysis,
            fileName: selectedEvidenceLabel,
            methodologyResolution,
            extractionSnapshot: extractionPreview,
          })
        : null,
    [extractionState.analysis, methodologyResolution, selectedEvidenceLabel, extractionPreview],
  );
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
  const hasStrongEvidenceMatch = normalizedResult?.supportStrength.value === "strong_evidence_match";
  const resultToneClass = hasStrongEvidenceMatch ? "border-emerald-200 bg-emerald-50/75" : "border-amber-200 bg-amber-50/80";
  const resultEyebrowClass = hasStrongEvidenceMatch ? "text-emerald-800" : "text-amber-800";
  const resultTitle = normalizedResult?.supportStrength.label ?? "Needs review";
  const resultSignalNote = normalizedResult?.supportStrength.description ?? "";
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

  const resolvePdfText = useCallback(
    async (input: { attachmentId: string; filename: string; mime: string; bytes: ArrayBuffer }) => {
      if (input.mime !== "application/pdf") {
        return {
          text: extractPdfText(input.bytes),
          engine: "heuristic" as const,
        };
      }
      return await resolveQuickCheckPdfText({
        bytes: input.bytes,
        filename: input.filename,
      });
    },
    [],
  );

  useEffect(() => {
    if (!selectedEvidenceSources.length) {
      setExtractionState({ loading: false, analysis: null, error: null });
      return;
    }

    let cancelled = false;
    setExtractionState({
      loading: true,
      analysis: null,
      error: null,
    });

    void analyzeQuickCheckEvidence(selectedEvidenceSources, { resolvePdfText })
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
  }, [resolvePdfText, selectedEvidenceSources]);

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
    setReviewQuestionResult(null);
    setSelectedHeading(null);
  }

  function handleHeadingClick(heading: DocumentHeading) {
    setSelectedHeading(heading);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(`§${heading.sectionNumber} ${heading.title}`).catch(() => undefined);
    }
  }

  function resetQuickCheckUi() {
    clearDecisionState();
    setPendingInventoryId("");
    setShowAdvanced(false);
    setShowSavedEvidence(false);
    setShowMethodology(false);
    setShowExtractionDetails(false);
    setEvidenceCheckResults([]);
    setRunningEvidenceChecks(false);
    setDocumentPurpose(null);
  }

  function openFullReviewFromRecovery() {
    if (workspaceMethodologyId && workspaceMethodologyVersion && onContinueToWorkspace) {
      onContinueToWorkspace(`/m/${encodeURIComponent(workspaceMethodologyId)}/v/${encodeURIComponent(workspaceMethodologyVersion)}?tab=verify&mode=list`);
      return;
    }
    if (workspaceMethodologyId && workspaceMethodologyVersion) {
      if (typeof window !== "undefined") {
        window.location.assign(`/m/${encodeURIComponent(workspaceMethodologyId)}/v/${encodeURIComponent(workspaceMethodologyVersion)}?tab=verify&mode=list`);
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

    const cachedExtraction = result.extraction ?? extractionPreview ?? null;

    void resolveQuickCheckCandidate({
      candidate,
      methods,
      loadRules: fetchRules,
    }).then(
      (resolved) => {
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
              evidenceSignals: cachedExtraction,
            }),
          );
        } else {
          setRecoveryState(
            buildRecoveryState({
              selectedMethodologyId: draft.methodologyId,
              evidenceAnalysis: undefined,
              claimIntents: classifyQuickCheckClaimIntents(effectiveClaimText),
            }),
          );
        }
        setFieldErrors({});
      },
      () => {
        if (cancelled) return;
        setFieldErrors({
          general: "Quick Check couldn't revalidate this result. Try running the check again.",
        });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [
    activeResultKey,
    draft.matchedRequirementId,
    draft.methodologyId,
    draft.methodologyVersion,
    effectiveClaimText,
    extractionPreview,
    fetchRules,
    methods,
    result,
    updateDraft,
    validatedResultKey,
  ]);

  async function buildLocalFallbackCandidates(methodSubset: MethodInventoryRecord[], analysis: QuickCheckEvidenceAnalysis): Promise<MatchCandidate[]> {
    const claimIntents = classifyQuickCheckClaimIntents(effectiveClaimText);
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
          claimText: effectiveClaimText,
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
            claimText: resolveEffectiveClaimText(activeDraft.claimText),
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

    setIsDragActive(false);
    setSubmitting(true);
    resetQuickCheckUi();
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

  function handleDragState(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    handleDragState(event);
    setIsDragActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    handleDragState(event);
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsDragActive(false);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    handleDragState(event);
    if (!isDragActive) setIsDragActive(true);
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    handleDragState(event);
    setIsDragActive(false);
    await handleUpload(event.dataTransfer.files?.[0] ?? null);
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
      const evidenceAnalysis = await analyzeQuickCheckEvidence(selectedEvidenceSources, { resolvePdfText });
      const reviewFieldText = draft.claimText.trim();
      const claimIntents = classifyQuickCheckClaimIntents(effectiveClaimText);
      const structuredQueryContext = evidenceAnalysis.rawPddText?.trim()
        ? getStructuredQueryContext(evidenceAnalysis.rawPddText)
        : undefined;
      const isReviewQuestion = detectRuntimeReviewPath({
        claimText: reviewFieldText,
        rawPddText: evidenceAnalysis.rawPddText,
        inputContext: "review_question_field",
        structuredQueryContext,
      }) === "review_question_answering";
      const currentMethodologyResolution = resolveQuickCheckMethodology({
        mentions: methodologyMentionsForDetection({ analysis: evidenceAnalysis, extraction: null }),
        methods,
      });
      if (!evidenceAnalysis.facts.length && !isReviewQuestion) {
        setFieldErrors({});
        setRecoveryState(buildWeakExtractionRecoveryState());
        return;
      }

      const resolvedMethodologyId = draft.methodologyId.trim()
        || (currentMethodologyResolution.status === "single" ? currentMethodologyResolution.matchedMethods[0]?.methodologyId ?? "" : "");
      const resolvedMethodologyVersion = draft.methodologyVersion.trim()
        || (currentMethodologyResolution.status === "single" ? currentMethodologyResolution.matchedMethods[0]?.methodologyVersion ?? "" : "");

      if (isReviewQuestion) {
        const firstSource = selectedEvidenceSources[0];
        const questionResult = buildReviewQuestionResult({
          claimText: reviewFieldText,
          methodologyId: resolvedMethodologyId,
          methodologyVersion: resolvedMethodologyVersion,
          rawPddText: evidenceAnalysis.rawPddText,
          evidenceSourceLabel: firstSource?.sourceLabel,
          evidenceDocumentType: evidenceAnalysis.documentTypes[0],
          structuredQueryContext,
        });
        const runId = reviewQuestionRunRef.current + 1;
        reviewQuestionRunRef.current = runId;
        setReviewQuestionResult({
          ...questionResult,
          semanticEvidenceStatus: evidenceAnalysis.rawPddText?.trim() ? "loading" : "disabled",
          semanticEvidenceWarning: evidenceAnalysis.rawPddText?.trim()
            ? "Loading advisory semantic evidence suggestions."
            : "No parsed PDD text was available for advisory semantic evidence suggestions.",
        });
        if (evidenceAnalysis.rawPddText?.trim()) {
          void fetchSemanticEvidenceCandidates({
            claimText: reviewFieldText,
            rawPddText: evidenceAnalysis.rawPddText,
            methodologyId: resolvedMethodologyId,
            methodologyVersion: resolvedMethodologyVersion,
          })
            .then((semanticEvidence) => {
              if (reviewQuestionRunRef.current !== runId) return;
              setReviewQuestionResult((current) => current
                ? {
                    ...current,
                    semanticEvidenceCandidates: semanticEvidence.candidates,
                    semanticEvidenceStatus: semanticEvidence.status,
                    semanticEvidenceWarning: semanticEvidence.warning,
                  }
                : current);
            })
            .catch((error) => {
              if (reviewQuestionRunRef.current !== runId) return;
              setReviewQuestionResult((current) => current
                ? {
                    ...current,
                    semanticEvidenceStatus: "request_failed",
                    semanticEvidenceWarning: error instanceof Error ? error.message : String(error),
                  }
                : current);
            });
        }
        setSelectedHeading(null);
        setFieldErrors({});
        setSubmitting(false);
        setRecoveryState(null);
        return;
      }

      if (!draft.methodologyId.trim() && currentMethodologyResolution.status === "unsupported") {
        setShowMethodology(true);
        setFieldErrors({});
        setRecoveryState(buildUnsupportedMethodRecoveryState(currentMethodologyResolution.unsupportedCanonicalKeys[0] ?? "unknown methodology"));
        return;
      }

      setReviewQuestionResult(null);
      setSelectedHeading(null);

      const selectedMethodologyId = draft.methodologyId.trim()
        || (currentMethodologyResolution.status === "single" ? currentMethodologyResolution.matchedMethods[0]?.methodologyId ?? "" : "");
      const selectedMethodologyVersion = draft.methodologyVersion.trim()
        || (currentMethodologyResolution.status === "single" ? currentMethodologyResolution.matchedMethods[0]?.methodologyVersion ?? "" : "");
      const allowedMethodologyIds = draft.methodologyId.trim()
        ? new Set([draft.methodologyId.trim()])
        : currentMethodologyResolution.status === "single" || currentMethodologyResolution.status === "multiple"
        ? new Set(currentMethodologyResolution.matchedMethods.map((method) => method.methodologyId))
        : new Set<string>();

      const queryTexts = buildQuickCheckQueryTexts(effectiveClaimText, evidenceAnalysis.facts, claimIntents);
      const responses = await Promise.all(
        queryTexts.map(async (query) => ({
          query,
          results: (await retrieveQuery(query)).results ?? [],
        })),
      );
      const mergedResults = mergeQueryResults(responses);
      const allCandidates = buildMatchCandidates(
        mergedResults,
        methods,
        {},
        effectiveClaimText,
        evidenceAnalysis,
        claimIntents,
      );
      let candidates = buildMatchCandidates(
        mergedResults,
        methods,
        {
          allowedMethodologyIds,
          selectedMethodologyId,
          selectedMethodologyVersion,
        },
        effectiveClaimText,
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
        claimPrefersMonitoringRequirement(effectiveClaimText, claimIntents) &&
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

      if (currentMethodologyResolution.status === "single" && !draft.methodologyId.trim() && !candidates.length) {
        setFieldErrors({});
        setRecoveryState(
          buildNoValidAnalysisPathRecoveryState({
            methodologyId: currentMethodologyResolution.matchedMethods[0]?.methodologyId ?? "",
            evidenceSignals: evidenceAnalysis,
          }),
        );
        return;
      }

      if (!candidates.length) {
        const methodSubset = allowedMethodologyIds.size
          ? methods.filter((method) => allowedMethodologyIds.has(method.code))
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

      if (!resolvedCandidates.length && currentMethodologyResolution.status === "single" && !draft.methodologyId.trim()) {
        setFieldErrors({});
        setRecoveryState(
          buildNoValidAnalysisPathRecoveryState({
            methodologyId: currentMethodologyResolution.matchedMethods[0]?.methodologyId ?? "",
            evidenceSignals: evidenceAnalysis,
          }),
        );
        return;
      }

      if (!draft.methodologyId.trim() && currentMethodologyResolution.status === "multiple") {
        const detectedResolvedCandidates = resolvedCandidates.filter((candidate) => allowedMethodologyIds.has(candidate.methodologyId));
        if (detectedResolvedCandidates.length) {
          setShowMethodology(true);
          setMatchCandidates(detectedResolvedCandidates);
          setFieldErrors({});
          setRecoveryState(buildMethodologyConfirmationRecoveryState());
          return;
        }
        setShowMethodology(true);
        setFieldErrors({});
        setRecoveryState(buildMethodologyConfirmationRecoveryState());
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

      if (!draft.methodologyId.trim() && currentMethodologyResolution.status === "none" && requiresMethodologyConfirmation(resolvedCandidates)) {
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

  async function runEvidenceChecks() {
    const evidenceAnalysis = await analyzeQuickCheckEvidence(selectedEvidenceSources, { resolvePdfText });
    if (!evidenceAnalysis.rawPddText?.trim()) return;

    // Classify document purpose before running checks
    const purposeClassification = classifyDocumentPurpose(evidenceAnalysis.rawPddText);
    const purpose = purposeClassification.purpose;
    setDocumentPurpose(purpose);

    const currentMethodologyResolution = resolveQuickCheckMethodology({
      mentions: methodologyMentionsForDetection({ analysis: evidenceAnalysis, extraction: null }),
      methods,
    });
    const resolvedMethodologyId = draft.methodologyId.trim()
      || (currentMethodologyResolution.status === "single" ? currentMethodologyResolution.matchedMethods[0]?.methodologyId ?? "" : "");
    const resolvedMethodologyVersion = draft.methodologyVersion.trim()
      || (currentMethodologyResolution.status === "single" ? currentMethodologyResolution.matchedMethods[0]?.methodologyVersion ?? "" : "");
    const structuredQueryContext = getStructuredQueryContext(evidenceAnalysis.rawPddText);

    // Only run checks appropriate for the detected document purpose
    const enabledCheckIds = getEnabledCheckIds(purpose, resolvedMethodologyId || undefined);
    const allChecks = getAllChecks(resolvedMethodologyId || undefined);
    const checksToRun = allChecks.filter((c) => enabledCheckIds.has(c.id));

    setRunningEvidenceChecks(true);
    const results: EvidenceCheckResult[] = [];

    for (const check of checksToRun) {
      const contract = getContract(check.id);
      const questionResult = buildReviewQuestionResult({
        claimText: check.question,
        methodologyId: resolvedMethodologyId || "VM0007",
        methodologyVersion: resolvedMethodologyVersion || "4.2",
        rawPddText: evidenceAnalysis.rawPddText,
        structuredQueryContext,
      });

      const ctx: CheckValidationContext = {
        evidenceDocument: structuredQueryContext.evidenceDocument,
        projectFactContract: structuredQueryContext.projectFactContract,
        sectionTableIndex: structuredQueryContext.sectionTableIndex,
        routerResult: questionResult.routerResult,
        queryIntentAnalysis: questionResult.queryIntentAnalysis,
        rawText: evidenceAnalysis.rawPddText,
      };

      const validated = validateCheck(contract, ctx);
      const formatted = formatEvidenceCheckUiText({
        label: check.label,
        status: validated.status,
        answerText: validated.answerText,
        downgradeReason: validated.downgradeReason,
      });
      const isFound = validated.status === "found";
      results.push({
        checkId: check.id,
        status: validated.status,
        answerText: formatted.answerText,
        downgradeReason: formatted.downgradeReason,
        quotes: isFound ? questionResult.routerResult.quotes : [],
        pages: isFound ? questionResult.routerResult.pages : [],
        sections: isFound ? questionResult.routerResult.sectionPaths : [],
        evidenceSpanIds: isFound ? questionResult.routerResult.evidenceSpanIds : [],
        warnings: questionResult.routerResult.warnings,
      });
    }

    setEvidenceCheckResults(results);
    setRunningEvidenceChecks(false);
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
      ], { resolvePdfText });
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
    const handoff = ensureQuickCheckWorkspaceHandoff({
      ...draft,
      methodologyId: workspaceMethodologyId,
      methodologyVersion: workspaceMethodologyVersion,
    });
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
      <div className="mx-auto w-full max-w-[53rem] px-4 md:px-0">
        <div className="flex flex-col items-center text-center">
          <div className="flex w-full items-start justify-center">
            <div className="w-full">
              <h1 className="text-4xl font-bold tracking-tight text-slate-950">
                Quick Check
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600 md:text-[15px]">
                Assess a carbon project document fast.
              </p>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500 md:text-[15px]">
                Upload one file. We extract the signal, detect the method, and tell you if it can support review.
              </p>
            </div>
            {loadingMethods || submitting ? <Loader2 className="mt-1 h-5 w-5 animate-spin text-slate-400" /> : null}
          </div>
        </div>

        <div className="mt-8 grid gap-8">
          <div>
            <div
              className={`rounded-[2rem] border bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] transition md:p-7 ${isDragActive ? "border-slate-950 ring-2 ring-slate-200" : "border-slate-200"}`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={(event) => void handleDrop(event)}
            >
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.xlsx,.geojson,.kml,.zip"
                onChange={(event) => void handleUpload(event.target.files?.[0] ?? null)}
              />
              <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
                <div className="max-w-xl">
                  <div className="text-xl font-semibold text-slate-950 md:text-2xl">
                    Drop your document
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    PDF, DOCX, XLSX, GEOJSON, KML, SHP ZIP
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-900"
                >
                  <Upload className="h-4 w-4" />
                  Upload document
                </button>
              </div>

              {!selectedEvidenceLabel ? (
                <div className="mt-6 rounded-[1.5rem] border border-dashed border-slate-300 bg-[linear-gradient(135deg,rgba(248,250,252,0.95),rgba(241,245,249,0.9))] px-6 py-12 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-900 shadow-sm">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div className="mt-4 text-base font-medium text-slate-900">
                    Start with the file
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    Upload first. Then confirm method and question.
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-white px-4 py-3.5 shadow-[0_12px_40px_rgba(15,23,42,0.05)] md:px-5 md:py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="text-base font-semibold text-slate-900">Extraction preview</div>
                        {extractionPreviewState ? (
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${extractionStateBadgeClass(extractionPreviewState.value)}`}>
                            {extractionPreviewState.value === "grounded" ? (
                              <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-600 text-white">
                                <Check className="h-2.5 w-2.5" />
                              </span>
                            ) : null}
                            {extractionPreviewState.label}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        {extractionState.loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
                        <button
                          type="button"
                          onClick={() => removeEvidence(draft.evidenceIds[0] ?? "")}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:border-slate-300 hover:text-slate-700"
                          aria-label="Remove selected evidence"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {extractionState.loading && !extractionPreviewView ? (
                      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        Reading document...
                      </div>
                    ) : extractionPreview && extractionPreviewView ? (
                      <>
                        {extractionPreviewView.warning ? (
                        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-sm text-amber-900">
                          {extractionPreviewView.warning}
                        </div>
                      ) : null}
                        <div className="mt-3 grid gap-3 md:grid-cols-[1.08fr_0.92fr]">
                          <div className="rounded-[1rem] border border-slate-200 bg-slate-50 px-3.5 py-3">
                            <div className="text-[0.95rem] font-semibold text-slate-900">{extractionPreviewView.signalsTitle ?? "What the file appears to contain"}</div>
                            {extractionPreviewView.signals.length ? (
                              <>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {extractionPreviewView.signals.map((signal) => (
                                    <span key={signal.label} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700">
                                      <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
                                        <Check className="h-2.5 w-2.5" />
                                      </span>
                                      {signal.label}
                                    </span>
                                  ))}
                                </div>
                                {extractionPreviewView.signalSummary ? <div className="mt-3 text-sm leading-6 text-slate-600">{extractionPreviewView.signalSummary}</div> : null}
                              </>
                            ) : (
                              <div className="mt-3 text-sm leading-6 text-slate-600">
                                {extractionPreviewView.signalSummary ?? "We read the file, but did not extract grounded review signals yet."}
                              </div>
                            )}
                          </div>
                          <div className="rounded-[1rem] border border-slate-200 bg-slate-50 px-3.5 py-3">
                            <div className="text-[0.95rem] font-semibold text-slate-900">File summary</div>
                            <div className="mt-3 grid gap-2.5 text-sm text-slate-700">
                              <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-start gap-3">
                                <div className="text-sm text-slate-500">File</div>
                                <div className="min-w-0 break-words font-medium leading-5 text-slate-900" title={extractionPreviewView.fileName || "Not detected"}>
                                  {extractionPreviewView.fileName || "Not detected"}
                                </div>
                              </div>
                              <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-start gap-3">
                                <div className="text-sm text-slate-500">Detected type</div>
                                <div className="min-w-0 break-words font-medium leading-5 text-slate-900" title={extractionPreviewView.detectedDocumentType || "Not detected"}>
                                  {extractionPreviewView.detectedDocumentType || "Not detected"}
                                </div>
                              </div>
                              {extractionPreviewView.detectedDocumentConfidence ? (
                                <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-start gap-3">
                                  <div className="text-sm text-slate-500">Confidence</div>
                                  <div className="min-w-0 break-words font-medium leading-5 text-slate-900">
                                    {extractionPreviewView.detectedDocumentConfidence}
                                  </div>
                                </div>
                              ) : null}
                              {extractionPreviewView.detectedDocumentEvidence && extractionPreviewView.detectedDocumentEvidence.length > 0 ? (
                                <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-start gap-3">
                                  <div className="text-sm text-slate-500">Evidence</div>
                                  <div className="min-w-0 space-y-1.5">
                                    {extractionPreviewView.detectedDocumentEvidence.map((item) => (
                                      <div key={item} className="break-words text-sm leading-5 text-slate-700">
                                        {item}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                              <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-start gap-3">
                                <div className="text-sm text-slate-500">Primary</div>
                                <div className="min-w-0 break-words font-medium leading-5 text-slate-900">
                                  {extractionPreviewView.primaryMethodology
                                    ? `${extractionPreviewView.primaryMethodology.id}${extractionPreviewView.primaryMethodology.version ? ` \u00b7 ${extractionPreviewView.primaryMethodology.version}` : ""}`
                                    : extractionPreviewView.detectedMethodology && extractionPreviewView.detectedMethodology !== "Not confidently detected"
                                      ? extractionPreviewView.detectedMethodology
                                      : "Not detected"}
                                </div>
                              </div>
                              {extractionPreviewView.monitoringMethodology ? (
                                <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-start gap-3">
                                  <div className="text-sm text-slate-500">Monitoring</div>
                                  <div className="min-w-0 break-words font-medium leading-5 text-slate-900">
                                    {extractionPreviewView.monitoringMethodology.id}{extractionPreviewView.monitoringMethodology.version ? ` \u00b7 ${extractionPreviewView.monitoringMethodology.version}` : ""}
                                  </div>
                                </div>
                              ) : null}
                              {extractionPreviewView.referencedMethods && extractionPreviewView.referencedMethods.length > 0 ? (
                                <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-start gap-3">
                                  <div className="text-sm text-slate-500">Referenced</div>
                                  <div className="min-w-0 break-words font-medium leading-5 text-slate-900">
                                    {renderMethodReferenceSummary(extractionPreviewView.referencedMethods)}
                                  </div>
                                </div>
                              ) : null}
                              <div>
                                <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-3">
                                  <span className="text-sm text-slate-500">Confidence</span>
                                  <span className="font-medium text-slate-700">
                                    {confidenceLabel(extractionPreviewView.methodologyConfidence)}
                                  </span>
                                </div>
                                <div className="ml-[6rem] mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                                  <div
                                    className={`h-full rounded-full ${confidenceBarTone(extractionPreviewView.methodologyConfidence)}`}
                                    style={{ width: confidenceBarWidth(extractionPreviewView.methodologyConfidence) }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowExtractionDetails((value) => !value)}
                          className="mt-2.5 flex w-full items-center justify-between rounded-xl px-1.5 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                          aria-expanded={showExtractionDetails}
                        >
                          <span>View extraction details</span>
                          {showExtractionDetails ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>

                        {showExtractionDetails ? (
                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div>
                              <div className="text-xs font-medium text-slate-500">Extraction signal</div>
                              {extractionPreviewState ? (
                                <>
                                  <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${extractionStateBadgeClass(extractionPreviewState.value)}`}>
                                    {extractionPreviewState.label}
                                  </span>
                                  <div className="mt-2 text-sm text-slate-600">{extractionPreviewState.description}</div>
                                </>
                              ) : null}
                            </div>
                            <div>
                              <div className="text-xs font-medium text-slate-500">Extraction diagnostic</div>
                              <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                                {extractionDiagnostic ? (
                                  <>
                                    <strong>{extractionDiagnostic.label}:</strong> {extractionDiagnostic.message}
                                  </>
                                ) : (
                                  "No extraction diagnostic from the active source."
                                )}
                              </div>
                            </div>
                            <div className="md:col-span-2">
                              <div className="text-xs font-medium text-slate-500">Grounded signal details</div>
                              <div className="mt-2 grid gap-2">
                                {extractionPreviewView.signals.length ? (
                                  extractionPreviewView.signals.map((signal) => (
                                    <div key={`${signal.label}-${signal.summary}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                                      <div className="font-medium text-slate-900">{signal.label}</div>
                                      {signal.summary ? <div className="mt-1 text-slate-600">{signal.summary}</div> : null}
                                    </div>
                                  ))
                                ) : (
                                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                                    No grounded signal details were extracted from the active source.
                                  </div>
                                )}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-slate-500">Methodology references</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {extractionPreviewView.referencedMethods && extractionPreviewView.referencedMethods.length > 0
                                  ? extractionPreviewView.referencedMethods.map((m) => (
                                      <span key={`${m.id}-${m.version ?? ""}`} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700">
                                        {formatMethodLabel(m.id, m.version)}
                                      </span>
                                    ))
                                  : extractionPreview.methodologyMentions.length > 0
                                    ? extractionPreview.methodologyMentions.map((mention) => (
                                        <span key={mention} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700">
                                          {mention}
                                        </span>
                                      ))
                                    : <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700">None detected</span>}
                              </div>
                            </div>
                            <div className="md:col-span-2">
                              <div className="text-xs font-medium text-slate-500">Warnings</div>
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
                    ) : extractionState.error || (extractionDiagnostic && ["file-too-large", "invalid-file", "upload-request-failed", "no-selectable-text", "parser-failed"].includes(extractionDiagnostic.code)) ? (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        {extractionDiagnostic?.message ?? `Extraction preview is unavailable right now. ${extractionState.error ?? ""}`.trim()} Try uploading a cleaner PDF or retrying the upload.
                      </div>
                    ) : null}
                  </div>
                </>
              )}
            </div>
            {fieldErrors.evidence ? <div className="mt-3 text-sm text-rose-700">{fieldErrors.evidence}</div> : null}
          </div>

          {/* ── Evidence Checks ─────────────────────────────────────── */}
          {selectedEvidenceSources.length > 0 && !submitting ? (
            <div className="rounded-[1.6rem] border border-emerald-200 bg-emerald-50/60 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-emerald-900">Evidence Checks</div>
                  <div className="mt-1 text-xs text-emerald-700">
                    {documentPurpose ? (
                      <>Detected: {documentPurposeLabel(documentPurpose)}</>
                    ) : (
                      <>Check whether your document contains evidence for key verification topics.</>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void runEvidenceChecks()}
                  disabled={runningEvidenceChecks}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                >
                  {runningEvidenceChecks ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SearchCheck className="h-3.5 w-3.5" />}
                  Run Checks
                </button>
              </div>

              {runningEvidenceChecks ? (
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Running checks&hellip;
                </div>
              ) : evidenceCheckResults.length > 0 ? (
                <div className="mt-4 grid gap-1.5">
                  {evidenceCheckResults.map((result) => {
                    const checkDef = getAllChecks(draft.methodologyId.trim() || undefined).find((c) => c.id === result.checkId);
                    const label = checkDef?.label ?? result.checkId;
                    const methodologyLabel = checkDef?.methodologySpecific;
                    const statusColors = result.status === "found" ? "bg-emerald-500" : result.status === "missing" ? "bg-rose-400" : result.status === "not_applicable" ? "bg-slate-300" : "bg-amber-400";
                    const badgeColors = result.status === "found" ? "bg-emerald-100 text-emerald-700" : result.status === "missing" ? "bg-rose-100 text-rose-700" : result.status === "not_applicable" ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-700";
                    const statusLabel = result.status === "found" ? "Found" : result.status === "missing" ? "Missing" : result.status === "not_applicable" ? "N/A" : "Unclear";
                    return (
                      <details key={result.checkId} className="group rounded-xl border border-slate-100 bg-white/80">
                        <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm">
                          <span className={`inline-block h-2 w-2 rounded-full ${statusColors}`} />
                          <span className={`font-medium ${result.status === "not_applicable" ? "text-slate-400" : "text-slate-800"}`}>{label}</span>
                          {methodologyLabel ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{methodologyLabel}</span> : null}
                          <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${badgeColors}`}>{statusLabel}</span>
                        </summary>
                        <div className="border-t border-slate-100 px-3 py-2 text-sm">
                          {result.status === "found" ? (
                            <>
                              <div className="text-xs text-slate-700">{result.answerText}</div>
                              {result.quotes.length > 0 ? (
                                <div className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-600 italic">
                                  &ldquo;{result.quotes[0]?.slice(0, 280)}{(result.quotes[0]?.length ?? 0) > 280 ? "\u2026" : ""}&rdquo;
                                </div>
                              ) : null}
                              <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-slate-400">
                                {result.pages.length > 0 ? <span>p.{result.pages.join(", ")}</span> : null}
                                {result.sections.length > 0 ? <span>{result.sections.join(" \u203a ")}</span> : null}
                                {result.evidenceSpanIds.length > 0 ? <span>{result.evidenceSpanIds.length} span(s)</span> : null}
                              </div>
                            </>
                          ) : result.status === "missing" ? (
                            <div className="text-xs text-slate-500">{result.answerText}</div>
                          ) : result.status === "not_applicable" ? (
                            <div className="text-xs text-slate-400">Not applicable for this document type.</div>
                          ) : (
                            <div className="text-xs text-slate-500">
                              {result.answerText}
                              {result.downgradeReason ? (
                                <div className="mt-1 text-[10px] text-slate-400">{result.downgradeReason}</div>
                              ) : null}
                            </div>
                          )}
                          <button
                            type="button"
                            className="mt-2 flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[10px] text-slate-400 hover:border-slate-300 hover:text-slate-600"
                            onClick={() => {
                              const correction = {
                                documentId: extractionPreviewView?.fileName ?? "",
                                documentName: extractionPreviewView?.fileName ?? "",
                                documentType: extractionPreviewView?.detectedDocumentType ?? "",
                                methodologyId: draft.methodologyId,
                                checkId: result.checkId,
                                currentAnswer: result.answerText,
                                currentStatus: result.status,
                                currentQuote: result.quotes[0] ?? "",
                                currentPage: result.pages[0] ?? null,
                                currentSection: result.sections[0] ?? "",
                                evidenceSpanIds: result.evidenceSpanIds,
                                correctedAnswer: "",
                                correctedQuote: "",
                                correctedPage: null,
                                correctedSection: "",
                                confidence: 0,
                                failureReason: "",
                              };
                              const blob = new Blob([JSON.stringify(correction, null, 2)], { type: "application/json" });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `correction-${result.checkId}-${Date.now()}.json`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                          >
                            Export correction
                          </button>
                        </div>
                      </details>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className={`rounded-[1.6rem] border px-4 py-4 ${showMethodology ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white"}`}>
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
              <span className="text-xs text-slate-500">
                Confirm or narrow the method.
              </span>
            </label>
          </div>

          <div className="rounded-[1.6rem] border border-slate-200 bg-white px-4 py-4">
            <label className="grid gap-2 text-sm text-slate-700">
              <span className="font-medium text-slate-900">Review question</span>
              <span className="text-xs text-slate-500">
                Optional. Leave blank for a general check.
              </span>
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
                rows={4}
                placeholder="Does this file support the selected methodology?"
                className="w-full rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4 text-base leading-7 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
                ref={claimRef}
              />
              {fieldErrors.claim ? <span className="text-sm text-rose-700">{fieldErrors.claim}</span> : null}
            </label>
            <div className="mt-4">
              <div className="text-xs text-slate-400">Try an example</div>
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
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <button
              type="button"
              disabled={!canRunQuickCheck}
              onClick={() => void runQuickCheck()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-black px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-neutral-900 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Run Quick Check
            </button>
            {process.env.NODE_ENV !== "production" ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleTryDemoCheck()}
                  disabled={submitting}
                  className="text-xs text-slate-400 underline underline-offset-4 transition hover:text-slate-600 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  Try demo check
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextValue = !showAdvancedOptions;
                    setShowAdvanced(nextValue);
                    if (!nextValue) {
                      setShowSavedEvidence(false);
                    }
                  }}
                  className="text-xs text-slate-400 underline underline-offset-4 transition hover:text-slate-600"
                  aria-expanded={showAdvancedOptions}
                >
                  Options
                </button>
              </div>
            ) : null}
          </div>
          
          {showAdvancedOptions ? (
            <div className="rounded-[1.6rem] border border-slate-200 bg-white px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Options</div>
              <div className="mt-4">
                <div className={`rounded-2xl border px-4 py-3 ${showSavedEvidence ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white"}`}>
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
              </div>
            </div>
          ) : null}

          {reviewQuestionResult ? (
            <div className="rounded-[1.6rem] border border-sky-200 bg-sky-50/80 p-5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-800">Review question</div>
                  <div className="mt-2 text-sm text-slate-600">{draft.claimText}</div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Review area (classified)</div>
                      <div className="mt-1 text-sm font-medium text-slate-900">{reviewAreaLabel(reviewQuestionResult.reviewArea)}</div>
                    </div>
                    {reviewQuestionResult.methodologyId ? (
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Methodology (from input)</div>
                        <div className="mt-1 text-sm font-medium text-slate-900">{reviewQuestionResult.methodologyId} · {reviewQuestionResult.methodologyVersion || "—"}</div>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-4 rounded-xl border border-sky-200 bg-white/80 p-4">
                    <div className="flex items-center gap-2">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">Document Q&amp;A</div>
                      {(() => {
                        const qaUi = getDocumentQaUiConfig(reviewQuestionResult.documentAnswer);
                        return (
                          <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] border ${qaUi.badgeClasses}`}>
                            {qaUi.statusLabel}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="mt-2 text-sm leading-relaxed text-slate-700">
                      {getDocumentQaUiConfig(reviewQuestionResult.documentAnswer).explanation}
                    </div>
                    <div className="mt-2 text-xs leading-relaxed text-slate-600">
                      {reviewQuestionResult.documentAnswer.methodologyExplanation}
                    </div>
                    {reviewQuestionResult.routerResult.status === "answered" ? (
                      <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Answer</div>
                        <div className="mt-1 text-sm leading-relaxed text-slate-800">{reviewQuestionResult.routerResult.answerText}</div>
                      </div>
                    ) : null}
                    {(() => {
                      const da = reviewQuestionResult.documentAnswer;
                      const isUnclearWeak = da.status === "unclear" && da.explanation.includes("does not directly address");

                      if (isUnclearWeak) {
                        return (
                          <>
                            <div className="mt-3 text-sm leading-relaxed text-slate-600 italic">
                              No directly relevant evidence was found for this question.
                            </div>
                            <details className="mt-2">
                              <summary className="text-xs font-medium text-slate-400 cursor-pointer hover:text-slate-600 select-none">Technical details</summary>
                              <div className="mt-2 space-y-3">
                                {(process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_VERCEL_ENV === "preview") ? (
                                  <div className="text-[11px] leading-relaxed text-slate-500">
                                    route: {reviewQuestionResult.documentDiagnostic.inputRoute} • raw text: {reviewQuestionResult.documentDiagnostic.rawTextAvailable ? "available" : "unavailable"} • evidence: {reviewQuestionResult.documentDiagnostic.documentEvidenceCount} • methodology matched: {reviewQuestionResult.documentDiagnostic.methodologyRuleMatched ? "yes" : "no"} • recovery suppressed: {reviewQuestionResult.documentDiagnostic.methodologyRecoverySuppressedByDocumentQa ? "yes" : "no"}
                                  </div>
                                ) : null}
                                {da.evidence.length > 0 ? (
                                  <div className="space-y-2">
                                    {da.evidence.map((item, index) => (
                                      <div key={`${item.source}:${item.sectionNumber ?? item.blockId ?? index}`} className="rounded-lg border border-sky-100 bg-sky-50/40 p-3">
                                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">Source text (verbatim)</div>
                                        <div className="text-[11px] text-sky-800">
                                          {[item.sectionNumber ? `§${item.sectionNumber}` : null, item.heading, item.page ? `p. ${item.page}` : null, item.blockId].filter(Boolean).join(" • ")}
                                        </div>
                                        <div className="mt-1 text-sm leading-relaxed text-slate-700">{item.snippet}</div>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                                {reviewQuestionResult.semanticEvidenceCandidates && reviewQuestionResult.semanticEvidenceCandidates.length > 0 ? (
                                  <div className="space-y-2">
                                    {reviewQuestionResult.semanticEvidenceCandidates.map((candidate) => (
                                      <div key={`${candidate.blockId}:${candidate.quote}`} className="rounded-lg border border-violet-100 bg-violet-50/40 p-3">
                                        <div className="text-[11px] text-violet-800">
                                          {[candidate.heading, candidate.page ? `p. ${candidate.page}` : null, candidate.blockId].filter(Boolean).join(" • ")}
                                        </div>
                                        <div className="mt-1 text-sm leading-relaxed text-slate-700">{candidate.quote}</div>
                                        <div className="mt-1 text-xs leading-relaxed text-slate-600">{candidate.reason}</div>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                                {reviewQuestionResult.semanticEvidenceWarning ? (
                                  <div className="text-xs leading-relaxed text-slate-500">
                                    {reviewQuestionResult.semanticEvidenceWarning}
                                  </div>
                                ) : null}
                              </div>
                            </details>
                          </>
                        );
                      }

                      // Non-unclear: show evidence inline, technical details collapsed
                      const routeDiagVisible = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_VERCEL_ENV === "preview";
                      const hasSemanticCandidates = reviewQuestionResult.semanticEvidenceCandidates && reviewQuestionResult.semanticEvidenceCandidates.length > 0;
                      const hasTechnicalContent = routeDiagVisible || hasSemanticCandidates || reviewQuestionResult.semanticEvidenceWarning;

                      return (
                        <>
                          {da.evidence.length > 0 ? (
                            <div className="mt-3 space-y-2">
                              {da.evidence.map((item, index) => (
                                <div key={`${item.source}:${item.sectionNumber ?? item.blockId ?? index}`} className="rounded-lg border border-sky-100 bg-sky-50/40 p-3">
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">Source text (verbatim)</div>
                                  <div className="text-[11px] text-sky-800">
                                    {[item.sectionNumber ? `§${item.sectionNumber}` : null, item.heading, item.page ? `p. ${item.page}` : null, item.blockId].filter(Boolean).join(" • ")}
                                  </div>
                                  <div className="mt-1 text-sm leading-relaxed text-slate-700">{item.snippet}</div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {hasTechnicalContent ? (
                            <details className="mt-2">
                              <summary className="text-xs font-medium text-slate-400 cursor-pointer hover:text-slate-600 select-none">Technical details</summary>
                              <div className="mt-2 space-y-3">
                                {routeDiagVisible ? (
                                  <div className="text-[11px] leading-relaxed text-slate-500">
                                    route: {reviewQuestionResult.documentDiagnostic.inputRoute} • raw text: {reviewQuestionResult.documentDiagnostic.rawTextAvailable ? "available" : "unavailable"} • evidence: {reviewQuestionResult.documentDiagnostic.documentEvidenceCount} • methodology matched: {reviewQuestionResult.documentDiagnostic.methodologyRuleMatched ? "yes" : "no"} • recovery suppressed: {reviewQuestionResult.documentDiagnostic.methodologyRecoverySuppressedByDocumentQa ? "yes" : "no"}
                                  </div>
                                ) : null}
                                {hasSemanticCandidates ? (
                                  <div className="space-y-2">
                                    {reviewQuestionResult.semanticEvidenceCandidates!.map((candidate) => (
                                      <div key={`${candidate.blockId}:${candidate.quote}`} className="rounded-lg border border-violet-100 bg-violet-50/40 p-3">
                                        <div className="text-[11px] text-violet-800">
                                          {[candidate.heading, candidate.page ? `p. ${candidate.page}` : null, candidate.blockId].filter(Boolean).join(" • ")}
                                        </div>
                                        <div className="mt-1 text-sm leading-relaxed text-slate-700">{candidate.quote}</div>
                                        <div className="mt-1 text-xs leading-relaxed text-slate-600">{candidate.reason}</div>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                                {reviewQuestionResult.semanticEvidenceWarning ? (
                                  <div className="text-xs leading-relaxed text-slate-500">
                                    {reviewQuestionResult.semanticEvidenceWarning}
                                  </div>
                                ) : null}
                              </div>
                            </details>
                          ) : null}
                        </>
                      );
                    })()}
                  </div>
                  {reviewQuestionResult.reviewAreaReview ? (
                    <div className="mt-4 rounded-xl border border-emerald-200 bg-white/80 p-4">
                      <div className="flex items-center gap-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                          {reviewQuestionResult.reviewArea === "baseline"
                            ? "Baseline review"
                            : `${reviewAreaLabel(reviewQuestionResult.reviewArea)} review`}
                        </div>
                        {(() => {
                          const v = reviewQuestionResult.reviewAreaReview.verdict;
                          const badge =
                            v === "supported"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                              : v === "partial"
                                ? "bg-amber-100 text-amber-800 border-amber-200"
                                : "bg-rose-100 text-rose-800 border-rose-200";
                          return (
                            <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] border ${badge}`}>
                              {v}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="mt-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Evidence summary</div>
                        <div className="mt-1 text-sm leading-relaxed text-slate-700">
                          {reviewQuestionResult.reviewAreaReview.evidence_summary}
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Cited sections</div>
                        <div className="mt-1 text-sm text-slate-700 font-mono">
                          {reviewQuestionResult.reviewAreaReview.cited_sections.length > 0
                            ? reviewQuestionResult.reviewAreaReview.cited_sections.map((section) => `§${section}`).join(", ")
                            : "None"}
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Gaps</div>
                        {reviewQuestionResult.reviewAreaReview.gaps.length > 0 ? (
                          <ul className="mt-1 list-disc pl-5 text-sm leading-relaxed text-slate-700">
                            {reviewQuestionResult.reviewAreaReview.gaps.map((gap) => (
                              <li key={gap}>{gap}</li>
                            ))}
                          </ul>
                        ) : (
                          <div className="mt-1 text-sm text-emerald-700">
                            None identified — the extracted PDD content meets the current Quick Check rubric for this review area.
                          </div>
                        )}
                      </div>
                      <div className="mt-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Recommended follow-up documents</div>
                        <ul className="mt-1 list-disc pl-5 text-sm leading-relaxed text-slate-700">
                          {reviewQuestionResult.reviewAreaReview.recommended_follow_up_documents.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">
                        Conservative Quick Check signal only. This is not a review-grade certainty finding.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-white/80 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">Methodology lane</div>
                      <div className="mt-2 text-sm leading-relaxed text-slate-700">
                        {reviewQuestionResult.documentAnswer.methodologyExplanation}
                      </div>
                    </div>
                  )}
                  {(() => {
                    const da = reviewQuestionResult.documentAnswer;
                    const evidenceSectionNumbers = new Set(da.evidence.map((e) => e.sectionNumber).filter(Boolean));
                    const filteredHeadings = reviewQuestionResult.matchedHeadings.filter((h) => !evidenceSectionNumbers.has(h.sectionNumber));

                    const headingIndexContent = (
                      <>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Document heading index (Phase 1 — title matching)</div>
                        <p className="mt-1 text-xs text-slate-500">Headings extracted from uploaded PDD. Quick Check matches section titles using your question, with limited methodology-aware fallback for certain review areas.</p>
                        {filteredHeadings.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            {filteredHeadings.map((h) => {
                              const isSelected = selectedHeading?.sectionNumber === h.sectionNumber;
                              return (
                                <button
                                  key={h.sectionNumber}
                                  type="button"
                                  onClick={() => handleHeadingClick(h)}
                                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${isSelected ? "border-sky-400 bg-sky-100" : "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50"}`}
                                >
                                  <div className="flex items-baseline gap-2">
                                    <span className="font-mono text-xs font-semibold text-sky-700">§{h.sectionNumber}</span>
                                    <span className="text-sm font-medium text-slate-900">{h.title}</span>
                                  </div>
                                  {h.bodyPreview ? (
                                    <div className="mt-1.5 text-xs leading-relaxed text-slate-600 line-clamp-2">{h.bodyPreview}</div>
                                  ) : null}
                                  <div className="mt-1 text-[10px] text-slate-400">Click to select / copy reference</div>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="mt-2 space-y-1">
                            <div className="text-sm text-amber-700">
                              No matching document section found.
                            </div>
                            {reviewQuestionResult.noMatchExplanation ? (
                              <div className="text-xs leading-relaxed text-amber-800">
                                {reviewQuestionResult.noMatchExplanation}
                              </div>
                            ) : null}
                          </div>
                        )}

                        {selectedHeading ? (
                          <div className="mt-3 rounded-xl border border-sky-300 bg-white p-4">
                            <div className="text-xs font-semibold text-sky-700">Selected: §{selectedHeading.sectionNumber} {selectedHeading.title}</div>
                            <div className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-slate-700 border border-slate-100 bg-slate-50 p-2 rounded">
                              {selectedHeading.bodyText || selectedHeading.bodyPreview}
                            </div>
                            <div className="mt-2 text-[10px] text-slate-500">Reference copied to clipboard. Use in full review for evidence citation.</div>
                          </div>
                        ) : null}

                        {filteredHeadings.length === 0 && reviewQuestionResult.headingIndex.length > 0 ? (
                          <details className="mt-2 text-xs">
                            <summary className="cursor-pointer text-slate-500">Show all {reviewQuestionResult.headingIndex.length} headings from document</summary>
                            <div className="mt-2 grid gap-1">
                              {reviewQuestionResult.headingIndex.slice(0, 12).map((h) => (
                                <button key={h.sectionNumber} type="button" onClick={() => handleHeadingClick(h)} className="text-left text-[11px] text-slate-600 hover:text-sky-700 font-mono">§{h.sectionNumber} {h.title}</button>
                              ))}
                            </div>
                          </details>
                        ) : null}

                        <p className="mt-2 text-xs text-slate-500">
                          Open full review to inspect these sections against the full document and methodology.
                        </p>
                        {reviewQuestionResult.routingDiagnostic && showReviewRoutingDiagnostic ? (
                          <details className="mt-3 text-xs">
                            <summary className="cursor-pointer font-medium text-slate-500 hover:text-slate-700">
                              Review routing diagnostic
                            </summary>
                            <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3 text-[11px] leading-relaxed text-slate-600">
                              <div><span className="font-semibold text-slate-500">Question: </span>{reviewQuestionResult.routingDiagnostic.inputReviewQuestion}</div>
                              <div><span className="font-semibold text-slate-500">Review area: </span>{reviewQuestionResult.routingDiagnostic.classifiedReviewArea}</div>
                              <div>
                                <span className="font-semibold text-slate-500">Selected methodology: </span>
                                {reviewQuestionResult.routingDiagnostic.selectedMethodology.methodologyId || "none"}
                                {reviewQuestionResult.routingDiagnostic.selectedMethodology.methodologyVersion
                                  ? ` ${reviewQuestionResult.routingDiagnostic.selectedMethodology.methodologyVersion}`
                                  : ""}
                              </div>
                              <div className="mt-2">
                                <div className="font-semibold text-slate-500">Candidate methodology headings found</div>
                                {reviewQuestionResult.routingDiagnostic.candidateMethodologyHeadingsFound.length > 0 ? (
                                  <ul className="mt-1 list-disc pl-5">
                                    {reviewQuestionResult.routingDiagnostic.candidateMethodologyHeadingsFound.map((heading) => (
                                      <li key={`${heading.sectionNumber}:${heading.title}`} className="font-mono">
                                        §{heading.sectionNumber} {heading.title}
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <div className="mt-1">None</div>
                                )}
                              </div>
                              <div className="mt-2">
                                <div className="font-semibold text-slate-500">Final routing decision</div>
                                {reviewQuestionResult.routingDiagnostic.finalMatch ? (
                                  <div className="mt-1 font-mono">
                                    {reviewQuestionResult.routingDiagnostic.finalMatch.matchStage}: §{reviewQuestionResult.routingDiagnostic.finalMatch.heading.sectionNumber} {reviewQuestionResult.routingDiagnostic.finalMatch.heading.title}
                                  </div>
                                ) : (
                                  <div className="mt-1">{reviewQuestionResult.routingDiagnostic.noMatchReason ?? "No match selected."}</div>
                                )}
                              </div>
                            </div>
                          </details>
                        ) : null}
                        {reviewQuestionResult.phase1Diagnostic && process.env.NODE_ENV !== "production" ? (
                          <details className="mt-3" open>
                            <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
                              Extraction diagnostic
                            </summary>
                            {reviewQuestionResult.phase1Diagnostic.sectionCandidates ? (
                              <div className="mt-2 space-y-2">
                                {Object.entries(reviewQuestionResult.phase1Diagnostic.sectionCandidates).map(([num, info]) => (
                                  <details key={num} className="rounded-lg border border-slate-200 bg-white text-[10px]">
                                    <summary className="cursor-pointer px-3 py-2 font-medium text-slate-700 hover:bg-slate-50">
                                      Section {num} — {info.selectedCandidate.includes("all") ? "⚠" : "✓"} {info.selectedCandidate.slice(0, 80)}
                                    </summary>
                                    <div className="border-t border-slate-100 px-3 py-2 text-slate-600">
                                      <div className="mb-1">
                                        <span className="font-semibold text-slate-500">Reason: </span>
                                        {info.selectedReason}
                                      </div>
                                      {info.allCandidateLines.length > 0 && (
                                        <div className="mb-1">
                                          <span className="font-semibold text-slate-500">Candidates ({info.allCandidateLines.length}):</span>
                                          <ul className="ml-2 list-disc list-inside">
                                            {info.allCandidateLines.map((line, idx) => (
                                              <li key={idx} className="truncate font-mono">{line}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      {info.rejectedCandidates.length > 0 && (
                                        <div className="mb-1">
                                          <span className="font-semibold text-slate-500">Rejected:</span>
                                          <ul className="ml-2 list-disc list-inside">
                                            {info.rejectedCandidates.map((reason, idx) => (
                                              <li key={idx} className="truncate font-mono text-rose-600">{reason}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      <div>
                                        <span className="font-semibold text-slate-500">Body preview: </span>
                                        <span className="font-mono">{info.sectionBodyPreview}</span>
                                      </div>
                                    </div>
                                  </details>
                                ))}
                              </div>
                            ) : null}
                            <pre className="mt-2 max-h-80 overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-[10px] leading-relaxed text-slate-600">
                              {JSON.stringify(reviewQuestionResult.phase1Diagnostic, null, 2)}
                            </pre>
                          </details>
                        ) : null}
                      </>
                    );

                    return (
                      <details className="mt-4">
                        <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700 select-none">Technical details</summary>
                        <div className="mt-3 space-y-3">
                          {headingIndexContent}
                        </div>
                      </details>
                    );
                  })()}
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setReviewQuestionResult(null)}
                      className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-800 transition hover:border-sky-300"
                    >
                      Return to requirement match
                    </button>
                  </div>
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
                    className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white"
                  >
                    Open full review
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleTryAnotherMethodology}
                      className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white"
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
              <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${resultEyebrowClass}`}>{resultTitle}</div>
              <div className="mt-2 text-sm text-slate-600">{normalizedResult.claim}</div>
              <div className="mt-2 text-sm text-slate-700">{resultSignalNote}</div>
              <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 px-4 py-3">
                <div className="text-sm text-slate-800">
                  {normalizedResult.match.rationale}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${extractionStateBadgeClass(normalizedResult.extractionState.value)}`}>
                  {normalizedResult.extractionState.label} evidence signal
                </span>
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleContinueToWorkspace}
                  className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white"
                >
                  <FolderOpen className="h-4 w-4" />
                  Open full review
                </button>
              </div>
            </div>
          ) : null}

          {(selectedMethodRecord && draft.methodologyVersion) || (methodologyResolution.status === "single" && !draft.methodologyId.trim()) ? (
            <div className="text-xs text-slate-500" aria-live="polite">
              Narrowing matches to {(selectedMethodRecord?.code ?? methodologyResolution.matchedMethods[0]?.methodologyId) ?? ""} · {(draft.methodologyVersion || methodologyResolution.matchedMethods[0]?.methodologyVersion) ?? ""}.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
