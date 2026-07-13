"use client";

import { useCallback, useEffect, useState } from "react";
import EvidenceMapReviewPanel from "@/components/preverif/evidence-map/EvidenceMapReviewPanel";
import EvidenceMapWorkspace from "@/components/preverif/evidence-map/EvidenceMapWorkspace";
import { loadVm0007EvidenceMapDraft } from "@/lib/preverif/vm0007EvidenceMapDraftStore";
import type { Vm0007EvidenceMapDraftPackage, Vm0007EvidenceMapDraftRow } from "@/lib/preverif/vm0007EvidenceMapDraft";
import { approveVm0007EvidenceMapRow, editVm0007EvidenceMapRow, finalizeVm0007EvidenceMap, reopenVm0007EvidenceMapRow, type Vm0007EvidenceMapEdit } from "@/lib/preverif/vm0007EvidenceMapReview";

export default function Vm0007EvidenceMapDraftPage({ auditId }: { auditId: string }) {
  const [pkg, setPkg] = useState<Vm0007EvidenceMapDraftPackage | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reviewRowId, setReviewRowId] = useState<string | null>(null);
  useEffect(() => setPkg(loadVm0007EvidenceMapDraft(auditId)), [auditId]);

  const closeReview = useCallback(() => setReviewRowId(null), []);
  if (!pkg) return <main className="min-h-screen bg-slate-50 p-8"><div className="mx-auto max-w-4xl rounded-xl border border-amber-200 bg-white p-6 text-amber-900">Evidence Map is not available for this audit. Only a valid VM0007 v1.8 draft can be opened.</div></main>;

  const finalize = () => {
    const result = finalizeVm0007EvidenceMap(pkg, "reviewer:local");
    if (result.ok) { setPkg(result.package); setMessage("Evidence Map finalized. The readiness report is now available."); }
    else setMessage(`Finalization blocked: ${result.blockedBy.join("; ")}`);
  };
  const transition = (rowId: string, action: "approve" | "reopen", note: string): string | null => {
    const result = action === "approve" ? approveVm0007EvidenceMapRow(pkg, rowId, "reviewer:local", note) : reopenVm0007EvidenceMapRow(pkg, rowId, "reviewer:local", note);
    if (!result.ok) return `Review action blocked: ${result.reason}`;
    setPkg(result.package);
    setMessage(`Row ${rowId} is now ${result.row.reviewState}.`);
    setReviewRowId(null);
    return null;
  };
  const edit = (rowId: string, change: Vm0007EvidenceMapEdit, note: string): string | null => {
    const result = editVm0007EvidenceMapRow(pkg, rowId, change, "reviewer:local", note);
    if (!result.ok) return `Review action blocked: ${result.reason}`;
    setPkg(result.package);
    setMessage(`Reviewer decision saved for ${rowId}. Approve the row to continue.`);
    return null;
  };
  const reviewRow: Vm0007EvidenceMapDraftRow | null = pkg.rows.find((row) => row.rowId === reviewRowId) ?? null;
  return <>
    <EvidenceMapWorkspace pkg={pkg} message={message} onFinalize={finalize} onReview={(row) => setReviewRowId(row.rowId)} />
    <EvidenceMapReviewPanel row={reviewRow} finalized={pkg.finalizationState === "finalized"} onClose={closeReview} onEdit={(change, note) => reviewRow ? edit(reviewRow.rowId, change, note) : "Row not found."} onApprove={(note) => reviewRow ? transition(reviewRow.rowId, "approve", note) : "Row not found."} onReopen={(note) => reviewRow ? transition(reviewRow.rowId, "reopen", note) : "Row not found."} />
  </>;
}
