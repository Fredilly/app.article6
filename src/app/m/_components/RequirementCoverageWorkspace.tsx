"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { formatEvidenceInventoryId, type EvidenceInventoryItem } from "@/lib/evidence/inventory";
import { computeMetrics } from "@/lib/evidence/metrics";
import EvidenceQualityBadge, { ReconciliationConfidenceBadge } from "@/components/evidence/EvidenceQualityBadge";
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
  inventoryItems?: EvidenceInventoryItem[];
  onLinkInventoryItem?: (evidenceId: string, ruleId: string, fragmentId?: string) => void;
  onUnlinkInventoryItem?: (evidenceId: string, ruleId: string, fragmentId?: string) => void;
  supportingEvidence?: ReactNode;
};

function formatInventoryTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function inventoryLinkStateLabel(item: EvidenceInventoryItem): string {
  if (!item.linked_requirement_ids.length) return "Unlinked";
  if (item.linked_requirement_ids.length === 1) return "Linked to 1 requirement";
  return `Linked to ${item.linked_requirement_ids.length} requirements`;
}

function inventoryRelationshipSummary(item: EvidenceInventoryItem): string {
  if (!item.linked_requirement_ids.length) return "Not linked yet";
  if (item.linked_requirement_ids.length === 1) return `Linked to ${item.linked_requirement_ids[0]}`;
  return `Linked to ${item.linked_requirement_ids.join(", ")}`;
}

function formatPddPageLabel(pageStart?: number, pageEnd?: number): string | null {
  if (typeof pageStart === "number" && typeof pageEnd === "number" && pageStart !== pageEnd) {
    return `Pages ${pageStart}-${pageEnd}`;
  }
  if (typeof pageStart === "number") return `Page ${pageStart}`;
  if (typeof pageEnd === "number") return `Page ${pageEnd}`;
  return null;
}

