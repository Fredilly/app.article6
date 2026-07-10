import {
  deriveConformanceConclusion,
  type ConformanceAssessmentInput,
  type ConformanceConclusionResult,
} from "@/lib/evidence/conformanceConclusionContract";
import { deriveApplicability } from "@/lib/evidence/applicabilityContract";
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
const complete: ConformanceAssessmentInput = {
  requirementSupport: "SUPPORTED", searchCoverageAssessment: "ADEQUATE", provenanceAssessment: "COMPLETE",
  versionIdentityAssessment: "NOT_REQUIRED", contradictionAssessment: "NONE",
};
const methodology = { methodologyId: "method-1", rulebookVersion: "v1.0" };
function assess(overrides: Partial<ConformanceAssessmentInput> = {}): ConformanceAssessmentInput { return { ...complete, ...overrides }; }
function derive(candidate: EvidenceMapRow, assessment: ConformanceAssessmentInput): ConformanceConclusionResult {
  return deriveConformanceConclusion(candidate, deriveApplicability(candidate, {
    decision: candidate.applicabilityState === "UNKNOWN" ? "NOT_EVALUATED" : candidate.applicabilityState,
    decisionBasis: "Explicit applicability basis.",
  }), assessment);
}
function conclusion(result: ConformanceConclusionResult): string { return result.conclusion; }

