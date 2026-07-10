import {
  deriveConformanceConclusion,
  type ConformanceAssessmentInput,
  type ConformanceConclusionResult,
} from "@/lib/evidence/conformanceConclusionContract";
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
function assess(overrides: Partial<ConformanceAssessmentInput> = {}): ConformanceAssessmentInput { return { ...complete, ...overrides }; }
function conclusion(result: ConformanceConclusionResult): string { return result.conclusion; }

describe("deriveConformanceConclusion", () => {
  it.each(["FOUND", "answered"]) ("allows complete supported %s to conform", (upstreamStatus) => {
    expect(conclusion(deriveConformanceConclusion(row({ upstreamStatus }), complete))).toBe("CONFORMS");
  });
  it("does not conform from FOUND alone", () => expect(conclusion(deriveConformanceConclusion(row(), assess({ requirementSupport: "NOT_EVALUATED" })))).toBe("NOT_ASSESSED"));
  it.each(["FOUND", "UNCLEAR", "MISSING", "unclear", "no_evidence"]) ("requires explicit support for %s", (upstreamStatus) => {
    const result = deriveConformanceConclusion(row({ upstreamStatus }), assess({ requirementSupport: "NOT_SUPPORTED" }));
    expect(conclusion(result)).toBe("ACTION_REQUIRED");
  });
  it.each(["UNCLEAR", "MISSING", "unclear", "no_evidence"]) ("fails closed for supported %s", (upstreamStatus) => {
    expect(conclusion(deriveConformanceConclusion(row({ upstreamStatus }), complete))).toBe("NOT_ASSESSED");
  });
  it("requires explicit not-applicable applicability", () => {
    expect(conclusion(deriveConformanceConclusion(row({ applicabilityState: "NOT_APPLICABLE" }), complete))).toBe("NOT_APPLICABLE");
    expect(conclusion(deriveConformanceConclusion(row({ applicabilityState: "UNKNOWN" }), complete))).toBe("NOT_ASSESSED");
  });
  it.each(["UNCLEAR", "MISSING", "unclear", "no_evidence"]) ("does not treat %s as not applicable", (upstreamStatus) => {
    expect(conclusion(deriveConformanceConclusion(row({ upstreamStatus }), complete))).toBe("NOT_ASSESSED");
  });
  it.each([
    ["INADEQUATE", "search_coverage_inadequate"], ["NOT_EVALUATED", "search_coverage_not_evaluated"],
    ["INCOMPLETE", "provenance_incomplete"], ["MISMATCHED", "version_identity_mismatch"],
    ["UNRESOLVED", "version_identity_unresolved"], ["BLOCKING", "blocking_contradiction"], ["NOT_EVALUATED", "contradiction_not_evaluated"],
  ])("blocks unsafe assessment %s", (value, reason) => {
    const key = reason.startsWith("search") ? "searchCoverageAssessment" : reason.startsWith("provenance") ? "provenanceAssessment" : reason.startsWith("version") ? "versionIdentityAssessment" : "contradictionAssessment";
    const result = deriveConformanceConclusion(row(), assess({ [key]: value } as Partial<ConformanceAssessmentInput>));
    expect(conclusion(result)).toBe("NOT_ASSESSED");
    expect(result).toMatchObject({ blockedBy: [{ category: reason }] });
  });
  it("preserves dependency reasons for incomplete rows", () => {
    const result = deriveConformanceConclusion({ finalizationState: "draft" }, complete);
    expect(result.conclusion).toBe("NOT_ASSESSED");
    expect(result.evidenceMapRowId).toBeNull();
    expect(result.blockedBy).toContainEqual({ category: "evidence_map_dependency_blocked", reason: "row_not_finalized" });
  });
  it("rejects malformed assessments and unsupported statuses", () => {
    expect(conclusion(deriveConformanceConclusion(row(), {}))).toBe("NOT_ASSESSED");
    const result = deriveConformanceConclusion(row({ upstreamStatus: "UNKNOWN" }), complete);
    expect(result).toMatchObject({ conclusion: "NOT_ASSESSED", blockedBy: [{ category: "unsupported_upstream_status" }] });
  });
  it("does not mutate inputs, includes deterministic blocks, and has no finding fields", () => {
    const candidate = row({ upstreamStatus: "UNCLEAR" }); const before = structuredClone(candidate);
    const result = deriveConformanceConclusion(candidate, assess({ requirementSupport: "SUPPORTED", provenanceAssessment: "NOT_EVALUATED", versionIdentityAssessment: "MISMATCHED" }));
    expect(candidate).toEqual(before);
    expect((result as Record<string, unknown>).draftFindingType).toBeUndefined();
    expect((result as Record<string, unknown>).draftFindingRecord).toBeUndefined();
    expect(result).toMatchObject({ blockedBy: [
      { category: "upstream_status_conflicts_with_support" }, { category: "version_identity_mismatch" }, { category: "provenance_not_evaluated" },
    ] });
  });
});
