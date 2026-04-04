"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, FilePlus2, FolderOpen, Loader2, Plus, TriangleAlert } from "lucide-react";
import { createAndStoreEvidenceAttachment } from "@/lib/proofMap/attachments";
import { loadPins, savePins } from "@/lib/proofMap/storage";
import type { EvidencePin } from "@/lib/proofMap/types";
import {
  buildQuickCheckResult,
  ensureQuickCheckWorkspaceHandoff,
  loadQuickCheckInventory,
  loadQuickCheckSession,
  saveQuickCheckSession,
  validateQuickCheckDraft,
  type QuickCheckDraft,
  type QuickCheckResult,
} from "@/lib/chat/quickCheck";
import { coalesceEvidencePins, type EvidenceInventoryItem } from "@/lib/evidence/inventory";
import type { RuleSummary } from "@/app/m/_lib/methodRules";

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

function nowIso(): string {
  return new Date().toISOString();
}

function newPinId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `pin-${nowIso()}-${Math.random().toString(16).slice(2)}`;
}

function methodOptionLabel(method: MethodInventoryRecord): string {
  return `${method.code} · ${method.latestVersion ?? method.versions[0] ?? "latest"}`;
}

function ruleOptionLabel(rule: RuleSummary): string {
  return `${rule.id} · ${rule.title}`;
}

function selectedEvidenceLabel(item: EvidenceInventoryItem): string {
  return `${item.display_name} · ${item.type}`;
}

