"use client";

import {
  ChevronDown,
  FileText,
  FilterX,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { useId, useMemo, useState } from "react";
import type {
  Vm0007EvidenceMapDraftPackage,
  Vm0007EvidenceMapDraftRow,
} from "@/lib/preverif/vm0007EvidenceMapDraft";
import type { ReviewedEvidenceMapSnapshot } from "@/lib/preverif/reviewedEvidenceMapTypes";
import {
  buildMachineEvidenceMapPresentation,
  buildReviewedEvidenceMapPresentation,
  EMPTY_PRESENTATION_FILTERS,
  filterEvidenceMapPresentation,
  summarizeEvidenceMapPresentation,
  hasPresentationFilters,
  summarizeEvidenceMapWorkflow,
  findEvidenceMapNavigationTarget,
  type EvidenceMapMode,
  type EvidenceMapPresentationFilters,
  type EvidenceMapPresentationRow,
} from "./evidenceMapPresentationModel";
import { vm0007EvidenceIdentity } from "@/lib/preverif/vm0007EvidenceMapReview";

function label(value: string): string {
  return value
    .toLocaleLowerCase()
    .replaceAll("_", " ")
    .replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase());
}

const badgeTone: Record<string, string> = {
  FOUND: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  UNCLEAR: "bg-amber-50 text-amber-800 ring-amber-600/20",
  MISSING: "bg-rose-50 text-rose-800 ring-rose-600/20",
  "N/A": "bg-slate-100 text-slate-700 ring-slate-500/20",
  ACTION_REQUIRED: "bg-rose-50 text-rose-800 ring-rose-600/20",
  CONFORMS: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
};

