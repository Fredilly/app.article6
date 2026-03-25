"use client";

import Tooltip from "@/components/ui/Tooltip";
import type { VerifyWizardStepDetails } from "@/lib/verify/runState";

type RuleOption = {
  id: string;
  title: string;
  summary?: string;
  type?: string;
  tags?: string[];
};

type EvidenceWorkflowStepperProps = {
  ruleOptions: RuleOption[];
  selectedRuleId: string | null;
  onSelectRuleId?: (ruleId: string | null) => void;
  onViewRule?: (ruleId: string) => void;
  hasAoi: boolean;
  aoiLabel: string | null;
  aoiSummary?: {
    isPreview: boolean;
    willClearWork: boolean;
    isSameAoi: boolean;
    showSameAoiPrompt: boolean;
    areaKm2: number | null;
    bboxLabel: string | null;
  } | null;
  searchDisabled: boolean;
  isRunning: boolean;
  hasSearchResults: boolean;
  stacResultCount: number;
  selectedStacItemId: string | null;
  onClearSelectedItem: () => void;
  canCreatePin: boolean;
  createPinDisabledReason: string;
  pinsCount: number;
  onUploadAoi: () => void;
  onApplyDraftAoiClick?: () => void;
  onCancelDraftAoi?: () => void;
  onKeepSameAoi?: () => void;
  onResetSameAoi?: () => void;
  onSearchStac: () => void;
  onCreatePin: () => void;
  draftMinutes: string;
  draftOutcomeNote: string;
  savedMinutes: string;
  savedOutcomeNote: string;
  savedReviewerArtifactAt?: string | null;
  onReviewerMinutesChange: (value: string) => void;
  onReviewerOutcomeNoteChange: (value: string) => void;
  onSaveReviewerArtifact: () => void;
  onFinalizeRun: () => void;
  finalizedAt?: string | null;
  currentRunLabel: string;
  loadedFromRunLabel?: string | null;
  isEditedDraft: boolean;
  hasUnsavedWorkspaceEdits: boolean;
  currentWorkspaceIsFinal: boolean;
  wizard: VerifyWizardStepDetails;
  onStartAnotherRun: () => void;
  onViewRunHistory: () => void;
};

