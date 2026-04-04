"use client";

import { useEffect } from "react";
import { formatEvidenceInventoryId } from "@/lib/evidence/inventory";
import {
  EXPECTED_EVIDENCE_LABELS,
  REQUIREMENT_RECONCILIATION_META,
  REQUIREMENT_COVERAGE_STATUS_META,
  reconcileRequirement,
  requirementProvenanceHint,
  type RequirementCoverageRow,
} from "@/app/m/_lib/requirementCoverage";

type RuleDetailModalProps = {
  open: boolean;
  row: RequirementCoverageRow | null;
  ruleTitle?: string | null;
  ruleText?: string | null;
  ruleLogic?: string | null;
  ruleNotes?: string | null;
  ruleWhen?: string[] | null;
  reviewerMinutes?: string | null;
  reviewerOutcomeNote?: string | null;
  sourcePath?: string | null;
  sha256?: string | null;
  traceSections?: Array<{
    sectionId: string;
    title?: string | null;
    textSnippet?: string | null;
    page?: number | null;
    match?: "explicit" | "text";
  }>;
  onClose: () => void;
  onOpenSourceContext: (sectionId: string) => void;
};

function sectionNumberFromId(sectionId?: string | null): string | null {
  if (!sectionId) return null;
  const match = sectionId.match(/^S-(\d+)$/i);
  return match ? match[1] : null;
}

function formatSectionLabel(input: { sectionId?: string | null; title?: string | null }): string {
  const sectionNumber = sectionNumberFromId(input.sectionId);
  if (sectionNumber && input.title?.trim()) {
    return `Section ${sectionNumber} · ${input.title.trim()}`;
  }
  if (input.title?.trim()) return input.title.trim();
  if (input.sectionId?.trim()) return input.sectionId.trim();
  return "Methodology section";
}

function formatPageLabel(page?: number | null): string | null {
  return typeof page === "number" ? `p. ${page}` : null;
}

function unresolvedNextStep(row: RequirementCoverageRow): string {
  const firstExpectedType = row.expectedEvidenceTypes[0];
  if (firstExpectedType) {
    const label = (EXPECTED_EVIDENCE_LABELS[firstExpectedType] ?? firstExpectedType).toLowerCase();
    return `Next: link ${label}.`;
  }
  return "Next: link supporting evidence or leave a reviewer note.";
}

function formatPddLinkedEvidenceMeta(item: RequirementCoverageRow["linkedEvidence"][number]): string | null {
  const details = [item.documentLabel, item.sectionHeading, item.sectionLabel].filter(Boolean);
  if (typeof item.pageStart === "number" && typeof item.pageEnd === "number" && item.pageStart !== item.pageEnd) {
    details.push(`p. ${item.pageStart}-${item.pageEnd}`);
  } else if (typeof item.pageStart === "number") {
    details.push(`p. ${item.pageStart}`);
  } else if (typeof item.pageEnd === "number") {
    details.push(`p. ${item.pageEnd}`);
  }
  return details.join(" • ") || item.provenanceSummary || null;
}

