"use client";

import {
  ChevronDown,
  FileText,
  FilterX,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
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
  hasPresentationFilters,
  summarizeEvidenceMapPresentation,
  type EvidenceMapMode,
  type EvidenceMapPresentationFilters,
  type EvidenceMapPresentationRow,
} from "./evidenceMapPresentationModel";

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

function EvidenceList({
  row,
  rejected = false,
}: {
  row: EvidenceMapPresentationRow;
  rejected?: boolean;
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
        <div
          className={`mt-3 divide-y divide-slate-200 rounded-xl px-4 ${rejected ? "bg-amber-50/60" : "bg-emerald-50/50"}`}
        >
          {records.map((record, index) => (
            <article
              key={`${record.spanId}-${index}`}
              data-evidence-record={rejected ? "rejected" : "accepted"}
              className="py-4"
            >
              <blockquote className="whitespace-pre-wrap text-sm leading-6 text-slate-800">
                “{record.quote}”
              </blockquote>
              {rejected && record.rejectionReason ? (
                <p className="mt-3 text-sm text-amber-900">
                  <strong>Rejected because:</strong> {record.rejectionReason}
                </p>
              ) : null}
              <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                <div>
                  <dt className="sr-only">Page</dt>
                  <dd>Page {record.page ?? record.provenance.page ?? "—"}</dd>
                </div>
                <div>
                  <dt className="sr-only">Section</dt>
                  <dd>
                    {record.section ||
                      record.provenance.sectionHeading ||
                      "No section"}
                  </dd>
                </div>
                <div title={record.provenance.spanId}>
                  <dt className="sr-only">Source span</dt>
                  <dd>
                    {record.provenance.docId} · {record.provenance.spanId}
                  </dd>
                </div>
              </dl>
            </article>
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

function RuleDetails({
  row,
  readOnly,
  finalized,
  onReview,
}: {
  row: EvidenceMapPresentationRow;
  readOnly: boolean;
  finalized: boolean;
  onReview: () => void;
}) {
  return (
    <div
      id={`${row.rowId}-details`}
      className="grid overflow-hidden border-t border-slate-200 bg-slate-50/70 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,.6fr)] lg:gap-10"
    >
      <div className="space-y-8">
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-[.12em] text-slate-500">
            Requirement
          </h3>
          <p className="mt-3 text-sm leading-6 text-slate-800">
            {row.requirementText}
          </p>
          <p className="mt-2 font-mono text-xs text-slate-500">
            {row.stableRuleId}
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
        <EvidenceList row={row} />
        <EvidenceList row={row} rejected />
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
      <aside className="mt-8 border-t border-slate-200 pt-6 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
        <h3 className="text-xs font-semibold uppercase tracking-[.12em] text-slate-500">
          Gap and action
        </h3>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          {row.clientAction || row.gap || "No action recorded."}
        </p>
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

function Summary({
  rows,
}: {
  rows: readonly EvidenceMapPresentationRow[];
}) {
  const summary = summarizeEvidenceMapPresentation(rows);
  const items = [
    ["Total rules", summary.total],
    ["Found", summary.found],
    ["Unclear", summary.unclear],
    ["Missing", summary.missing],
    ["Not applicable", summary.notApplicable],
    ["Action required", summary.actionRequired],
  ] as const;
  return (
    <nav
      aria-label="Evidence Map summary"
      className="grid grid-cols-2 divide-x divide-y divide-slate-200 border-y border-slate-200 bg-white sm:grid-cols-3 lg:grid-cols-6"
    >
      {items.map(([name, count]) => (
        <div key={name} className="px-4 py-4">
          <span className="font-mono text-xl font-semibold tabular-nums">
            {count}
          </span>
          <span className="mt-1 block text-xs font-medium text-slate-500">
            {name}
          </span>
        </div>
      ))}
    </nav>
  );
}

type Props = {
  pkg: Vm0007EvidenceMapDraftPackage;
  reviewedSnapshot?: ReviewedEvidenceMapSnapshot | null;
  mode: EvidenceMapMode;
  onModeChange: (mode: EvidenceMapMode) => void;
  message: string | null;
  onFinalize: () => void;
  onReview: (row: Vm0007EvidenceMapDraftRow) => void;
};
export default function EvidenceMapWorkspace({
  pkg,
  reviewedSnapshot,
  mode,
  onModeChange,
  message,
  onFinalize,
  onReview,
}: Props) {
  const [filters, setFilters] = useState<EvidenceMapPresentationFilters>(
    EMPTY_PRESENTATION_FILTERS,
  );
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const presentation = useMemo(
    () =>
      mode === "reviewed" && reviewedSnapshot
        ? buildReviewedEvidenceMapPresentation(reviewedSnapshot)
        : buildMachineEvidenceMapPresentation(pkg),
    [mode, pkg, reviewedSnapshot],
  );
  const rows = useMemo(
    () => filterEvidenceMapPresentation(presentation.rows, filters),
    [presentation.rows, filters],
  );
  const finalized = pkg.finalizationState === "finalized";
  const allApproved = pkg.rows.every((row) => row.reviewState === "approved");
  const toggle = (rowId: string) =>
    setExpanded((current) => {
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
  const reviewerOutcomes = [
    ...new Set(presentation.rows.map((row) => row.reviewerOutcome)),
  ];
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-blue-600" />
              <p className="text-sm font-medium text-slate-600">
                {pkg.sourceDocument.documentName ||
                  pkg.sourceDocument.documentId}
              </p>
            </div>
            <h1 className="mt-2 text-2xl font-semibold">
              Evidence Map ·{" "}
              {presentation.readOnly ? "Reviewed truth" : "Machine proposal"}
            </h1>
            <p className="mt-2 text-xs text-slate-500">
              {pkg.methodologyId} {pkg.rulebookVersion} · Audit {pkg.auditId}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {reviewedSnapshot ? (
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
        </div>
      </header>
      <div className="mx-auto max-w-[1600px]">
        <div
          className={`border-b px-4 py-3 text-sm sm:px-6 ${presentation.readOnly ? "border-blue-200 bg-blue-50 text-blue-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}
        >
          {presentation.readOnly
            ? "Reviewed truth snapshot. Historical reviewed evidence and outcomes are shown separately from the live machine proposal."
            : "Machine proposal. Live proposal fields are shown unchanged; switch modes to compare reviewed truth."}
        </div>
        <Summary rows={presentation.rows} />
        <div className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/95 px-4 py-3 sm:px-6">
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
                onChange={(event) =>
                  setFilters({ ...filters, query: event.target.value })
                }
                placeholder="Search rules"
                className="min-h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm"
              />
            </label>
            <select
              aria-label="Evidence state"
              value={filters.evidenceState}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  evidenceState: event.target
                    .value as EvidenceMapPresentationFilters["evidenceState"],
                })
              }
              className="rounded-lg border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="ALL">Evidence state: All</option>
              {["FOUND", "UNCLEAR", "MISSING", "N/A"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <select
              aria-label="Reviewer outcome"
              value={filters.reviewerOutcome}
              onChange={(event) =>
                setFilters({ ...filters, reviewerOutcome: event.target.value })
              }
              className="rounded-lg border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="ALL">Reviewer outcome: All</option>
              {reviewerOutcomes.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={!hasPresentationFilters(filters)}
              onClick={() => setFilters(EMPTY_PRESENTATION_FILTERS)}
              className="inline-flex items-center gap-1.5 px-3 text-sm font-medium text-blue-700 disabled:text-slate-400"
            >
              <FilterX size={14} />
              Clear all
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {rows.length} of {presentation.rows.length} rules
          </p>
        </div>
        {message && !presentation.readOnly ? (
          <p
            role="status"
            className="border-b border-blue-100 bg-blue-50 px-6 py-3 text-sm text-blue-900"
          >
            {message}
          </p>
        ) : null}
        <section aria-label="Evidence Map rules" className="bg-white">
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
                className="grid w-full gap-3 px-4 py-4 text-left sm:px-6 lg:grid-cols-[8rem_minmax(12rem,.8fr)_minmax(16rem,1.4fr)_auto] lg:items-center"
              >
                <span className="font-mono text-xs font-semibold text-blue-700">
                  {row.ruleReference}
                </span>
                <div>
                  <h2 className="text-sm font-semibold">{row.ruleTitle}</h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge value={row.evidenceState} />
                    <Badge value={row.reviewerOutcome} />
                  </div>
                </div>
                <p className="line-clamp-2 text-sm text-slate-600">
                  {row.acceptedEvidence[0]?.quote ||
                    row.gap ||
                    row.clientAction ||
                    row.assessmentReason ||
                    "No evidence preview recorded."}
                </p>
                <ChevronDown
                  size={18}
                  className={expanded.has(row.rowId) ? "rotate-180" : ""}
                />
              </button>
              {expanded.has(row.rowId) ? (
                <RuleDetails
                  row={row}
                  readOnly={presentation.readOnly}
                  finalized={finalized}
                  onReview={() => {
                    const machineRow = pkg.rows.find(
                      (item) => item.rowId === row.rowId,
                    );
                    if (machineRow) onReview(machineRow);
                  }}
                />
              ) : null}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
