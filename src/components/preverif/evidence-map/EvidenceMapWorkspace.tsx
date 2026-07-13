"use client";

import { ChevronDown, FileText, FilterX, Search, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import type { Vm0007EvidenceMapDraftPackage, Vm0007EvidenceMapDraftRow } from "@/lib/preverif/vm0007EvidenceMapDraft";
import { EMPTY_EVIDENCE_MAP_FILTERS, filterEvidenceMapRows, hasEvidenceMapFilters, summarizeEvidenceMap, type EvidenceMapFilters } from "./evidenceMapViewModel";

function label(value: string): string {
  const known: Record<string, string> = {
    supported_by_pdd: "Supported by PDD",
    partially_supported: "Partially supported",
    missing_evidence: "Missing evidence",
    not_applicable: "Not applicable",
    manual_review_needed: "Manual review needed",
    NIR_CANDIDATE: "NIR candidate",
    NCR_CANDIDATE: "NCR candidate",
    OFI_CANDIDATE: "OFI candidate",
  };
  return known[value] ?? value.toLocaleLowerCase().replaceAll("_", " ").replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase());
}
function dateTime(value: string | null | undefined): string { if (!value) return "Not yet"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date); }

const badgeTone: Record<string, string> = {
  FOUND: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  UNCLEAR: "bg-amber-50 text-amber-800 ring-amber-600/20",
  MISSING: "bg-rose-50 text-rose-800 ring-rose-600/20",
  approved: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  edited: "bg-blue-50 text-blue-800 ring-blue-600/20",
  reopened: "bg-amber-50 text-amber-800 ring-amber-600/20",
  "pending review": "bg-slate-100 text-slate-700 ring-slate-500/20",
};