function stepStateClass(input: { active: boolean; complete: boolean; disabled: boolean }): string {
  if (input.active) return "border-slate-900 bg-slate-50 shadow-sm";
  if (input.complete) return "border-emerald-200 bg-emerald-50";
  if (input.disabled) return "border-slate-200 bg-slate-50/70 opacity-75";
  return "border-slate-200 bg-white";
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function EvidenceWorkflowStepper({
  ruleOptions,
  selectedRuleId,
  onSelectRuleId,
  onViewRule,
  hasAoi,
  aoiLabel,
  aoiSummary = null,
  searchDisabled,
  isRunning,
  hasSearchResults,
  stacResultCount,
  selectedStacItemId,
  onClearSelectedItem,
  canCreatePin,
  createPinDisabledReason,
  pinsCount,
  onUploadAoi,
  onApplyDraftAoiClick,
  onCancelDraftAoi,
  onKeepSameAoi,
  onResetSameAoi,
  onSearchStac,
  onCreatePin,
  draftMinutes,
  draftOutcomeNote,
  savedMinutes,
  savedOutcomeNote,
  savedReviewerArtifactAt = null,
  onReviewerMinutesChange,
  onReviewerOutcomeNoteChange,
  onSaveReviewerArtifact,
  onFinalizeRun,
  finalizedAt = null,
  currentRunLabel,
  loadedFromRunLabel = null,
  isEditedDraft,
  hasUnsavedWorkspaceEdits,
  currentWorkspaceIsFinal,
  wizard,
  onStartAnotherRun,
  onViewRunHistory,
}: EvidenceWorkflowStepperProps) {
  const stepMap = new Map(wizard.steps.map((step) => [step.id, step]));
  const step1 = stepMap.get(1)!;
  const step2 = stepMap.get(2)!;
  const step3 = stepMap.get(3)!;
  const step4 = stepMap.get(4)!;
  const step5 = stepMap.get(5)!;
  const step6 = stepMap.get(6)!;
  const step7 = stepMap.get(7)!;
  const hasDraftArtifactChanges = draftMinutes !== savedMinutes || draftOutcomeNote !== savedOutcomeNote;
  const reviewerArtifactSaved = Boolean(savedReviewerArtifactAt);
  const readyToFinalize = step7.active || (reviewerArtifactSaved && !currentWorkspaceIsFinal && !step7.disabled);
  const inProgress = !currentWorkspaceIsFinal && !readyToFinalize;
  const selectedRule = ruleOptions.find((rule) => rule.id === selectedRuleId) ?? null;

  return (
    <div className="grid gap-3">
      <div className="sticky top-0 z-10 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Current workspace</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span>
                <span className="font-semibold text-slate-900">Run:</span>{" "}
                <span data-testid="current-run-indicator" className="font-mono">
                  {currentRunLabel}
                </span>
              </span>
              {loadedFromRunLabel ? (
                <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                  Loaded from Run {loadedFromRunLabel}
                </span>
              ) : null}
              {isEditedDraft ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                  Edited draft
                </span>
              ) : null}
              {currentWorkspaceIsFinal ? (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  Finalized
                </span>
              ) : null}
              {inProgress ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                  In progress
                </span>
              ) : null}
              {reviewerArtifactSaved && !currentWorkspaceIsFinal ? (
                <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                  Reviewer artifact saved
                </span>
              ) : null}
              {readyToFinalize ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                  Ready to finalize
                </span>
              ) : null}
              {hasUnsavedWorkspaceEdits ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                  Unsaved edits
                </span>
              ) : null}
            </div>
          </div>
          <div className="text-right text-[11px] text-slate-500" data-testid="wizard-next-action">
            <div className="font-semibold uppercase tracking-wide text-slate-400">Next required action</div>
            <div className="mt-1 text-slate-700">{wizard.nextAction ?? "Run complete"}</div>
          </div>
        </div>
      </div>

      <div className={`rounded-lg border px-3 py-2 ${stepStateClass(step1)}`} data-testid="wizard-step-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Step 1</div>
        <div className="mt-1 text-xs font-semibold text-slate-900">Pick rule</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
            <span className="text-xs font-semibold text-slate-600">Rule</span>
            <select
              className="max-w-[220px] bg-transparent text-xs text-slate-700 outline-none"
              value={selectedRuleId ?? ""}
              onChange={(event) => onSelectRuleId?.(event.target.value.trim() || null)}
            >
              <option value="">Select rule…</option>
              {ruleOptions.map((rule) => (
                <option key={rule.id} value={rule.id}>
                  {rule.id} {rule.title.trim().slice(0, 60) ? `- ${rule.title.trim().slice(0, 60)}` : ""}
                </option>
              ))}
            </select>
          </div>
          {selectedRuleId ? (
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={() => onViewRule?.(selectedRuleId)}
            >
              View rule
            </button>
          ) : (
            <div className="text-[11px] text-slate-500">Select a rule to unlock the rest of the workflow.</div>
          )}
        </div>
        {selectedRule ? (
          <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-semibold text-slate-900">{selectedRule.id}</span>
              {selectedRule.type ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                  {selectedRule.type}
                </span>
              ) : null}
              {selectedRule.tags?.slice(0, 2).map((tag) => (
                <span
                  key={`${selectedRule.id}-${tag}`}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-1 text-slate-600">
              {selectedRule.summary?.trim() || "Open the rule viewer for requirement text, citations, and methodology grounding."}
            </div>
          </div>
        ) : null}
      </div>

      <div className={`rounded-lg border px-3 py-2 ${stepStateClass(step2)}`} data-testid="wizard-step-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Step 2</div>
        <div className="mt-1 text-xs font-semibold text-slate-900">Confirm AOI</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`rounded-full border px-3 py-1 text-xs font-semibold shadow-sm ${
              step2.active ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
            onClick={onUploadAoi}
            disabled={step2.disabled}
          >
            Upload AOI
          </button>
          {!selectedRuleId ? (
            <div className="text-[11px] text-slate-500">Disabled: pick a rule first.</div>
          ) : hasAoi ? (
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              AOI ready
            </span>
          ) : (
            <div className="text-[11px] text-slate-500">Upload and confirm an AOI to continue.</div>
          )}
        </div>
        {aoiSummary ? (
          <div className="mt-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700">
            {aoiSummary.isPreview ? (
              <>
                <div className="font-semibold text-slate-900">New AOI ready</div>
                <div className="mt-1">Replace the current AOI with <span className="font-semibold">{aoiLabel ?? "uploaded AOI"}</span>?</div>
                {aoiSummary.willClearWork ? <div className="mt-1 text-[11px] text-slate-600">This will clear pins and evidence selections.</div> : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button type="button" className="rounded-full border border-sky-200 bg-sky-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-sky-700" onClick={onApplyDraftAoiClick}>Replace AOI</button>
                  <button type="button" className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50" onClick={onCancelDraftAoi}>Keep current</button>
                </div>
                {aoiSummary.isSameAoi && aoiSummary.showSameAoiPrompt ? (
                  <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-[11px] text-slate-700">
                    <div className="font-semibold text-slate-800">Same AOI detected. Keep current links?</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button type="button" className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50" onClick={onKeepSameAoi}>Keep</button>
                      <button type="button" className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 shadow-sm hover:bg-rose-100" onClick={onResetSameAoi}>Reset anyway</button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="grid gap-1 text-[11px] text-slate-600">
                <div>AOI: {aoiLabel ?? "none"}</div>
                <div>area: {typeof aoiSummary.areaKm2 === "number" ? aoiSummary.areaKm2.toFixed(2) : "—"} km²</div>
                <div className="break-words">bbox: {aoiSummary.bboxLabel ?? "—"}</div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className={`rounded-lg border px-3 py-2 ${stepStateClass(step3)}`} data-testid="wizard-step-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Step 3</div>
        <div className="mt-1 text-xs font-semibold text-slate-900">Search STAC</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`rounded-full border px-3 py-1 text-xs font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${
              step3.active ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
            disabled={step3.disabled || searchDisabled}
            onClick={onSearchStac}
          >
            {isRunning ? "Searching…" : "Search STAC"}
          </button>
          {!hasAoi ? (
            <div className="text-[11px] text-slate-500">Disabled: confirm AOI first.</div>
          ) : hasSearchResults ? (
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
              {stacResultCount} items
            </span>
          ) : (
            <div className="text-[11px] text-slate-500">Run search to load candidate evidence.</div>
          )}
        </div>
      </div>

      <div className={`rounded-lg border px-3 py-2 ${stepStateClass(step4)}`} data-testid="wizard-step-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Step 4</div>
        <div className="mt-1 text-xs font-semibold text-slate-900">Select item</div>
        {selectedStacItemId ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
              <span className="font-mono">{selectedStacItemId}</span>
            </span>
            <button type="button" className="text-xs font-semibold text-slate-700 underline underline-offset-2" onClick={onClearSelectedItem}>Clear</button>
          </div>
        ) : (
          <div className="mt-2 text-[11px] text-slate-500">Pick a STAC item from the list or map to continue.</div>
        )}
      </div>

      <div className={`rounded-lg border px-3 py-2 ${stepStateClass(step5)}`} data-testid="wizard-step-5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Step 5</div>
        <div className="mt-1 text-xs font-semibold text-slate-900">Create/link pin</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Tooltip content={createPinDisabledReason}>
            <button
              type="button"
              className={`rounded-full border px-3 py-1 text-xs font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                step5.active ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              onClick={onCreatePin}
              disabled={!canCreatePin}
            >
              Create pin
            </button>
          </Tooltip>
          {pinsCount > 0 ? (
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              {pinsCount} link{pinsCount === 1 ? "" : "s"} ready
            </span>
          ) : null}
        </div>
      </div>

      <div className={`rounded-lg border px-3 py-2 ${stepStateClass(step6)}`} data-testid="wizard-step-6">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Step 6</div>
        <div className="mt-1 text-xs font-semibold text-slate-900">Save reviewer artifact</div>
        <div className="mt-2 grid gap-3">
          <div className="text-[11px] text-slate-500">Type concise minutes or an outcome note, then save it explicitly before finalization.</div>
          <textarea
            data-testid="verifier-minutes-textarea"
            className="min-h-[96px] w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-200 disabled:opacity-60"
            placeholder="Verifier minutes: what you checked, what you assume, what remains uncertain."
            value={draftMinutes}
            disabled={step6.disabled || currentWorkspaceIsFinal}
            onChange={(event) => onReviewerMinutesChange(event.target.value)}
          />
          <textarea
            className="min-h-[72px] w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-200 disabled:opacity-60"
            placeholder="Outcome note: one concise sentence if minutes are unnecessary."
            value={draftOutcomeNote}
            disabled={step6.disabled || currentWorkspaceIsFinal}
            onChange={(event) => onReviewerOutcomeNoteChange(event.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onSaveReviewerArtifact}
              disabled={step6.disabled || currentWorkspaceIsFinal || !hasDraftArtifactChanges}
            >
              Save reviewer artifact
            </button>
            {savedReviewerArtifactAt ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                Saved {formatDate(savedReviewerArtifactAt)}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className={`rounded-lg border px-3 py-2 ${stepStateClass(step7)}`} data-testid="wizard-step-7">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Step 7</div>
        <div className="mt-1 text-xs font-semibold text-slate-900">Finalize run</div>
        <div className="mt-1 text-[11px] text-slate-500">This is the single completion/export action. Finalization writes the immutable run artifact with evidence and reviewer notes.</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-emerald-700 bg-emerald-700 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onFinalizeRun}
            disabled={step7.disabled || currentWorkspaceIsFinal}
          >
            Finalize run
          </button>
          {finalizedAt ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              Finalized {formatDate(finalizedAt)}
            </span>
          ) : null}
        </div>
      </div>

      {wizard.isComplete ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3" data-testid="wizard-completion-card">
          <div className="text-sm font-semibold text-emerald-900">Run complete</div>
          <div className="mt-1 text-xs text-emerald-800">Locked artifacts: finalized workspace state and the saved reviewer artifact.</div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className="rounded-full border border-emerald-700 bg-emerald-700 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800" onClick={onStartAnotherRun}>Start another run</button>
            <button type="button" className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-800 shadow-sm hover:bg-emerald-100" onClick={onViewRunHistory}>View run history</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
