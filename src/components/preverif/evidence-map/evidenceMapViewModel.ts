import type { Vm0007EvidenceMapDraftRow } from "@/lib/preverif/vm0007EvidenceMapDraft";

export type EvidenceMapFilters = Readonly<{
  query: string;
  evidenceState: "ALL" | Vm0007EvidenceMapDraftRow["proposedEvidenceStatus"];
  applicability: "ALL" | Vm0007EvidenceMapDraftRow["proposedApplicability"];
  reviewerOutcome: "ALL" | "NONE" | "NIR_CANDIDATE" | "NCR_CANDIDATE" | "OFI_CANDIDATE";
  reviewState: "ALL" | "ACTION_REQUIRED" | NonNullable<Vm0007EvidenceMapDraftRow["reviewState"]>;
}>;

export const EMPTY_EVIDENCE_MAP_FILTERS: EvidenceMapFilters = {
  query: "",
  evidenceState: "ALL",
  applicability: "ALL",
  reviewerOutcome: "ALL",
  reviewState: "ALL",
};

export type EvidenceMapSummary = Readonly<{
  total: number;
  found: number;
  unclear: number;
  missing: number;
  notApplicable: number;
  actionRequired: number;
}>;

export function summarizeEvidenceMap(rows: readonly Vm0007EvidenceMapDraftRow[]): EvidenceMapSummary {
  return rows.reduce<EvidenceMapSummary>((summary, row) => ({
    total: summary.total + 1,
    found: summary.found + Number(row.proposedEvidenceStatus === "FOUND"),
    unclear: summary.unclear + Number(row.proposedEvidenceStatus === "UNCLEAR"),
    missing: summary.missing + Number(row.proposedEvidenceStatus === "MISSING"),
    notApplicable: summary.notApplicable + Number(row.proposedApplicability === "NOT_APPLICABLE"),
    actionRequired: summary.actionRequired + Number((row.reviewState ?? "pending review") !== "approved"),
  }), { total: 0, found: 0, unclear: 0, missing: 0, notApplicable: 0, actionRequired: 0 });
}

export function filterEvidenceMapRows(rows: readonly Vm0007EvidenceMapDraftRow[], filters: EvidenceMapFilters): Vm0007EvidenceMapDraftRow[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return rows.filter((row) => {
    const outcome = row.assessment?.draftFinding.draftFindingType ?? "NONE";
    const searchable = [row.ruleReference, row.ruleTitle, row.requirementText, row.assessmentReason, row.gap, row.clientAction].join(" ").toLocaleLowerCase();
    return (!query || searchable.includes(query))
      && (filters.evidenceState === "ALL" || row.proposedEvidenceStatus === filters.evidenceState)
      && (filters.applicability === "ALL" || row.proposedApplicability === filters.applicability)
      && (filters.reviewerOutcome === "ALL" || outcome === filters.reviewerOutcome)
      && (filters.reviewState === "ALL"
        || (filters.reviewState === "ACTION_REQUIRED" && (row.reviewState ?? "pending review") !== "approved")
        || (row.reviewState ?? "pending review") === filters.reviewState);
  });
}

export function hasEvidenceMapFilters(filters: EvidenceMapFilters): boolean {
  return filters.query.trim() !== "" || Object.entries(filters).some(([key, value]) => key !== "query" && value !== "ALL");
}
