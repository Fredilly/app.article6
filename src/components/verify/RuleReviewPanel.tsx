"use client";

import { useState, useCallback } from "react";
import type { ReviewStatus, RuleReview } from "@/lib/verify/reviewStore";
import {
  validateReview,
  statusLabel,
  statusColor,
} from "@/lib/verify/reviewValidation";

type RuleReviewPanelProps = {
  ruleId: string;
  ruleText: string;
  sectionId?: string;
  methodology: string;
  version: string;
  anchorUrl?: string;
  existingReview: RuleReview | null;
  onSave: (review: RuleReview) => void;
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
  onSave,
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
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(() => {
    const review: RuleReview = {
      ruleId,
      methodology,
      version,
      status,
      rationale,
      supportReference,
      evidenceLink: evidenceLink || undefined,
      reviewedBy: existingReview?.reviewedBy ?? "reviewer",
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
    existingReview,
    onSave,
  ]);

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      {/* Rule text */}
      <div className="mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Rule text
        </div>
        <div className="mt-1 break-words text-sm leading-relaxed text-slate-800">
          {ruleText}
        </div>
        {sectionId ? (
          <div className="mt-1 text-xs text-slate-500">
            Section {sectionId}
            {anchorUrl ? (
              <>
                {" "}
                ·{" "}
                <a
                  href={anchorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-700 underline hover:text-slate-900"
                >
                  Open source
                </a>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Status selector */}
      <div className="mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Status
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {STATUSES.map((s) => {
            const isActive = status === s;
            const c = statusColor(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? `border-${c}-500 bg-${c}-50 text-${c}-700`
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {statusLabel(s)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rationale */}
      <div className="mb-4">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Rationale{" "}
          {status !== "pending" ? (
            <span className="text-red-500">*</span>
          ) : null}
        </label>
        <textarea
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Explain why this rule passes or fails based on the evidence..."
          rows={3}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
      </div>

      {/* Support reference */}
      <div className="mb-4">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Support reference{" "}
          {status !== "pending" ? (
            <span className="text-red-500">*</span>
          ) : null}
        </label>
        <input
          type="text"
          value={supportReference}
          onChange={(e) => setSupportReference(e.target.value)}
          placeholder="e.g., Monitoring Report Section 3.2, STAC scene S2A_20240115..."
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
      </div>

      {/* Evidence link */}
      <div className="mb-4">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Evidence link
        </label>
        <input
          type="text"
          value={evidenceLink}
          onChange={(e) => setEvidenceLink(e.target.value)}
          placeholder="URL to supporting document or upload"
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
      </div>

      {/* Reserved STAC evidence area */}
      <div className="mb-4 rounded-lg border border-dashed border-slate-300 bg-white/50 px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Evidence support — coming soon
        </div>
        <div className="mt-1 text-xs text-slate-400">
          STAC satellite facts and linked evidence will appear here.
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          {errors.map((err, i) => (
            <div key={i} className="text-xs text-red-700">
              {err}
            </div>
          ))}
        </div>
      ) : null}

      {/* Provenance footer */}
      {existingReview ? (
        <div className="mb-4 text-[11px] text-slate-400">
          Reviewed by {existingReview.reviewedBy} ·{" "}
          {new Date(existingReview.updatedAt).toLocaleString()}
        </div>
      ) : null}

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
          saved
            ? "bg-emerald-600 text-white"
            : "bg-slate-900 text-white hover:bg-slate-700"
        }`}
      >
        {saved ? "Saved" : "Save review"}
      </button>
    </div>
  );
}