function linkedEvidenceProvenance(item: RequirementCoverageRow["linkedEvidence"][number]): string | null {
  const section = item.sectionHeading ?? item.sectionLabel ?? null;
  const pageLabel = formatPddPageLabel(item.pageStart, item.pageEnd);
  return ([item.documentLabel, item.fragmentLabel, section, pageLabel].filter(Boolean).join(" • ") || item.provenanceSummary) ?? null;
}

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
  inventoryItems = [],
  onLinkInventoryItem,
  onUnlinkInventoryItem,
  supportingEvidence = null,
}: RequirementCoverageWorkspaceProps) {
  const [filter, setFilter] = useState<RequirementCoverageFilter>("all");
  const [query, setQuery] = useState("");
  const selectedRequirementRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    selectedRequirementRef.current?.scrollIntoView({ block: "start", inline: "nearest" });
  }, [selectedRow?.ruleId]);

  const primarySourceSectionId =
    selectedRow?.provenance.sectionId ??
    selectedRow?.provenance.citations.find((citation) => citation.sectionId)?.sectionId ??
    selectedTraceSections[0]?.sectionId ??
    null;
  const hasReconciliation = inventoryItems.some((i) => i.reconciliation_status);
  const hasReconciliationError = inventoryItems.some((i) => i.reconciliation_load_error);
  const inventoryCounts = useMemo(() => {
    return inventoryItems.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.link_state === "unlinked") acc.unlinked += 1;
        else acc.linked += 1;
        if (item.reconciliation_status === "linked") acc.recLinked += 1;
        else if (item.reconciliation_status === "unmatched") acc.recUnmatched += 1;
        else if (item.reconciliation_status === "gap") acc.recGap += 1;
        if (item.reconciliation_load_error) acc.recError += 1;
        return acc;
      },
      { total: 0, linked: 0, unlinked: 0, recLinked: 0, recUnmatched: 0, recGap: 0, recError: 0 },
    );
  }, [inventoryItems]);

  const qualityByEvidenceId = useMemo(() => {
    const metrics = computeMetrics({ inventoryItems });
    return new Map(metrics.fragmentQualities.map((q) => [q.evidenceId, q]));
  }, [inventoryItems]);
  const inventoryMetrics = useMemo(() => computeMetrics({ inventoryItems }), [inventoryItems]);
  const selectedRuleMetrics = useMemo(() => {
    if (!selectedRow) return null;
    const linkedItems = inventoryItems.filter((item) => {
      if (item.linked_requirement_ids.includes(selectedRow.ruleId)) return true;
      return (item.pdd_fragment_links ?? []).some((link) => link.rule_id === selectedRow.ruleId);
    });
    const qualityEntries = linkedItems
      .map((item) => qualityByEvidenceId.get(item.evidence_id))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    const fragmentCount = qualityEntries.reduce((sum, entry) => sum + entry.fragmentCount, 0);
    const averageQuality =
      qualityEntries.length > 0
        ? qualityEntries.reduce((sum, entry) => sum + entry.score, 0) / qualityEntries.length
        : 0;
    return {
      evidenceItemCount: linkedItems.length,
      fragmentCount,
      averageQuality,
    };
  }, [inventoryItems, qualityByEvidenceId, selectedRow]);

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
              <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-800">
                Evidence coverage {Math.round(inventoryMetrics.overallCoverage * 100)}%
              </span>
              <span className="rounded-full bg-violet-50 px-3 py-1 text-violet-800">
                Avg quality {Math.round(inventoryMetrics.averageQuality * 100)}%
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Metrics are advisory only and help reviewers assess sufficiency at a glance.
            </p>
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
          <div
            ref={selectedRequirementRef}
            id={selectedRow ? `requirement-detail-${selectedRow.ruleId}` : undefined}
            className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            {selectedRow ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Selected requirement
                    </div>
                    <div className="mt-1 font-mono text-xs font-semibold text-slate-700">{selectedRow.ruleId}</div>
                    {selectedRow.provenance.sectionTitle ? (
                      <div className="mt-1 text-sm text-slate-500">{selectedRow.provenance.sectionTitle}</div>
                    ) : null}
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
                  {selectedRuleMetrics ? (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">
                        {selectedRuleMetrics.evidenceItemCount} evidence item{selectedRuleMetrics.evidenceItemCount === 1 ? "" : "s"}
                      </span>
                      <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-800">
                        {selectedRuleMetrics.fragmentCount} fragment{selectedRuleMetrics.fragmentCount === 1 ? "" : "s"}
                      </span>
                      <span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-800">
                        Avg quality {Math.round(selectedRuleMetrics.averageQuality * 100)}%
                      </span>
                    </div>
                  ) : null}
                </div>

                <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Methodology provenance</div>
                  <div className="mt-2 space-y-2 text-sm text-slate-700">
                    <div>{requirementProvenanceHint(selectedRow)}</div>
                    {selectedRow.provenance.tools.length ? (
                      <ul className="grid gap-2">
                        {selectedRow.provenance.tools.map((tool) => (
                          <li key={tool} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                            {tool}
                          </li>
                        ))}
                      </ul>
                    ) : null}
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
                      <div>No expected evidence defined for this rule.</div>
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
                            <div className="mt-1 font-mono text-[11px] text-slate-600">
                              {item.fragmentId ? item.fragmentId : formatEvidenceInventoryId(item.id)}
                            </div>
                            <div className="mt-1 text-xs text-slate-600">
                              {item.type} • {item.source}
                            </div>
                            {item.documentLabel && item.fragmentLabel ? (
                              <div className="mt-1 text-xs text-slate-600">
                                {item.documentLabel}
                              </div>
                            ) : null}
                            {linkedEvidenceProvenance(item) ? (
                              <div className="mt-1 text-xs text-slate-600">{linkedEvidenceProvenance(item)}</div>
                            ) : null}
                            {item.excerpt ? (
                              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-700">
                                {item.excerpt}
                              </div>
                            ) : null}
                            {onUnlinkInventoryItem ? (
                              <div className="mt-2">
                                <button
                                  type="button"
                                  onClick={() => onUnlinkInventoryItem(item.evidenceId ?? item.id, selectedRow.ruleId, item.fragmentId)}
                                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                >
                                  Unlink from {selectedRow.ruleId}
                                </button>
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div>Requirement is unresolved. No linked evidence yet.</div>
                    )}
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Workbook-derived candidates</div>
                  <div className="mt-2 text-sm text-slate-700">
                    {selectedRow.candidateEvidence.length ? (
                      <ul className="grid gap-2">
                        {selectedRow.candidateEvidence.map((item) => (
                          <li key={`${item.source}:${item.id}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                            <div className="font-semibold text-slate-900">{item.title}</div>
                            <div className="mt-1 font-mono text-[11px] text-slate-600">{item.id}</div>
                            <div className="mt-1 text-xs text-slate-600">{item.type} • candidate only</div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div>No workbook-derived candidates for this requirement yet.</div>
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

                <section className="rounded-xl border border-slate-200 bg-slate-50 p-3" data-testid="evidence-inventory-panel">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Evidence inventory</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">Active workspace evidence</div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-slate-700">
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">Total {inventoryCounts.total}</span>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800">
                        Unlinked {inventoryCounts.unlinked}
                      </span>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-800">
                        Linked {inventoryCounts.linked}
                      </span>
                      {hasReconciliation ? (
                        <>
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-800">
                            Reconciled {inventoryCounts.recLinked}
                          </span>
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800">
                            Unmatched {inventoryCounts.recUnmatched}
                          </span>
                          <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-red-800">
                            Gaps {inventoryCounts.recGap}
                          </span>
                        </>
                      ) : null}
                      {hasReconciliationError ? (
                        <span className="rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-red-800" title="Reconciliation could not complete — check methodology pack or manifest">
                          {inventoryCounts.recError} reconciliation error{inventoryCounts.recError === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {!hasReconciliation && hasReconciliationError ? (
                    <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
                      <p className="font-semibold">Reconciliation incomplete</p>
                      <p className="mt-1 text-xs text-red-700">
                        Evidence inventory could not be reconciled — the methodology pack or manifest may be missing.
                        Coverage gaps cannot be determined. Verify the methodology is available and re-run reconciliation.
                      </p>
                    </div>
                  ) : null}
                  <div className="mt-3 text-sm text-slate-700">
                    {inventoryItems.length ? (
                      <ul className="grid gap-2">
                        {inventoryItems.map((item) => {
                          const linkedToSelected = Boolean(selectedRow && item.linked_requirement_ids.includes(selectedRow.ruleId));
                          return (
                            <li key={item.evidence_id} className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-slate-900">{item.display_name}</span>
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                      {inventoryLinkStateLabel(item)}
                                    </span>
                                    {item.reconciliation_status ? (
                                      <span
                                        className={
                                          item.reconciliation_status === "linked"
                                            ? "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
                                            : item.reconciliation_status === "unmatched"
                                              ? "rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700"
                                              : "rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700"
                                        }
                                        title={
                                          item.reconciliation_status === "linked"
                                            ? "Evidence fragment matches a methodology rule via candidate link"
                                            : item.reconciliation_status === "unmatched"
                                              ? "Evidence fragment has no matching methodology rule — may require manual review"
                                              : "No evidence covers this rule — reviewer attention needed"
                                        }
                                      >
                                        {item.reconciliation_status === "linked"
                                          ? "Reconciled"
                                          : item.reconciliation_status === "unmatched"
                                            ? "Unmatched"
                                            : "Gap"}
                                      </span>
                                    ) : null}
                                    {item.reconciliation_load_error ? (
                                      <span
                                        className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700"
                                        title={item.reconciliation_load_error}
                                      >
                                        Reconciliation error
                                      </span>
                                    ) : null}
                                    {qualityByEvidenceId.has(item.evidence_id) ? (
                                      <>
                                        <EvidenceQualityBadge
                                          grade={qualityByEvidenceId.get(item.evidence_id)!.grade}
                                          score={qualityByEvidenceId.get(item.evidence_id)!.score}
                                        />
                                        <ReconciliationConfidenceBadge
                                          level={qualityByEvidenceId.get(item.evidence_id)!.reconciliationConfidenceLevel}
                                          score={qualityByEvidenceId.get(item.evidence_id)!.reconciliationConfidenceScore}
                                        />
                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                          {qualityByEvidenceId.get(item.evidence_id)!.fragmentCount} fragment{qualityByEvidenceId.get(item.evidence_id)!.fragmentCount === 1 ? "" : "s"}
                                        </span>
                                      </>
                                    ) : null}
                                  </div>
                                  <div className="mt-2 text-xs text-slate-600">{inventoryRelationshipSummary(item)}</div>
                                </div>
                                {selectedRow ? (
                                  item.pdd_document ? (
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                                      Link PDD fragments from the evidence panel
                                    </span>
                                  ) : linkedToSelected ? (
                                    <button
                                      type="button"
                                      onClick={() => onUnlinkInventoryItem?.(item.evidence_id, selectedRow.ruleId)}
                                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                      data-testid={`inventory-unlink-${item.evidence_id}`}
                                    >
                                      Unlink
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => onLinkInventoryItem?.(item.evidence_id, selectedRow.ruleId)}
                                      className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                                      data-testid={`inventory-link-${item.evidence_id}`}
                                    >
                                      Link
                                    </button>
                                  )
                                ) : null}
                              </div>
                              <details className="mt-2 rounded-lg border border-slate-200 bg-slate-50">
                                <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-slate-700">
                                  More
                                </summary>
                                <div className="grid gap-1 px-3 pb-3 text-[11px] text-slate-600">
                                  <div>ID: {formatEvidenceInventoryId(item.evidence_id)}</div>
                                  <div>Type: {item.type}</div>
                                  <div>Source: {item.source_summary}</div>
                                  <div>Added: {formatInventoryTime(item.added_at)}</div>
                                  <div>Provenance: {item.provenance_summary}</div>
                                  {item.pdd_document ? (
                                    <div>
                                      PDD: {item.pdd_document.file_name} • {item.pdd_document.mime}
                                      {item.pdd_document.sha256 ? ` • ${item.pdd_document.sha256.slice(0, 12)}…` : ""}
                                    </div>
                                  ) : null}
                                  {item.pdd_fragments?.length ? (
                                    <div className="grid gap-1">
                                      {item.pdd_fragments.map((fragment) => (
                                        <div key={fragment.fragment_id} className="flex flex-wrap items-center gap-2">
                                          <span>
                                            {fragment.label ?? fragment.section_heading ?? fragment.section_label ?? "PDD fragment"}
                                            {fragment.page_start
                                              ? ` • p. ${fragment.page_start}${fragment.page_end && fragment.page_end !== fragment.page_start ? `-${fragment.page_end}` : ""}`
                                              : ""}
                                          </span>
                                          {qualityByEvidenceId.has(item.evidence_id) ? (
                                            <ReconciliationConfidenceBadge
                                              level={qualityByEvidenceId.get(item.evidence_id)!.reconciliationConfidenceLevel}
                                              score={qualityByEvidenceId.get(item.evidence_id)!.reconciliationConfidenceScore}
                                            />
                                          ) : null}
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                  {item.workbook_assets?.length ? (
                                    <div>
                                      Workbook: {item.workbook_assets[0]?.sheet_count ?? 0} sheet{item.workbook_assets[0]?.sheet_count === 1 ? "" : "s"} •{" "}
                                      {item.workbook_record_groups?.length ?? 0} derived group{(item.workbook_record_groups?.length ?? 0) === 1 ? "" : "s"}
                                    </div>
                                  ) : null}
                                  {item.workbook_record_groups?.length ? (
                                    <div className="grid gap-1">
                                      {item.workbook_record_groups.map((group) => (
                                        <div key={group.group_id}>
                                          {group.display_name} • {group.source_sheet}
                                          {group.source_range ? ` • ${group.source_range}` : ""}
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                  {item.linked_requirement_ids.length ? (
                                    <div>Requirements: {item.linked_requirement_ids.join(", ")}</div>
                                  ) : null}
                                </div>
                              </details>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-3 text-sm text-slate-500">
                        No evidence inventory yet.
                      </div>
                    )}
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
