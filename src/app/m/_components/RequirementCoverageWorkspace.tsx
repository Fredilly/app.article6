"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  EXPECTED_EVIDENCE_LABELS,
  REQUIREMENT_COVERAGE_STATUS_META,
  requirementProvenanceHint,
  summarizeExpectedEvidence,
  summarizeLinkedEvidence,
  type RequirementCoverageRow,
} from "@/app/m/_lib/requirementCoverage";

export type RequirementCoverageFilter = "all" | "unresolved" | "linked" | "needs-review";

type RequirementCoverageWorkspaceProps = {
  rows: RequirementCoverageRow[];
  activeRuleId: string | null;
  selectedRequirementText?: string | null;
  selectedRequirementSourcePath?: string | null;
  selectedRequirementSha256?: string | null;
  selectedTraceSections?: Array<{
    sectionId: string;
    title?: string | null;
    textSnippet?: string | null;
    match?: "explicit" | "text";
  }>;
  onSelectRule: (ruleId: string) => void;
  onOpenSourceContext: (sectionId: string) => void;
  onCopyRequirementLink?: (ruleId: string) => void;
  supportingEvidence?: ReactNode;
};

function matchesFilter(row: RequirementCoverageRow, filter: RequirementCoverageFilter): boolean {
  if (filter === "all") return true;
  if (filter === "unresolved") return row.status === "missing" || row.status === "partial";
  if (filter === "linked") return row.status === "linked";
  return row.status === "needs-review";
}

