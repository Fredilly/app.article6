"use client";

import Tooltip from "@/components/ui/Tooltip";

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
  onStartRun: () => void;
  onOpenRunDetails: () => void;
};

function stepStateClass(input: { active: boolean; complete: boolean; disabled: boolean }): string {
  if (input.active) return "border-slate-900 bg-slate-50";
  if (input.complete) return "border-emerald-200 bg-emerald-50";
  if (input.disabled) return "border-slate-200 bg-slate-50/70 opacity-75";
  return "border-slate-200 bg-white";
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
  onStartRun,
  onOpenRunDetails,
}: EvidenceWorkflowStepperProps) {
  const hasRule = Boolean(selectedRuleId);
  const hasItem = Boolean(selectedStacItemId);
  const hasPins = pinsCount > 0;

  const activeStep = !hasRule ? 1 : !hasAoi ? 2 : !hasSearchResults ? 3 : !hasItem ? 4 : !hasPins ? 5 : 6;
  const step1 = { active: activeStep === 1, complete: hasRule, disabled: false };
  const step2 = { active: activeStep === 2, complete: hasAoi, disabled: !hasRule };
  const step3 = { active: activeStep === 3, complete: hasSearchResults, disabled: !hasAoi };
  const step4 = { active: activeStep === 4, complete: hasItem, disabled: !hasSearchResults };
  const step5 = { active: activeStep === 5, complete: hasPins, disabled: !hasRule || !hasItem };
  const step6 = { active: activeStep === 6, complete: hasPins, disabled: !hasPins };

  return (
    <div className="grid gap-3">
      <div className="sticky top-0 z-10 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Current selection</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
            Rule: <span className="ml-1 font-mono">{selectedRuleId ?? "none"}</span>
          </span>
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
            AOI: <span className="ml-1">{aoiLabel ?? "none"}</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
            Selected item: <span className="font-mono">{selectedStacItemId ?? "none"}</span>
            {selectedStacItemId ? (
              <button
                type="button"
                className="rounded-full border border-slate-200 bg-slate-50 px-1 text-[10px] leading-4 text-slate-600 hover:bg-slate-100"
                onClick={onClearSelectedItem}
                aria-label="Clear selected item"
              >
                x
              </button>
            ) : null}
          </span>
        </div>
      </div>

      <div className={`rounded-lg border px-3 py-2 ${stepStateClass(step1)}`}>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Step 1</div>
        <div className="mt-1 text-xs font-semibold text-slate-900">Pick rule</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
            <span className="text-xs font-semibold text-slate-600">Rule</span>
            <select
              className="max-w-[220px] bg-transparent text-xs text-slate-700 outline-none"
              value={selectedRuleId ?? ""}
              onChange={(event) => {
                const next = event.target.value.trim();
                onSelectRuleId?.(next || null);
              }}
            >
              <option value="">Select rule…</option>
              {ruleOptions.map((rule) => {
                const preview = rule.title.trim().slice(0, 60);
                return (
                  <option key={rule.id} value={rule.id}>
                    {rule.id} {preview ? `- ${preview}` : ""}
                  </option>
                );
              })}
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
            <div className="text-[11px] text-slate-500">Select a rule to unlock AOI upload.</div>
          )}
        </div>
      </div>

      <div className={`rounded-lg border px-3 py-2 ${stepStateClass(step2)}`}>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Step 2</div>
        <div className="mt-1 text-xs font-semibold text-slate-900">Upload/Confirm AOI</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`rounded-full border px-3 py-1 text-xs font-semibold shadow-sm ${
              step2.active
                ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
            onClick={onUploadAoi}
            disabled={!hasRule}
          >
            Upload AOI
          </button>
          {!hasRule ? (
            <div className="text-[11px] text-slate-500">Disabled: pick a rule first.</div>
          ) : hasAoi ? (
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              AOI ready
            </span>
          ) : (
            <div className="text-[11px] text-slate-500">Upload AOI to continue.</div>
          )}
        </div>
        {aoiSummary ? (
          <div className="mt-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700">
            {aoiSummary.isPreview ? (
              <>
                <div className="font-semibold text-slate-900">New AOI ready</div>
                <div className="mt-1">
                  Replace the current AOI with <span className="font-semibold">{aoiLabel ?? "uploaded AOI"}</span>?
                </div>
                {aoiSummary.willClearWork ? (
                  <div className="mt-1 text-[11px] text-slate-600">This will clear pins and evidence selections.</div>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-sky-200 bg-sky-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-sky-700"
                    onClick={onApplyDraftAoiClick}
                  >
                    Replace AOI
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                    onClick={onCancelDraftAoi}
                  >
                    Keep current
                  </button>
                </div>
                {aoiSummary.isSameAoi && aoiSummary.showSameAoiPrompt ? (
                  <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-[11px] text-slate-700">
                    <div className="font-semibold text-slate-800">Same AOI detected. Keep current links?</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                        onClick={onKeepSameAoi}
                      >
                        Keep
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 shadow-sm hover:bg-rose-100"
                        onClick={onResetSameAoi}
                      >
                        Reset anyway
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="grid gap-1 text-[11px] text-slate-600">
                <div>area: {typeof aoiSummary.areaKm2 === "number" ? aoiSummary.areaKm2.toFixed(2) : "—"} km²</div>
                <div className="break-words">bbox: {aoiSummary.bboxLabel ?? "—"}</div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className={`rounded-lg border px-3 py-2 ${stepStateClass(step3)}`}>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Step 3</div>
        <div className="mt-1 text-xs font-semibold text-slate-900">Search STAC</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`rounded-full border px-3 py-1 text-xs font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${
              step3.active
                ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
            disabled={!hasAoi || searchDisabled}
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
            <div className="text-[11px] text-slate-500">Run search to load STAC items.</div>
          )}
        </div>
      </div>

      <div className={`rounded-lg border px-3 py-2 ${stepStateClass(step4)}`}>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Step 4</div>
        <div className="mt-1 text-xs font-semibold text-slate-900">Select item</div>
        {hasItem ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
              <span className="font-mono">{selectedStacItemId}</span>
            </span>
            <button
              type="button"
              className="text-xs font-semibold text-slate-700 underline underline-offset-2"
              onClick={onClearSelectedItem}
            >
              Clear
            </button>
          </div>
        ) : (
          <div className="mt-2 text-[11px] text-slate-500">Pick a STAC item from the list or map to continue.</div>
        )}
      </div>

      <div className={`rounded-lg border px-3 py-2 ${stepStateClass(step5)}`}>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Step 5</div>
        <div className="mt-1 text-xs font-semibold text-slate-900">Create pin</div>
        <div className="mt-2">
          <Tooltip content={createPinDisabledReason}>
            <button
              type="button"
              className={`rounded-full border px-3 py-1 text-xs font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                step5.active
                  ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              onClick={onCreatePin}
              disabled={!canCreatePin}
            >
              Create pin
            </button>
          </Tooltip>
          {!canCreatePin ? (
            <div className="mt-1 text-[11px] text-slate-500">
              {!hasRule ? "Disabled: pick a rule first." : !hasItem ? "Disabled: select a STAC item first." : "Disabled."}
            </div>
          ) : null}
        </div>
      </div>

      <div className={`rounded-lg border px-3 py-2 ${stepStateClass(step6)}`}>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Run</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-slate-900 bg-slate-900 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onStartRun}
            disabled={!hasPins}
          >
            Start run with {pinsCount} pin{pinsCount === 1 ? "" : "s"}
          </button>
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={onOpenRunDetails}
          >
            Run details
          </button>
        </div>
        {!hasPins ? (
          <div className="mt-1 text-[11px] text-slate-500">Disabled: create at least one pin first.</div>
        ) : null}
      </div>
    </div>
  );
}
