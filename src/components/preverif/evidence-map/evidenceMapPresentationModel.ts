import type { Vm0007EvidenceMapDraftPackage } from "@/lib/preverif/vm0007EvidenceMapDraft";
import { vm0007EvidenceMapRowWorkflowState } from "@/lib/preverif/vm0007EvidenceMapReview";
import type {
  ReviewedEvidenceMapSnapshot,
  ReviewedEvidenceRecord,
} from "@/lib/preverif/reviewedEvidenceMapTypes";

export type EvidenceMapMode = "reviewed" | "machine";
export type EvidenceMapPresentationEvidence = ReviewedEvidenceRecord;
export type EvidenceMapPresentationRow = Readonly<{
  rowId: string;
  stableRuleId: string;
  ruleReference: string;
  ruleTitle: string;
  requirementText: string;
  evidenceState: "FOUND" | "UNCLEAR" | "MISSING" | "N/A";
  applicability: "APPLICABLE" | "NOT_APPLICABLE" | "UNKNOWN";
  reviewerOutcome: string;
  reviewState: string;
  acceptedEvidence: readonly EvidenceMapPresentationEvidence[];
  rejectedEvidence: readonly EvidenceMapPresentationEvidence[];
  draftFindingCandidate: string | null;
  contradictionState: string | null;
  clientAction: string;
  gap: string;
  rawAuditStatus: string | null;
  confidence: string | null;
  assessmentReason: string | null;
  notApplicable: boolean;
  actionRequired: boolean;
  supportedComponents: readonly string[] | null;
  missingComponents: readonly string[] | null;
  reasonSelected: string | null;
  reviewHistory: Vm0007EvidenceMapDraftPackage["rows"][number]["reviewHistory"];
  unresolved: boolean;
  blockerReasons: readonly string[];
}>;

export type EvidenceMapPresentation = Readonly<{
  mode: EvidenceMapMode;
  rows: readonly EvidenceMapPresentationRow[];
  readOnly: boolean;
}>;

function machineEvidence(
  row: Vm0007EvidenceMapDraftPackage["rows"][number],
): readonly EvidenceMapPresentationEvidence[] {
  if (row.acceptedEvidence?.length) return row.acceptedEvidence;
  const evidence = row.proposedAcceptedEvidence;
  if (!evidence) return [];
  return [
    {
      quote: evidence.quote,
      page: evidence.provenance.page,
      section: evidence.provenance.sectionHeading,
      spanId: evidence.provenance.spanId,
      provenance: evidence.provenance,
    },
  ];
}

function machineRejected(
  row: Vm0007EvidenceMapDraftPackage["rows"][number],
): readonly EvidenceMapPresentationEvidence[] {
  if (row.rejectedEvidence?.length) return row.rejectedEvidence;
  const evidence = row.proposedRejectedEvidence;
  if (!evidence) return [];
  return [
    {
      quote: evidence.quote,
      page: evidence.provenance.page,
      section: evidence.provenance.sectionHeading,
      spanId: evidence.provenance.spanId,
      provenance: evidence.provenance,
      rejectionReason: evidence.reason,
    },
  ];
}

export function buildMachineEvidenceMapPresentation(
  pkg: Vm0007EvidenceMapDraftPackage,
): EvidenceMapPresentation {
  return {
    mode: "machine",
    readOnly: false,
    rows: pkg.rows.map((row) => {
      const workflow = vm0007EvidenceMapRowWorkflowState(row);
      return {
      rowId: row.rowId,
      stableRuleId: row.stableRuleId,
      ruleReference: row.ruleReference,
      ruleTitle: row.ruleTitle,
      requirementText: row.requirementText,
      evidenceState: row.proposedEvidenceStatus,
      applicability: row.proposedApplicability,
      reviewerOutcome: row.assessment?.draftFinding.draftFindingType ?? "NONE",
      reviewState: row.reviewState ?? "pending review",
      acceptedEvidence: machineEvidence(row),
      rejectedEvidence: machineRejected(row),
      draftFindingCandidate: null,
      contradictionState: null,
      clientAction: row.clientAction,
      gap: row.gap,
      rawAuditStatus: row.rawAuditStatus,
      confidence: row.confidence,
      assessmentReason: row.assessmentReason,
      notApplicable: row.proposedApplicability === "NOT_APPLICABLE",
      actionRequired: (row.reviewState ?? "pending review") !== "approved",
      supportedComponents: row.supportedComponents ?? null,
      missingComponents: row.missingComponents ?? null,
      reasonSelected: row.reasonSelected ?? null,
      reviewHistory: row.reviewHistory,
      unresolved: workflow.unresolved,
      blockerReasons: workflow.blockerReasons,
      };
    }),
  };
}

