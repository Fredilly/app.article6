"use client";

import { useEffect, useState, type ReactNode } from "react";
import Tooltip from "@/components/ui/Tooltip";
import type { AoiFeatureRole } from "@/lib/proofMap/types";
import type { VerifyWizardStepDetails } from "@/lib/verify/runState";

type RuleOption = { id: string; title: string };

function shortRuleLabel(ruleId: string): string {
  const trimmed = ruleId.trim();
  if (!trimmed) return "";
  const dotSegments = trimmed.split(".");
  const lastSegment = dotSegments[dotSegments.length - 1]?.trim() ?? "";
  if (/^R-\d/i.test(lastSegment)) return lastSegment;
  const match = trimmed.match(/(^|[.-])(R-\d[\w-]*)$/i);
  return match?.[2] ?? trimmed;
}

function formatRuleOptionLabel(rule: RuleOption): string {
  const shortId = shortRuleLabel(rule.id);
  const title = rule.title.trim();
  if (!title || title === rule.id || title === shortId) return shortId || rule.id;
  return `${shortId || rule.id} - ${title.slice(0, 60)}`;
}

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
    primaryFeatureName?: string | null;
    areaKm2: number | null;
    bboxLabel: string | null;
    declaredAreaKm2?: number | null;
    declaredAreaSource?: string | null;
    projectZoneCount?: number;
    supportingFeatureCount?: number;
    areaMismatchRelative?: number | null;
    areaMismatchWarning?: boolean;
    requiresPrimarySelection?: boolean;
  } | null;
  aoiFeatures?: Array<{
    id: string;
    name: string;
    geometryType: string;
    areaKm2: number | null;
    role: AoiFeatureRole;
  }>;
  onAoiFeatureRoleChange?: (featureId: string, role: AoiFeatureRole) => void;
  declaredAreaInput?: string;
  onDeclaredAreaInputChange?: (value: string) => void;
  onConfirmArea?: () => void;
  canConfirmArea?: boolean;
  isAreaConfirmed?: boolean;
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
  finalizeBlocked?: boolean;
  finalizeGateBanner?: ReactNode;
  finalizedResult?: ReactNode;
};

function stepStateClass(input: { active: boolean; complete: boolean; disabled: boolean }): string {
  if (input.active) return "border-slate-300 bg-white shadow-sm shadow-slate-200/30";
  if (input.complete) return "border-emerald-200/80 bg-emerald-50/35";
  if (input.disabled) return "border-slate-200/80 bg-slate-50/60 opacity-80";
  return "border-slate-200/90 bg-white";
}

function stepMarkerClass(input: { active: boolean; complete: boolean; disabled: boolean }): string {
  if (input.active) return "border-slate-900 bg-slate-900 text-white";
  if (input.complete) return "border-emerald-200 bg-white text-emerald-700";
  if (input.disabled) return "border-slate-200 bg-slate-50 text-slate-400";
  return "border-slate-200 bg-white text-slate-500";
}

