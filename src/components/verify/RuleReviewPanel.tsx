"use client";

import { useCallback, useMemo, useState } from "react";
import {
  addEvidenceAttachment,
  removeEvidenceAttachment,
  saveReview,
  type EvidenceAttachment,
  type ReviewStatus,
  type RuleReview,
} from "@/lib/verify/reviewStore";
import {
  validateReview,
  statusLabel,
} from "@/lib/verify/reviewValidation";
import { getAuditTrailForRule, logAuditEvent, type AuditEvent } from "@/lib/verify/auditTrail";
import { isStacEligible, stacEligibilityReason } from "@/lib/verify/stacEligibility";
import { extractStacSupportFacts } from "@/lib/verify/stacSupportFacts";
import StacSupportSection from "@/components/verify/StacSupportSection";

type RuleReviewPanelProps = {
  ruleId: string;
  ruleText: string;
  sectionId?: string;
  methodology: string;
  version: string;
  anchorUrl?: string;
  existingReview: RuleReview | null;
  linkedEvidence?: Array<{
    id: string;
    title: string;
    type: string;
    meta?: string | null;
    excerpt?: string | null;
  }>;
  emptyEvidenceHint?: string;
  ruleLogic?: string | null;
  ruleNotes?: string | null;
  ruleWhen?: string[] | null;
  expectedEvidence?: string[];
  sourcePath?: string | null;
  sha256?: string | null;
  ruleTags?: string[];
  stacItems?: Array<{
    id: string;
    datetime?: string;
    cloud_cover?: number | null;
    collection?: string;
    bbox?: [number, number, number, number];
  }>;
  hasAoi?: boolean;
  onSave: (review: RuleReview) => void;
  onReviewChange?: (review: RuleReview) => void;
};

const STATUSES: ReviewStatus[] = [
  "pending",
  "verified",
  "not_verified",
  "needs_followup",
];