describe("deriveConformanceConclusion", () => {
  it.each(["FOUND", "answered"]) ("allows complete supported %s to conform", (upstreamStatus) => {
    expect(conclusion(derive(row({ upstreamStatus }), complete))).toBe("CONFORMS");
  });
  it("does not conform from FOUND alone", () => expect(conclusion(derive(row(), assess({ requirementSupport: "NOT_EVALUATED" })))).toBe("NOT_ASSESSED"));
  it.each(["FOUND", "UNCLEAR", "MISSING", "unclear", "no_evidence"]) ("requires explicit support for %s", (upstreamStatus) => {
    const result = derive(row({ upstreamStatus }), assess({ requirementSupport: "NOT_SUPPORTED" }));
    expect(conclusion(result)).toBe("ACTION_REQUIRED");
  });
  it.each(["UNCLEAR", "MISSING", "unclear", "no_evidence"]) ("fails closed for supported %s", (upstreamStatus) => {
    expect(conclusion(derive(row({ upstreamStatus }), complete))).toBe("NOT_ASSESSED");
  });
  it("requires explicit not-applicable applicability", () => {
    expect(conclusion(derive(row({ applicabilityState: "NOT_APPLICABLE" }), complete))).toBe("NOT_APPLICABLE");
    expect(conclusion(derive(row({ applicabilityState: "UNKNOWN" }), complete))).toBe("NOT_ASSESSED");
  });
  it("requires a successful matching applicability result before deriving a conclusion", () => {
    const candidate = row({ applicabilityState: "APPLICABLE", upstreamStatus: "MISSING" });
    const blocked = deriveApplicability(candidate, { decision: "NOT_EVALUATED", decisionBasis: null });
    expect(deriveConformanceConclusion(candidate, blocked, { ...complete, requirementSupport: "NOT_SUPPORTED" })).toMatchObject({ conclusion: "NOT_ASSESSED", blockedBy: [{ category: "applicability_blocked" }] });
    const mismatch = deriveApplicability(candidate, { decision: "NOT_APPLICABLE", decisionBasis: "Explicit basis." });
    expect(deriveConformanceConclusion(candidate, mismatch, complete)).toMatchObject({ conclusion: "NOT_ASSESSED", blockedBy: [{ category: "applicability_blocked" }] });
    expect(deriveConformanceConclusion(candidate, deriveApplicability(candidate, { decision: "APPLICABLE", decisionBasis: "Explicit basis." }), { ...complete, requirementSupport: "NOT_SUPPORTED" })).toMatchObject({ conclusion: "ACTION_REQUIRED" });
    expect(deriveConformanceConclusion(candidate, { applicability: "APPLICABLE", evidenceMapRowId: "other-row", basis: "explicit_applicable_decision", decisionBasis: "Basis." }, complete)).toMatchObject({ conclusion: "NOT_ASSESSED", blockedBy: [{ category: "applicability_row_id_mismatch" }] });
    expect(deriveConformanceConclusion(candidate, { applicability: "NOT_ASSESSED", evidenceMapRowId: "row-1", blockedBy: [] }, complete)).toMatchObject({ conclusion: "NOT_ASSESSED", blockedBy: [{ category: "applicability_result_invalid" }] });
  });
  it.each(["CONFORMS", "ACTION_REQUIRED", "NOT_APPLICABLE"]) ("allows %s with methodology only when version identity is matched", (expected) => {
    const assessment = assess({
      versionIdentityAssessment: "MATCHED",
      requirementSupport: expected === "ACTION_REQUIRED" ? "NOT_SUPPORTED" : "SUPPORTED",
    });
    const candidate = row({ methodology, applicabilityState: expected === "NOT_APPLICABLE" ? "NOT_APPLICABLE" : "APPLICABLE" });
    const result = derive(candidate, assessment);
    expect(conclusion(result)).toBe(expected);
  });
  it.each([
    [null, "MATCHED", "version_identity_matched_without_methodology"],
    [methodology, "NOT_REQUIRED", "version_identity_not_required_for_methodology"],
  ])("blocks inconsistent methodology/version identity combinations", (rowMethodology, versionIdentityAssessment, reason) => {
    const candidate = row({ methodology: rowMethodology });
    const result = derive(candidate, assess({ versionIdentityAssessment }));
    expect(result).toMatchObject({ conclusion: "NOT_ASSESSED", blockedBy: [{ category: reason }] });
  });
  it.each(["UNCLEAR", "MISSING", "unclear", "no_evidence"]) ("does not treat %s as not applicable", (upstreamStatus) => {
    expect(conclusion(derive(row({ upstreamStatus }), complete))).toBe("NOT_ASSESSED");
  });
  it.each([
    ["INADEQUATE", "search_coverage_inadequate"], ["NOT_EVALUATED", "search_coverage_not_evaluated"],
    ["INCOMPLETE", "provenance_incomplete"], ["MISMATCHED", "version_identity_mismatch"],
    ["UNRESOLVED", "version_identity_unresolved"], ["BLOCKING", "blocking_contradiction"], ["NOT_EVALUATED", "contradiction_not_evaluated"],
  ])("blocks unsafe assessment %s", (value, reason) => {
    const key = reason.startsWith("search") ? "searchCoverageAssessment" : reason.startsWith("provenance") ? "provenanceAssessment" : reason.startsWith("version") ? "versionIdentityAssessment" : "contradictionAssessment";
    const result = derive(row(), assess({ [key]: value } as Partial<ConformanceAssessmentInput>));
    expect(conclusion(result)).toBe("NOT_ASSESSED");
    expect(result).toMatchObject({ blockedBy: [{ category: reason }] });
  });
  it("preserves dependency reasons for incomplete rows", () => {
    const result = deriveConformanceConclusion({ finalizationState: "draft" }, null, complete);
    expect(result.conclusion).toBe("NOT_ASSESSED");
    expect(result.evidenceMapRowId).toBeNull();
    expect(result.blockedBy).toContainEqual({ category: "evidence_map_dependency_blocked", reason: "row_not_finalized" });
  });
  it("rejects malformed assessments and unsupported statuses", () => {
    expect(conclusion(derive(row(), {} as ConformanceAssessmentInput))).toBe("NOT_ASSESSED");
    const result = derive(row({ upstreamStatus: "UNKNOWN" }), complete);
    expect(result).toMatchObject({ conclusion: "NOT_ASSESSED", blockedBy: [{ category: "unsupported_upstream_status" }] });
  });
  it("does not mutate inputs, includes deterministic blocks, and has no finding fields", () => {
    const candidate = row({ upstreamStatus: "UNCLEAR" }); const before = structuredClone(candidate);
    const result = derive(candidate, assess({ requirementSupport: "SUPPORTED", provenanceAssessment: "NOT_EVALUATED", versionIdentityAssessment: "MISMATCHED" }));
    expect(candidate).toEqual(before);
    expect((result as Record<string, unknown>).draftFindingType).toBeUndefined();
    expect((result as Record<string, unknown>).draftFindingRecord).toBeUndefined();
    expect(result).toMatchObject({ blockedBy: [
      { category: "upstream_status_conflicts_with_support" }, { category: "version_identity_mismatch" }, { category: "provenance_not_evaluated" },
    ] });
  });
});
