import {
  deriveApplicability,
  isApplicabilityResult,
  type ApplicabilityAssessmentInput,
  type ApplicabilityResult,
} from "@/lib/evidence/applicabilityContract";
import type { EvidenceMapRow } from "@/lib/evidence/evidenceMapDependencyContract";

const provenance = { docId: "doc-1", page: 1, sectionPath: ["1"], spanId: "span-1", sectionHeading: "Heading", sourceType: "PDD" };
function row(overrides: Partial<EvidenceMapRow> = {}): EvidenceMapRow {
  return {
    rowId: "row-1", requirement: { requirementId: "req-1", requirementReference: "REQ-1", requirementText: "A requirement." },
    methodology: null, upstreamStatus: "FOUND", applicabilityState: "APPLICABLE", acceptedEvidence: [], rejectedEvidence: [],
    assessmentReason: "Reviewed.", clientAction: null, searchCoverage: { searched: true, searchedDocumentIds: ["doc-1"], notes: null },
    sourceDocument: { documentId: "doc-1", documentName: "source.pdf", contentSha256: null }, evidenceProvenance: [provenance],
    finalizationState: "finalized", finalizationActorRef: "actor-1", finalizedAt: "now", finalizationBasis: "review",
    reviewHistoryRef: "history-1", evidenceMapContractVersion: "v1", reviewPolicyVersion: "v1", ...overrides,
  };
}
function assess(decision: ApplicabilityAssessmentInput["decision"], decisionBasis: string | null = "Explicit basis."): ApplicabilityAssessmentInput {
  return { decision, decisionBasis };
}
function result(candidate: EvidenceMapRow, assessment: unknown): ApplicabilityResult {
  return deriveApplicability(candidate, assessment);
}

describe("deriveApplicability", () => {
  it("accepts explicit applicable and not-applicable decisions with a basis", () => {
    expect(result(row(), assess("APPLICABLE", "  Explicit applicability rationale.  "))).toEqual({ applicability: "APPLICABLE", evidenceMapRowId: "row-1", basis: "explicit_applicable_decision", decisionBasis: "Explicit applicability rationale." });
    const candidate = row({ applicabilityState: "NOT_APPLICABLE" });
    expect(result(candidate, assess("NOT_APPLICABLE"))).toEqual({ applicability: "NOT_APPLICABLE", evidenceMapRowId: "row-1", basis: "explicit_not_applicable_decision", decisionBasis: "Explicit basis." });
  });
  it.each([
    [undefined, "applicabilityState", "APPLICABLE", "invalid_applicability_assessment"],
    [assess("NOT_EVALUATED"), "applicabilityState", "APPLICABLE", "applicability_decision_not_evaluated"],
    [assess("APPLICABLE", null), "applicabilityState", "APPLICABLE", "applicability_basis_missing"],
    [assess("NOT_APPLICABLE", "   "), "applicabilityState", "NOT_APPLICABLE", "applicability_basis_missing"],
  ])("fails closed for incomplete decision input", (assessment, key, state, category) => {
    expect(result(row({ [key]: state } as Partial<EvidenceMapRow>), assessment)).toMatchObject({ applicability: "NOT_ASSESSED", blockedBy: [{ category }] });
  });
  it("fails closed for an unknown row and for row/decision disagreement", () => {
    expect(result(row({ applicabilityState: "UNKNOWN" }), assess("APPLICABLE"))).toMatchObject({ blockedBy: [{ category: "applicability_row_state_unknown" }, { category: "applicability_row_state_mismatch" }] });
    expect(result(row({ applicabilityState: "APPLICABLE" }), assess("NOT_APPLICABLE"))).toMatchObject({ blockedBy: [{ category: "applicability_row_state_mismatch" }] });
  });
  it.each(["MISSING", "UNCLEAR", "answered", "unclear", "no_evidence"]) ("does not infer non-applicability from upstream status %s", (upstreamStatus) => {
    const candidate = row({ upstreamStatus });
    expect(result(candidate, assess("APPLICABLE"))).toMatchObject({ applicability: "APPLICABLE" });
    expect(result(candidate, assess("NOT_EVALUATED"))).toMatchObject({ applicability: "NOT_ASSESSED" });
  });
  it("does not let search failure or insufficient support create non-applicability", () => {
    const candidate = row({ searchCoverage: { searched: false, searchedDocumentIds: [], notes: "search failed" }, acceptedEvidence: [] });
    expect(result(candidate, assess("APPLICABLE"))).toMatchObject({ applicability: "APPLICABLE" });
  });
  it("preserves row identity, fails dependency input closed, and does not mutate inputs", () => {
    const candidate = row();
    const before = structuredClone(candidate);
    expect(result(candidate, assess("APPLICABLE")).evidenceMapRowId).toBe("row-1");
    expect(result({ ...candidate, finalizationState: "draft" }, assess("NOT_APPLICABLE"))).toMatchObject({ applicability: "NOT_ASSESSED", evidenceMapRowId: "row-1", blockedBy: [{ category: "evidence_map_dependency_blocked", reason: "row_not_finalized" }] });
    expect(candidate).toEqual(before);
    const many = result(row({ applicabilityState: "UNKNOWN" }), assess("NOT_APPLICABLE"));
    expect(many).toMatchObject({ blockedBy: [{ category: "applicability_row_state_unknown" }, { category: "applicability_row_state_mismatch" }] });
  });
  it("rejects malformed or forged runtime results", () => {
    expect(isApplicabilityResult({ applicability: "NOT_ASSESSED", evidenceMapRowId: "row-1", blockedBy: [] })).toBe(false);
    expect(isApplicabilityResult({ applicability: "NOT_ASSESSED", evidenceMapRowId: "row-1", blockedBy: [{ category: "forged" }] })).toBe(false);
    expect(isApplicabilityResult({ applicability: "NOT_ASSESSED", evidenceMapRowId: "row-1", blockedBy: [{ category: "evidence_map_dependency_blocked", reason: "forged" }] })).toBe(false);
    expect(isApplicabilityResult({ applicability: "APPLICABLE", evidenceMapRowId: "", basis: "explicit_applicable_decision", decisionBasis: "Basis." })).toBe(false);
  });
});