export default function RuleDetailModal({
  open,
  row,
  ruleTitle,
  ruleText,
  ruleLogic,
  ruleNotes,
  ruleWhen,
  reviewerMinutes,
  reviewerOutcomeNote,
  sourcePath,
  sha256,
  traceSections = [],
  onClose,
  onOpenSourceContext,
}: RuleDetailModalProps) {
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose, open]);

  if (!open || !row) return null;

  const status = REQUIREMENT_COVERAGE_STATUS_META[row.status];
  const primaryTraceSection =
    traceSections[0] ??
    (row.provenance.sectionId || row.provenance.sectionTitle || typeof row.provenance.page === "number"
      ? {
          sectionId: row.provenance.sectionId ?? "",
          title: row.provenance.sectionTitle ?? null,
          page: row.provenance.page,
          textSnippet: null,
        }
      : null);
  const primarySourceSectionId =
    primaryTraceSection?.sectionId ??
    row.provenance.sectionId ??
    row.provenance.citations.find((citation) => citation.sectionId)?.sectionId ??
    null;
  const categoryLabel = row.ruleSummary.type?.trim() || null;
  const provenanceTools = row.provenance.tools ?? [];
  const renderedWhen = ruleWhen?.length ? ruleWhen : row.ruleSummary.when;
  const reconciliation = reconcileRequirement({
    linkedEvidence: row.linkedEvidence,
    expectedEvidenceTypes: row.expectedEvidenceTypes,
    reviewerMinutes,
    reviewerOutcomeNote,
  });
  const reconciliationMeta = REQUIREMENT_RECONCILIATION_META[reconciliation.status];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Rule detail ${row.ruleId}`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 px-4 py-6 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">View rule</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-semibold text-slate-700">{row.ruleId}</span>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${status.tone}`}>
                {status.label}
              </span>
              {categoryLabel ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold capitalize text-slate-700">
                  {categoryLabel}
                </span>
              ) : null}
            </div>
            <h2 className="mt-3 text-lg font-semibold text-slate-900">{ruleTitle?.trim() || row.ruleSummary.title}</h2>
          </div>
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <section className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Rule summary</div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-800">
                {ruleText?.trim() || row.ruleSummary.summary || row.ruleSummary.snippet}
              </p>
              {ruleLogic?.trim() || row.ruleSummary.logic ? (
                <div className="mt-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Logic</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-800">
                    {ruleLogic?.trim() || row.ruleSummary.logic}
                  </p>
                </div>
              ) : null}
              {ruleNotes?.trim() || row.ruleSummary.notes ? (
                <div className="mt-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-800">
                    {ruleNotes?.trim() || row.ruleSummary.notes}
                  </p>
                </div>
              ) : null}
              {renderedWhen?.length ? (
                <div className="mt-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">When</div>
                  <ul className="mt-2 grid gap-2 text-sm text-slate-800">
                    {renderedWhen.map((item) => (
                      <li key={item} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Methodology provenance</div>
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                <div className="font-semibold text-slate-900">
                  {formatSectionLabel({
                    sectionId: primaryTraceSection?.sectionId ?? row.provenance.sectionId,
                    title: primaryTraceSection?.title ?? row.provenance.sectionTitle,
                  })}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                  {formatPageLabel(primaryTraceSection?.page ?? row.provenance.page) ? (
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                      {formatPageLabel(primaryTraceSection?.page ?? row.provenance.page)}
                    </span>
                  ) : null}
                  {row.provenance.sectionAnchor || row.provenance.anchor ? (
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                      Anchor {(row.provenance.sectionAnchor ?? row.provenance.anchor ?? "").replace(/^#/, "")}
                    </span>
                  ) : null}
                  {row.provenance.sectionStableId ? (
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                      {row.provenance.sectionStableId}
                    </span>
                  ) : null}
                  {provenanceTools.length ? (
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                      Tools {provenanceTools.join(", ")}
                    </span>
                  ) : null}
                  {!formatPageLabel(primaryTraceSection?.page ?? row.provenance.page) &&
                  !row.provenance.sectionAnchor &&
                  !row.provenance.anchor &&
                  !row.provenance.sectionStableId &&
                  !provenanceTools.length ? (
                    <span>{requirementProvenanceHint(row)}</span>
                  ) : null}
                </div>
                {primaryTraceSection?.textSnippet ? (
                  <div className="mt-2 text-xs text-slate-600">{primaryTraceSection.textSnippet}</div>
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
                </div>
              </div>
            </section>
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Reconciliation</div>
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${reconciliationMeta.tone}`}>
                    {reconciliationMeta.label}
                  </span>
                </div>
                <div className="mt-2 text-sm text-slate-700">{reconciliation.reason}</div>
                {row.expectedEvidenceTypes.length ? (
                  <div className="mt-3 grid gap-2 text-xs text-slate-600">
                    <div>
                      <span className="font-semibold text-slate-700">Satisfied:</span>{" "}
                      {reconciliation.satisfiedExpectedEvidenceTypes.length
                        ? reconciliation.satisfiedExpectedEvidenceTypes.map((type) => EXPECTED_EVIDENCE_LABELS[type]).join(", ")
                        : "None"}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Missing:</span>{" "}
                      {reconciliation.missingExpectedEvidenceTypes.length
                        ? reconciliation.missingExpectedEvidenceTypes.map((type) => EXPECTED_EVIDENCE_LABELS[type]).join(", ")
                        : "None"}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Expected evidence</div>
              <div className="mt-3 text-sm text-slate-700">
                {row.expectedEvidenceTypes.length ? (
                  <ul className="grid gap-2">
                    {row.expectedEvidenceTypes.map((type) => (
                      <li key={type} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        {EXPECTED_EVIDENCE_LABELS[type] ?? type}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                    This rule does not define expected evidence.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Linked evidence</div>
              <div className="mt-3 text-sm text-slate-700">
                {row.linkedEvidence.length ? (
                  <ul className="grid gap-2">
                    {row.linkedEvidence.map((item) => (
                      <li key={`${item.source}:${item.id}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="font-semibold text-slate-900">{item.title}</div>
                        <div className="mt-1 font-mono text-[11px] text-slate-600">
                          {item.fragmentId ? item.fragmentId : formatEvidenceInventoryId(item.id)}
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          {item.type} • {item.source}
                        </div>
                        {formatPddLinkedEvidenceMeta(item) ? (
                          <div className="mt-1 text-xs text-slate-600">{formatPddLinkedEvidenceMeta(item)}</div>
                        ) : null}
                        {item.excerpt ? (
                          <div className="mt-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700">
                            {item.excerpt}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                    <div>Requirement is unresolved. No linked evidence yet.</div>
                    <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
                      {unresolvedNextStep(row)}
                    </div>
                  </div>
                )}
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                  {status.description}
                </div>
              </div>
            </section>

            <details className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
              <summary className="cursor-pointer list-none font-semibold text-slate-700">Audit details</summary>
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-700">Source path</span>
                  <span className="break-all font-mono text-slate-700">{sourcePath ?? "—"}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-700">sha256</span>
                  <span className="break-all font-mono text-slate-700">{sha256 ?? "—"}</span>
                </div>
              </div>
            </details>
          </aside>
        </div>
      </div>
    </div>
  );
}
