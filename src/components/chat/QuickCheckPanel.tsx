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
  type QuickCheckResult,
  type QuickCheckStagedUpload,
} from "@/lib/chat/quickCheck";
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

type QuickCheckSessionState = {
  draft: QuickCheckDraft;
  result: QuickCheckResult | null;
  stagedUploads: QuickCheckStagedUpload[];
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
  | null;

type QueryResultWithSignals = QueryResponse["results"][number] & {
  _signalBoost: number;
  _matchedQueries: string[];
};

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

function boostForEvidenceFacts(result: QueryResultWithSignals, analysis: QuickCheckEvidenceAnalysis): number {
  const haystack = `${pickRequirementLabel(result)} ${result.text ?? ""} ${(result.tags ?? []).join(" ")} ${(result.refs ?? []).join(" ")}`.toLowerCase();
  let boost = 0;
  for (const fact of analysis.facts) {
    if (fact.category === "boundary" && haystack.includes("boundary")) boost += 0.16;
    if (fact.category === "monitoring-plan" && haystack.includes("monitoring")) boost += 0.16;
    if (fact.category === "workbook-reference" && (haystack.includes("workbook") || haystack.includes("spreadsheet"))) boost += 0.12;
    if (fact.category === "monitoring-evidence" && haystack.includes("monitoring")) boost += 0.1;
    if (fact.category === "plot-count" && (haystack.includes("plot") || haystack.includes("sampling") || haystack.includes("monitoring"))) boost += 0.12;
    if (fact.category === "reporting-period" && (haystack.includes("period") || haystack.includes("monitoring"))) boost += 0.12;
    if (fact.category === "monitoring-records" && (haystack.includes("monitoring") || haystack.includes("workbook"))) boost += 0.1;
    if (fact.category === "qa-summary" && (haystack.includes("quality") || haystack.includes("review") || haystack.includes("qa"))) boost += 0.08;
  }
  return Math.min(boost, 0.4);
}

function buildMatchCandidates(
  results: QueryResultWithSignals[],
  methods: MethodInventoryRecord[],
  selectedMethodologyId: string,
  selectedMethodologyVersion: string,
  analysis: QuickCheckEvidenceAnalysis,
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
    const score = Number((baseScore + result._signalBoost + boostForEvidenceFacts(result, analysis)).toFixed(4));
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

function isAmbiguousMatch(candidates: MatchCandidate[]): boolean {
  if (candidates.length <= 1) return false;
  const [first, second] = candidates;
  if (!first || !second) return false;
  if (first.score == null || second.score == null) return true;
  return Math.abs(first.score - second.score) < 0.05;
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
}): RecoveryState {
  if (input.selectedMethodologyId.trim()) {
    return {
      kind: "no-match",
      title: `No clear match in ${input.selectedMethodologyId} yet`,
      description: "The current methodology narrowing is stricter than the evidence signals we found.",
      note: "Try another methodology or keep the claim and broaden the check.",
    };
  }
  return {
    kind: "no-match",
    title: "No clear match yet",
    description: "We couldn't find a requirement to check from this claim and evidence yet.",
    note: "Edit the claim or try another methodology to guide the check.",
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
  const [matchCandidates, setMatchCandidates] = useState<MatchCandidate[]>([]);
  const [pendingInventoryId, setPendingInventoryId] = useState("");
  const [showSavedEvidence, setShowSavedEvidence] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
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

  useEffect(() => {
    let cancelled = false;
    setLoadingMethods(true);
    fetch("/api/methods/inventory", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Method inventory request failed with ${response.status}`);
        const payload = (await response.json()) as { methods?: MethodInventoryRecord[] };
        if (cancelled) return;
        const nextMethods = Array.isArray(payload.methods) ? payload.methods : [];
        setMethods(nextMethods.sort((a, b) => a.code.localeCompare(b.code)));
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
  }, []);

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
  const selectedEvidenceLabel = selectedUpload
    ? selectedUpload.filename
    : selectedInventoryItem
    ? selectedInventoryItem.display_name
    : "";
  const selectedEvidenceMeta = selectedUpload
    ? "Uploaded evidence"
    : selectedInventoryItem
    ? `${selectedInventoryItem.type} from saved evidence`
    : "";
  const canRunQuickCheck = Boolean(draft.claimText.trim()) && selectedEvidenceCount === 1 && !submitting;
  const resultRequirement = splitRequirementLabel(result?.requirementLabel ?? "");
  const selectedEvidenceSources = useMemo(() => {
    const sources = new Map<string, { evidenceId: string; sourceLabel: string; attachments: EvidencePin["attachments"]; pddFragments?: PddFragment[] }>();

    for (const item of selectedInventoryEvidence) {
      const pin = selectedPins.find((candidate) => candidate.id === item.evidence_id) ?? null;
      sources.set(item.evidence_id, {
        evidenceId: item.evidence_id,
        sourceLabel: item.display_name,
        attachments: pin?.attachments ?? [],
        pddFragments: item.pdd_fragments,
      });
    }

    for (const upload of selectedUploadEvidence) {
      sources.set(upload.evidenceId, {
        evidenceId: upload.evidenceId,
        sourceLabel: upload.filename,
        attachments: [upload.attachment],
      });
    }

    return Array.from(sources.values()).map((source) => ({
      evidenceId: source.evidenceId,
      sourceLabel: source.sourceLabel,
      attachments: source.attachments ?? [],
      pddFragments: source.pddFragments,
    }));
  }, [selectedInventoryEvidence, selectedPins, selectedUploadEvidence]);

  useEffect(() => {
    if (!result?.id) return;
    resultRef.current?.focus();
  }, [result?.id]);

  function clearDecisionState() {
    setFieldErrors({});
    setRecoveryState(null);
    setMatchCandidates([]);
  }

  async function fetchRules(methodologyId: string, methodologyVersion: string): Promise<RuleSummary[]> {
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
  }

  async function buildLocalFallbackCandidates(methodSubset: MethodInventoryRecord[], analysis: QuickCheckEvidenceAnalysis): Promise<MatchCandidate[]> {
    const perMethodCandidates = await Promise.all(
      methodSubset.map(async (method) => {
        const methodologyVersion = pickVersion(method, draft.methodologyId === method.code ? draft.methodologyVersion : null);
        if (!methodologyVersion) return [];
        const rules = await fetchRules(method.code, methodologyVersion);
        return buildLocalRuleCandidates({
          claimText: draft.claimText.trim(),
          facts: analysis.facts,
          rules,
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

  async function materializeUploads(methodologyId: string, methodologyVersion: string): Promise<string[]> {
    if (!stagedUploads.length) return draft.evidenceIds;
    const currentPins = coalesceEvidencePins(loadPins(methodologyId, methodologyVersion));
    const existingIds = new Set(currentPins.map((item) => item.id));
    const nextPins = coalesceEvidencePins([
      ...currentPins,
      ...stagedUploads.filter((upload) => !existingIds.has(upload.evidenceId)).map(asPinForUpload),
    ]);
    savePins(methodologyId, methodologyVersion, nextPins);
    updateSession((current) => ({
      ...current,
      stagedUploads: current.stagedUploads.filter((upload) => !current.draft.evidenceIds.includes(upload.evidenceId)),
    }));
    return draft.evidenceIds;
  }

  async function completeQuickCheck(candidate: MatchCandidate) {
    setSubmitting(true);
    setFieldErrors({});
    setRecoveryState(null);
    try {
      await materializeUploads(candidate.methodologyId, candidate.methodologyVersion);
      const rules = await fetchRules(candidate.methodologyId, candidate.methodologyVersion);
      const selectedRule = rules.find((item) => item.id === candidate.requirementId) ?? null;
      if (!selectedRule) {
        setFieldErrors({ general: "The matched requirement could not be loaded." });
        return;
      }

      const nextDraft: QuickCheckDraft = {
        ...draft,
        methodologyId: candidate.methodologyId,
        methodologyVersion: candidate.methodologyVersion,
        matchedRequirementId: candidate.requirementId,
        matchedRequirementLabel: candidate.requirementLabel,
        status: "draft",
      };

      const inventory = loadQuickCheckInventory(candidate.methodologyId, candidate.methodologyVersion);
      const nextResult = buildQuickCheckResult({
        draft: nextDraft,
        rule: {
          id: selectedRule.id,
          title: selectedRule.title,
          snippet: selectedRule.snippet,
          text: selectedRule.text,
          summary: selectedRule.summary,
          logic: selectedRule.logic,
          notes: selectedRule.notes,
          when: selectedRule.when,
          expectedEvidence: selectedRule.expectedEvidence,
          type: selectedRule.type,
          tags: selectedRule.tags,
          sectionId: selectedRule.sectionId,
          anchor: selectedRule.anchor,
          refs: selectedRule.refs,
          citations: selectedRule.citations,
        },
        inventoryItems: inventory,
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
      setMatchCandidates([]);
      setRecoveryState(null);
    } catch (error) {
      setFieldErrors({ general: error instanceof Error ? error.message : String(error) });
    } finally {
      setSubmitting(false);
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
        draft: {
          ...current.draft,
          evidenceIds: [evidenceId],
          status: "draft",
          result: null,
          resultId: undefined,
          updatedAt: nowIso(),
        },
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
    updateSession((current) => ({
      ...current,
      draft: {
        ...current.draft,
        evidenceIds: [evidenceId],
        status: "draft",
        result: null,
        resultId: undefined,
        updatedAt: nowIso(),
      },
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
      const queryTexts = buildQuickCheckQueryTexts(draft.claimText.trim(), evidenceAnalysis.facts);
      const responses = await Promise.all(
        queryTexts.map(async (query) => ({
          query,
          results: (await retrieveQuery(query)).results ?? [],
        })),
      );
      const mergedResults = mergeQueryResults(responses);
      const allCandidates = buildMatchCandidates(mergedResults, methods, "", "", evidenceAnalysis);
      let candidates = buildMatchCandidates(
        mergedResults,
        methods,
        draft.methodologyId,
        draft.methodologyVersion,
        evidenceAnalysis,
      );

      if (!candidates.length) {
        const methodSubset = draft.methodologyId.trim()
          ? methods.filter((method) => method.code === draft.methodologyId)
          : methods;
        candidates = await buildLocalFallbackCandidates(methodSubset, evidenceAnalysis);
      }

      if (!candidates.length && draft.methodologyId.trim()) {
        const broaderCandidates =
          allCandidates.length > 0 ? allCandidates : await buildLocalFallbackCandidates(methods, evidenceAnalysis);
        if (broaderCandidates.length) {
          setMatchCandidates(broaderCandidates);
          setRecoveryState(null);
          setFieldErrors({
            general: "This methodology filter removed closer matches. Pick a likely match below or try another methodology.",
          });
          return;
        }
      }

      if (!candidates.length) {
        if (!draft.methodologyId.trim()) setShowMethodology(true);
        setFieldErrors({});
        setRecoveryState(
          buildRecoveryState({
            selectedMethodologyId: draft.methodologyId,
          }),
        );
        return;
      }

      if (isAmbiguousMatch(candidates)) {
        setMatchCandidates(candidates);
        if (!draft.methodologyId.trim()) setShowMethodology(true);
        setRecoveryState(null);
        setFieldErrors({
          general: "Multiple requirements could fit this claim. Pick the closest match or narrow by methodology.",
        });
        return;
      }

      await completeQuickCheck(candidates[0]!);
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
      <div className="mx-auto w-full max-w-3xl rounded-[2rem] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_30px_80px_-36px_rgba(15,23,42,0.4)] md:px-7 md:py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Article 6 quick check</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 md:text-[2rem]">
              Check one claim
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Add one piece of evidence. We&apos;ll find the best matching requirement and open the full review.
            </p>
          </div>
          {loadingMethods || submitting ? <Loader2 className="mt-1 h-5 w-5 animate-spin text-slate-400" /> : null}
        </div>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm text-slate-700">
            <span className="font-medium text-slate-900">Claim</span>
            <textarea
              value={draft.claimText}
              onChange={(event) => {
                const value = event.target.value;
                updateDraft(
                  (current) => ({
                    ...current,
                    claimText: value,
                    matchedRequirementId: undefined,
                    matchedRequirementLabel: undefined,
                    status: "draft",
                    resultId: undefined,
                  }),
                  null,
                );
                clearDecisionState();
              }}
              rows={3}
              placeholder="Example: The monitoring report covers the full reporting period."
              className="w-full rounded-[1.6rem] border border-slate-200 bg-slate-50/70 px-4 py-4 text-base leading-7 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
              ref={claimRef}
            />
            {fieldErrors.claim ? <span className="text-sm text-rose-700">{fieldErrors.claim}</span> : null}
          </label>

          <div className="flex flex-wrap gap-2">
            {CLAIM_SUGGESTIONS.slice(0, 2).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  updateDraft(
                    (current) => ({
                      ...current,
                      claimText: suggestion,
                      matchedRequirementId: undefined,
                      matchedRequirementLabel: undefined,
                      status: "draft",
                      resultId: undefined,
                    }),
                    null,
                  );
                  clearDecisionState();
                }}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                {suggestion}
              </button>
            ))}
          </div>

          <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50/75 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900">Add one piece of evidence</div>
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
                className="inline-flex items-center gap-2 rounded-full border border-slate-900 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                <Upload className="h-4 w-4" />
                Upload evidence
              </button>
            </div>

            {selectedEvidenceLabel ? (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3">
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
            ) : null}
            {fieldErrors.evidence ? <div className="mt-3 text-sm text-rose-700">{fieldErrors.evidence}</div> : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSavedEvidence((value) => !value)}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                aria-expanded={showSavedEvidence}
              >
                {showSavedEvidence ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                Use saved evidence instead
              </button>
              <button
                type="button"
                onClick={() => setShowMethodology((value) => !value)}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                aria-expanded={showMethodology}
              >
                {showMethodology ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                Narrow by methodology
              </button>
            </div>

            <button
              type="button"
              disabled={!canRunQuickCheck}
              onClick={() => void runQuickCheck()}
              className="inline-flex min-w-[13rem] items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Run quick check
            </button>
          </div>

          {showSavedEvidence ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-sm font-medium text-slate-900">Use saved evidence</div>
              {!draft.methodologyId || !draft.methodologyVersion ? (
                <div className="mt-2 text-sm text-slate-600">Choose a methodology first to reuse saved evidence.</div>
              ) : (
                <div className="mt-3">
                  <select
                    value={pendingInventoryId}
                    onChange={(event) => {
                      const value = event.target.value;
                      setPendingInventoryId(value);
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
          ) : null}

          {showMethodology ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <label className="grid gap-2 text-sm text-slate-700">
                <span className="font-medium text-slate-900">Methodology</span>
                <select
                  value={draft.methodologyId}
                  onChange={(event) => {
                    const methodologyId = event.target.value;
                    const method = methods.find((item) => item.code === methodologyId);
                    const methodologyVersion = methodologyId ? pickVersion(method, initialVersion) : "";
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
          ) : null}

          {recoveryState ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4">
              <div className="text-sm font-semibold text-slate-900">{recoveryState.title}</div>
              <div className="mt-1 text-sm text-slate-700">{recoveryState.description}</div>
              {recoveryState.note ? <div className="mt-3 text-sm text-slate-600">{recoveryState.note}</div> : null}
              <div className="mt-4 flex flex-wrap gap-2">
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

          {result ? (
            <div
              ref={resultRef}
              tabIndex={-1}
              className="rounded-[1.6rem] border border-emerald-200 bg-emerald-50/75 p-5 outline-none"
              role="status"
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Result</div>
                  <div className="mt-2 text-lg font-semibold text-slate-950">{result.verdict}</div>
                  <div className="mt-2 text-sm text-slate-700">{result.claimText}</div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Methodology</div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {draft.methodologyId} {draft.methodologyVersion ? `· ${draft.methodologyVersion}` : ""}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Requirement</div>
                      <div className="mt-1 text-sm font-medium text-slate-900">{resultRequirement.title}</div>
                      {resultRequirement.id ? (
                        <div className="mt-1 text-xs font-mono text-slate-500">{resultRequirement.id}</div>
                      ) : null}
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Evidence</div>
                      <div className="mt-1 text-sm font-medium text-slate-900">{selectedEvidenceLabel || "1 item selected"}</div>
                    </div>
                  </div>
                  <div className="mt-4 text-sm text-slate-700">{result.explanation}</div>
                  {result.citations.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {result.citations.map((citation) => (
                        <span key={citation} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700">
                          {citation}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-3 text-sm text-slate-600">{result.nextStepHint}</div>
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
                            claimText: "",
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
                      Check another claim
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