export default function RequirementCoverageWorkspace({
  rows,
  activeRuleId,
  selectedRequirementText,
  selectedRequirementSourcePath,
  selectedRequirementSha256,
  selectedTraceSections = [],
  onSelectRule,
  onOpenSourceContext,
  onCopyRequirementLink,
  supportingEvidence = null,
}: RequirementCoverageWorkspaceProps) {
  const [filter, setFilter] = useState<RequirementCoverageFilter>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.total += 1;
        if (row.status === "missing" || row.status === "partial") acc.unresolved += 1;
        if (row.status === "linked") acc.linked += 1;
        if (row.status === "needs-review") acc.needsReview += 1;
        return acc;
      },
      { total: 0, unresolved: 0, linked: 0, needsReview: 0 },
    );
  }, [rows]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (!matchesFilter(row, filter)) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        row.ruleId,
        row.ruleSummary.title,
        row.ruleSummary.snippet,
        row.provenance.sectionId,
        row.provenance.sectionTitle,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [filter, query, rows]);

  const selectedRow = useMemo(() => {
    const inFiltered = filteredRows.find((row) => row.ruleId === activeRuleId);
    if (inFiltered) return inFiltered;
    return filteredRows[0] ?? null;
  }, [activeRuleId, filteredRows]);

  useEffect(() => {
    if (!selectedRow) return;
    if (selectedRow.ruleId === activeRuleId) return;
    onSelectRule(selectedRow.ruleId);
  }, [activeRuleId, onSelectRule, selectedRow]);

  const primarySourceSectionId =
    selectedRow?.provenance.sectionId ??
    selectedRow?.provenance.citations.find((citation) => citation.sectionId)?.sectionId ??
    selectedTraceSections[0]?.sectionId ??
    null;

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Requirement coverage workspace
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              Review methodology requirements row by row with provenance and evidence context.
            </h3>
            <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
              <span className="rounded-full bg-slate-100 px-3 py-1">Total {counts.total}</span>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">Unresolved {counts.unresolved}</span>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">Complete {counts.linked}</span>
              <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-800">Needs review {counts.needsReview}</span>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-80">
            <div className="inline-flex w-full flex-wrap rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-semibold text-slate-600">
              {([
                ["all", `All (${counts.total})`],
                ["unresolved", `Unresolved (${counts.unresolved})`],
                ["linked", `Linked (${counts.linked})`],
                ["needs-review", `Needs review (${counts.needsReview})`],
              ] as Array<[RequirementCoverageFilter, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-full px-3 py-1 ${filter === value ? "bg-white text-slate-900 shadow-sm" : ""}`}
                  aria-pressed={filter === value}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search requirements…"
              className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section className="grid gap-3">
          {filteredRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              No requirements match this filter.
            </div>
          ) : (
            filteredRows.map((row) => {
              const status = REQUIREMENT_COVERAGE_STATUS_META[row.status];
              const selected = row.ruleId === selectedRow?.ruleId;
              return (
                <button
                  key={row.ruleId}
                  id={`r-${row.ruleId}`}
                  type="button"
                  onClick={() => onSelectRule(row.ruleId)}
                  className={`grid gap-3 rounded-2xl border p-4 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50 ${
                    selected ? "border-sky-300 bg-sky-50/40 ring-2 ring-sky-100" : "border-slate-200 bg-white"
                  }`}
                  aria-pressed={selected}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-700">{row.ruleId}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.tone}`}>
                        {status.label}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">{requirementProvenanceHint(row)}</span>
                  </div>
                  <div className="text-sm font-semibold leading-snug text-slate-900">{row.ruleSummary.snippet}</div>
                  <div className="grid gap-2 text-xs text-slate-600 md:grid-cols-3">
                    <div>
                      <div className="font-semibold uppercase tracking-wide text-slate-400">Provenance</div>
                      <div className="mt-1">{requirementProvenanceHint(row)}</div>
                    </div>
                    <div>
                      <div className="font-semibold uppercase tracking-wide text-slate-400">Expected evidence</div>
                      <div className="mt-1">{summarizeExpectedEvidence(row.expectedEvidenceTypes)}</div>
                    </div>
                    <div>
                      <div className="font-semibold uppercase tracking-wide text-slate-400">Linked evidence</div>
                      <div className="mt-1">{summarizeLinkedEvidence(row.linkedEvidence)}</div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </section>

        <aside className="xl:sticky xl:top-4 xl:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {selectedRow ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Selected requirement
                    </div>
                    <div className="mt-1 font-mono text-xs font-semibold text-slate-700">{selectedRow.ruleId}</div>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${REQUIREMENT_COVERAGE_STATUS_META[selectedRow.status].tone}`}
                  >
                    {REQUIREMENT_COVERAGE_STATUS_META[selectedRow.status].label}
                  </span>
                </div>

                <div>
                  <h4 className="text-base font-semibold text-slate-900">{selectedRow.ruleSummary.title}</h4>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">
                    {selectedRequirementText?.trim() || selectedRow.ruleSummary.snippet}
                  </p>
                </div>

                <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Methodology provenance</div>
                  <div className="mt-2 space-y-2 text-sm text-slate-700">
                    <div>{requirementProvenanceHint(selectedRow)}</div>
                    {selectedRow.provenance.citations.length ? (
                      <ul className="grid gap-2">
                        {selectedRow.provenance.citations.slice(0, 4).map((citation, index) => (
                          <li key={`${citation.sectionId ?? citation.anchor ?? "citation"}-${index}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                            {citation.label ?? citation.sectionId ?? citation.anchor ?? "Methodology citation"}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {selectedTraceSections.length ? (
                      <div className="grid gap-2">
                        {selectedTraceSections.slice(0, 3).map((section) => (
                          <button
                            key={section.sectionId}
                            type="button"
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left hover:border-slate-300"
                            onClick={() => onOpenSourceContext(section.sectionId)}
                          >
                            <div className="font-mono text-[11px] text-slate-600">{section.sectionId}</div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">
                              {section.title ?? "Methodology section"}
                            </div>
                            {section.textSnippet ? (
                              <div className="mt-1 text-xs text-slate-600">{section.textSnippet}</div>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => primarySourceSectionId && onOpenSourceContext(primarySourceSectionId)}
                        disabled={!primarySourceSectionId}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Open source context
                      </button>
                      {onCopyRequirementLink ? (
                        <button
                          type="button"
                          onClick={() => onCopyRequirementLink(selectedRow.ruleId)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:text-slate-900"
                        >
                          Copy link
                        </button>
                      ) : null}
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Expected evidence</div>
                  <div className="mt-2 text-sm text-slate-700">
                    {selectedRow.expectedEvidenceTypes.length ? (
                      <ul className="grid gap-2">
                        {selectedRow.expectedEvidenceTypes.map((type) => (
                          <li key={type} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                            {EXPECTED_EVIDENCE_LABELS[type] ?? type}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div>No expected evidence metadata</div>
                    )}
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Linked evidence</div>
                  <div className="mt-2 text-sm text-slate-700">
                    {selectedRow.linkedEvidence.length ? (
                      <ul className="grid gap-2">
                        {selectedRow.linkedEvidence.map((item) => (
                          <li key={`${item.source}:${item.id}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                            <div className="font-semibold text-slate-900">{item.title}</div>
                            <div className="mt-1 text-xs text-slate-600">
                              {item.type} • {item.source}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div>Requirement is unresolved. No linked evidence yet.</div>
                    )}
                  </div>
                </section>

                <section className="grid gap-2 text-xs text-slate-600">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-700">Source path</span>
                    <span className="break-all font-mono text-slate-700">{selectedRequirementSourcePath ?? "—"}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-700">sha256</span>
                    <span className="break-all font-mono text-slate-700">{selectedRequirementSha256 ?? "—"}</span>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                    {REQUIREMENT_COVERAGE_STATUS_META[selectedRow.status].description}
                  </div>
                </section>
              </div>
            ) : (
              <div className="text-sm text-slate-500">No requirement selected.</div>
            )}
          </div>
        </aside>
      </div>

      {selectedRow ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Supporting evidence
            </div>
            <h3 className="mt-1 text-base font-semibold text-slate-900">
              Evidence and map context for {selectedRow.ruleId}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              These views follow the selected requirement while verify, finalize, and export stay available.
            </p>
          </div>
          {supportingEvidence}
        </section>
      ) : null}
    </div>
  );
}
