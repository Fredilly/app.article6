"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import type { DraftFindingType } from "@/lib/evidence/draftFindingContract";
import type { Vm0007EvidenceMapDraftRow, Vm0007PersistedEvidenceMapAssessment } from "@/lib/preverif/vm0007EvidenceMapDraft";
import type { Vm0007EvidenceMapEdit } from "@/lib/preverif/vm0007EvidenceMapReview";

type FormState = {
  assessmentReason: string;
  applicability: "" | "APPLICABLE" | "NOT_APPLICABLE" | "NOT_EVALUATED";
  applicabilityBasis: string;
  requirementSupport: "" | "SUPPORTED" | "NOT_SUPPORTED" | "NOT_EVALUATED";
  searchCoverage: "" | "ADEQUATE" | "INADEQUATE" | "NOT_REQUIRED" | "NOT_EVALUATED";
  provenance: "" | "COMPLETE" | "INCOMPLETE" | "NOT_EVALUATED";
  versionIdentity: "" | "MATCHED" | "NOT_REQUIRED" | "MISMATCHED" | "UNRESOLVED";
  contradiction: "" | "NONE" | "BLOCKING" | "NOT_EVALUATED";
  draftFinding: "" | Exclude<DraftFindingType, null>;
  findingBasis: string;
  reviewerAssessment: string;
  note: string;
};

function initialForm(row: Vm0007EvidenceMapDraftRow): FormState {
  const assessment = row.assessment;
  return {
    assessmentReason: row.assessmentReason,
    applicability: assessment?.applicability.decision ?? "",
    applicabilityBasis: assessment?.applicability.decisionBasis ?? "",
    requirementSupport: assessment?.conformance.requirementSupport ?? "",
    searchCoverage: assessment?.conformance.searchCoverageAssessment ?? "",
    provenance: assessment?.conformance.provenanceAssessment ?? "",
    versionIdentity: assessment?.conformance.versionIdentityAssessment ?? "",
    contradiction: assessment?.conformance.contradictionAssessment ?? "",
    draftFinding: assessment?.draftFinding.draftFindingType ?? "",
    findingBasis: assessment?.draftFinding.findingBasis ?? "",
    reviewerAssessment: assessment?.draftFinding.reviewerAssessment ?? "",
    note: "",
  };
}

type Props = {
  row: Vm0007EvidenceMapDraftRow | null;
  finalized: boolean;
  onClose: () => void;
  onEdit: (edit: Vm0007EvidenceMapEdit, note: string) => string | null;
  onApprove: (note: string) => string | null;
  onReopen: (note: string) => string | null;
};

