"use client";

import { useCallback, useEffect, useState } from "react";
import EvidenceMapReviewPanel from "@/components/preverif/evidence-map/EvidenceMapReviewPanel";
import EvidenceMapWorkspace from "@/components/preverif/evidence-map/EvidenceMapWorkspace";
import { loadVm0007EvidenceMapDraft } from "@/lib/preverif/vm0007EvidenceMapDraftStore";
import type {
  Vm0007EvidenceMapDraftPackage,
  Vm0007EvidenceMapDraftRow,
} from "@/lib/preverif/vm0007EvidenceMapDraft";
import {
  approveVm0007EvidenceMapRow,
  acceptVm0007EvidenceRecord,
  editVm0007EvidenceMapRow,
  finalizeVm0007EvidenceMap,
  rejectVm0007EvidenceRecord,
  reopenVm0007EvidenceMapRow,
  type Vm0007EvidenceMapEdit,
} from "@/lib/preverif/vm0007EvidenceMapReview";
import { matchesReviewedEvidenceMapCase } from "@/lib/preverif/reviewedEvidenceMapRegistry";
import type { ReviewedEvidenceMapSnapshot } from "@/lib/preverif/reviewedEvidenceMapTypes";
import type { EvidenceMapMode } from "@/components/preverif/evidence-map/evidenceMapPresentationModel";

export default function Vm0007EvidenceMapDraftPage({
  auditId,
  reviewedCandidate = null,
  reviewedCandidates = [],
}: {
  auditId: string;
  reviewedCandidate?: ReviewedEvidenceMapSnapshot | null;
  reviewedCandidates?: readonly ReviewedEvidenceMapSnapshot[];
}) {
  const [pkg, setPkg] = useState<Vm0007EvidenceMapDraftPackage | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reviewRowId, setReviewRowId] = useState<string | null>(null);
  const [mode, setMode] = useState<EvidenceMapMode>("reviewed");
  useEffect(() => {
    setPkg(loadVm0007EvidenceMapDraft(auditId));
    setLoaded(true);
  }, [auditId]);

  const closeReview = useCallback(() => setReviewRowId(null), []);
  const reviewedSnapshot = pkg
    ? (reviewedCandidates.find((candidate) =>
        matchesReviewedEvidenceMapCase(pkg, candidate),
      ) ??
      (reviewedCandidate &&
      matchesReviewedEvidenceMapCase(pkg, reviewedCandidate)
        ? reviewedCandidate
        : null))
    : reviewedCandidate;
  if (!loaded)
    return <main className="min-h-screen bg-slate-50" aria-busy="true" />;
  if (!pkg && !reviewedSnapshot)
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-4xl rounded-xl border border-amber-200 bg-white p-6 text-amber-900">
          Evidence Map is not available for this audit. Only a valid VM0007 v1.8
          draft can be opened.
        </div>
      </main>
    );

  const finalize = () => {
    if (!pkg) return;
    const result = finalizeVm0007EvidenceMap(pkg, "reviewer:local");
    if (result.ok) {
      setPkg(result.package);
      setMessage(
        "Evidence Map finalized. The readiness report is now available.",
      );
    } else setMessage(`Finalization blocked: ${result.blockedBy.join("; ")}`);
  };
  const transition = (
    rowId: string,
    action: "approve" | "reopen",
    note: string,
  ): string | null => {
    if (!pkg)
      return "Machine proposal is not available for this reviewed snapshot.";
    const result =
      action === "approve"
        ? approveVm0007EvidenceMapRow(pkg, rowId, "reviewer:local", note)
        : reopenVm0007EvidenceMapRow(pkg, rowId, "reviewer:local", note);
    if (!result.ok) return `Review action blocked: ${result.reason}`;
    setPkg(result.package);
    setMessage(`Row ${rowId} is now ${result.row.reviewState}.`);
    setReviewRowId(null);
    return null;
  };
  const edit = (
    rowId: string,
    change: Vm0007EvidenceMapEdit,
    note: string,
  ): string | null => {
    if (!pkg)
      return "Machine proposal is not available for this reviewed snapshot.";
    const result = editVm0007EvidenceMapRow(
      pkg,
      rowId,
      change,
      "reviewer:local",
      note,
    );
    if (!result.ok) return `Review action blocked: ${result.reason}`;
    setPkg(result.package);
    setMessage(
      `Reviewer decision saved for ${rowId}. Approve the row to continue.`,
    );
    return null;
  };
  const decideEvidence = (
    rowId: string,
    evidenceIdentity: string,
    action: "reject" | "reinstate",
    note: string,
  ): string | null => {
    if (!pkg) return "Machine proposal is not available for this reviewed snapshot.";
    const result = action === "reject"
      ? rejectVm0007EvidenceRecord(pkg, rowId, evidenceIdentity, "reviewer:local", note)
      : acceptVm0007EvidenceRecord(pkg, rowId, evidenceIdentity, "reviewer:local", note);
    if (!result.ok) return `Evidence action blocked: ${result.reason}`;
    setPkg(result.package);
    setMessage(`Evidence ${action === "reject" ? "rejected" : "reinstated"}. Assessment needs review after this change.`);
    return null;
  };
  const activeMode: EvidenceMapMode = reviewedSnapshot ? mode : "machine";
  const reviewRow: Vm0007EvidenceMapDraftRow | null = pkg
    ? (pkg.rows.find((row) => row.rowId === reviewRowId) ?? null)
    : null;
  return (
    <>
      <EvidenceMapWorkspace
        pkg={pkg}
        reviewedSnapshot={reviewedSnapshot}
        mode={activeMode}
        onModeChange={setMode}
        message={message}
        onFinalize={finalize}
        onReview={(row) => setReviewRowId(row.rowId)}
        onEvidenceDecision={decideEvidence}
      />
      <EvidenceMapReviewPanel
        row={reviewRow}
        finalized={pkg?.finalizationState === "finalized"}
        onClose={closeReview}
        onEdit={(change, note) =>
          reviewRow ? edit(reviewRow.rowId, change, note) : "Row not found."
        }
        onApprove={(note) =>
          reviewRow
            ? transition(reviewRow.rowId, "approve", note)
            : "Row not found."
        }
        onReopen={(note) =>
          reviewRow
            ? transition(reviewRow.rowId, "reopen", note)
            : "Row not found."
        }
      />
    </>
  );
}