function Badge({ value }: { value: string }) { return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${badgeTone[value] ?? "bg-slate-100 text-slate-700 ring-slate-500/20"}`}>{label(value)}</span>; }

function EvidenceProvenance({ row, record }: { row: Vm0007EvidenceMapDraftRow; record: NonNullable<Vm0007EvidenceMapDraftRow["acceptedEvidence"]>[number] }) {
  const section = record.section || record.provenance.sectionHeading || record.provenance.sectionPath.at(-1);
  return <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500"><div><dt className="sr-only">Page</dt><dd>Page {record.page ?? record.provenance.page ?? "—"}</dd></div><div><dt className="sr-only">Section</dt><dd>{section || "No section"}</dd></div>{record.evidenceType ? <div><dt className="sr-only">Evidence type</dt><dd>{label(record.evidenceType)}</dd></div> : null}<div title={record.provenance.spanId}><dt className="sr-only">Source</dt><dd className="max-w-[20rem] truncate">{row.sourceDocument.documentName || record.provenance.docId} · {record.provenance.spanId}</dd></div></dl>;
}

function AcceptedEvidenceList({ row }: { row: Vm0007EvidenceMapDraftRow }) {
  const records = row.acceptedEvidence ?? (row.proposedAcceptedEvidence ? [{ quote: row.proposedAcceptedEvidence.quote, page: row.proposedAcceptedEvidence.provenance.page, section: row.proposedAcceptedEvidence.provenance.sectionHeading, spanId: row.proposedAcceptedEvidence.provenance.spanId, provenance: row.proposedAcceptedEvidence.provenance }] : []);
  return <section aria-labelledby={`${row.rowId}-accepted`}><div className="flex items-center justify-between"><h4 id={`${row.rowId}-accepted`} className="text-sm font-semibold text-slate-950">Accepted evidence</h4><span className="font-mono text-xs text-slate-500">{records.length}</span></div>{records.length ? <div className="mt-3 divide-y divide-slate-200 rounded-xl bg-emerald-50/50 px-4">{records.map((record, index) => <article key={`${record.spanId}-${index}`} data-evidence-record="accepted" className="py-4"><blockquote className="whitespace-pre-wrap text-sm leading-6 text-slate-800">“{record.quote}”</blockquote><EvidenceProvenance row={row} record={record} /></article>)}</div> : <p className="mt-3 text-sm text-slate-500">No accepted evidence is recorded.</p>}</section>;
}

function RejectedEvidenceList({ row }: { row: Vm0007EvidenceMapDraftRow }) {
  const records = row.rejectedEvidence ?? (row.proposedRejectedEvidence ? [{ quote: row.proposedRejectedEvidence.quote, rejectionReason: row.proposedRejectedEvidence.reason, page: row.proposedRejectedEvidence.provenance.page, section: row.proposedRejectedEvidence.provenance.sectionHeading, spanId: row.proposedRejectedEvidence.provenance.spanId, provenance: row.proposedRejectedEvidence.provenance }] : []);
  return <section aria-labelledby={`${row.rowId}-rejected`}><div className="flex items-center justify-between"><h4 id={`${row.rowId}-rejected`} className="text-sm font-semibold text-slate-950">Rejected evidence</h4><span className="font-mono text-xs text-slate-500">{records.length}</span></div>{records.length ? <div className="mt-3 divide-y divide-slate-200 rounded-xl bg-amber-50/60 px-4">{records.map((record, index) => <article key={`${record.spanId}-${index}`} data-evidence-record="rejected" className="py-4"><blockquote className="whitespace-pre-wrap text-sm leading-6 text-slate-800">“{record.quote}”</blockquote><p className="mt-3 text-sm font-medium text-amber-900"><span className="font-semibold">Rejected because:</span> {record.rejectionReason}</p><EvidenceProvenance row={row} record={record} /></article>)}</div> : <p className="mt-3 text-sm text-slate-500">No rejected evidence is recorded.</p>}</section>;
}

function ComponentCoverage({ row }: { row: Vm0007EvidenceMapDraftRow }) {
  if (row.supportedComponents === undefined && row.missingComponents === undefined) return null;
  return <section aria-labelledby={`${row.rowId}-coverage`} data-component-coverage className="rounded-xl border border-slate-200 p-4"><h4 id={`${row.rowId}-coverage`} className="text-sm font-semibold text-slate-950">Component coverage</h4><div className="mt-3 grid gap-4 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Supported</p><ul className="mt-2 space-y-1.5 text-sm text-slate-700">{row.supportedComponents?.length ? row.supportedComponents.map((item) => <li key={item}>✓ {item}</li>) : <li className="text-slate-500">None recorded</li>}</ul></div><div><p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Missing</p><ul className="mt-2 space-y-1.5 text-sm text-slate-700">{row.missingComponents?.length ? row.missingComponents.map((item) => <li key={item}>○ {item}</li>) : <li className="text-slate-500">None recorded</li>}</ul></div></div></section>;
}

function EvidenceMapRuleDetails({ row, finalized, onReview }: { row: Vm0007EvidenceMapDraftRow; finalized: boolean; onReview: () => void }) {
  const assessment = row.assessment;
  return <div id={`${row.rowId}-details`} className="evidence-map-details grid overflow-hidden border-t border-slate-200 bg-slate-50/70 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,.6fr)] lg:gap-10">
    <div className="space-y-8">
      <section><h3 className="text-xs font-semibold uppercase tracking-[.12em] text-slate-500">Requirement</h3><p className="mt-3 text-sm leading-6 text-slate-800">{row.requirementText}</p><p className="mt-2 font-mono text-xs text-slate-500">{row.stableRuleId} · {row.methodologyId} {row.methodologyVersion}</p></section>
      <section><h3 className="text-xs font-semibold uppercase tracking-[.12em] text-slate-500">Assessment</h3><dl className="mt-3 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2"><div><dt className="text-xs text-slate-500">Audit status</dt><dd className="mt-1 font-medium text-slate-800">{label(row.rawAuditStatus)}</dd></div><div><dt className="text-xs text-slate-500">Evidence state</dt><dd className="mt-1 font-medium text-slate-800">{row.proposedEvidenceStatus}</dd></div><div><dt className="text-xs text-slate-500">Applicability</dt><dd className="mt-1 font-medium text-slate-800">{row.proposedApplicability}</dd></div><div><dt className="text-xs text-slate-500">Confidence</dt><dd className="mt-1 font-medium text-slate-800">{label(row.confidence)}</dd></div><div className="sm:col-span-2"><dt className="text-xs text-slate-500">Assessment reason</dt><dd className="mt-1 leading-6 text-slate-800">{row.assessmentReason}</dd></div>{row.reasonSelected ? <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Reason selected</dt><dd className="mt-1 leading-6 text-slate-800">{row.reasonSelected}</dd></div> : null}{assessment ? <><div><dt className="text-xs text-slate-500">Reviewer support decision</dt><dd className="mt-1 font-medium text-slate-800">{assessment.conformance.requirementSupport}</dd></div><div><dt className="text-xs text-slate-500">Reviewer outcome</dt><dd className="mt-1 font-medium text-slate-800">{assessment.draftFinding.draftFindingType ?? "No finding"}</dd></div></> : null}</dl></section>
      <AcceptedEvidenceList row={row} /><RejectedEvidenceList row={row} /><ComponentCoverage row={row} />
    </div>
    <aside className="mt-8 space-y-6 border-t border-slate-200 pt-6 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0"><section><h3 className="text-xs font-semibold uppercase tracking-[.12em] text-slate-500">Gap and action</h3><dl className="mt-3 space-y-4 text-sm"><div><dt className="font-medium text-slate-700">Current gap</dt><dd className="mt-1 leading-6 text-slate-600">{row.gap || "No gap recorded."}</dd></div><div><dt className="font-medium text-slate-700">Client action</dt><dd className="mt-1 leading-6 text-slate-600">{row.clientAction || "No client action recorded."}</dd></div></dl></section><section><h3 className="text-xs font-semibold uppercase tracking-[.12em] text-slate-500">Review history</h3><p className="mt-3 text-sm text-slate-600">{row.reviewHistory?.length ?? 0} event(s){row.reviewHistory?.length ? ` · last by ${row.reviewHistory.at(-1)?.reviewerIdentity}` : ""}</p>{row.reviewHistory?.at(-1)?.reasonOrNote ? <p className="mt-2 text-sm leading-6 text-slate-700">“{row.reviewHistory.at(-1)?.reasonOrNote}”</p> : null}</section><button type="button" onClick={onReview} className="w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 motion-reduce:transition-none">{finalized ? "View review decision" : "Review decision"}</button></aside>
  </div>;
}

function EvidenceMapRuleRow({ row, expanded, finalized, onToggle, onReview }: { row: Vm0007EvidenceMapDraftRow; expanded: boolean; finalized: boolean; onToggle: () => void; onReview: () => void }) {
  const preview = row.acceptedEvidence?.[0]?.quote ?? row.proposedAcceptedEvidence?.quote ?? row.gap ?? row.assessmentReason;
  const page = row.acceptedEvidence?.[0]?.page ?? row.provenance?.page ?? row.page;
  return <article data-evidence-map-row={row.rowId} className="border-b border-slate-200 last:border-b-0">
    <button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={`${row.rowId}-details`} className="grid w-full gap-3 px-4 py-4 text-left transition hover:bg-slate-50 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-blue-600 sm:px-6 lg:grid-cols-[8rem_minmax(12rem,.8fr)_minmax(16rem,1.4fr)_auto] lg:items-center motion-reduce:transition-none">
      <div><span className="font-mono text-xs font-semibold text-blue-700">{row.ruleReference}</span><span className="mt-1 block text-xs text-slate-500 lg:hidden">{row.methodologyId} {row.methodologyVersion}</span></div>
      <div><h2 className="text-sm font-semibold leading-5 text-slate-950">{row.ruleReference.trim().toLocaleLowerCase() === row.ruleTitle.trim().toLocaleLowerCase() ? row.ruleReference : row.ruleTitle}</h2><div className="mt-2 flex flex-wrap gap-2"><Badge value={row.proposedEvidenceStatus} /><Badge value={row.reviewState ?? "pending review"} /><span className="text-xs leading-6 text-slate-500">{label(row.proposedApplicability)} · {label(row.confidence)}</span></div></div>
      <div><p className="line-clamp-2 text-sm leading-5 text-slate-600">{preview || "No evidence or gap preview recorded."}</p>{page !== null && page !== undefined ? <p className="mt-1 text-xs text-slate-500">Page {page}</p> : null}</div>
      <ChevronDown aria-hidden="true" className={`justify-self-end text-slate-400 transition-transform ${expanded ? "rotate-180" : ""} motion-reduce:transition-none`} size={18} />
    </button>
    {expanded ? <EvidenceMapRuleDetails row={row} finalized={finalized} onReview={onReview} /> : null}
  </article>;
}

function EvidenceMapSummary({ rows, filters, onChange }: { rows: readonly Vm0007EvidenceMapDraftRow[]; filters: EvidenceMapFilters; onChange: (filters: EvidenceMapFilters) => void }) {
  const summary = summarizeEvidenceMap(rows);
  const items = [
    ["Total rules", summary.total, () => onChange(EMPTY_EVIDENCE_MAP_FILTERS)],
    ["Found", summary.found, () => onChange({ ...filters, evidenceState: filters.evidenceState === "FOUND" ? "ALL" : "FOUND" })],
    ["Unclear", summary.unclear, () => onChange({ ...filters, evidenceState: filters.evidenceState === "UNCLEAR" ? "ALL" : "UNCLEAR" })],
    ["Missing", summary.missing, () => onChange({ ...filters, evidenceState: filters.evidenceState === "MISSING" ? "ALL" : "MISSING" })],
    ["Not applicable", summary.notApplicable, () => onChange({ ...filters, applicability: filters.applicability === "NOT_APPLICABLE" ? "ALL" : "NOT_APPLICABLE" })],
    ["Action required", summary.actionRequired, () => onChange({ ...filters, reviewState: filters.reviewState === "ACTION_REQUIRED" ? "ALL" : "ACTION_REQUIRED" })],
  ] as const;
  return <nav aria-label="Evidence Map summary filters" className="grid grid-cols-2 divide-x divide-y divide-slate-200 overflow-hidden border-y border-slate-200 bg-white sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">{items.map(([name, count, click]) => <button type="button" key={name} onClick={click} className="px-4 py-4 text-left transition hover:bg-slate-50 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-blue-600 motion-reduce:transition-none"><span className="font-mono text-xl font-semibold tabular-nums text-slate-950">{count}</span><span className="mt-1 block text-xs font-medium text-slate-500">{name}</span></button>)}</nav>;
}

function EvidenceMapFiltersBar({ filters, count, total, onChange }: { filters: EvidenceMapFilters; count: number; total: number; onChange: (filters: EvidenceMapFilters) => void }) {
  const selectClass = "min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 motion-reduce:transition-none";
  return <div className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur sm:px-6"><div className="flex flex-col gap-3 xl:flex-row xl:items-center"><label className="relative min-w-64 flex-1"><span className="sr-only">Search rules</span><Search aria-hidden="true" size={17} className="pointer-events-none absolute left-3 top-3 text-slate-400" /><input type="search" value={filters.query} onChange={(event) => onChange({ ...filters, query: event.target.value })} placeholder="Search rule, requirement, gap, or action" className="min-h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 motion-reduce:transition-none" /></label><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{([["Evidence state", "evidenceState", ["FOUND", "UNCLEAR", "MISSING"]], ["Applicability", "applicability", ["APPLICABLE", "NOT_APPLICABLE", "UNKNOWN"]], ["Reviewer outcome", "reviewerOutcome", ["NONE", "NIR_CANDIDATE", "NCR_CANDIDATE", "OFI_CANDIDATE"]], ["Review state", "reviewState", ["pending review", "approved", "edited", "reopened"]]] as const).map(([name, field, options]) => <label key={field}><span className="sr-only">{name}</span><select aria-label={name} value={filters[field]} onChange={(event) => onChange({ ...filters, [field]: event.target.value })} className={selectClass}><option value="ALL">{name}: All</option>{options.map((option) => <option key={option} value={option}>{label(option)}</option>)}</select></label>)}</div></div><div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span aria-live="polite"><strong className="font-semibold text-slate-700">{count}</strong> of {total} rules</span><button type="button" onClick={() => onChange(EMPTY_EVIDENCE_MAP_FILTERS)} disabled={!hasEvidenceMapFilters(filters)} className="inline-flex items-center gap-1.5 font-medium text-blue-700 transition hover:text-blue-900 disabled:text-slate-400 motion-reduce:transition-none"><FilterX size={14} />Clear all</button></div></div>;
}

type Props = { pkg: Vm0007EvidenceMapDraftPackage; message: string | null; onFinalize: () => void; onReview: (row: Vm0007EvidenceMapDraftRow) => void };
export default function EvidenceMapWorkspace({ pkg, message, onFinalize, onReview }: Props) {
  const [filters, setFilters] = useState<EvidenceMapFilters>(EMPTY_EVIDENCE_MAP_FILTERS);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const rows = useMemo(() => filterEvidenceMapRows(pkg.rows, filters), [pkg.rows, filters]);
  const finalized = pkg.finalizationState === "finalized";
  const allApproved = pkg.rows.every((row) => row.reviewState === "approved");
  const toggle = (rowId: string) => setExpanded((current) => { const next = new Set(current); if (next.has(rowId)) next.delete(rowId); else next.add(rowId); return next; });
  return <main className="min-h-screen bg-slate-50 text-slate-950"><header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-6"><div className="mx-auto flex max-w-[1600px] flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex items-center gap-2"><FileText size={18} className="text-blue-600" /><p className="truncate text-sm font-medium text-slate-600">{pkg.sourceDocument.documentName || pkg.sourceDocument.documentId}</p></div><h1 className="mt-2 text-2xl font-semibold tracking-tight">Evidence Map</h1><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500"><span>{pkg.methodologyId} {pkg.rulebookVersion}</span><span aria-hidden="true">·</span><span>Audit {pkg.auditId}</span><span aria-hidden="true">·</span><span>Generated {dateTime(pkg.generatedAt)}</span>{pkg.finalizedAt ? <><span aria-hidden="true">·</span><span>Reviewed {dateTime(pkg.finalizedAt)}</span></> : null}</div></div><div className="flex flex-wrap items-center gap-3"><div className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${finalized ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}><span className={`h-2 w-2 rounded-full ${finalized ? "bg-emerald-500" : "bg-amber-500"}`} />{finalized ? "Finalized" : "Draft · machine proposed"}</div><button type="button" onClick={onFinalize} disabled={!allApproved || finalized} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:bg-slate-200 disabled:text-slate-500 motion-reduce:transition-none"><ShieldCheck size={17} />Finalize Evidence Map</button>{finalized ? <a href={`/quick-check/pre-validation-readiness?auditId=${encodeURIComponent(pkg.auditId)}`} className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50">Open readiness report</a> : null}</div></div></header>
    <div className="mx-auto max-w-[1600px]"><div className={`border-b px-4 py-3 text-sm sm:px-6 ${finalized ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>{finalized ? "Finalized Evidence Map. Reopening or editing a row requires re-finalization." : "Machine-proposed Evidence Map. Review every row before finalization; missing and weak evidence remains visible."}</div><EvidenceMapSummary rows={pkg.rows} filters={filters} onChange={setFilters} /><EvidenceMapFiltersBar filters={filters} count={rows.length} total={pkg.rows.length} onChange={setFilters} />{message ? <p role="status" className="border-b border-blue-100 bg-blue-50 px-6 py-3 text-sm text-blue-900">{message}</p> : null}<section aria-label="Evidence Map rules" className="bg-white">{rows.length ? rows.map((row) => <EvidenceMapRuleRow key={row.rowId} row={row} expanded={expanded.has(row.rowId)} finalized={finalized} onToggle={() => toggle(row.rowId)} onReview={() => onReview(row)} />) : <div className="px-6 py-20 text-center"><p className="font-medium text-slate-800">No rules match these filters.</p><button type="button" onClick={() => setFilters(EMPTY_EVIDENCE_MAP_FILTERS)} className="mt-3 text-sm font-semibold text-blue-700">Clear all filters</button></div>}</section></div>
  </main>;
}