function Badge({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${badgeTone[value] ?? "bg-slate-100 text-slate-700 ring-slate-500/20"}`}
    >
      {label(value)}
    </span>
  );
}

export function createEvidencePreview(quote: string, maxLength = 360): string {
  if (quote.length <= maxLength) return quote;
  const boundary = quote.slice(0, maxLength + 1).lastIndexOf(" ");
  return `${quote.slice(0, boundary > 0 ? boundary : maxLength).trimEnd()}…`;
}

function hasDistinctRuleTitle(row: EvidenceMapPresentationRow): boolean {
  return Boolean(row.ruleTitle.trim() && row.ruleTitle.trim().toLocaleLowerCase() !== row.ruleReference.trim().toLocaleLowerCase());
}

function EvidenceList({
  row,
  rejected = false,
  onEvidenceDecision,
}: {
  row: EvidenceMapPresentationRow;
  rejected?: boolean;
  onEvidenceDecision?: (rowId: string, evidenceIdentity: string, action: "reject" | "reinstate", note: string) => string | null;
}) {
  const records = rejected ? row.rejectedEvidence : row.acceptedEvidence;
  const heading = rejected
    ? "Rejected evidence"
    : row.reviewState === "reviewed snapshot"
      ? "Reviewed accepted evidence"
      : "Machine proposed evidence";
  return (
    <section>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-950">{heading}</h4>
        <span className="font-mono text-xs text-slate-500">
          {records.length}
        </span>
      </div>
      {records.length ? (
        <div className="mt-3 space-y-3">
            {records.map((record, index) => (
              <EvidenceRecord key={`${record.spanId}-${index}`} record={record} rejected={rejected} rowId={row.rowId} onEvidenceDecision={onEvidenceDecision} />
            ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          No {rejected ? "rejected" : "accepted"} evidence is recorded.
        </p>
      )}
    </section>
  );
}

function EvidenceRecord({
  record,
  rejected,
  rowId,
  onEvidenceDecision,
}: {
  record: EvidenceMapPresentationRow["acceptedEvidence"][number];
  rejected: boolean;
  rowId: string;
  onEvidenceDecision?: (rowId: string, evidenceIdentity: string, action: "reject" | "reinstate", note: string) => string | null;
}) {
  const [showFull, setShowFull] = useState(false);
  const [action, setAction] = useState<"reject" | "reinstate" | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const noteId = `evidence-note-${useId()}`;
  const quoteId = `evidence-quote-${useId()}`;
  const isLong = record.quote.length > 360;
  const visibleQuote = showFull ? record.quote : createEvidencePreview(record.quote);
  const identity = vm0007EvidenceIdentity(record);
  const openAction = (next: "reject" | "reinstate") => { setAction(next); setNote(""); setError(null); };
  const cancelAction = () => { setAction(null); setNote(""); setError(null); };
  const submitAction = () => {
    if (!note.trim()) { setError(action === "reject" ? "Add a rejection reason." : "Add a reviewer note."); return; }
    if (!onEvidenceDecision) return;
    setPending(true);
    const result = onEvidenceDecision(rowId, identity, action!, note.trim());
    setPending(false);
    if (result) setError(result); else cancelAction();
  };
  return (
    <article data-evidence-record={rejected ? "rejected" : "accepted"} className={`rounded-xl border p-4 shadow-sm ${rejected ? "border-amber-200 bg-amber-50/30" : "border-slate-200 bg-white"}`}>
      <blockquote id={quoteId} className="whitespace-pre-wrap text-[15px] leading-7 text-slate-800">
        “{visibleQuote}”
      </blockquote>
      {isLong ? (
        <button type="button" aria-expanded={showFull} aria-controls={quoteId} onClick={() => setShowFull((current) => !current)} className="mt-2 min-h-10 text-sm font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
          {showFull ? "Show less" : "Show full evidence"}
        </button>
      ) : null}
      {rejected && record.rejectionReason ? <p className="mt-3 text-sm text-amber-900"><strong>Rejected because:</strong> {record.rejectionReason}</p> : null}
      <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
        <div><dt className="sr-only">Page</dt><dd>Page {record.page ?? record.provenance.page ?? "—"}</dd></div>
        <div><dt className="sr-only">Section</dt><dd>{record.section || record.provenance.sectionHeading || "No section"}</dd></div>
        <div><dt className="sr-only">Document</dt><dd>{record.provenance.docId}</dd></div>
        <div title={record.provenance.spanId}><dt className="sr-only">Source span</dt><dd>{record.provenance.spanId}</dd></div>
      </dl>
      {onEvidenceDecision ? (
        <div className="mt-4 border-t border-slate-200 pt-3">
          {!action ? <button type="button" onClick={() => openAction(rejected ? "reinstate" : "reject")} className="min-h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{rejected ? "Reinstate" : "Reject"}</button> : (
            <div className="grid gap-2" onKeyDown={(event) => { if (event.key === "Escape") cancelAction(); }}>
              <label htmlFor={noteId} className="text-sm font-medium text-slate-800">{rejected ? "Reviewer note" : "Rejection reason"} <span className="text-rose-600">*</span></label>
              <textarea id={noteId} autoFocus value={note} onChange={(event) => setNote(event.target.value)} disabled={pending} rows={2} aria-describedby={error ? `${noteId}-error` : undefined} className="rounded-md border border-slate-300 p-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              {error ? <p id={`${noteId}-error`} role="alert" className="text-sm text-rose-700">{error}</p> : null}
              <div className="flex flex-wrap gap-2"><button type="button" onClick={submitAction} disabled={pending} aria-busy={pending} className="min-h-9 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Saving…" : "Confirm"}</button><button type="button" onClick={cancelAction} disabled={pending} className="min-h-9 rounded-md px-3 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancel</button></div>
            </div>
          )}
        </div>
      ) : null}
    </article>
  );
}

function RuleDetails({
  row,
  readOnly,
  finalized,
  onReview,
  onEvidenceDecision,
}: {
  row: EvidenceMapPresentationRow;
  readOnly: boolean;
  finalized: boolean;
  onReview: () => void;
  onEvidenceDecision: (rowId: string, evidenceIdentity: string, action: "reject" | "reinstate", note: string) => string | null;
}) {
  return (
    <div
      id={`${row.rowId}-details`}
      className="grid overflow-hidden border-t border-slate-200 bg-white px-4 py-6 sm:px-6 lg:grid-cols-[minmax(16rem,280px)_minmax(0,1fr)_minmax(18rem,300px)] lg:gap-8"
    >
      <div className="grid gap-6 lg:col-span-2 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-5">
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-[.12em] text-slate-500">
            Requirement
          </h3>
          <p className="mt-3 text-sm leading-6 text-slate-800">
            {row.requirementText}
          </p>
        </section>
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-[.12em] text-slate-500">
            {readOnly ? "Reviewed assessment" : "Machine assessment"}
          </h3>
          <dl className="mt-3 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">Evidence state</dt>
              <dd className="mt-1 font-medium">{row.evidenceState}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Reviewer outcome</dt>
              <dd className="mt-1 font-medium">{label(row.reviewerOutcome)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Applicability</dt>
              <dd className="mt-1 font-medium">{label(row.applicability)}</dd>
            </div>
            {row.rawAuditStatus ? (
              <div>
                <dt className="text-xs text-slate-500">Raw audit status</dt>
                <dd className="mt-1 font-medium">
                  {label(row.rawAuditStatus)}
                </dd>
              </div>
            ) : null}
            {row.confidence ? (
              <div>
                <dt className="text-xs text-slate-500">Confidence</dt>
                <dd className="mt-1 font-medium">{label(row.confidence)}</dd>
              </div>
            ) : null}
            {row.assessmentReason ? (
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-500">
                  Machine assessment reason
                </dt>
                <dd className="mt-1 leading-6">{row.assessmentReason}</dd>
              </div>
            ) : null}
            {row.reasonSelected ? (
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-500">Reason selected</dt>
                <dd className="mt-1 leading-6">{row.reasonSelected}</dd>
              </div>
            ) : null}
            {readOnly ? (
              <>
                <div>
                  <dt className="text-xs text-slate-500">
                    Draft finding candidate
                  </dt>
                  <dd className="mt-1 font-medium">
                    {row.draftFindingCandidate
                      ? label(row.draftFindingCandidate)
                      : "None"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">
                    Contradiction state
                  </dt>
                  <dd className="mt-1 font-medium">
                    {row.contradictionState
                      ? label(row.contradictionState)
                      : "Not recorded"}
                  </dd>
                </div>
              </>
            ) : null}
          </dl>
        </section>
        </div>
        <div className="space-y-6">
          <EvidenceList row={row} onEvidenceDecision={readOnly ? undefined : onEvidenceDecision} />
          <EvidenceList row={row} rejected onEvidenceDecision={readOnly ? undefined : onEvidenceDecision} />
        {row.supportedComponents || row.missingComponents ? (
          <section
            data-component-coverage
            className="rounded-xl border border-slate-200 p-4"
          >
            <h4 className="text-sm font-semibold">Component coverage</h4>
            <p className="mt-2 text-sm">
              {row.supportedComponents?.join(", ") || "None recorded"}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {row.missingComponents?.join(", ") || "None missing"}
            </p>
          </section>
        ) : null}
        </div>
      </div>
      <aside className="border-t border-slate-200 pt-6 lg:col-start-3 lg:row-start-1 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
        <h3 className="text-xs font-semibold uppercase tracking-[.12em] text-slate-500">
          Gap and action
        </h3>
        <div className="mt-3 space-y-4 text-sm leading-6 text-slate-700">
          <div><h4 className="font-medium text-slate-950">Gap</h4><p>{row.gap || "No gap recorded."}</p></div>
          <div><h4 className="font-medium text-slate-950">Client action</h4><p>{row.clientAction || "No client action recorded."}</p></div>
        </div>
        {!readOnly ? (
          <section className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-[.12em] text-slate-500">
              Latest review activity
            </h3>
            <p className="mt-3 text-sm text-slate-600">
              {row.reviewHistory?.length ?? 0} event(s)
              {row.reviewHistory?.length
                ? ` · last by ${row.reviewHistory.at(-1)?.reviewerIdentity}`
                : ""}
            </p>
            {row.reviewHistory?.at(-1)?.reasonOrNote ? (
              <p className="mt-2 text-sm">
                {row.reviewHistory.at(-1)?.reasonOrNote}
              </p>
            ) : null}
          </section>
        ) : null}
        {readOnly ? (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <strong className="block text-slate-800">
              Reviewed truth snapshot
            </strong>
            This historical snapshot is read-only. Save, approve, reopen, and
            finalize controls are unavailable.
          </div>
        ) : (
          <button
            type="button"
            onClick={onReview}
            className="mt-6 w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
          >
            {finalized ? "View review decision" : "Review decision"}
          </button>
        )}
      </aside>
    </div>
  );
}

function Summary({ rows }: { rows: readonly EvidenceMapPresentationRow[] }) {
  const summary = summarizeEvidenceMapWorkflow(rows);
  const legacy = summarizeEvidenceMapPresentation(rows);
  const items = [
    ["Total rules", summary.total],
    ["Complete", summary.complete],
    ["Unresolved", summary.unresolved],
    ["Blocked / stale", summary.blocked],
    ["Found", legacy.found],
    ["Unclear", legacy.unclear],
    ["Missing", legacy.missing],
    ["Not applicable", legacy.notApplicable],
    ["Action required", legacy.actionRequired],
  ] as const;
  return (
    <nav
      aria-label="Evidence Map summary"
      className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm shadow-sm"
    >
      {items.map(([name, count]) => (
        <div key={name} className="flex items-baseline gap-1.5 border-l border-slate-200 pl-5 first:border-l-0 first:pl-0">
          <span className={`font-mono font-semibold tabular-nums ${name === "Action required" ? "text-rose-700" : "text-slate-950"}`}>
            {count}
          </span>
          <span className="text-xs font-medium text-slate-500">
            {name}
          </span>
        </div>
      ))}
    </nav>
  );
}

type Props = {
  pkg: Vm0007EvidenceMapDraftPackage | null;
  reviewedSnapshot?: ReviewedEvidenceMapSnapshot | null;
  mode: EvidenceMapMode;
  onModeChange: (mode: EvidenceMapMode) => void;
  message: string | null;
  onFinalize: () => void;
  onReview: (row: Vm0007EvidenceMapDraftRow) => void;
  onEvidenceDecision: (rowId: string, evidenceIdentity: string, action: "reject" | "reinstate", note: string) => string | null;
};
export default function EvidenceMapWorkspace({
  pkg,
  reviewedSnapshot,
  mode,
  onModeChange,
  message,
  onFinalize,
  onReview,
  onEvidenceDecision,
}: Props) {
  const [filters, setFilters] = useState<EvidenceMapPresentationFilters>(
    EMPTY_PRESENTATION_FILTERS,
  );
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const presentation = useMemo(
    () =>
      mode === "reviewed" && reviewedSnapshot
        ? buildReviewedEvidenceMapPresentation(reviewedSnapshot)
        : pkg
          ? buildMachineEvidenceMapPresentation(pkg)
          : { mode: "reviewed" as const, rows: [], readOnly: true },
    [mode, pkg, reviewedSnapshot],
  );
  const rows = useMemo(
    () => filterEvidenceMapPresentation(presentation.rows, filters),
    [presentation.rows, filters],
  );
  const finalized = pkg?.finalizationState === "finalized";
  const allApproved = Boolean(
    pkg?.rows.every((row) => row.reviewState === "approved"),
  );
  const toggle = (rowId: string) =>
    setExpanded((current) => {
      setSelectedRowId(rowId);
      const next = new Set(current);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  const setMode = (next: EvidenceMapMode) => {
    setFilters(EMPTY_PRESENTATION_FILTERS);
    setExpanded(new Set());
    onModeChange(next);
  };
  const selectedIndex = rows.findIndex((row) => row.rowId === selectedRowId);
  const effectiveIndex = selectedIndex >= 0 ? selectedIndex : (rows.length ? 0 : -1);
  const navigate = (target: "previous" | "next" | "unresolved" | "blocker") => {
    const navigationRows = target === "unresolved" || target === "blocker" ? presentation.rows : rows;
    const current = selectedRowId ?? navigationRows[0]?.rowId ?? null;
    const destination = findEvidenceMapNavigationTarget(navigationRows, current, target);
    if (!destination) return;
    if (!rows.some((row) => row.rowId === destination.rowId)) {
      setFilters(EMPTY_PRESENTATION_FILTERS);
    }
    setSelectedRowId(destination.rowId);
    setExpanded((currentExpanded) => new Set(currentExpanded).add(destination.rowId));
    const machineRow = pkg?.rows.find((row) => row.rowId === destination.rowId);
    if (machineRow) onReview(machineRow);
  };
  const workflow = summarizeEvidenceMapWorkflow(presentation.rows);
  const reviewerOutcomes = [
    ...new Set(presentation.rows.map((row) => row.reviewerOutcome)),
  ];
  const activeFilterCount = [
    filters.evidenceState !== "ALL",
    filters.applicability !== "ALL",
    filters.reviewerOutcome !== "ALL",
    filters.reviewState !== "ALL",
  ].filter(Boolean).length;
  const filtersActive = hasPresentationFilters(filters);
  const setPresentationFilter = <K extends keyof EvidenceMapPresentationFilters>(
    key: K,
    value: EvidenceMapPresentationFilters[K],
  ) => setFilters((current) => ({ ...current, [key]: value }));
  return (
    <main className="min-h-screen w-full bg-slate-50 text-slate-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-8 md:px-8">
        <header className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between lg:p-6">
          <div>
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-blue-600" />
              <p className="text-sm font-medium text-slate-600">
                {pkg?.sourceDocument.documentName ||
                  pkg?.sourceDocument.documentId ||
                  reviewedSnapshot?.sourceDocument.documentName ||
                  reviewedSnapshot?.sourceDocument.documentId}
              </p>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Evidence Map · {presentation.readOnly ? "Reviewed truth" : "Machine proposal"}</h1>
            <p className="mt-2 text-xs text-slate-500">
              {pkg?.methodologyId || reviewedSnapshot?.methodologyId}{" "}
              {pkg?.rulebookVersion || reviewedSnapshot?.methodologyVersion} ·
              Audit {pkg?.auditId || reviewedSnapshot?.canonicalAuditId}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {reviewedSnapshot && pkg ? (
              <div
                aria-label="Evidence Map mode"
                className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-1"
              >
                {(["reviewed", "machine"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={mode === option}
                    onClick={() => setMode(option)}
                    className={`rounded-md px-3 py-2 text-sm font-semibold ${mode === option ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`}
                  >
                    {option === "reviewed"
                      ? "Reviewed truth"
                      : "Machine proposal"}
                  </button>
                ))}
              </div>
            ) : null}
            <span
              className={`rounded-full px-3 py-2 text-xs font-semibold ${presentation.readOnly ? "bg-blue-50 text-blue-800" : "bg-amber-50 text-amber-800"}`}
            >
              {presentation.readOnly
                ? "Reviewed truth snapshot"
                : finalized
                  ? "Finalized machine package"
                  : "Draft · machine proposed"}
            </span>
            <button
              type="button"
              onClick={onFinalize}
              disabled={presentation.readOnly || !allApproved || finalized}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-500"
            >
              <ShieldCheck size={17} />
              Finalize Evidence Map
            </button>
          </div>
        </header>
        <div className={`rounded-lg border px-4 py-3 text-sm ${presentation.readOnly ? "border-blue-200/80 bg-white text-blue-900" : "border-amber-200/80 bg-white text-amber-900"}`}>
          {presentation.readOnly
            ? "Reviewed truth snapshot. Historical reviewed evidence and outcomes are shown separately from the live machine proposal."
            : "Machine proposal. Live proposal fields are shown unchanged; switch modes to compare reviewed truth."}
        </div>
        <Summary rows={presentation.rows} />
        {!presentation.readOnly ? <nav aria-label="Evidence Map rule navigation" className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <span className="mr-auto text-xs text-slate-500">{effectiveIndex >= 0 ? `Rule ${effectiveIndex + 1} of ${rows.length}` : "No rules"}</span>
          <button type="button" onClick={() => navigate("previous")} disabled={effectiveIndex <= 0} aria-label="Previous rule" className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
          <button type="button" onClick={() => navigate("next")} disabled={effectiveIndex < 0 || effectiveIndex >= rows.length - 1} aria-label="Next rule" className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40">Next</button>
          <button type="button" onClick={() => navigate("unresolved")} disabled={!workflow.unresolved} aria-label="Next unresolved rule" className="min-h-10 rounded-lg border border-blue-300 px-3 text-sm font-semibold text-blue-800 disabled:cursor-not-allowed disabled:opacity-40">Next unresolved</button>
          <button type="button" onClick={() => navigate("blocker")} disabled={!workflow.blocked} aria-label="Next blocked or stale rule" className="min-h-10 rounded-lg border border-amber-300 px-3 text-sm font-semibold text-amber-900 disabled:cursor-not-allowed disabled:opacity-40">Next blocker</button>
        </nav> : null}
        <section aria-label="Search and filters" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <label className="relative min-w-64 flex-1">
              <Search
                size={17}
                className="absolute left-3 top-3 text-slate-400"
              />
              <input
                aria-label="Search rules"
                type="search"
                value={filters.query}
                onChange={(event) => setPresentationFilter("query", event.target.value)}
                placeholder="Search rules"
                className="min-h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm"
              />
            </label>
            <button type="button" aria-expanded={filtersOpen} aria-controls="evidence-map-secondary-filters" onClick={() => setFiltersOpen((current) => !current)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"><SlidersHorizontal size={16} /> Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}</button>
            <button
              type="button"
              disabled={!filtersActive}
              onClick={() => setFilters(EMPTY_PRESENTATION_FILTERS)}
              className="inline-flex items-center gap-1.5 px-3 text-sm font-medium text-blue-700 disabled:text-slate-400"
            >
              <FilterX size={14} />
              Clear filters
            </button>
          </div>
          {filtersOpen ? <div id="evidence-map-secondary-filters" className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-1 text-xs font-medium text-slate-600">Evidence state<select aria-label="Evidence state" value={filters.evidenceState} onChange={(event) => setPresentationFilter("evidenceState", event.target.value as EvidenceMapPresentationFilters["evidenceState"])} className="min-h-10 rounded-md border border-slate-300 bg-white px-2 text-sm font-normal text-slate-900"><option value="ALL">All</option>{["FOUND", "UNCLEAR", "MISSING", "N/A"].map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="grid gap-1 text-xs font-medium text-slate-600">Applicability<select aria-label="Applicability" value={filters.applicability} onChange={(event) => setPresentationFilter("applicability", event.target.value as EvidenceMapPresentationFilters["applicability"])} className="min-h-10 rounded-md border border-slate-300 bg-white px-2 text-sm font-normal text-slate-900"><option value="ALL">All</option><option value="APPLICABLE">Applicable</option><option value="NOT_APPLICABLE">Not applicable</option><option value="UNKNOWN">Unknown</option></select></label>
            <label className="grid gap-1 text-xs font-medium text-slate-600">Reviewer outcome<select aria-label="Reviewer outcome" value={filters.reviewerOutcome} onChange={(event) => setPresentationFilter("reviewerOutcome", event.target.value)} className="min-h-10 rounded-md border border-slate-300 bg-white px-2 text-sm font-normal text-slate-900"><option value="ALL">All</option>{reviewerOutcomes.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="grid gap-1 text-xs font-medium text-slate-600">Review state<select aria-label="Review state" value={filters.reviewState} onChange={(event) => setPresentationFilter("reviewState", event.target.value)} className="min-h-10 rounded-md border border-slate-300 bg-white px-2 text-sm font-normal text-slate-900"><option value="ALL">All</option>{[...new Set(presentation.rows.map((row) => row.reviewState))].map((value) => <option key={value}>{value}</option>)}</select></label>
          </div> : null}
          <p className="mt-2 text-xs text-slate-500">
            {rows.length} of {presentation.rows.length} rules
          </p>
        </section>
        {message && !presentation.readOnly ? (
          <p
            role="status"
            className="border-b border-blue-100 bg-blue-50 px-6 py-3 text-sm text-blue-900"
          >
            {message}
          </p>
        ) : null}
        <section aria-label="Evidence Map rules" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[8rem_minmax(12rem,1fr)_minmax(7rem,auto)_minmax(8rem,auto)_auto] gap-3 border-b border-slate-200 bg-slate-50/70 px-6 py-3 text-[11px] font-semibold text-slate-500 lg:grid">
            <span>Rule</span><span>Requirement / preview</span><span>Evidence state</span><span>Reviewer outcome</span><span className="sr-only">Expand</span>
          </div>
          {rows.map((row) => (
            <article
              key={row.rowId}
              data-evidence-map-row={row.rowId}
              className="border-b border-slate-200"
            >
              <button
                type="button"
                onClick={() => toggle(row.rowId)}
                aria-expanded={expanded.has(row.rowId)}
                aria-controls={`${row.rowId}-details`}
                className="grid min-h-20 w-full gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-blue-600 sm:px-6 lg:grid-cols-[8rem_minmax(12rem,1fr)_minmax(7rem,auto)_minmax(8rem,auto)_auto] lg:items-center motion-reduce:transition-none"
              >
                <span className="font-mono text-xs font-semibold text-blue-700">
                  {row.ruleReference}
                </span>
                <div>
                  {hasDistinctRuleTitle(row) ? <h2 className="text-sm font-semibold text-slate-950">{row.ruleTitle}</h2> : <h2 className="sr-only">{row.ruleReference}</h2>}
                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    {createEvidencePreview(row.acceptedEvidence[0]?.quote || row.gap || row.clientAction || row.assessmentReason || "No evidence preview recorded.", 180)}
                  </p>
                </div>
                <Badge value={row.evidenceState} />
                <Badge value={row.reviewerOutcome} />
                <ChevronDown
                  size={18}
                  className={expanded.has(row.rowId) ? "rotate-180" : ""}
                />
              </button>
              {row.blockerReasons.length ? <p className="border-t border-amber-100 bg-amber-50/60 px-4 py-2 text-xs text-amber-900 sm:px-6"><strong>Needs attention:</strong> {row.blockerReasons.join(" · ")}</p> : null}
              {expanded.has(row.rowId) ? (
                <RuleDetails
                  row={row}
                  readOnly={presentation.readOnly}
                  finalized={finalized}
                  onReview={() => {
                    const machineRow = pkg?.rows.find(
                      (item) => item.rowId === row.rowId,
                    );
                    if (machineRow) onReview(machineRow);
                  }}
                  onEvidenceDecision={onEvidenceDecision}
                />
              ) : null}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
