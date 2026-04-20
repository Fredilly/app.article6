"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { formatEvidenceInventoryId, type EvidenceInventoryItem } from "@/lib/evidence/inventory";
import type { ReviewStatus } from "@/lib/verify/reviewStore";
import {
  EXPECTED_EVIDENCE_LABELS,
  REQUIREMENT_COVERAGE_STATUS_META,
  requirementProvenanceHint,
  type RequirementCoverageRow,
} from "@/app/m/_lib/requirementCoverage";

export type RequirementCoverageFilter = "pending" | "verified" | "gaps";

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
  reviewStatusByRuleId?: Map<string, ReviewStatus>;
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

function reviewFilterBucket(status: ReviewStatus | null | undefined): RequirementCoverageFilter {
  if (status === "verified") return "verified";
  if (status === "not_verified" || status === "needs_followup") return "gaps";
  return "pending";
}

function reviewStateMeta(status: ReviewStatus | null | undefined): { label: string; tone: string } {
  if (status === "verified") {
    return {
      label: "Verified",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }
  if (status === "not_verified" || status === "needs_followup") {
    return {
      label: "Gap recorded",
      tone: "border-rose-200 bg-rose-50 text-rose-800",
    };
  }
  return {
    label: "Pending review",
    tone: "border-slate-200 bg-slate-50 text-slate-700",
  };
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
  reviewStatusByRuleId = new Map<string, ReviewStatus>(),
  supportingEvidence = null,
}: RequirementCoverageWorkspaceProps) {
  const [filter, setFilter] = useState<RequirementCoverageFilter>("pending");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const bucket = reviewFilterBucket(reviewStatusByRuleId.get(row.ruleId));
        acc.total += 1;
        acc[bucket] += 1;
        return acc;
      },
      { total: 0, pending: 0, verified: 0, gaps: 0 },
    );
  }, [reviewStatusByRuleId, rows]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (reviewFilterBucket(reviewStatusByRuleId.get(row.ruleId)) !== filter) return false;
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
  }, [filter, query, reviewStatusByRuleId, rows]);

  const selectedRow = useMemo(() => {
    const inFiltered = filteredRows.find((row) => row.ruleId === activeRuleId);
    if (inFiltered) return inFiltered;
    return filteredRows[0] ?? null;
  }, [activeRuleId, filteredRows]);
  const nextReviewRow = filteredRows[0] ?? null;

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
  const inventoryCounts = useMemo(() => {
    return inventoryItems.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.link_state === "unlinked") acc.unlinked += 1;
        else acc.linked += 1;
        return acc;
      },
      { total: 0, linked: 0, unlinked: 0 },
    );
  }, [inventoryItems]);

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Requirement review
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              Review requirements in order and keep the next judgment obvious.
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Rules {counts.total}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Reviewed {counts.verified + counts.gaps}
              </span>
              {filter === "pending" ? (
                nextReviewRow ? (
                  <span className="text-sm text-slate-600">
                    Next review: <span className="font-semibold text-slate-900">{nextReviewRow.ruleId}</span> {nextReviewRow.ruleSummary.title}
                  </span>
                ) : (
                  <span className="text-sm text-slate-500">No pending reviews left.</span>
                )
              ) : null}
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-80">
            <div className="inline-flex w-full flex-wrap rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-semibold text-slate-600">
              {([
                ["pending", `Pending (${counts.pending})`],
                ["verified", `Verified (${counts.verified})`],
                ["gaps", `Gaps (${counts.gaps})`],
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
              const reviewMeta = reviewStateMeta(reviewStatusByRuleId.get(row.ruleId));
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
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className={`rounded-full border px-2.5 py-1 font-semibold ${reviewMeta.tone}`}>
                      {reviewMeta.label}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700">
                      {row.linkedEvidence.length} linked evidence
                    </span>
                    {row.expectedEvidenceTypes.length ? (
                      <span className="text-slate-500">
                        {row.expectedEvidenceTypes.length} expected evidence type{row.expectedEvidenceTypes.length === 1 ? "" : "s"}
                      </span>
                    ) : (
                      <span className="text-slate-500">No expected evidence defined</span>
                    )}
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
                    </div>
                  </div>
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
                                        <div key={fragment.fragment_id}>
                                          {fragment.label ?? fragment.section_heading ?? fragment.section_label ?? "PDD fragment"}
                                          {fragment.page_start
                                            ? ` • p. ${fragment.page_start}${fragment.page_end && fragment.page_end !== fragment.page_start ? `-${fragment.page_end}` : ""}`
                                            : ""}
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
              Utilities
            </div>
            <h3 className="mt-1 text-base font-semibold text-slate-900">
              Evidence and export utilities for {selectedRow.ruleId}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Open map and evidence tools, share the current review state, and export without leaving the review surface.
            </p>
          </div>
          {supportingEvidence}
        </section>
      ) : null}
    </div>
  );
}
