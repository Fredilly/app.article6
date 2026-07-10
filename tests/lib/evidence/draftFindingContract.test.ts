import {
  deriveDraftFinding,
  type DraftFindingAssessmentInput,
  type DraftFindingResult,
} from "@/lib/evidence/draftFindingContract";
import {
  deriveConformanceConclusion,
  type ConformanceAssessmentInput,
} from "@/lib/evidence/conformanceConclusionContract";
import { deriveApplicability } from "@/lib/evidence/applicabilityContract";
import type { EvidenceMapRow } from "@/lib/evidence/evidenceMapDependencyContract";

const provenance = { docId: "doc-1", page: 1, sectionPath: ["1"], spanId: "span-1", sectionHeading: "Heading", sourceType: "PDD" };
function row(overrides: Partial<EvidenceMapRow> = {}): EvidenceMapRow {
  return {
    rowId: "row-1", requirement: { requirementId: "req-1", requirementReference: "REQ-1", requirementText: "A requirement." },
    methodology: null, upstreamStatus: "UNCLEAR", applicabilityState: "APPLICABLE", acceptedEvidence: [], rejectedEvidence: [],
    assessmentReason: "Reviewed.", clientAction: null, searchCoverage: { searched: true, searchedDocumentIds: ["doc-1"], notes: null },
    sourceDocument: { documentId: "doc-1", documentName: "source.pdf", contentSha256: null }, evidenceProvenance: [provenance],
    finalizationState: "finalized", finalizationActorRef: "actor-1", finalizedAt: "now", finalizationBasis: "review",
    reviewHistoryRef: "history-1", evidenceMapContractVersion: "v1", reviewPolicyVersion: "v1", ...overrides,
  };
}
const conformanceAssessment: ConformanceAssessmentInput = {
  requirementSupport: "NOT_SUPPORTED", searchCoverageAssessment: "ADEQUATE", provenanceAssessment: "COMPLETE",
  versionIdentityAssessment: "NOT_REQUIRED", contradictionAssessment: "NONE",
};
function derive(candidate: EvidenceMapRow, assessment: ConformanceAssessmentInput): ReturnType<typeof deriveConformanceConclusion> {
  return deriveConformanceConclusion(candidate, deriveApplicability(candidate, {
    decision: candidate.applicabilityState === "UNKNOWN" ? "NOT_EVALUATED" : candidate.applicabilityState,
    decisionBasis: "Explicit applicability basis.",
  }), assessment);
}
const actionRequired = derive(row(), conformanceAssessment);
const assessment = (draftFindingType: DraftFindingAssessmentInput["draftFindingType"], findingBasis: string | null = null, reviewerAssessment: string | null = null): DraftFindingAssessmentInput => ({ draftFindingType, findingBasis, reviewerAssessment });
function findingType(result: DraftFindingResult): string | null { return result.draftFindingType; }

describe("deriveDraftFinding", () => {
  it.each(["NIR_CANDIDATE", "NCR_CANDIDATE", "OFI_CANDIDATE"]) ("returns an immutable %s candidate only from explicit classification", (draftFindingType) => {
    const result = deriveDraftFinding(row(), actionRequired, assessment(draftFindingType as DraftFindingAssessmentInput["draftFindingType"], "Explicit classification basis.", "Reviewer assessment."));
    expect(findingType(result)).toBe(draftFindingType);
    expect(result).toMatchObject({ draftFindingRecord: { profile: "GENERIC_PRE_VALIDATION", evidenceMapRowId: "row-1", requirementId: "req-1", conformanceConclusion: "ACTION_REQUIRED", clientResponse: null, closingRemarks: null } });
  });
  it("keeps one stable record identity when classification changes", () => {
    const findingIds = ["NIR_CANDIDATE", "NCR_CANDIDATE", "OFI_CANDIDATE"].map((draftFindingType) => {
      const result = deriveDraftFinding(row(), actionRequired, assessment(draftFindingType as DraftFindingAssessmentInput["draftFindingType"], "Explicit classification basis.", "Reviewer assessment."));
      if (result.draftFindingRecord === null) throw new Error("Expected a draft finding record");
      return result.draftFindingRecord.findingId;
    });

    expect(new Set(findingIds)).toEqual(new Set(["draft:row-1"]));
    expect(findingIds[0]).toBe(findingIds[1]);
    expect(findingIds[1]).toBe(findingIds[2]);
  });
  it.each([
    ["CONFORMS", derive(row({ upstreamStatus: "FOUND" }), { ...conformanceAssessment, requirementSupport: "SUPPORTED" })],
    ["NOT_APPLICABLE", derive(row({ applicabilityState: "NOT_APPLICABLE" }), { ...conformanceAssessment, requirementSupport: "SUPPORTED" })],
    ["NOT_ASSESSED", derive(row(), { ...conformanceAssessment, requirementSupport: "NOT_EVALUATED" })],
  ])("returns null for %s", (_label, conformance) => {
    expect(deriveDraftFinding(row(), conformance, assessment("NIR_CANDIDATE", "Basis.", "Assessment."))).toMatchObject({ draftFindingType: null, draftFindingRecord: null });
  });
  it("allows ACTION_REQUIRED to have no candidate", () => {
    expect(deriveDraftFinding(row(), actionRequired, assessment(null))).toEqual({ draftFindingType: null, draftFindingRecord: null });
  });
  it.each(["FOUND", "UNCLEAR", "MISSING", "answered", "unclear", "no_evidence"]) ("does not infer a candidate from upstream status %s", (upstreamStatus) => {
    const candidate = row({ upstreamStatus });
    const conformance = derive(candidate, conformanceAssessment);
    expect(deriveDraftFinding(candidate, conformance, assessment(null))).toEqual({ draftFindingType: null, draftFindingRecord: null });
  });
  it("fails closed for invalid classification and mismatched row identity", () => {
    expect(deriveDraftFinding(row(), actionRequired, { draftFindingType: "NCR" })).toMatchObject({ draftFindingType: null, blockedBy: [{ category: "invalid_draft_finding_assessment" }] });
    expect(deriveDraftFinding(row(), { ...actionRequired, evidenceMapRowId: "other-row" }, assessment("NIR_CANDIDATE", "Basis.", "Assessment."))).toMatchObject({ draftFindingType: null, blockedBy: [{ category: "conformance_row_id_mismatch" }] });
  });
  it("fails closed for incomplete or formal authority text", () => {
    expect(deriveDraftFinding(row(), actionRequired, assessment("NIR_CANDIDATE", null, "Assessment."))).toMatchObject({ blockedBy: [{ category: "finding_basis_missing" }] });
    expect(deriveDraftFinding(row(), actionRequired, assessment("NIR_CANDIDATE", "The VVB formally issued a finding.", "Assessment."))).toMatchObject({ blockedBy: [{ category: "formal_authority_language" }] });
  });
  it("does not mutate inputs and orders multiple blockers deterministically", () => {
    const candidate = row(); const before = structuredClone(candidate);
    const result = deriveDraftFinding(candidate, { ...actionRequired, evidenceMapRowId: "other-row" }, assessment("NIR_CANDIDATE", null, null));
    expect(candidate).toEqual(before);
    expect((result as Record<string, unknown>).draftFindingRecord).toBeNull();
    expect(result).toMatchObject({ blockedBy: [
      { category: "conformance_row_id_mismatch" }, { category: "finding_basis_missing" }, { category: "reviewer_assessment_missing" },
    ] });
    expect(JSON.stringify(result)).not.toMatch(/VALIDATED|VERIFIED|APPROVED_BY_VVB|issued/i);
  });
});
