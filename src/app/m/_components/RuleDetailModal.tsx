"use client";

import { useEffect } from "react";
import { formatEvidenceInventoryId } from "@/lib/evidence/inventory";
import {
  EXPECTED_EVIDENCE_LABELS,
  REQUIREMENT_COVERAGE_STATUS_META,
  requirementProvenanceHint,
  type RequirementCoverageRow,
} from "@/app/m/_lib/requirementCoverage";

type RuleDetailModalProps = {
  open: boolean;
  row: RequirementCoverageRow | null;
  ruleTitle?: string | null;
  ruleText?: string | null;
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

export default function RuleDetailModal({
  open,
  row,
  ruleTitle,
  ruleText,
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
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Full rule text</div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-800">
                {ruleText?.trim() || row.ruleSummary.snippet}
              </p>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Methodology provenance</div>
              <div className="mt-3 space-y-3 text-sm text-slate-700">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
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
                    {row.provenance.anchor ? (
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                        {row.provenance.anchor.replace(/^#/, "")}
                      </span>
                    ) : null}
                    {!formatPageLabel(primaryTraceSection?.page ?? row.provenance.page) && !row.provenance.anchor ? (
                      <span>{requirementProvenanceHint(row)}</span>
                    ) : null}
                  </div>
                </div>
                {row.provenance.citations.length ? (
                  <ul className="grid gap-2">
                    {row.provenance.citations.slice(0, 4).map((citation, index) => (
                      <li
                        key={`${citation.sectionId ?? citation.anchor ?? "citation"}-${index}`}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
                      >
                        {citation.label ??
                          formatSectionLabel({ sectionId: citation.sectionId, title: null }) ??
                          citation.anchor ??
                          "Methodology citation"}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                    No provenance citations available.
                  </div>
                )}
                {traceSections.length ? (
                  <div className="grid gap-2">
                    {traceSections.slice(0, 3).map((section) => (
                      <button
                        key={section.sectionId}
                        type="button"
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left hover:border-slate-300"
                        onClick={() => onOpenSourceContext(section.sectionId)}
                      >
                        <div className="mt-1 text-sm font-semibold text-slate-900">
                          {formatSectionLabel({ sectionId: section.sectionId, title: section.title })}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-600">
                          <span className="font-mono">{section.sectionId}</span>
                          {formatPageLabel(section.page) ? <span>{formatPageLabel(section.page)}</span> : null}
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
                </div>
              </div>
            </section>
          </section>

          <aside className="space-y-4">
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
                    No expected evidence metadata
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
                        <div className="mt-1 font-mono text-[11px] text-slate-600">{formatEvidenceInventoryId(item.id)}</div>
                        <div className="mt-1 text-xs text-slate-600">
                          {item.type} • {item.source}
                        </div>
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