export default function EvidenceMapReviewPanel({ row, finalized, onClose, onEdit, onApprove, onReopen }: Props) {
  const [form, setForm] = useState<FormState | null>(row ? initialForm(row) : null);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setForm(row ? initialForm(row) : null); setError(null); }, [row]);
  useEffect(() => {
    if (!row) return;
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); previouslyFocused?.focus(); };
  }, [row, onClose]);

  if (!row || !form) return null;
  const set = <K extends keyof FormState>(field: K, value: FormState[K]) => setForm((current) => current ? { ...current, [field]: value } : current);
  const currentAssessment = Boolean(row.assessment && row.assessment.rowVersion === (row.rowVersion ?? 1));
  const requireNote = () => {
    if (form.note.trim()) return true;
    setError("Add a review note so this decision is preserved in review history.");
    return false;
  };
  const save = () => {
    if (!form.applicability || !form.requirementSupport || !form.searchCoverage || !form.provenance || !form.versionIdentity || !form.contradiction) return setError("Complete every canonical assessment selection before saving.");
    if ((form.applicability === "APPLICABLE" || form.applicability === "NOT_APPLICABLE") && !form.applicabilityBasis.trim()) return setError("Applicability basis is required.");
    if (form.draftFinding && (!form.findingBasis.trim() || !form.reviewerAssessment.trim())) return setError("Finding basis and reviewer assessment are required for a classification.");
    if (!form.assessmentReason.trim()) return setError("Assessment reason is required.");
    if (!requireNote()) return;
    const assessment: Vm0007PersistedEvidenceMapAssessment = {
      evidenceMapRowId: row.rowId,
      rowVersion: row.rowVersion ?? 1,
      applicability: { decision: form.applicability, decisionBasis: form.applicabilityBasis.trim() || null },
      conformance: { requirementSupport: form.requirementSupport, searchCoverageAssessment: form.searchCoverage, provenanceAssessment: form.provenance, versionIdentityAssessment: form.versionIdentity, contradictionAssessment: form.contradiction },
      draftFinding: { draftFindingType: form.draftFinding || null, findingBasis: form.draftFinding ? form.findingBasis.trim() : null, reviewerAssessment: form.draftFinding ? form.reviewerAssessment.trim() : null },
      reviewState: "CURRENT",
    };
    setError(onEdit({ assessmentReason: form.assessmentReason.trim(), assessment }, form.note.trim()));
  };
  const act = (action: "approve" | "reopen") => {
    if (!requireNote()) return;
    setError(action === "approve" ? onApprove(form.note.trim()) : onReopen(form.note.trim()));
  };
  const select = (label: string, field: keyof FormState, options: readonly string[]) => (
    <label className="grid gap-1.5 text-sm text-slate-700"><span className="font-medium">{label}</span><select value={form[field]} onChange={(event) => set(field, event.target.value as never)} disabled={finalized} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 motion-reduce:transition-none"><option value="">Select…</option>{options.map((option) => <option key={option}>{option}</option>)}</select></label>
  );

  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30 backdrop-blur-[1px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className="evidence-map-review-panel h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl outline-none">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-8">
        <div><p className="font-mono text-xs font-semibold text-blue-700">{row.ruleReference}</p><h2 id={titleId} className="mt-1 text-lg font-semibold tracking-tight text-slate-950">Review decision</h2><p className="mt-1 text-sm text-slate-500">Current state: {row.reviewState ?? "pending review"}</p></div>
        <button type="button" onClick={onClose} aria-label="Close review panel" className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 motion-reduce:transition-none"><X size={20} /></button>
      </header>
      <div className="space-y-8 px-5 py-6 sm:px-8">
        <section aria-labelledby={`${titleId}-proposal`}><h3 id={`${titleId}-proposal`} className="text-xs font-semibold uppercase tracking-[.12em] text-slate-500">Machine proposal</h3><div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-4"><div><span className="block text-xs text-slate-500">Evidence</span>{row.proposedEvidenceStatus}</div><div><span className="block text-xs text-slate-500">Applicability</span>{row.proposedApplicability}</div><div><span className="block text-xs text-slate-500">Confidence</span>{row.confidence}</div><div><span className="block text-xs text-slate-500">Audit status</span>{row.rawAuditStatus.replaceAll("_", " ")}</div></div></section>
        <section aria-labelledby={`${titleId}-assessment`}><h3 id={`${titleId}-assessment`} className="text-xs font-semibold uppercase tracking-[.12em] text-slate-500">Reviewer assessment</h3><div className="mt-4 grid gap-4 sm:grid-cols-2">{select("Applicability", "applicability", ["APPLICABLE", "NOT_APPLICABLE", "NOT_EVALUATED"])}<label className="grid gap-1.5 text-sm text-slate-700"><span className="font-medium">Applicability basis</span><input value={form.applicabilityBasis} onChange={(event) => set("applicabilityBasis", event.target.value)} disabled={finalized} className="min-h-10 rounded-lg border border-slate-300 px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>{select("Requirement support", "requirementSupport", ["SUPPORTED", "NOT_SUPPORTED", "NOT_EVALUATED"])}{select("Search coverage", "searchCoverage", ["ADEQUATE", "INADEQUATE", "NOT_REQUIRED", "NOT_EVALUATED"])}{select("Provenance", "provenance", ["COMPLETE", "INCOMPLETE", "NOT_EVALUATED"])}{select("Version identity", "versionIdentity", ["MATCHED", "NOT_REQUIRED", "MISMATCHED", "UNRESOLVED"])}{select("Contradiction", "contradiction", ["NONE", "BLOCKING", "NOT_EVALUATED"])}{select("Draft finding", "draftFinding", ["NIR_CANDIDATE", "NCR_CANDIDATE", "OFI_CANDIDATE"])}<label className="grid gap-1.5 text-sm text-slate-700 sm:col-span-2"><span className="font-medium">Assessment reason</span><textarea value={form.assessmentReason} onChange={(event) => set("assessmentReason", event.target.value)} disabled={finalized} rows={3} className="rounded-lg border border-slate-300 p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>{form.draftFinding ? <><label className="grid gap-1.5 text-sm text-slate-700"><span className="font-medium">Finding basis</span><textarea value={form.findingBasis} onChange={(event) => set("findingBasis", event.target.value)} disabled={finalized} rows={3} className="rounded-lg border border-slate-300 p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label><label className="grid gap-1.5 text-sm text-slate-700"><span className="font-medium">Reviewer assessment</span><textarea value={form.reviewerAssessment} onChange={(event) => set("reviewerAssessment", event.target.value)} disabled={finalized} rows={3} className="rounded-lg border border-slate-300 p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label></> : null}</div></section>
        <section><label className="grid gap-1.5 text-sm text-slate-700"><span className="font-medium">Review note <span className="text-rose-600">*</span></span><textarea value={form.note} onChange={(event) => set("note", event.target.value)} rows={2} placeholder="Why are you making this decision?" className="rounded-lg border border-slate-300 p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label><p className="mt-2 text-xs text-slate-500">This note is appended to the existing review history.</p></section>
        {error ? <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5"><button type="button" onClick={save} disabled={finalized} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:bg-slate-200 disabled:text-slate-500 motion-reduce:transition-none">Save reviewer decision</button><button type="button" onClick={() => act("approve")} disabled={finalized || row.reviewState === "approved" || !currentAssessment} title={!currentAssessment ? "Save a current canonical assessment first" : undefined} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:text-slate-400 motion-reduce:transition-none">Approve row</button><button type="button" onClick={() => act("reopen")} disabled={row.reviewState === "pending review" || row.reviewState === "reopened"} className="rounded-lg px-3 py-2.5 text-sm font-medium text-amber-800 transition hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:text-slate-400 motion-reduce:transition-none">Reopen</button></div>
        {finalized ? <p className="text-sm text-slate-600">This map is finalized. Reopen the row before changing its decision.</p> : null}
      </div>
    </div>
  </div>;
}
