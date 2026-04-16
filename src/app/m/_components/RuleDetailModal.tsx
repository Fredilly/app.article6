"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, FileSearch, FileText, Link2, NotebookText, Scale, Shapes, ShieldAlert } from "lucide-react";
import { formatEvidenceInventoryId } from "@/lib/evidence/inventory";
import RuleReviewPanel from "@/components/verify/RuleReviewPanel";
import { getReview, saveReview, type RuleReview } from "@/lib/verify/reviewStore";
import { logAuditEvent } from "@/lib/verify/auditTrail";
import { statusLabel } from "@/lib/verify/reviewValidation";
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
  canonicalRuleId?: string | null;
  ruleText?: string | null;
  ruleLogic?: string | null;
  ruleNotes?: string | null;
  ruleWhen?: string[] | null;
  reviewerMinutes?: string | null;
  reviewerOutcomeNote?: string | null;
  ruleTags?: string[];
  stacItems?: Array<{
    id: string;
    datetime?: string;
    cloud_cover?: number | null;
    collection?: string;
    bbox?: [number, number, number, number];
  }>;
  hasAoi?: boolean;
  methodologyLabel?: string | null;
  reviewMethodology?: string | null;
  reviewVersion?: string | null;
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

function shortRuleId(input?: string | null): string | null {
  const value = input?.trim();
  if (!value) return null;
  const match = value.match(/(R-\d+(?:-\d+)*)$/i);
  return match ? match[1] : value;
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

function evidenceKindIcon(item: RequirementCoverageRow["linkedEvidence"][number]) {
  const type = item.type.toLowerCase();
  if (type.includes("pdd")) return FileText;
  if (type.includes("workbook") || type.includes("spreadsheet")) return NotebookText;
  if (type.includes("stac")) return Shapes;
  return Link2;
}

function evidencePrimaryLabel(item: RequirementCoverageRow["linkedEvidence"][number]): string {
  return item.documentLabel ?? item.title;
}

function evidenceSecondaryLabel(item: RequirementCoverageRow["linkedEvidence"][number]): string | null {
  if (item.documentLabel && item.title !== item.documentLabel) return item.title;
  return null;
}

export default function RuleDetailModal({
  open,
  row,
  canonicalRuleId,
  ruleText,
  ruleLogic,
  ruleNotes,
  ruleWhen,
  reviewerMinutes,
  reviewerOutcomeNote,
  ruleTags = [],
  stacItems = [],
  hasAoi = false,
  methodologyLabel,
  reviewMethodology,
  reviewVersion,
  sourcePath,
  sha256,
  traceSections = [],
  onClose,
  onOpenSourceContext,
}: RuleDetailModalProps) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [existingReview, setExistingReview] = useState<RuleReview | null>(null);

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

  useEffect(() => {
    if (!open || !canonicalRuleId || !reviewMethodology || !reviewVersion) {
      setExistingReview(null);
      setReviewOpen(false);
      return;
    }
    setExistingReview(getReview(canonicalRuleId, reviewMethodology, reviewVersion));
    setReviewOpen(false);
  }, [canonicalRuleId, open, reviewMethodology, reviewVersion]);

  const handleSaveReview = useCallback(
    (review: RuleReview) => {
      const actor = review.reviewedBy?.trim() || "local-reviewer";
      if (!existingReview) {
        logAuditEvent({
          ruleId: review.ruleId,
          methodology: review.methodology,
          version: review.version,
          action: "review_created",
          newStatus: review.status,
          actor,
          note: `Created review with status ${review.status}`,
        });
      } else if (existingReview.status !== review.status) {
        logAuditEvent({
          ruleId: review.ruleId,
          methodology: review.methodology,
          version: review.version,
          action: "status_change",
          previousStatus: existingReview.status,
          newStatus: review.status,
          actor,
          note: `Status changed from ${existingReview.status} to ${review.status}`,
        });
      }
      saveReview(review);
      setExistingReview(review);
    },
    [existingReview],
  );

  const handleReviewChange = useCallback((review: RuleReview) => {
    setExistingReview(review);
  }, []);

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
  const displayRuleId = shortRuleId(row.ruleId) ?? shortRuleId(canonicalRuleId) ?? row.ruleId;
  const reviewReady = Boolean(canonicalRuleId && reviewMethodology && reviewVersion);
  const reviewRuleId = canonicalRuleId ?? "";
  const reviewMethodologyValue = reviewMethodology ?? "";
  const reviewVersionValue = reviewVersion ?? "";
  const reviewStatus = existingReview?.status ?? "pending";
  const reviewTone =
    reviewStatus === "verified"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : reviewStatus === "not_verified"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : reviewStatus === "needs_followup"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-slate-200 bg-slate-100 text-slate-700";
  const reviewSummary =
    reviewStatus === "verified"
      ? "Judged satisfied with a supporting trace."
      : reviewStatus === "not_verified"
        ? "Judged not satisfied with recorded support."
        : reviewStatus === "needs_followup"
          ? "Follow-up is still needed before a final judgment."
          : "No judgment recorded yet.";
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
        className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-[28px] border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-100 bg-white/95 px-6 py-5 backdrop-blur">
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Rule review</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Rule {displayRuleId}</h2>
            <div className="mt-2 max-w-2xl text-sm leading-6 text-slate-800">
              {ruleText?.trim() || row.ruleSummary.summary || row.ruleSummary.snippet}
            </div>
            <div className="mt-2 text-sm text-slate-600">
              {methodologyLabel?.trim() || sourcePath?.trim() || "Methodology rule detail"}
            </div>
            {canonicalRuleId?.trim() && canonicalRuleId.trim() !== row.ruleId ? (
              <div className="mt-2 font-mono text-[11px] text-slate-400">{canonicalRuleId.trim()}</div>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${reviewTone}`}>
                {statusLabel(reviewStatus)}
              </span>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${status.tone}`}>
                {status.label}
              </span>
              {categoryLabel ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold capitalize text-slate-700">
                  {categoryLabel}
                </span>
              ) : null}
            </div>
            <div className="mt-2 text-sm text-slate-600">{reviewSummary}</div>
          </div>
          <div className="flex items-center gap-2">
            {reviewReady ? (
              <button
                type="button"
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  existingReview
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
                onClick={() => setReviewOpen((current) => !current)}
              >
                {reviewOpen ? "Hide review" : existingReview ? `Review (${existingReview.status})` : "Review"}
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        <div className="px-6 py-6">
          {reviewOpen && reviewReady ? (
            <RuleReviewPanel
              key={`${reviewRuleId}:${reviewMethodologyValue}:${reviewVersionValue}`}
              ruleId={reviewRuleId}
              ruleText={ruleText?.trim() || row.ruleSummary.summary || row.ruleSummary.snippet}
              sectionId={row.provenance.sectionId ?? undefined}
              methodology={reviewMethodologyValue}
              version={reviewVersionValue}
              anchorUrl={row.provenance.anchor ?? undefined}
              existingReview={existingReview}
              linkedEvidence={row.linkedEvidence.map((item) => ({
                id: item.fragmentId ?? item.id,
                title: evidencePrimaryLabel(item),
                type: item.type,
                meta: formatPddLinkedEvidenceMeta(item),
                excerpt: item.excerpt ?? null,
              }))}
              emptyEvidenceHint={unresolvedNextStep(row)}
              ruleLogic={ruleLogic?.trim() || row.ruleSummary.logic || null}
              ruleNotes={ruleNotes?.trim() || row.ruleSummary.notes || null}
              ruleWhen={renderedWhen ?? null}
              expectedEvidence={row.expectedEvidenceTypes.map((type) => EXPECTED_EVIDENCE_LABELS[type] ?? type)}
              sourcePath={sourcePath ?? null}
              sha256={sha256 ?? null}
              ruleTags={ruleTags}
              stacItems={stacItems}
              hasAoi={hasAoi}
              onSave={handleSaveReview}
              onReviewChange={handleReviewChange}
            />
          ) : (
            <div className="grid gap-4">
              <section className="rounded-3xl border border-slate-200/90 bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">Current support picture</div>
                <div className="mt-2.5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-start gap-2.5">
                    {reconciliation.status === "supported" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    ) : reconciliation.status === "missing-evidence" ? (
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    )}
                    <div className="min-w-0">
                      <div className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${reconciliationMeta.tone}`}>
                        {reconciliationMeta.label}
                      </div>
                      <div className="mt-2 text-sm text-slate-700">{reconciliation.reason}</div>
                    </div>
                  </div>
                </div>
              </section>

              <details className="group rounded-3xl border border-slate-200/90 bg-white p-4 shadow-sm" open>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-700 marker:hidden">
                  <span>Method detail</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-4 grid gap-4 text-sm text-slate-700">
                  {ruleLogic?.trim() || row.ruleSummary.logic ? (
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Scale className="h-4 w-4 text-slate-500" />
                        <span>Logic</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap leading-7 text-slate-800">
                        {ruleLogic?.trim() || row.ruleSummary.logic}
                      </p>
                    </div>
                  ) : null}
                  {renderedWhen?.length ? (
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Conditions</div>
                      <ul className="mt-2 grid gap-1.5 text-sm text-slate-800">
                        {renderedWhen.map((item) => (
                          <li key={item} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {ruleNotes?.trim() || row.ruleSummary.notes ? (
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Notes</div>
                      <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                          {ruleNotes?.trim() || row.ruleSummary.notes}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </details>
            </div>
          )}

          {!reviewOpen ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]">
            <section className="rounded-3xl border border-slate-200/90 bg-white p-3.5 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Reconciliation</div>
              <div className="mt-2.5 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="flex items-start gap-2.5">
                  {reconciliation.status === "supported" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : reconciliation.status === "missing-evidence" ? (
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  )}
                  <div className="min-w-0">
                    <div className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${reconciliationMeta.tone}`}>
                      {reconciliationMeta.label}
                    </div>
                    <div className="mt-1.5 text-sm font-medium text-slate-900">
                      {reconciliation.status === "supported" ? "Rule is supported" : reconciliation.status === "missing-evidence" ? "Evidence is still missing" : "Needs reconciliation"}
                    </div>
                    <div className="mt-1 text-sm text-slate-700">{reconciliation.reason}</div>
                  </div>
                </div>
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

            <section className="rounded-3xl border border-slate-200/90 bg-white p-3.5 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Expected evidence</div>
              <div className="mt-2.5 text-sm text-slate-700">
                {row.expectedEvidenceTypes.length ? (
                  <ul className="grid gap-2">
                    {row.expectedEvidenceTypes.map((type) => (
                      <li key={type} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                        {EXPECTED_EVIDENCE_LABELS[type] ?? type}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                    <div className="flex items-start gap-2.5">
                      <FileSearch className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <div>
                        <div className="font-medium text-slate-900">No expected evidence defined</div>
                        <div className="mt-1 text-sm text-slate-600">
                          This rule does not specify methodology-owned expected evidence types.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200/90 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Linked evidence</div>
              <div className="mt-2.5 text-sm text-slate-700">
                {row.linkedEvidence.length ? (
                  <ul className="grid gap-2.5">
                    {row.linkedEvidence.map((item) => (
                      <li key={`${item.source}:${item.id}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            {(() => {
                              const Icon = evidenceKindIcon(item);
                              return <Icon className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />;
                            })()}
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-slate-900">{evidencePrimaryLabel(item)}</div>
                              {evidenceSecondaryLabel(item) ? (
                                <div className="mt-1 text-xs text-slate-600">{evidenceSecondaryLabel(item)}</div>
                              ) : null}
                            </div>
                          </div>
                          {item.fragmentId ? (
                            <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
                              Fragment
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2.5 font-mono text-[11px] text-slate-500">
                          {item.fragmentId ? item.fragmentId : formatEvidenceInventoryId(item.id)}
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700">
                            {item.type}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 capitalize">
                            {item.source}
                          </span>
                        </div>
                        {formatPddLinkedEvidenceMeta(item) ? (
                          <div className="mt-2.5 text-xs text-slate-600">{formatPddLinkedEvidenceMeta(item)}</div>
                        ) : null}
                        {item.excerpt ? (
                          <div className="mt-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs leading-6 text-slate-700">
                            {item.excerpt}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                    <div>Requirement is unresolved. No linked evidence yet.</div>
                    <div className="mt-2 text-xs font-semibold text-amber-800">
                      {unresolvedNextStep(row)}
                    </div>
                  </div>
                )}
                <div className="mt-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
                  {status.description}
                </div>
              </div>
            </section>

            <details className="group rounded-3xl border border-slate-200/90 bg-white p-4 text-xs text-slate-600 shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-700 marker:hidden">
                <span>Methodology provenance</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                <div className="font-medium text-slate-900">
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
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => primarySourceSectionId && onOpenSourceContext(primarySourceSectionId)}
                    disabled={!primarySourceSectionId}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Open source context
                  </button>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <div className="text-sm font-semibold text-slate-700">Audit details</div>
                <div className="mt-3 space-y-3">
                  {canonicalRuleId?.trim() ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-slate-700">Canonical rule id</span>
                      <span className="break-all font-mono text-slate-700">{canonicalRuleId.trim()}</span>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-700">Source path</span>
                    <span className="break-all font-mono text-slate-700">{sourcePath ?? "—"}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-700">sha256</span>
                    <span className="break-all font-mono text-slate-700">{sha256 ?? "—"}</span>
                  </div>
                </div>
              </div>
            </details>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