function stepTextTone(input: { active: boolean; complete: boolean; disabled: boolean }): string {
  if (input.active) return "text-slate-900";
  if (input.disabled) return "text-slate-500";
  return "text-slate-700";
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatAreaKm2(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(2)} km²` : "—";
}

const AOI_ROLE_OPTIONS: Array<{ value: AoiFeatureRole; label: string }> = [
  { value: "primary_project_area", label: "primary_project_area" },
  { value: "project_zone", label: "project_zone" },
  { value: "leakage_belt", label: "leakage_belt" },
  { value: "reference_region", label: "reference_region" },
  { value: "excluded_area", label: "excluded_area" },
  { value: "stratum", label: "stratum" },
  { value: "monitoring_plot", label: "monitoring_plot" },
  { value: "canal_block", label: "canal_block" },
  { value: "dipwell", label: "dipwell" },
  { value: "subsidence_pole", label: "subsidence_pole" },
  { value: "other", label: "other" },
];

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
      className="rounded-xl border border-emerald-200/90 bg-white px-4 py-3"
      data-testid="wizard-completed-summary"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
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
            className="rounded-full border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              onClick={onViewOutcome}
            >
              View outcome
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            onClick={onStartAnotherRun}
          >
            Start another run
          </button>
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700"
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
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          onClick={onCollapse}
        >
          Collapse workflow
        </button>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-white px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
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
                className="rounded-full border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                onClick={onViewOutcome}
              >
                View outcome
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              onClick={onStartAnotherRun}
            >
              Start another run
            </button>
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
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
  aoiFeatures = [],
  onAoiFeatureRoleChange,
  declaredAreaInput = "",
  onDeclaredAreaInputChange,
  onConfirmArea,
  canConfirmArea = false,
  isAreaConfirmed = false,
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
  finalizeBlocked = false,
  finalizeGateBanner = null,
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
  const readyToFinalize =
    !finalizeBlocked && (step7.active || (reviewerArtifactSaved && !currentWorkspaceIsFinal && !step7.disabled));
  const stepShellClass = currentWorkspaceIsFinal ? "opacity-45 transition" : "transition";
  const [completedWorkflowExpanded, setCompletedWorkflowExpanded] = useState(false);
  const [advancedSpatialOpen, setAdvancedSpatialOpen] = useState(false);
  const completedCounts = [
    typeof reviewedRuleCount === "number"
      ? `${reviewedRuleCount} reviewed rule${reviewedRuleCount === 1 ? "" : "s"}`
      : null,
    typeof linkedEvidenceCount === "number"
      ? `${linkedEvidenceCount} linked evidence item${linkedEvidenceCount === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean) as string[];
  const finalizedLabel = formatDate(finalizedAt);
  const nextActionText =
    finalizeBlocked && !currentWorkspaceIsFinal
      ? "Complete all non-pending rule reviews with rationale and support before finalizing."
      : (wizard.nextAction ?? "Run complete");

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

  const searchAndSelectState = {
    active: step3.active || step4.active,
    complete: step4.complete,
    disabled: step3.disabled,
  };
  const saveAndFinalizeState = {
    active: step6.active || step7.active,
    complete: false,
    disabled: step6.disabled && step7.disabled,
  };

  return (
    <div className="grid gap-3">
      <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 px-3.5 py-2.5 text-[11px] text-slate-600" data-testid="wizard-next-action">
        <span className="font-semibold text-slate-900">Next:</span> {nextActionText}
      </div>

      <div className={`${stepShellClass} rounded-xl border px-3.5 py-3 ${stepStateClass(step1)}`} data-testid="wizard-step-1">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${stepMarkerClass(step1)}`}>
            {step1.complete ? "✓" : "1"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Step 1</div>
              <div className={`text-sm font-semibold ${stepTextTone(step1)}`}>Pick rule</div>
            </div>
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
                    <option key={rule.id} value={rule.id} title={rule.id}>
                      {formatRuleOptionLabel(rule)}
                    </option>
                  ))}
                </select>
              </div>
              {selectedRuleId ? (
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => onViewRule?.(selectedRuleId)}
                >
                  View rule
                </button>
              ) : (
                <div className="text-[11px] text-slate-500">Select a rule to unlock the rest of the workflow.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={`${stepShellClass} rounded-xl border px-3.5 py-3 ${stepStateClass(step2)}`} data-testid="wizard-step-2">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${stepMarkerClass(step2)}`}>
            {step2.complete ? "✓" : "2"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Step 2</div>
              <div className={`text-sm font-semibold ${stepTextTone(step2)}`}>Confirm area</div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  step2.active ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                onClick={onUploadAoi}
                disabled={step2.disabled}
              >
                Upload Area
              </button>
              {!selectedRuleId ? (
                <div className="text-[11px] text-slate-500">Disabled: pick a rule first.</div>
              ) : hasAoi ? (
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  Area ready
                </span>
              ) : (
                <div className="text-[11px] text-slate-500">Upload and confirm an Area to continue.</div>
              )}
            </div>
            {aoiSummary ? (
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-2 text-xs text-slate-700">
                {aoiSummary.isPreview ? (
                  <>
                    <div className="font-semibold text-slate-900">New Area ready</div>
                    <div className="mt-1">Replace the current Area with <span className="font-semibold">{aoiLabel ?? "uploaded Area"}</span>?</div>
                    {aoiSummary.willClearWork ? <div className="mt-1 text-[11px] text-slate-600">This will clear pins and evidence selections.</div> : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button type="button" className="rounded-full border border-sky-200 bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-700" onClick={onApplyDraftAoiClick}>Replace Area</button>
                      <button type="button" className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={onCancelDraftAoi}>Keep current</button>
                    </div>
                    {aoiSummary.isSameAoi && aoiSummary.showSameAoiPrompt ? (
                      <div className="mt-2 rounded-md border border-slate-200 bg-white px-2 py-2 text-[11px] text-slate-700">
                        <div className="font-semibold text-slate-800">Same Area detected. Keep current links?</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button type="button" className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50" onClick={onKeepSameAoi}>Keep</button>
                          <button type="button" className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100" onClick={onResetSameAoi}>Reset anyway</button>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="grid gap-3 text-[11px] text-slate-600">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Primary Project Area</div>
                        <div className="mt-1 break-words font-semibold text-slate-900">{aoiSummary.primaryFeatureName ?? "Not selected"}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Uploaded Geometry Area</div>
                        <div className="mt-1 font-semibold text-slate-900">{formatAreaKm2(aoiSummary.areaKm2)}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Declared Area</div>
                        <div className="mt-1 font-semibold text-slate-900">{formatAreaKm2(aoiSummary.declaredAreaKm2)}</div>
                        {aoiSummary.declaredAreaSource ? <div className="mt-1 break-words text-slate-500">{aoiSummary.declaredAreaSource}</div> : null}
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Supporting Features</div>
                        <div className="mt-1 font-semibold text-slate-900">
                          {aoiSummary.projectZoneCount ?? 0} project zone{(aoiSummary.projectZoneCount ?? 0) === 1 ? "" : "s"}
                          {" · "}
                          {aoiSummary.supportingFeatureCount ?? 0} supporting
                        </div>
                      </div>
                    </div>
                    <div className="break-words">bbox: {aoiSummary.bboxLabel ?? "—"}</div>
                    <label className="grid gap-1 text-[11px] text-slate-600">
                      <span>Declared area (km²)</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={declaredAreaInput}
                        onChange={(event) => onDeclaredAreaInputChange?.(event.target.value)}
                        placeholder="Optional PDD / registry value"
                        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700"
                      />
                    </label>
                    {typeof aoiSummary.declaredAreaKm2 === "number" ? (
                      <div>
                        declared area: {aoiSummary.declaredAreaKm2.toFixed(2)} km²
                        {aoiSummary.declaredAreaSource ? ` (${aoiSummary.declaredAreaSource})` : ""}
                      </div>
                    ) : null}
                    {aoiSummary.areaMismatchWarning && typeof aoiSummary.areaMismatchRelative === "number" ? (
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-2 font-medium text-amber-800">
                        Boundary appears approximate. Declared area is {formatAreaKm2(aoiSummary.declaredAreaKm2)}; uploaded geometry is {formatAreaKm2(aoiSummary.areaKm2)}.
                      </div>
                    ) : null}
                    {aoiSummary.primaryFeatureName ? (
                      <div className="font-semibold text-slate-700">Primary project area detected. Review or confirm to continue.</div>
                    ) : aoiSummary.requiresPrimarySelection ? (
                      <div className="font-semibold text-amber-700">Select exactly one primary project area feature to continue.</div>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-sky-200 bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={onConfirmArea}
                        disabled={!canConfirmArea}
                      >
                        Confirm area
                      </button>
                      {isAreaConfirmed ? (
                        <span className="text-[11px] font-semibold text-emerald-700">Confirmed for satellite search</span>
                      ) : (
                        <span className="text-[11px] text-slate-500">Satellite search stays locked until the area is confirmed.</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
            {aoiFeatures.length > 0 ? (
              <details
                className="mt-3 rounded-lg border border-slate-200 bg-white"
                open={advancedSpatialOpen}
                onToggle={(event) => setAdvancedSpatialOpen((event.currentTarget as HTMLDetailsElement).open)}
              >
                <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-slate-700">
                  Advanced: edit spatial features
                </summary>
                <div className="grid gap-2 border-t border-slate-100 px-3 py-3">
                  {aoiFeatures.map((feature) => (
                    <div
                      key={feature.id}
                      className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]"
                    >
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Feature</div>
                        <div className="mt-1 break-words font-medium text-slate-900">{feature.name}</div>
                        <div className="mt-1 text-slate-500">{feature.geometryType}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Area</div>
                        <div className="mt-1 text-slate-900">{formatAreaKm2(feature.areaKm2)}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Role</div>
                        <select
                          className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700"
                          value={feature.role}
                          onChange={(event) => onAoiFeatureRoleChange?.(feature.id, event.target.value as AoiFeatureRole)}
                        >
                          {AOI_ROLE_OPTIONS.map((option) => (
                            <option
                              key={option.value}
                              value={option.value}
                              disabled={option.value === "primary_project_area" && feature.areaKm2 == null}
                            >
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        </div>
      </div>

      <div className={`${stepShellClass} rounded-xl border px-3.5 py-3 ${stepStateClass(searchAndSelectState)}`} data-testid="wizard-step-3">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${stepMarkerClass(searchAndSelectState)}`}>
            {searchAndSelectState.complete ? "✓" : "3"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Step 3</div>
              <div className={`text-sm font-semibold ${stepTextTone(searchAndSelectState)}`}>Search satellite</div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
                  searchAndSelectState.active ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                disabled={step3.disabled || searchDisabled}
                onClick={onSearchStac}
              >
                {isRunning ? "Searching…" : "Search Satellite"}
              </button>
              {!hasAoi ? (
                <div className="text-[11px] text-slate-500">Disabled: confirm Area first.</div>
              ) : hasSearchResults ? (
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                  {stacResultCount} result{stacResultCount === 1 ? "" : "s"}
                </span>
              ) : (
                <div className="text-[11px] text-slate-500">Run search to load candidate evidence.</div>
              )}
            </div>
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/55 px-3 py-2" data-testid="wizard-step-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Selected item</div>
              {selectedStacItemId ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                    <span className="font-mono">{selectedStacItemId}</span>
                  </span>
                  <button type="button" className="text-xs font-semibold text-slate-700 underline underline-offset-2" onClick={onClearSelectedItem}>Clear</button>
                </div>
              ) : (
                <div className="mt-2 text-[11px] text-slate-500">Pick a satellite result from the list or map to continue.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={`${stepShellClass} rounded-xl border px-3.5 py-3 ${stepStateClass(step5)}`} data-testid="wizard-step-5">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${stepMarkerClass(step5)}`}>
            {step5.complete ? "✓" : "4"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Step 4</div>
              <div className={`text-sm font-semibold ${stepTextTone(step5)}`}>Evidence inventory</div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Tooltip content={createPinDisabledReason}>
                <button
                  type="button"
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
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
              ) : (
                <div className="text-[11px] text-slate-500">Create and link evidence for the selected rule.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={`${stepShellClass} rounded-xl border px-3.5 py-3 ${stepStateClass(saveAndFinalizeState)}`} data-testid="wizard-step-6">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${stepMarkerClass(saveAndFinalizeState)}`}>
            {step7.complete ? "✓" : "5"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Step 5</div>
              <div className={`text-sm font-semibold ${stepTextTone(saveAndFinalizeState)}`}>Save &amp; finalize</div>
            </div>
            <div className="mt-2 grid gap-3">
              <div className="text-[11px] text-slate-500">Type concise minutes or an outcome note, save it explicitly, then finalize the run.</div>
              <textarea
                data-testid="verifier-minutes-textarea"
                className="min-h-[92px] w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200 disabled:opacity-60"
                placeholder="Verifier minutes: what you checked, what you assume, what remains uncertain."
                value={draftMinutes}
                disabled={currentWorkspaceIsFinal}
                onChange={(event) => onReviewerMinutesChange(event.target.value)}
              />
              <textarea
                className="min-h-[72px] w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200 disabled:opacity-60"
                placeholder="Outcome note: one concise sentence if minutes are unnecessary."
                value={draftOutcomeNote}
                disabled={currentWorkspaceIsFinal}
                onChange={(event) => onReviewerOutcomeNoteChange(event.target.value)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
                {hasUnsavedWorkspaceEdits ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                    Unsaved edits
                  </span>
                ) : null}
                {loadedFromRunLabel ? (
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                    Loaded from Run {loadedFromRunLabel}
                  </span>
                ) : null}
                {isEditedDraft ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                    Edited draft
                  </span>
                ) : null}
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/55 px-3 py-3" data-testid="wizard-step-7">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Finalize run</div>
                <div className="mt-1 text-[11px] text-slate-500">Finalization writes the immutable run artifact with evidence and reviewer notes.</div>
                {finalizeGateBanner ? <div className="mt-2">{finalizeGateBanner}</div> : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={onFinalizeRun}
                    disabled={step7.disabled || currentWorkspaceIsFinal || finalizeBlocked}
                  >
                    Finalize run
                  </button>
                  {reviewerArtifactSaved ? (
                    <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                      Reviewer artifact saved
                    </span>
                  ) : null}
                  {readyToFinalize ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                      Ready to finalize
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