export function buildReviewedEvidenceMapPresentation(
  snapshot: ReviewedEvidenceMapSnapshot,
): EvidenceMapPresentation {
  return {
    mode: "reviewed",
    readOnly: true,
    rows: snapshot.rows.map((row) => ({
      rowId: row.rowId,
      stableRuleId: row.stableRuleId,
      ruleReference: row.ruleReference,
      ruleTitle: row.ruleReference,
      requirementText: row.requirementText,
      evidenceState: row.finalEvidenceState,
      applicability:
        row.finalEvidenceState === "N/A" ? "NOT_APPLICABLE" : "APPLICABLE",
      reviewerOutcome: row.reviewerOutcome,
      reviewState: "reviewed snapshot",
      acceptedEvidence: row.reviewerEvidence,
      rejectedEvidence: row.rejectedEvidence,
      draftFindingCandidate: row.draftFindingCandidate,
      contradictionState: row.contradictionState,
      clientAction: row.clientAction,
      gap: "",
      rawAuditStatus: null,
      confidence: null,
      assessmentReason: null,
      notApplicable: row.finalEvidenceState === "N/A",
      actionRequired: row.reviewerOutcome === "ACTION_REQUIRED",
      supportedComponents: null,
      missingComponents: null,
      reasonSelected: null,
      reviewHistory: [],
      unresolved: false,
      blockerReasons: [],
    })),
  };
}

export type EvidenceMapPresentationFilters = Readonly<{
  query: string;
  evidenceState: "ALL" | EvidenceMapPresentationRow["evidenceState"];
  applicability: "ALL" | EvidenceMapPresentationRow["applicability"];
  reviewerOutcome: string;
  reviewState: string;
}>;

export const EMPTY_PRESENTATION_FILTERS: EvidenceMapPresentationFilters = {
  query: "",
  evidenceState: "ALL",
  applicability: "ALL",
  reviewerOutcome: "ALL",
  reviewState: "ALL",
};

export function summarizeEvidenceMapPresentation(
  rows: readonly EvidenceMapPresentationRow[],
) {
  return rows.reduce(
    (summary, row) => ({
      total: summary.total + 1,
      found: summary.found + Number(row.evidenceState === "FOUND"),
      unclear: summary.unclear + Number(row.evidenceState === "UNCLEAR"),
      missing: summary.missing + Number(row.evidenceState === "MISSING"),
      notApplicable: summary.notApplicable + Number(row.notApplicable),
      actionRequired: summary.actionRequired + Number(row.actionRequired),
    }),
    {
      total: 0,
      found: 0,
      unclear: 0,
      missing: 0,
      notApplicable: 0,
      actionRequired: 0,
    },
  );
}

export function filterEvidenceMapPresentation(
  rows: readonly EvidenceMapPresentationRow[],
  filters: EvidenceMapPresentationFilters,
) {
  const query = filters.query.trim().toLocaleLowerCase();
  return rows.filter((row) => {
    const searchable = [
      row.ruleReference,
      row.ruleTitle,
      row.requirementText,
      row.assessmentReason,
      row.gap,
      row.clientAction,
    ]
      .join(" ")
      .toLocaleLowerCase();
    return (
      (!query || searchable.includes(query)) &&
      (filters.evidenceState === "ALL" ||
        row.evidenceState === filters.evidenceState) &&
      (filters.applicability === "ALL" ||
        row.applicability === filters.applicability) &&
      (filters.reviewerOutcome === "ALL" ||
        row.reviewerOutcome === filters.reviewerOutcome) &&
      (filters.reviewState === "ALL" || row.reviewState === filters.reviewState)
    );
  });
}

export function hasPresentationFilters(
  filters: EvidenceMapPresentationFilters,
): boolean {
  return (
    filters.query.trim() !== "" ||
    Object.entries(filters).some(
      ([key, value]) => key !== "query" && value !== "ALL",
    )
  );
}

export type EvidenceMapNavigationTarget = "previous" | "next" | "unresolved" | "blocker";

/** Navigation always consumes the current canonical visible order and stable row IDs. */
export function findEvidenceMapNavigationTarget(
  rows: readonly EvidenceMapPresentationRow[],
  currentRowId: string | null,
  target: EvidenceMapNavigationTarget,
): EvidenceMapPresentationRow | null {
  if (!rows.length) return null;
  const index = currentRowId ? rows.findIndex((row) => row.rowId === currentRowId) : -1;
  if (target === "previous") return index > 0 ? rows[index - 1] : null;
  if (target === "next") return index >= 0 && index < rows.length - 1 ? rows[index + 1] : null;
  const candidates = target === "unresolved" ? rows.filter((row) => row.unresolved) : rows.filter((row) => row.blockerReasons.length > 0);
  const after = index >= 0 ? rows.slice(index + 1).find((row) => candidates.some((candidate) => candidate.rowId === row.rowId)) : undefined;
  return after ?? candidates.find((row) => row.rowId !== currentRowId) ?? null;
}

export function summarizeEvidenceMapWorkflow(rows: readonly EvidenceMapPresentationRow[]) {
  const unresolved = rows.filter((row) => row.unresolved).length;
  return { total: rows.length, complete: rows.length - unresolved, unresolved, blocked: rows.filter((row) => row.blockerReasons.length > 0).length };
}