export default function QuickCheckPanel({ initialMethod, initialVersion, onContinueToWorkspace }: QuickCheckPanelProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [methods, setMethods] = useState<MethodInventoryRecord[]>([]);
  const [rules, setRules] = useState<RuleSummary[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [loadingRules, setLoadingRules] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [session, setSession] = useState(() =>
    loadQuickCheckSession({
      methodologyId: initialMethod?.trim() || undefined,
      methodologyVersion: initialVersion?.trim() || undefined,
    }),
  );
  const [pendingInventoryId, setPendingInventoryId] = useState("");

  const draft = session.draft;
  const result = session.result;

  const inventoryItems = useMemo(
    () => loadQuickCheckInventory(draft.methodologyId, draft.methodologyVersion),
    [draft.methodologyId, draft.methodologyVersion],
  );

  const selectedEvidence = useMemo(
    () => inventoryItems.filter((item) => draft.evidenceIds.includes(item.evidence_id)),
    [draft.evidenceIds, inventoryItems],
  );

  const updateDraft = useCallback((mutator: (current: QuickCheckDraft) => QuickCheckDraft, nextResult?: QuickCheckResult | null) => {
    setSession((current) => {
      const nextDraft = {
        ...mutator(current.draft),
        updatedAt: nowIso(),
      };
      const next = { draft: nextDraft, result: nextResult ?? current.result };
      saveQuickCheckSession(next);
      return next;
    });
  }, []);

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
        setErrors([error instanceof Error ? error.message : String(error)]);
      })
      .finally(() => {
        if (!cancelled) setLoadingMethods(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!methods.length) return;
    if (draft.methodologyId.trim() && draft.methodologyVersion.trim()) return;
    const fallback =
      methods.find((item) => item.code === initialMethod && (initialVersion ? item.versions.includes(initialVersion) : true)) ??
      methods[0];
    if (!fallback) return;
    updateDraft((current) => ({
      ...current,
      methodologyId: fallback.code,
      methodologyVersion: initialVersion && fallback.versions.includes(initialVersion)
        ? initialVersion
        : (fallback.latestVersion ?? fallback.versions[0] ?? ""),
    }));
  }, [draft.methodologyId, draft.methodologyVersion, initialMethod, initialVersion, methods, updateDraft]);

  useEffect(() => {
    const methodCode = draft.methodologyId.trim();
    const version = draft.methodologyVersion.trim();
    if (!methodCode || !version) {
      setRules([]);
      return;
    }
    let cancelled = false;
    setLoadingRules(true);
    fetch(`/api/methods/${encodeURIComponent(methodCode)}/v/${encodeURIComponent(version)}/rules`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Rules request failed with ${response.status}`);
        const payload = (await response.json()) as { rules?: RuleSummary[] };
        if (cancelled) return;
        setRules(Array.isArray(payload.rules) ? payload.rules : []);
      })
      .catch((error) => {
        if (!cancelled) setErrors([error instanceof Error ? error.message : String(error)]);
      })
      .finally(() => {
        if (!cancelled) setLoadingRules(false);
      });
    return () => {
      cancelled = true;
    };
  }, [draft.methodologyId, draft.methodologyVersion]);

  useEffect(() => {
    const validEvidenceIds = new Set(inventoryItems.map((item) => item.evidence_id));
    const filteredIds = draft.evidenceIds.filter((id) => validEvidenceIds.has(id));
    if (filteredIds.length === draft.evidenceIds.length) return;
    updateDraft((current) => ({ ...current, evidenceIds: filteredIds }), null);
  }, [draft.evidenceIds, inventoryItems, updateDraft]);

  async function handleUpload(file: File | null) {
    if (!file) return;
    const methodCode = draft.methodologyId.trim();
    const version = draft.methodologyVersion.trim();
    if (!methodCode || !version) {
      setErrors(["Choose a methodology before attaching evidence."]);
      return;
    }

    setSubmitting(true);
    setErrors([]);
    try {
      const pinId = newPinId();
      const attachmentResult = await createAndStoreEvidenceAttachment({ pin_id: pinId, file });
      if (!attachmentResult.ok) {
        setErrors([attachmentResult.message]);
        return;
      }
      const currentPins = coalesceEvidencePins(loadPins(methodCode, version));
      const nextPins = coalesceEvidencePins([
        ...currentPins,
        {
          id: pinId,
          kind: file.type === "application/pdf" ? "pdd" : "doc",
          title: file.name || "evidence",
          cited_ids: [],
          attachments: [attachmentResult.attachment],
          created_at: attachmentResult.attachment.created_at,
        } satisfies EvidencePin,
      ]);
      savePins(methodCode, version, nextPins);
      updateDraft((current) => ({
        ...current,
        evidenceIds: Array.from(new Set([...current.evidenceIds, pinId])),
        status: "draft",
        resultId: undefined,
      }), null);
    } finally {
      setSubmitting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function addExistingEvidence() {
    if (!pendingInventoryId) return;
    updateDraft((current) => ({
      ...current,
      evidenceIds: Array.from(new Set([...current.evidenceIds, pendingInventoryId])),
      status: "draft",
      resultId: undefined,
    }), null);
    setPendingInventoryId("");
  }

  function removeEvidence(evidenceId: string) {
    updateDraft((current) => ({
      ...current,
      evidenceIds: current.evidenceIds.filter((id) => id !== evidenceId),
      status: "draft",
      resultId: undefined,
    }), null);
  }

  async function runQuickCheck() {
    const validationErrors = validateQuickCheckDraft(draft);
    if (validationErrors.length) {
      setErrors(validationErrors);
      return;
    }
    const selectedRule = rules.find((item) => item.id === draft.requirementId) ?? null;
    if (!selectedRule) {
      setErrors(["The selected requirement could not be loaded."]);
      return;
    }
    setSubmitting(true);
    setErrors([]);
    try {
      const nextResult = buildQuickCheckResult({
        draft,
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
        inventoryItems,
      });

      const nextDraft: QuickCheckDraft = {
        ...draft,
        status: "checked",
        resultId: nextResult.id,
        updatedAt: nowIso(),
      };
      const nextSession = { draft: nextDraft, result: nextResult };
      saveQuickCheckSession(nextSession);
      setSession(nextSession);
    } finally {
      setSubmitting(false);
    }
  }

  function handleContinueToWorkspace() {
    const handoff = ensureQuickCheckWorkspaceHandoff(draft);
    const nextSession = { draft: handoff.draft, result };
    saveQuickCheckSession(nextSession);
    setSession(nextSession);
    if (onContinueToWorkspace) {
      onContinueToWorkspace(handoff.url);
      return;
    }
    if (typeof window !== "undefined") window.location.assign(handoff.url);
  }

  const availableInventory = inventoryItems.filter((item) => !draft.evidenceIds.includes(item.evidence_id));

  return (
    <div className="mr-auto max-w-[88%]">
      <div className="rounded-3xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Quick check</div>
            <div className="mt-1 text-sm text-gray-700">Check one requirement against one or more evidence items, then continue into the Review Workspace.</div>
          </div>
          {loadingMethods || loadingRules || submitting ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" /> : null}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm text-gray-700">
            <span className="font-medium text-gray-900">Methodology</span>
            <select
              value={draft.methodologyId && draft.methodologyVersion ? `${draft.methodologyId}@@${draft.methodologyVersion}` : ""}
              onChange={(event) => {
                const [methodologyId, methodologyVersion] = event.target.value.split("@@");
                updateDraft((current) => ({
                  ...current,
                  methodologyId: methodologyId ?? "",
                  methodologyVersion: methodologyVersion ?? "",
                  requirementId: "",
                  evidenceIds: [],
                  status: "draft",
                  resultId: undefined,
                }), null);
              }}
              className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
            >
              <option value="">Select methodology</option>
              {methods.map((method) => {
                const version = method.latestVersion ?? method.versions[0] ?? "";
                return (
                  <option key={`${method.code}-${version}`} value={`${method.code}@@${version}`}>
                    {methodOptionLabel(method)}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="grid gap-2 text-sm text-gray-700">
            <span className="font-medium text-gray-900">Requirement</span>
            <select
              value={draft.requirementId}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  requirementId: event.target.value,
                  status: "draft",
                  resultId: undefined,
                }), null)
              }
              disabled={!draft.methodologyId || !draft.methodologyVersion || loadingRules}
              className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">Select requirement</option>
              {rules.map((rule) => (
                <option key={rule.id} value={rule.id}>
                  {ruleOptionLabel(rule)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50/70 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-gray-900">Evidence</div>
              <div className="mt-1 text-xs text-gray-600">Select an existing item or attach a new file for this quick check.</div>
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
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-gray-300 hover:text-gray-900"
            >
              <FilePlus2 className="h-4 w-4" />
              Attach evidence
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-2 md:flex-row">
            <select
              value={pendingInventoryId}
              onChange={(event) => setPendingInventoryId(event.target.value)}
              className="min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
            >
              <option value="">Select existing evidence</option>
              {availableInventory.map((item) => (
                <option key={item.evidence_id} value={item.evidence_id}>
                  {selectedEvidenceLabel(item)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addExistingEvidence}
              disabled={!pendingInventoryId}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add evidence item
            </button>
          </div>

          {selectedEvidence.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedEvidence.map((item) => (
                <button
                  key={item.evidence_id}
                  type="button"
                  onClick={() => removeEvidence(item.evidence_id)}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-gray-300"
                >
                  {item.display_name} · {item.type} ×
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {errors.length ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
            <div className="flex items-start gap-2.5">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                {errors.map((error) => (
                  <div key={error}>{error}</div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {result ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3.5">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900">{result.requirementLabel}</div>
                <div className="mt-1 inline-flex rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                  {result.verdict}
                </div>
                <div className="mt-2 text-sm text-gray-700">{result.explanation}</div>
                {result.citations.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {result.citations.map((citation) => (
                      <span key={citation} className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700">
                        {citation}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="mt-3 text-xs text-gray-600">{result.nextStepHint}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateDraft((current) => ({
                        ...current,
                        status: "draft",
                        resultId: undefined,
                      }), null)
                    }
                    className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700"
                  >
                    Add another evidence item
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateDraft((current) => ({
                        ...current,
                        requirementId: "",
                        status: "draft",
                        resultId: undefined,
                      }), null)
                    }
                    className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700"
                  >
                    Check another requirement
                  </button>
                  <button
                    type="button"
                    onClick={handleContinueToWorkspace}
                    className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    <FolderOpen className="h-4 w-4" />
                    Continue to Review Workspace
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <button
              type="button"
              disabled={submitting}
              onClick={() => void runQuickCheck()}
              className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Check requirement
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
