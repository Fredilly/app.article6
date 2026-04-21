"use client";

import { useState } from "react";
import { type RuleReview } from "@/lib/verify/reviewStore";
import { validateReview, statusLabel } from "@/lib/verify/reviewValidation";
import { type DocumentSupportEntry } from "@/lib/verify/documentSupport";
import { ExternalLink } from "lucide-react";

type RuleReviewPanelProps = {
  ruleId: string;
  ruleText: string;
  sectionId?: string;
  methodology: string;
  version: string;
  anchorUrl?: string;
  existingReview?: RuleReview | null;
  onSave: (review: RuleReview) => void;
  // added props for audit-grade alignment
  ruleTags?: string[];
  sha256: string | null;
  // compatibility with RuleDetailModal
  linkedEvidence?: Array<{
    id: string;
    title: string;
    type: string;
    meta: string | null;
    excerpt: string | null;
  }>;
  emptyEvidenceHint?: string;
  ruleLogic?: string | null;
  ruleNotes?: string | null;
  ruleWhen?: string[] | null;
  expectedEvidence?: string[];
  stacItems?: Array<{
    id: string;
    datetime?: string;
    cloud_cover?: number | null;
    collection?: string;
    bbox?: [number, number, number, number];
  }>;
  hasAoi?: boolean;
  documentSupport?: DocumentSupportEntry[];
  sourcePath?: string | null;
  onReviewChange?: (review: RuleReview) => void;
};

export default function RuleReviewPanel(props: RuleReviewPanelProps) {
  const {
    ruleId,
    ruleText,
    sectionId,
    methodology,
    version,
    anchorUrl,
    existingReview,
    onSave,
    sha256,
    onReviewChange,
  } = props;
  const [status, setStatus] = useState<RuleReview["status"]>(
    existingReview?.status ?? "pending"
  );
  const [rationale, setRationale] = useState(existingReview?.rationale ?? "");
  const [supportReference, setSupportReference] = useState(
    existingReview?.supportReference ?? ""
  );
  const [evidenceLink, setEvidenceLink] = useState(
    existingReview?.evidenceLink ?? ""
  );
  const [reviewerName] = useState(
    existingReview?.reviewedBy ?? "Agent (Auto-Review)"
  );

  const { valid, errors } = validateReview({
    status,
    rationale,
    supportReference,
  });

  const handleSave = () => {
    if (!valid) return;

    const now = new Date().toISOString();
    const review: RuleReview = {
      ruleId,
      methodology,
      version,
      status,
      rationale,
      supportReference,
      evidenceLink,
      evidenceAttachments: existingReview?.evidenceAttachments ?? [],
      reviewedBy: reviewerName,
      reviewedAt: existingReview?.reviewedAt ?? now,
      updatedAt: now,
    };

    onSave(review);
    if (onReviewChange) onReviewChange(review);
  };

  const statusOptions: RuleReview["status"][] = [
    "pending",
    "verified",
    "not_verified",
    "needs_followup",
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-300">
      {/* Rule Text Header - Audit Grade Context */}
      <section className="space-y-3">
        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Source Requirement
        </label>
        <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 font-mono text-sm leading-relaxed text-slate-800">
          {ruleText}
        </div>
        <div className="flex flex-wrap items-center gap-6 text-[10px] text-slate-500 uppercase tracking-tight">
          {sectionId && (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-400">Section:</span>
              <span className="font-mono text-slate-700">{sectionId}</span>
            </div>
          )}
          {sha256 && (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-400">SHA256:</span>
              <span className="font-mono text-slate-700">{sha256.slice(0, 12)}...</span>
            </div>
          )}
          {anchorUrl && (
            <a
              href={anchorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 transition"
            >
              <ExternalLink size={10} />
              <span>Verify PDF Source</span>
            </a>
          )}
        </div>
      </section>

      {/* Review Fields */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Verification Status
            </label>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setStatus(opt)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-all border ${
                    status === opt
                      ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {statusLabel(opt)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Support Reference
            </label>
            <input
              type="text"
              value={supportReference}
              onChange={(e) => setSupportReference(e.target.value)}
              placeholder="e.g., Monitoring Plan v1.2, Sec 4.1"
              className="w-full px-4 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
            />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
               Evidence Link (Optional)
            </label>
            <input
              type="text"
              value={evidenceLink}
              onChange={(e) => setEvidenceLink(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Audit Rationale
          </label>
          <textarea
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            rows={8}
            placeholder="Explain how the requirement was satisfied based on provided documentation..."
            className="w-full px-4 py-3 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition resize-none"
          />
        </div>
      </section>

      {/* Reserved Evidence Area (Phase 2+) */}
      <div className="rounded-xl border-2 border-dashed border-slate-100 p-8 text-center bg-slate-50/20">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
          Linked Evidence Support — Coming Soon
        </p>
      </div>

      <footer className="flex items-center justify-between pt-6 border-t border-slate-100">
        <div className="text-[10px] font-mono text-slate-400 space-y-1">
          <p>REVIEWER: {reviewerName}</p>
          {existingReview && (
             <p>LAST UPDATED: {new Date(existingReview.updatedAt).toLocaleString()}</p>
          )}
        </div>
        
        <div className="flex items-center gap-4">
           {errors.length > 0 && status !== 'pending' && (
             <span className="text-[10px] font-semibold text-rose-500 uppercase">Required fields missing</span>
           )}
           <button
            type="button"
            onClick={handleSave}
            disabled={!valid || (status !== 'pending' && !existingReview && rationale === "" && supportReference === "")}
            className={`px-8 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
              valid 
                ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md active:scale-95"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
          >
            Finalize Review
          </button>
        </div>
      </footer>
    </div>
  );
}
