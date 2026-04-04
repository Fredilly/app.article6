"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  FilePlus2,
  FolderOpen,
  Loader2,
  SearchCheck,
  Sparkles,
  TriangleAlert,
  Upload,
} from "lucide-react";
import type { RuleSummary } from "@/app/m/_lib/methodRules";
import { retrieveQuery, type QueryResponse } from "@/lib/chat/client";
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
import { loadPins, savePins } from "@/lib/proofMap/storage";
import type { EvidencePin } from "@/lib/proofMap/types";

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

function buildMatchCandidates(
  results: QueryResponse["results"],
  methods: MethodInventoryRecord[],
  selectedMethodologyId: string,
): MatchCandidate[] {
  const selectedMethod = selectedMethodologyId.trim();
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

    const requirementId = result.id?.trim();
    if (!requirementId) continue;

    const key = `${methodologyId}@@${methodologyVersion}@@${requirementId}`;
    if (unique.has(key)) continue;
    unique.set(key, {
      key,
      methodologyId,
      methodologyVersion,
      requirementId,
      requirementLabel: `${requirementId} · ${pickRequirementLabel(result)}`,
      score: typeof result.score === "number" ? result.score : null,
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

function inventoryEvidenceLabel(item: EvidenceInventoryItem): string {
  return `${item.display_name} · ${item.type}`;
}

function uploadChipLabel(upload: QuickCheckStagedUpload): string {
  return `${upload.filename} · Upload`;
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
  const rulesCache = useRef(new Map<string, RuleSummary[]>());

  const [methods, setMethods] = useState<MethodInventoryRecord[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [matchCandidates, setMatchCandidates] = useState<MatchCandidate[]>([]);
  const [pendingInventoryId, setPendingInventoryId] = useState("");
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
          evidenceIds: Array.from(new Set([...current.draft.evidenceIds, evidenceId])),
          status: "draft",
          result: null,
          resultId: undefined,
          updatedAt: nowIso(),
        },
        result: null,
        stagedUploads: [
          ...current.stagedUploads,
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

  function addExistingEvidence() {
    if (!pendingInventoryId) return;
    updateDraft(
      (current) => ({
        ...current,
        evidenceIds: Array.from(new Set([...current.evidenceIds, pendingInventoryId])),
        status: "draft",
        resultId: undefined,
      }),
      null,
    );
    setPendingInventoryId("");
    setFieldErrors((current) => ({ ...current, evidence: undefined, general: undefined }));
    setMatchCandidates([]);
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
    setFieldErrors((current) => ({ ...current, evidence: undefined, general: undefined }));
    setMatchCandidates([]);
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
    setMatchCandidates([]);
    try {
      const response = await retrieveQuery(draft.claimText.trim());
      const candidates = buildMatchCandidates(response.results ?? [], methods, draft.methodologyId);
      if (!candidates.length) {
        setFieldErrors({
          general: draft.methodologyId
            ? "No likely requirement match was found for the selected methodology. Try another methodology or adjust the claim."
            : "No likely requirement match was found. Add a methodology to narrow the match or rewrite the claim.",
        });
        return;
      }

      if (isAmbiguousMatch(candidates)) {
        setMatchCandidates(candidates);
        setFieldErrors({
          general: "Multiple likely requirements match this claim. Pick the closest one or narrow with methodology.",
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

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.35)] md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="text-sm font-semibold text-slate-500">Check one claim</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
              Start with one plain-language claim and one evidence item.
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Describe the claim you want to test, upload one evidence item, and the app will map it into the existing
              requirement-based review flow before opening the full Review Workspace.
            </p>
          </div>
          {loadingMethods || submitting ? <Loader2 className="mt-1 h-5 w-5 animate-spin text-slate-400" /> : null}
        </div>

        <div className="mt-6 grid gap-6">
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
                setFieldErrors((current) => ({ ...current, claim: undefined, general: undefined }));
                setMatchCandidates([]);
              }}
              rows={4}
              placeholder="Example: The monitoring report covers the full reporting period."
              className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            />
            {fieldErrors.claim ? <span className="text-sm text-rose-700">{fieldErrors.claim}</span> : null}
          </label>

          <div className="flex flex-wrap gap-2">
            {CLAIM_SUGGESTIONS.map((suggestion) => (
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
                  setFieldErrors((current) => ({ ...current, claim: undefined, general: undefined }));
                  setMatchCandidates([]);
                }}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
              >
                {suggestion}
              </button>
            ))}
          </div>

          <div className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-slate-900">Evidence</div>
                <div className="mt-1 text-sm text-slate-600">
                  Upload one evidence item first. Reusing existing evidence stays available when you want to narrow to a methodology.
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
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <Upload className="h-4 w-4" />
                Upload evidence
              </button>
            </div>

            <div className="grid gap-2">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Choose existing evidence</div>
              <div className="flex flex-col gap-2 md:flex-row">
                <select
                  value={pendingInventoryId}
                  onChange={(event) => setPendingInventoryId(event.target.value)}
                  disabled={!draft.methodologyId || !draft.methodologyVersion}
                  className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">
                    {draft.methodologyId ? "Select existing evidence" : "Choose a methodology to reuse saved evidence"}
                  </option>
                  {availableInventory.map((item) => (
                    <option key={item.evidence_id} value={item.evidence_id}>
                      {inventoryEvidenceLabel(item)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addExistingEvidence}
                  disabled={!pendingInventoryId}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 disabled:opacity-50"
                >
                  <FilePlus2 className="h-4 w-4" />
                  Add selected evidence
                </button>
              </div>
              {fieldErrors.evidence ? <span className="text-sm text-rose-700">{fieldErrors.evidence}</span> : null}
            </div>

            {selectedUploadEvidence.length || selectedInventoryEvidence.length ? (
              <div className="flex flex-wrap gap-2">
                {selectedUploadEvidence.map((upload) => (
                  <button
                    key={upload.evidenceId}
                    type="button"
                    onClick={() => removeEvidence(upload.evidenceId)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300"
                  >
                    {uploadChipLabel(upload)} ×
                  </button>
                ))}
                {selectedInventoryEvidence.map((item) => (
                  <button
                    key={item.evidence_id}
                    type="button"
                    onClick={() => removeEvidence(item.evidence_id)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300"
                  >
                    {inventoryEvidenceLabel(item)} ×
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <label className="grid gap-2 text-sm text-slate-700">
            <span className="font-medium text-slate-900">Methodology (optional)</span>
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
                setFieldErrors((current) => ({ ...current, general: undefined }));
                setMatchCandidates([]);
              }}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            >
              <option value="">Any methodology</option>
              {methods.map((method) => (
                <option key={method.code} value={method.code}>
                  {methodOptionLabel(method)}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-500">
              Leave this open to let the matcher search broadly, or choose a methodology to narrow likely matches.
            </span>
          </label>

          {fieldErrors.general ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
              <div className="flex items-start gap-2.5">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div>{fieldErrors.general}</div>
              </div>
            </div>
          ) : null}

          {matchCandidates.length ? (
            <div className="rounded-3xl border border-sky-200 bg-sky-50/80 p-4">
              <div className="flex items-start gap-3">
                <SearchCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">Likely requirement matches</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Choose the closest match, or narrow the claim with a methodology and run the quick check again.
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
                          <div className="text-sm font-medium text-slate-900">{candidate.requirementLabel}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {candidate.methodologyId} · {candidate.methodologyVersion}
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
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Quick check result</div>
                  <div className="mt-2 text-sm font-medium text-slate-900">{result.claimText}</div>
                  <div className="mt-3 text-sm text-slate-600">Matched requirement</div>
                  <div className="mt-1 text-base font-semibold text-slate-950">{result.requirementLabel}</div>
                  <div className="mt-3 inline-flex rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                    {result.verdict}
                  </div>
                  <div className="mt-3 text-sm text-slate-700">{result.explanation}</div>
                  {result.citations.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {result.citations.map((citation) => (
                        <span key={citation} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700">
                          {citation}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-3 flex items-start gap-2 text-sm text-slate-600">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                    <span>{result.nextStepHint}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        updateDraft(
                          (current) => ({
                            ...current,
                            status: "draft",
                            resultId: undefined,
                          }),
                          null,
                        );
                        setFieldErrors({});
                      }}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                    >
                      Upload another evidence item
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
                            status: "draft",
                            resultId: undefined,
                          }),
                          null,
                        );
                        setFieldErrors({});
                        setMatchCandidates([]);
                      }}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                    >
                      Check another claim
                    </button>
                    <button
                      type="button"
                      onClick={handleContinueToWorkspace}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      <FolderOpen className="h-4 w-4" />
                      Continue to Review Workspace
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void runQuickCheck()}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Run quick check
              </button>
            </div>
          )}

          {selectedMethodRecord && draft.methodologyVersion ? (
            <div className="text-xs text-slate-500">
              Existing evidence is being reused from {selectedMethodRecord.code} · {draft.methodologyVersion}.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