export default function RuleReviewPanel({
  ruleId,
  ruleText,
  sectionId,
  methodology,
  version,
  anchorUrl,
  existingReview,
  linkedEvidence = [],
  emptyEvidenceHint = "No linked evidence yet. Add the best supporting trace before recording a final judgment.",
  ruleLogic,
  ruleNotes,
  ruleWhen,
  expectedEvidence = [],
  sourcePath,
  sha256,
  ruleTags = [],
  stacItems = [],
  hasAoi = false,
  onSave,
  onReviewChange,
}: RuleReviewPanelProps) {
  const [status, setStatus] = useState<ReviewStatus>(
    existingReview?.status ?? "pending",
  );
  const [rationale, setRationale] = useState(
    existingReview?.rationale ?? "",
  );
  const [supportReference, setSupportReference] = useState(
    existingReview?.supportReference ?? "",
  );
  const [evidenceLink, setEvidenceLink] = useState(
    existingReview?.evidenceLink ?? "",
  );
  const [attachments, setAttachments] = useState<EvidenceAttachment[]>(
    existingReview?.evidenceAttachments ?? [],
  );
  const [attachmentType, setAttachmentType] = useState<EvidenceAttachment["type"]>("url");
  const [attachmentLabel, setAttachmentLabel] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(
    getAuditTrailForRule(ruleId, methodology, version).slice(-5).reverse(),
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const stacEligible = isStacEligible(ruleTags);
  const stacReason = stacEligibilityReason(ruleTags);
  const stacSummary = stacEligible ? extractStacSupportFacts(stacItems) : null;
  const reviewExplanation = useMemo(() => {
    switch (status) {
      case "verified":
        return "This rule is judged satisfied. Record why and cite the supporting trace.";
      case "not_verified":
        return "This rule is judged not satisfied. Record the gap and point to the supporting trace.";
      case "needs_followup":
        return "This rule still needs follow-up. Record what is unclear and what support is missing.";
      default:
        return "No judgment recorded yet. Start with a status, then explain the reason and cite support.";
    }
  }, [status]);
  const statusTone = useMemo(() => {
    switch (status) {
      case "verified":
        return {
          chip: "border-emerald-200 bg-emerald-50 text-emerald-700",
          button: "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm",
        };
      case "not_verified":
        return {
          chip: "border-rose-200 bg-rose-50 text-rose-700",
          button: "border-rose-500 bg-rose-50 text-rose-700 shadow-sm",
        };
      case "needs_followup":
        return {
          chip: "border-amber-200 bg-amber-50 text-amber-700",
          button: "border-amber-500 bg-amber-50 text-amber-700 shadow-sm",
        };
      default:
        return {
          chip: "border-slate-200 bg-slate-100 text-slate-700",
          button: "border-slate-500 bg-slate-100 text-slate-700 shadow-sm",
        };
    }
  }, [status]);
  const actorLabel = existingReview?.reviewedBy?.trim() || "local-reviewer";

  const refreshAuditEvents = useCallback(() => {
    setAuditEvents(getAuditTrailForRule(ruleId, methodology, version).slice(-5).reverse());
  }, [methodology, ruleId, version]);

  const syncReview = useCallback(
    (review: RuleReview) => {
      setAttachments(review.evidenceAttachments ?? []);
      onReviewChange?.(review);
    },
    [onReviewChange],
  );

  const handleSave = useCallback(() => {
    const review: RuleReview = {
      ruleId,
      methodology,
      version,
      status,
      rationale,
      supportReference,
      evidenceLink: evidenceLink || undefined,
      evidenceAttachments: attachments,
      reviewedBy: existingReview?.reviewedBy ?? "local-reviewer",
      reviewedAt: existingReview?.reviewedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const validationErrors = validateReview(review);
    if (validationErrors.length > 0) {
      setErrors(validationErrors.map((e) => e.message));
      return;
    }

    setErrors([]);
    onSave(review);
    refreshAuditEvents();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [
    ruleId,
    methodology,
    version,
    status,
    rationale,
    supportReference,
    evidenceLink,
    attachments,
    existingReview,
    onSave,
    refreshAuditEvents,
  ]);

  const handleAddAttachment = useCallback(() => {
    const trimmedLabel = attachmentLabel.trim();
    const trimmedUrl = attachmentUrl.trim();
    if (!trimmedLabel) return;
    if (attachmentType === "url" && !trimmedUrl) return;

    if (!existingReview) {
      const seededReview: RuleReview = {
        ruleId,
        methodology,
        version,
        status,
        rationale,
        supportReference,
        evidenceLink: evidenceLink || undefined,
        evidenceAttachments: attachments,
        reviewedBy: actorLabel,
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveReview(seededReview);
      syncReview(seededReview);
    }

    const review = addEvidenceAttachment(ruleId, methodology, version, {
      type: attachmentType,
      label: trimmedLabel,
      url: attachmentType === "url" ? trimmedUrl : undefined,
    });
    if (!review) return;

    logAuditEvent({
      ruleId,
      methodology,
      version,
      action: "evidence_added",
      evidenceId: review.evidenceAttachments[review.evidenceAttachments.length - 1]?.id,
      actor: actorLabel,
      note:
        attachmentType === "url"
          ? `Added ${attachmentType} attachment: ${trimmedLabel} (${trimmedUrl})`
          : `Added ${attachmentType} attachment: ${trimmedLabel}`,
    });
    setAttachmentLabel("");
    setAttachmentUrl("");
    syncReview(review);
    refreshAuditEvents();
  }, [
    actorLabel,
    attachmentLabel,
    attachmentType,
    attachmentUrl,
    attachments,
    evidenceLink,
    existingReview,
    methodology,
    rationale,
    refreshAuditEvents,
    ruleId,
    status,
    supportReference,
    syncReview,
    version,
  ]);

  const handleFileSelected = useCallback(
    (file: File | null) => {
      if (!file) return;
      setAttachmentType("file");
      setAttachmentLabel(file.name);
      setAttachmentUrl("");
    },
    [],
  );

  const handleRemoveAttachment = useCallback(
    (attachment: EvidenceAttachment) => {
      const review = removeEvidenceAttachment(ruleId, methodology, version, attachment.id);
      if (!review) return;
      logAuditEvent({
        ruleId,
        methodology,
        version,
        action: "evidence_removed",
        evidenceId: attachment.id,
        actor: actorLabel,
        note: `Removed ${attachment.type} attachment: ${attachment.label}`,
      });
      syncReview(review);
      refreshAuditEvents();
    },
    [actorLabel, methodology, refreshAuditEvents, ruleId, syncReview, version],
  );

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Review record
            </div>
            <div className="max-w-2xl text-sm leading-6 text-slate-900">{ruleText}</div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                {methodology} · {version}
              </span>
              {sectionId ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                  Section {sectionId}
                </span>
              ) : null}
              {anchorUrl ? (
                <a
                  href={anchorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700 hover:border-slate-300 hover:text-slate-900"
                >
                  Open source
                </a>
              ) : null}
            </div>
          </div>
          <div className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${statusTone.chip}`}>
            {statusLabel(status)}
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-slate-600">{reviewExplanation}</p>
      </div>

      <div className="grid gap-6 px-5 py-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <div className="space-y-5">
          <section className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Current judgment
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {STATUSES.map((s) => {
                const isActive = status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                      isActive
                        ? statusTone.button
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <div className="font-semibold">{statusLabel(s)}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {s === "pending"
                        ? "No judgment yet"
                        : s === "verified"
                          ? "Satisfied with support"
                          : s === "not_verified"
                            ? "Not satisfied"
                            : "Needs follow-up"}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-4">
            <div className="grid gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Why this judgment {status !== "pending" ? <span className="text-rose-500">*</span> : null}
              </label>
              <textarea
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder="State the reviewer’s reason in plain language."
                rows={4}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>

            <div className="grid gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Supporting trace {status !== "pending" ? <span className="text-rose-500">*</span> : null}
              </label>
              <input
                type="text"
                value={supportReference}
                onChange={(e) => setSupportReference(e.target.value)}
                placeholder="Cite the best supporting trace: section, fragment, scene, workbook cell, or note."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>

            <div className="grid gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Evidence link
              </label>
              <input
                type="text"
                value={evidenceLink}
                onChange={(e) => setEvidenceLink(e.target.value)}
                placeholder="Optional link to the supporting document, upload, or external trace."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>

            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Evidence attachments
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Save URL, file-name, or reference attachments as supporting traces for this rule.
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)_auto]">
                <select
                  value={attachmentType}
                  onChange={(event) => setAttachmentType(event.target.value as EvidenceAttachment["type"])}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                >
                  <option value="url">URL</option>
                  <option value="file">File</option>
                  <option value="reference">Reference</option>
                </select>
                {attachmentType === "file" ? (
                  <input
                    type="file"
                    onChange={(event) => handleFileSelected(event.target.files?.[0] ?? null)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 file:mr-3 file:rounded-full file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                  />
                ) : (
                  <input
                    type="text"
                    value={attachmentLabel}
                    onChange={(event) => setAttachmentLabel(event.target.value)}
                    placeholder={attachmentType === "reference" ? "Reference label" : "Attachment label"}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                )}
                <input
                  type="text"
                  value={attachmentUrl}
                  onChange={(event) => setAttachmentUrl(event.target.value)}
                  disabled={attachmentType !== "url"}
                  placeholder={attachmentType === "url" ? "https://…" : attachmentType === "file" ? "Stored as file name only" : "Optional location or note"}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                />
                <button
                  type="button"
                  onClick={handleAddAttachment}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900"
                >
                  Add
                </button>
              </div>

              {attachments.length ? (
                <ul className="grid gap-2">
                  {attachments.map((attachment) => (
                    <li key={attachment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900">{attachment.label}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {attachment.type}
                          {attachment.url ? ` · ${attachment.url}` : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(attachment)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-3 text-sm text-slate-500">
                  No attachments saved yet.
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Supporting context
            </div>
            {linkedEvidence.length ? (
              <div className="mt-3 space-y-3">
                <div className="text-sm font-medium text-slate-900">
                  Best trace available
                </div>
                {linkedEvidence.slice(0, 2).map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.type}</div>
                    {item.meta ? <div className="mt-2 text-xs text-slate-600">{item.meta}</div> : null}
                    {item.excerpt ? (
                      <div className="mt-2 text-sm leading-6 text-slate-700">{item.excerpt}</div>
                    ) : null}
                  </div>
                ))}
                {linkedEvidence.length > 2 ? (
                  <div className="text-xs text-slate-500">
                    {linkedEvidence.length - 2} more linked evidence item{linkedEvidence.length - 2 === 1 ? "" : "s"} available in detail.
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
                <div className="font-medium text-slate-900">No linked evidence yet</div>
                <div className="mt-1">{emptyEvidenceHint}</div>
              </div>
            )}
          </section>

          {existingReview ? (
            <div className="text-xs text-slate-500">
              Reviewed by {existingReview.reviewedBy} · {new Date(existingReview.updatedAt).toLocaleString()}
            </div>
          ) : null}

          <section className="rounded-[20px] border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Recent audit
            </div>
            {auditEvents.length ? (
              <ul className="mt-3 grid gap-2">
                {auditEvents.map((event, index) => (
                  <li key={`${event.timestamp}:${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <div className="text-xs font-semibold text-slate-700">{event.action.replaceAll("_", " ")}</div>
                    <div className="mt-1 text-xs text-slate-600">
                      {event.note ?? `${event.actor} · ${new Date(event.timestamp).toLocaleString()}`}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                No audit events for this rule yet.
              </div>
            )}
          </section>

          <StacSupportSection
            eligible={stacEligible}
            eligibilityReason={stacReason}
            summary={stacSummary}
            hasAoi={hasAoi}
          />
        </aside>
      </div>

      {errors.length > 0 ? (
        <div className="mx-5 mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
          {errors.map((err, i) => (
            <div key={i} className="text-sm text-rose-700">
              {err}
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
        <div className="text-xs text-slate-500">
          Non-pending decisions require both a reason and a supporting trace.
        </div>
        <button
          type="button"
          onClick={handleSave}
          className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
            saved
              ? "bg-emerald-600 text-white"
              : "bg-slate-900 text-white hover:bg-slate-700"
          }`}
        >
          {saved ? "Saved" : "Save review"}
        </button>
      </div>

      <details className="group border-t border-slate-100 px-5 py-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-700 marker:hidden">
          <span>Rule detail and provenance</span>
          <span className="text-xs font-medium text-slate-400 group-open:hidden">Show</span>
          <span className="text-xs font-medium text-slate-400 hidden group-open:inline">Hide</span>
        </summary>
        <div className="mt-4 grid gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Full rule text</div>
            <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{ruleText}</div>
          </div>

          {ruleLogic ? (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Logic</div>
              <div className="mt-2 text-sm leading-6 text-slate-700">{ruleLogic}</div>
            </div>
          ) : null}

          {ruleWhen?.length ? (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Conditions</div>
              <ul className="mt-2 grid gap-2 text-sm text-slate-700">
                {ruleWhen.map((item) => (
                  <li key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {expectedEvidence.length ? (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Expected evidence</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {expectedEvidence.map((item) => (
                  <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {ruleNotes ? (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Notes</div>
              <div className="mt-2 text-sm leading-6 text-slate-700">{ruleNotes}</div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
              {methodology} · {version}
            </span>
            {sectionId ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                Section {sectionId}
              </span>
            ) : null}
            {sourcePath ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono">
                {sourcePath}
              </span>
            ) : null}
            {sha256 ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono">
                {sha256}
              </span>
            ) : null}
          </div>
        </div>
      </details>
    </section>
  );
}
