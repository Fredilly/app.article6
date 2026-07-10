import { deriveApplicability } from "@/lib/evidence/applicabilityContract";
import { deriveConformanceConclusion, type ConformanceAssessmentInput } from "@/lib/evidence/conformanceConclusionContract";
import { deriveDraftFinding } from "@/lib/evidence/draftFindingContract";
import type { EvidenceMapRow } from "@/lib/evidence/evidenceMapDependencyContract";
import { createReportPresentationObject, type ReportPresentationObject } from "@/lib/evidence/reportPresentationObject";
import { evaluatePresentationGate, evaluatePresentationReportGate } from "@/lib/evidence/presentationGate";

const provenance = { docId: "doc-1", page: 2, sectionPath: ["3"], spanId: "span-1", sectionHeading: "Evidence", sourceType: "PDD" };
function row(overrides: Partial<EvidenceMapRow> = {}): EvidenceMapRow {
  return {
    rowId: "row-1",
    requirement: { requirementId: "req-1", requirementReference: "REQ-1", requirementText: "A requirement." },
    methodology: { methodologyId: "method-1", rulebookVersion: "v1.0" },
    upstreamStatus: "FOUND", applicabilityState: "APPLICABLE",
    acceptedEvidence: [{ evidenceId: "accepted-1", quote: "Evidence.", provenance }], rejectedEvidence: [],
    assessmentReason: "Reviewed.", clientAction: null,
    searchCoverage: { searched: true, searchedDocumentIds: ["doc-1"], notes: null },
    sourceDocument: { documentId: "doc-1", documentName: "source.pdf", contentSha256: "hash" }, evidenceProvenance: [provenance],
    finalizationState: "finalized", finalizationActorRef: "actor-1", finalizedAt: "2026-07-10T00:00:00Z",
    finalizationBasis: "reviewed", reviewHistoryRef: "history-1", evidenceMapContractVersion: "v1", reviewPolicyVersion: "policy-v1",
    ...overrides,
  };
}
const assessment: ConformanceAssessmentInput = {
  requirementSupport: "SUPPORTED", searchCoverageAssessment: "ADEQUATE", provenanceAssessment: "COMPLETE",
  versionIdentityAssessment: "MATCHED", contradictionAssessment: "NONE",
};
function presentation(candidate: EvidenceMapRow = row(), conformanceInput: ConformanceAssessmentInput = assessment): ReportPresentationObject {
  const applicability = deriveApplicability(candidate, { decision: "APPLICABLE", decisionBasis: "Explicit basis." });
  const conformance = deriveConformanceConclusion(candidate, applicability, conformanceInput);
  const draft = deriveDraftFinding(candidate, conformance, { draftFindingType: null, findingBasis: null, reviewerAssessment: null });
  const result = createReportPresentationObject(candidate, applicability, conformance, draft);
  if (!result.ready) throw new Error("Expected a valid presentation object");
  return result.presentation;
}
function withChanges(value: ReportPresentationObject, changes: Record<string, unknown>): unknown {
  return { ...value, ...changes };
}

describe("presentation gates", () => {
  it("passes a complete valid presentation object", () => {
    const result = evaluatePresentationGate(presentation());
    expect(result).toMatchObject({ releaseReady: true, releaseState: "PRE_VALIDATION_RELEASE_READY" });
  });

  it.each([
    ["malformed presentation", null, "invalid_presentation_object"],
    ["missing review history", withChanges(presentation(), { reviewHistoryRef: "" }), "invalid_presentation_object"],
    ["untraceable finalization", withChanges(presentation(), { finalizationActorRef: "" }), "invalid_presentation_object"],
    ["inconsistent applicability", withChanges(presentation(), { applicabilityResult: { applicability: "APPLICABLE", evidenceMapRowId: "other", basis: "explicit_applicable_decision", decisionBasis: "Basis." } }), "invalid_presentation_object"],
    ["unsupported conformance evidence", withChanges(presentation(), { acceptedEvidence: [] }), "evidence_insufficient_for_conformance"],
    ["incomplete search coverage", withChanges(presentation(), { searchCoverage: { searched: false, searchedDocumentIds: [], notes: null } }), "search_coverage_incomplete"],
    ["missing provenance", withChanges(presentation(), { evidenceProvenance: [] }), "provenance_incomplete"],
    ["unresolved methodology version", withChanges(presentation(), { methodology: { methodologyId: "method-1", rulebookVersion: "unresolved" } }), "methodology_version_unresolved"],
    ["unsupported contract version", withChanges(presentation(), { evidenceMapContractVersion: "v2" }), "unsupported_contract_version"],
    ["reopened row", withChanges(presentation(), { reviewState: "reopened" }), "review_state_not_current"],
    ["superseded row", withChanges(presentation(), { reviewState: "superseded" }), "review_state_not_current"],
  ])("blocks %s", (_name, input, category) => {
    const result = evaluatePresentationGate(input);
    expect(result.releaseReady).toBe(false);
    if (result.releaseReady) throw new Error("Expected a blocked result");
    expect(result.blockedBy).toContainEqual(expect.objectContaining({ category }));
  });

  it("allows ACTION_REQUIRED to preserve missing evidence", () => {
    const candidate = row({ upstreamStatus: "MISSING", acceptedEvidence: [], searchCoverage: { searched: true, searchedDocumentIds: ["doc-1"], notes: null } });
    const applicability = deriveApplicability(candidate, { decision: "APPLICABLE", decisionBasis: "Explicit basis." });
    const conformance = deriveConformanceConclusion(candidate, applicability, { ...assessment, requirementSupport: "NOT_SUPPORTED" });
    const draft = deriveDraftFinding(candidate, conformance, { draftFindingType: "NCR_CANDIDATE", findingBasis: "Evidence is missing.", reviewerAssessment: "Candidate." });
    const packaged = createReportPresentationObject(candidate, applicability, conformance, draft);
    if (!packaged.ready) throw new Error("Expected packaging to succeed");
    expect(evaluatePresentationGate(packaged.presentation)).toMatchObject({ releaseReady: true });
  });

  it("blocks duplicate rows, conflicting requirement conclusions, and methodology drift", () => {
    const first = presentation();
    const duplicate = presentation(row({ rowId: "row-1", requirement: { ...row().requirement, requirementId: "req-2" } }));
    const conflict = presentation(row({ rowId: "row-2", upstreamStatus: "MISSING", acceptedEvidence: [], searchCoverage: { searched: true, searchedDocumentIds: ["doc-1"], notes: null } }), { ...assessment, requirementSupport: "NOT_SUPPORTED" });
    const drift = presentation(row({ rowId: "row-3", requirement: { requirementId: "req-3", requirementReference: "REQ-3", requirementText: "Another requirement." }, methodology: { methodologyId: "other-method", rulebookVersion: "v2.0" } }));
    const result = evaluatePresentationReportGate([first, duplicate, conflict, drift]);
    expect(result.releaseReady).toBe(false);
    if (!result.releaseReady) expect(result.blockedBy.map((blocker) => blocker.category)).toEqual([
      "duplicate_row_identity", "conflicting_requirement_conclusion", "inconsistent_methodology_identity",
    ]);
  });

  it("preserves evidence, leaves inputs unchanged, and freezes output", () => {
    const input = presentation();
    const before = structuredClone(input);
    const result = evaluatePresentationGate(input);
    expect(input).toEqual(before);
    expect(result).toMatchObject({ releaseReady: true });
    expect(Object.isFrozen(result)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/issued|approved|validated|verified|authority/i);
  });
});
