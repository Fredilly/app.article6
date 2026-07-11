"use client";

import Link from "next/link";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  loadVm0007EvidenceMapDraft,
  VM0007_EVIDENCE_MAP_DRAFT_EVENT,
} from "@/lib/preverif/vm0007EvidenceMapDraftStore";
import type { Vm0007EvidenceMapDraftPackage } from "@/lib/preverif/vm0007EvidenceMapDraft";

type Vm0007GapReportLaunchButtonProps = {
  isVm0007Result: boolean;
  auditId?: string | null;
  projectId?: string | null;
  title?: string;
  onGenerate?: (() => void) | null;
  generationError?: string | null;
  generating?: boolean;
  generateDisabled?: boolean;
  testId?: string;
};

export default function Vm0007GapReportLaunchButton({
  isVm0007Result,
  auditId,
  title = "Internal report",
  onGenerate = null,
  generationError = null,
  generating = false,
  generateDisabled = false,
  testId = "vm0007-internal-report-section",
}: Vm0007GapReportLaunchButtonProps) {
  const [draftPackage, setDraftPackage] = useState<Vm0007EvidenceMapDraftPackage | null>(null);
  useEffect(() => {
    const refresh = () => setDraftPackage(auditId?.trim() ? loadVm0007EvidenceMapDraft(auditId) : null);
    refresh();
    const onDraftEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ auditId?: string }>).detail;
      if (!auditId || detail?.auditId === auditId) refresh();
    };
    window.addEventListener(VM0007_EVIDENCE_MAP_DRAFT_EVENT, onDraftEvent);
    return () => window.removeEventListener(VM0007_EVIDENCE_MAP_DRAFT_EVENT, onDraftEvent);
  }, [auditId]);

  const evidenceMapHref = auditId?.trim()
    ? `/internal/reports/vm0007-evidence-map/${encodeURIComponent(auditId)}`
    : null;

  if (!isVm0007Result) return null;

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 px-4 py-4" data-testid={testId}>
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</div>
      {draftPackage && evidenceMapHref ? (
        <>
          <div className="mt-2 text-sm text-slate-600">Open the persisted machine-proposed Evidence Map.</div>
          <div className="mt-3">
            <Link
              href={evidenceMapHref}
              className="inline-flex items-center gap-2 rounded-full border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:border-blue-700 hover:bg-blue-700"
            >
              <ArrowUpRight className="h-4 w-4" />
              Open Evidence Map
            </Link>
          </div>
          <div className="mt-2 text-xs text-slate-500">{draftPackage.methodologyId} {draftPackage.rulebookVersion} · {draftPackage.rows.length} requirements</div>
        </>
      ) : onGenerate ? (
        <>
          {generationError ? <div className="mt-2 text-sm text-amber-800">{generationError}</div> : null}
          <div className="mt-2 text-sm text-slate-600">
            Create a machine-proposed Evidence Map from the VM0007 methodology requirements and the uploaded PDD.
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={onGenerate}
              disabled={generating || generateDisabled}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
              {generationError ? "Retry Evidence Map" : "Generate Evidence Map"}
            </button>
          </div>
        </>
      ) : auditId?.trim() ? (
        <>
          <div className="mt-2 text-sm text-slate-600">Evidence Map was not created for this audit. Rerun the evidence review with a valid VM0007 v1.8 PDD.</div>
        </>
      ) : (
        <>
          <div className="mt-2">
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500"
            >
              Evidence Map not available yet
            </button>
          </div>
          <div className="mt-3 text-sm text-slate-600">
            Upload a VM0007 v1.8 PDD and run Quick Check to generate the Evidence Map.
          </div>
        </>
      )}
    </div>
  );
}
