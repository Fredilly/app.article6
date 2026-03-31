"use client";

import { useEffect, useState, type ReactNode } from "react";
import Tooltip from "@/components/ui/Tooltip";
import type { VerifyWizardStepDetails } from "@/lib/verify/runState";

type RuleOption = { id: string; title: string };

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
  onViewOutcome?: () => void;
  methodCode?: string;
  version?: string;
  reviewedRuleCount?: number | null;
  linkedEvidenceCount?: number | null;
  finalizedResult?: ReactNode;
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

function CompletedWorkflowSummary(props: {
  methodCode?: string;
  version?: string;
  finalizedLabel: string | null;
  completedCounts: string[];
  onViewOutcome?: () => void;
  onStartAnotherRun: () => void;
  onExpand: () => void;
}) {
  const { methodCode, version, finalizedLabel, completedCounts, onViewOutcome, onStartAnotherRun, onExpand } = props;

  return (
    <div
      className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-slate-50 px-4 py-3 shadow-sm shadow-emerald-100"
      data-testid="wizard-completed-summary"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
              Finalized
            </span>
            {methodCode && version ? (
              <span className="text-xs font-medium text-slate-600">
                {methodCode}@{version}
              </span>
            ) : null}
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-900">Workflow completed</div>
          <div className="mt-1 text-xs text-slate-600">
            {finalizedLabel ? `Finalized ${finalizedLabel}` : "Run finalized."}
          </div>
          <div className="mt-1 text-xs text-slate-600">
            {completedCounts.length ? completedCounts.join(" · ") : "Outcome and exports are now the primary surface."}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onViewOutcome ? (
            <button
              type="button"
              className="rounded-full border border-emerald-700 bg-emerald-700 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800"
              onClick={onViewOutcome}
            >
              View outcome
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={onStartAnotherRun}
          >
            Start another run
          </button>
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={onExpand}
          >
            Expand workflow
          </button>
        </div>
      </div>
    </div>
  );
}

function CompletedWorkflowDetail(props: {
  currentRunLabel: string;
  loadedFromRunLabel?: string | null;
  finalizedLabel: string | null;
  savedReviewerArtifactAt?: string | null;
  methodCode?: string;
  version?: string;
  reviewedRuleCount?: number | null;
  linkedEvidenceCount?: number | null;
  stacResultCount: number;
  savedMinutes: string;
  savedOutcomeNote: string;
  wizard: VerifyWizardStepDetails;
  finalizedResult?: ReactNode;
  onViewOutcome?: () => void;
  onViewRunHistory: () => void;
  onStartAnotherRun: () => void;
  onCollapse: () => void;
}) {
  const {
    currentRunLabel,
    loadedFromRunLabel = null,
    finalizedLabel,
    savedReviewerArtifactAt = null,
    methodCode,
    version,
    reviewedRuleCount = null,
    linkedEvidenceCount = null,
    stacResultCount,
    savedMinutes,
    savedOutcomeNote,
    wizard,
    finalizedResult = null,
    onViewOutcome,
    onViewRunHistory,
    onStartAnotherRun,
    onCollapse,
  } = props;
  const savedArtifactLabel = formatDate(savedReviewerArtifactAt);
  const reviewerSummary = savedMinutes.trim() || savedOutcomeNote.trim() || "No reviewer note captured.";

  return (
    <div className="grid gap-3" data-testid="wizard-completed-detail">
      <div className="flex justify-end">
        <button
          type="button"
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          onClick={onCollapse}
        >
          Collapse workflow
        </button>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-white px-4 py-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                Completed workflow
              </span>
              {methodCode && version ? (
                <span className="text-xs font-medium text-slate-600">
                  {methodCode}@{version}
                </span>
              ) : null}
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900">Completed audit detail</div>
            <div className="mt-1 text-xs text-slate-600">
              {finalizedLabel ? `Finalized ${finalizedLabel}` : "Run finalized."}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onViewOutcome ? (
              <button
                type="button"
                className="rounded-full border border-emerald-700 bg-emerald-700 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800"
                onClick={onViewOutcome}
              >
                View outcome
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={onStartAnotherRun}
            >
              Start another run
            </button>
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={onViewRunHistory}
            >
              View run history
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Run record</div>
            <div className="mt-2 grid gap-1 text-xs">
              <div><span className="font-semibold text-slate-900">Run:</span> <span className="font-mono">{currentRunLabel}</span></div>
              {loadedFromRunLabel ? <div><span className="font-semibold text-slate-900">Loaded from:</span> <span className="font-mono">{loadedFromRunLabel}</span></div> : null}
              <div><span className="font-semibold text-slate-900">Reviewer artifact:</span> {savedArtifactLabel ?? "Saved in run history"}</div>
              <div><span className="font-semibold text-slate-900">Search results reviewed:</span> {stacResultCount}</div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Completion scope</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {typeof reviewedRuleCount === "number" ? (
                <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">
                  {reviewedRuleCount} reviewed rule{reviewedRuleCount === 1 ? "" : "s"}
                </span>
              ) : null}
              {typeof linkedEvidenceCount === "number" ? (
                <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">
                  {linkedEvidenceCount} linked evidence item{linkedEvidenceCount === 1 ? "" : "s"}
                </span>
              ) : null}
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                {wizard.steps.filter((step) => step.complete).length} steps completed
              </span>
            </div>
            <div className="mt-3 text-xs text-slate-600">{reviewerSummary}</div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Audit history</div>
          <div className="mt-3 grid gap-2">
            {wizard.steps.map((step) => (
              <div key={step.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div>
                  <div className="text-xs font-semibold text-slate-900">Step {step.id} · {step.label}</div>
                  <div className="mt-1 text-[11px] text-slate-600">
                    {step.complete ? "Recorded in the finalized run history." : "Not completed in this run."}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  step.complete ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-slate-200 bg-white text-slate-600"
                }`}>
                  {step.complete ? "Completed" : "Not used"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {finalizedResult ? <div className="mt-4">{finalizedResult}</div> : null}
      </div>
    </div>
  );
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
  onViewOutcome,
  methodCode,
  version,
  reviewedRuleCount = null,
  linkedEvidenceCount = null,
  finalizedResult = null,
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
  const stepShellClass = currentWorkspaceIsFinal ? "opacity-45 transition" : "transition";
  const [completedWorkflowExpanded, setCompletedWorkflowExpanded] = useState(false);
  const completedCounts = [
    typeof reviewedRuleCount === "number"
      ? `${reviewedRuleCount} reviewed rule${reviewedRuleCount === 1 ? "" : "s"}`
      : null,
    typeof linkedEvidenceCount === "number"
      ? `${linkedEvidenceCount} linked evidence item${linkedEvidenceCount === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean) as string[];
  const finalizedLabel = formatDate(finalizedAt);

  useEffect(() => {
    setCompletedWorkflowExpanded(false);
  }, [currentWorkspaceIsFinal, currentRunLabel]);

  if (currentWorkspaceIsFinal && !completedWorkflowExpanded) {
    return (
      <CompletedWorkflowSummary
        methodCode={methodCode}
        version={version}
        finalizedLabel={finalizedLabel}
        completedCounts={completedCounts}
        onViewOutcome={onViewOutcome}
        onStartAnotherRun={onStartAnotherRun}
        onExpand={() => setCompletedWorkflowExpanded(true)}
      />
    );
  }

  if (currentWorkspaceIsFinal) {
    return (
      <CompletedWorkflowDetail
        currentRunLabel={currentRunLabel}
        loadedFromRunLabel={loadedFromRunLabel}
        finalizedLabel={finalizedLabel}
        savedReviewerArtifactAt={savedReviewerArtifactAt}
        methodCode={methodCode}
        version={version}
        reviewedRuleCount={reviewedRuleCount}
        linkedEvidenceCount={linkedEvidenceCount}
        stacResultCount={stacResultCount}
        savedMinutes={savedMinutes}
        savedOutcomeNote={savedOutcomeNote}
        wizard={wizard}
        finalizedResult={finalizedResult}
        onViewOutcome={onViewOutcome}
        onViewRunHistory={onViewRunHistory}
        onStartAnotherRun={onStartAnotherRun}
        onCollapse={() => setCompletedWorkflowExpanded(false)}
      />
    );
  }

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

      <div className={`${stepShellClass} rounded-lg border px-3 py-2 ${stepStateClass(step1)}`} data-testid="wizard-step-1">
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
      </div>

      <div className={`${stepShellClass} rounded-lg border px-3 py-2 ${stepStateClass(step2)}`} data-testid="wizard-step-2">
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

      <div className={`${stepShellClass} rounded-lg border px-3 py-2 ${stepStateClass(step3)}`} data-testid="wizard-step-3">
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

      <div className={`${stepShellClass} rounded-lg border px-3 py-2 ${stepStateClass(step4)}`} data-testid="wizard-step-4">
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

      <div className={`${stepShellClass} rounded-lg border px-3 py-2 ${stepStateClass(step5)}`} data-testid="wizard-step-5">
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

      <div className={`${stepShellClass} rounded-lg border px-3 py-2 ${stepStateClass(step6)}`} data-testid="wizard-step-6">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Step 6</div>
        <div className="mt-1 text-xs font-semibold text-slate-900">Save reviewer artifact</div>
        <div className="mt-2 grid gap-3">
          <div className="text-[11px] text-slate-500">Type concise minutes or an outcome note, then save it explicitly before finalization.</div>
          <textarea
            data-testid="verifier-minutes-textarea"
            className="min-h-[96px] w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-200 disabled:opacity-60"
            placeholder="Verifier minutes: what you checked, what you assume, what remains uncertain."
            value={draftMinutes}
            disabled={currentWorkspaceIsFinal}
            onChange={(event) => onReviewerMinutesChange(event.target.value)}
          />
          <textarea
            className="min-h-[72px] w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-200 disabled:opacity-60"
            placeholder="Outcome note: one concise sentence if minutes are unnecessary."
            value={draftOutcomeNote}
            disabled={currentWorkspaceIsFinal}
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

      <div className={`${currentWorkspaceIsFinal ? "opacity-70 transition" : "transition"} rounded-lg border px-3 py-2 ${stepStateClass(step7)}`} data-testid="wizard-step-7">
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
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-slate-50 px-4 py-4 shadow-sm shadow-emerald-100" data-testid="wizard-completion-card">
          <div className="text-sm font-semibold text-emerald-900">Run complete</div>
          <div className="mt-1 text-xs text-emerald-800">Locked artifacts: finalized workspace state and the saved reviewer artifact.</div>
          {finalizedResult ? <div className="mt-4">{finalizedResult}</div> : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className="rounded-full border border-emerald-700 bg-emerald-700 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800" onClick={onStartAnotherRun}>Start another run</button>
            {onViewOutcome ? (
              <button type="button" className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-800 shadow-sm hover:bg-emerald-100" onClick={onViewOutcome}>View outcome</button>
            ) : null}
            <button type="button" className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-800 shadow-sm hover:bg-emerald-100" onClick={onViewRunHistory}>View run history</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
