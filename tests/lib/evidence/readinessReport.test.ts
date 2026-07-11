import { deriveApplicability } from "@/lib/evidence/applicabilityContract";
import { deriveConformanceConclusion } from "@/lib/evidence/conformanceConclusionContract";
import type { EvidenceMapRow } from "@/lib/evidence/evidenceMapDependencyContract";
import { deriveDraftFinding } from "@/lib/evidence/draftFindingContract";
import { createReportPresentationObject } from "@/lib/evidence/reportPresentationObject";
import { evaluatePresentationReportGate } from "@/lib/evidence/presentationGate";
import { createReadinessReportViewModel, reviewStateForGate, validateReviewerWorkflowEvent } from "@/lib/evidence/readinessReport";

const provenance = { docId: "doc-1", page: 4, sectionPath: ["3", "3.1"], spanId: "span-1", sectionHeading: "Evidence", sourceType: "PDD" };
const row = (overrides: Partial<EvidenceMapRow> = {}): EvidenceMapRow => ({ rowId: "row-1", requirement: { requirementId: "req-1", requirementReference: "REQ-1", requirementText: "Requirement text." }, methodology: { methodologyId: "VM", rulebookVersion: "1.0" }, upstreamStatus: "FOUND", applicabilityState: "APPLICABLE", acceptedEvidence: [{ evidenceId: "accepted", quote: "Accepted quote", provenance }], rejectedEvidence: [{ evidenceId: "rejected", quote: "Rejected quote", rejectionReason: "Out of scope", provenance }], assessmentReason: "Reviewed against the requirement.", clientAction: "Provide the signed appendix.", searchCoverage: { searched: true, searchedDocumentIds: ["doc-1"], notes: null }, sourceDocument: { documentId: "doc-1", documentName: "source.pdf", contentSha256: "hash" }, evidenceProvenance: [provenance], finalizationState: "finalized", finalizationActorRef: "reviewer-1", finalizedAt: "2026-07-10T00:00:00Z", finalizationBasis: "Evidence Map review", reviewHistoryRef: "history-1", evidenceMapContractVersion: "v1", reviewPolicyVersion: "policy-v1", ...overrides });
function presentation(candidate = row()) {
  const applicability = deriveApplicability(candidate, { decision: "APPLICABLE", decisionBasis: "Requirement applies." });
  const conclusion = deriveConformanceConclusion(candidate, applicability, { requirementSupport: "SUPPORTED", searchCoverageAssessment: "ADEQUATE", provenanceAssessment: "COMPLETE", versionIdentityAssessment: "MATCHED", contradictionAssessment: "NONE" });
  const draft = deriveDraftFinding(candidate, conclusion, { draftFindingType: null, findingBasis: null, reviewerAssessment: null });
  const result = createReportPresentationObject(candidate, applicability, conclusion, draft);
  if (!result.ready) throw new Error("expected presentation");
  return result.presentation;
}

describe("Phase 9 readiness report consumer", () => {
  test("handles single and multi-row gate results without remapping upstream status", () => {
    const first = presentation();
    const second = presentation(row({ rowId: "row-2", requirement: { requirementId: "req-2", requirementReference: "REQ-2", requirementText: "Second requirement." } }));
    expect(createReadinessReportViewModel(evaluatePresentationReportGate([{ presentation: first }])).release.label).toBe("client-release-ready");
    const model = createReadinessReportViewModel(evaluatePresentationReportGate([{ presentation: first }, { presentation: second }]));
    expect(model.rows).toHaveLength(2);
    expect(model.rows[0].upstreamStatus).toBe("FOUND");
  });

  test("renders blocked reports internally and preserves every gate reason", () => {
    const gate = evaluatePresentationReportGate([{ presentation: presentation(), reviewState: "REOPENED" }]);
    const model = createReadinessReportViewModel(gate);
    expect(model.release.label).toBe("blocked");
    expect(model.release.reasons).toEqual(expect.arrayContaining([expect.objectContaining({ category: "review_state_not_current" })]));
  });

  test("fails closed for missing presentation data and does not derive release readiness", () => {
    const model = createReadinessReportViewModel(null);
    expect(model.release.label).toBe("not assessed");
    expect(model.release.releaseReady).toBe(false);
    expect(model.release.reasons[0].category).toBe("invalid_report_input");
  });

  test("requires a real review event and preserves workflow metadata", () => {
    expect(validateReviewerWorkflowEvent(null)).toEqual({ complete: false, state: "incomplete", reason: "review-history-event-required" });
    const result = validateReviewerWorkflowEvent({ reviewerIdentity: "r-1", timestamp: "2026-07-11T00:00:00Z", reasonOrNote: "Reviewed evidence.", previousState: "pending review", newState: "approved", presentationContractVersion: "v1", reviewPolicyVersion: "policy-v1" });
    expect(result).toMatchObject({ complete: true, state: "approved", event: { reviewerIdentity: "r-1", previousState: "pending review" } });
    expect(reviewStateForGate("reopened")).toBe("REOPENED");
  });
});
