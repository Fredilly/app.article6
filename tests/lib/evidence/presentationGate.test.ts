import { deriveApplicability } from "@/lib/evidence/applicabilityContract";
import { deriveConformanceConclusion, type ConformanceAssessmentInput } from "@/lib/evidence/conformanceConclusionContract";
import { deriveDraftFinding } from "@/lib/evidence/draftFindingContract";
import type { EvidenceMapRow } from "@/lib/evidence/evidenceMapDependencyContract";
import { createReportPresentationObject, type ReportPresentationObject } from "@/lib/evidence/reportPresentationObject";
import { evaluatePresentationGate, evaluatePresentationReportGate } from "@/lib/evidence/presentationGate";

const provenance = { docId: "doc-1", page: 2, sectionPath: ["3"], spanId: "span-1", sectionHeading: "Evidence", sourceType: "PDD" };
function row(overrides: Partial<EvidenceMapRow> = {}): EvidenceMapRow {
  return { rowId: "row-1", requirement: { requirementId: "req-1", requirementReference: "REQ-1", requirementText: "Requirement." },
    methodology: { methodologyId: "method-1", rulebookVersion: "v1" }, upstreamStatus: "FOUND", applicabilityState: "APPLICABLE",
    acceptedEvidence: [{ evidenceId: "accepted-1", quote: "Evidence.", provenance }], rejectedEvidence: [], assessmentReason: "Reviewed.", clientAction: null,
    searchCoverage: { searched: true, searchedDocumentIds: ["doc-1"], notes: null }, sourceDocument: { documentId: "doc-1", documentName: "source.pdf", contentSha256: "hash" },
    evidenceProvenance: [provenance], finalizationState: "finalized", finalizationActorRef: "actor-1", finalizedAt: "2026-07-10T00:00:00Z", finalizationBasis: "reviewed",
    reviewHistoryRef: "history-1", evidenceMapContractVersion: "v1", reviewPolicyVersion: "policy-v1", ...overrides };
}
const assessed: ConformanceAssessmentInput = { requirementSupport: "SUPPORTED", searchCoverageAssessment: "ADEQUATE", provenanceAssessment: "COMPLETE", versionIdentityAssessment: "MATCHED", contradictionAssessment: "NONE" };
function presentation(candidate: EvidenceMapRow = row(), assessment: ConformanceAssessmentInput = assessed): ReportPresentationObject {
  const applicability = deriveApplicability(candidate, { decision: candidate.applicabilityState === "NOT_APPLICABLE" ? "NOT_APPLICABLE" : "APPLICABLE", decisionBasis: "Basis." });
  const conclusion = deriveConformanceConclusion(candidate, applicability, assessment);
  const draft = deriveDraftFinding(candidate, conclusion, { draftFindingType: null, findingBasis: null, reviewerAssessment: null });
  const result = createReportPresentationObject(candidate, applicability, conclusion, draft);
  if (!result.ready) throw new Error("Expected presentation");
  return result.presentation;
}
const input = (value: ReportPresentationObject, reviewState?: "CURRENT" | "PENDING_REVIEW" | "REOPENED" | "SUPERSEDED" | "STALE") => reviewState === undefined ? { presentation: value } : { presentation: value, reviewState };
function deepFrozen(value: unknown): void { if (value && typeof value === "object") { expect(Object.isFrozen(value)).toBe(true); Object.values(value).forEach(deepFrozen); } }

describe("presentation gates", () => {
  it("distinguishes malformed and empty reports", () => {
    expect(evaluatePresentationReportGate({})).toMatchObject({ releaseState: "BLOCKED", blockedBy: [{ category: "invalid_report_input" }] });
    expect(evaluatePresentationReportGate([])).toMatchObject({ releaseState: "BLOCKED", blockedBy: [{ category: "empty_report" }] });
  });
  it("passes a valid linked row and reports a single row as NOT_EVALUATED", () => {
    expect(evaluatePresentationReportGate([input(presentation())])).toMatchObject({ releaseReady: true, crossRowOutcome: "NOT_EVALUATED" });
  });
  it("uses typed review state without changing Phase 6", () => {
    expect(evaluatePresentationGate(input(presentation(), "PENDING_REVIEW"))).toMatchObject({ releaseState: "INTERNAL_REVIEW_ONLY", crossRowOutcome: "NOT_EVALUATED" });
    expect(evaluatePresentationGate(input(presentation(), "REOPENED"))).toMatchObject({ releaseState: "BLOCKED", blockedBy: [{ category: "review_state_not_current" }] });
  });
  it.each([["MISSING"], ["UNCLEAR"]])("blocks %s from CONFORMS", (upstreamStatus) => {
    const candidate = row({ upstreamStatus, acceptedEvidence: [{ evidenceId: "a", quote: "q", provenance }] });
    const forged = { ...presentation(), upstreamStatus };
    expect(evaluatePresentationGate(input(forged))).toMatchObject({ releaseState: "BLOCKED", blockedBy: [{ category: "conclusion_invariant_violation" }] });
    expect(candidate.upstreamStatus).toBe(upstreamStatus);
  });
  it("blocks unknown upstream status and CONFORMS draft findings", () => {
    const unknown = evaluatePresentationGate(input({ ...presentation(), upstreamStatus: "OTHER" }));
    if (unknown.releaseReady || unknown.releaseState !== "BLOCKED") throw new Error("Expected blocked");
    expect(unknown.blockedBy).toEqual(expect.arrayContaining([expect.objectContaining({ category: "unsupported_upstream_status" })]));
    const p = presentation();
    const drafted = evaluatePresentationGate(input({ ...p, draftFindingResult: { draftFindingType: "NIR_CANDIDATE", draftFindingRecord: { findingId: "draft:row-1", profile: "GENERIC_PRE_VALIDATION", evidenceMapRowId: "row-1", requirementId: "req-1", conformanceConclusion: "ACTION_REQUIRED", draftFindingType: "NIR_CANDIDATE", findingBasis: "Basis", clientResponse: null, reviewerAssessment: "Review", closingRemarks: null } } }));
    if (drafted.releaseReady || drafted.releaseState !== "BLOCKED") throw new Error("Expected blocked");
    expect(drafted.blockedBy).toEqual(expect.arrayContaining([expect.objectContaining({ category: "conclusion_invariant_violation" })]));
  });
  it("allows missing-evidence ACTION_REQUIRED without provenance", () => {
    const candidate = row({ upstreamStatus: "MISSING", acceptedEvidence: [], rejectedEvidence: [], evidenceProvenance: [] });
    expect(evaluatePresentationGate(input(presentation(candidate, { ...assessed, requirementSupport: "NOT_SUPPORTED" })))).toMatchObject({ releaseReady: true });
  });
  it("blocks orphan and unsearched evidence provenance", () => {
    const p = presentation();
    expect(evaluatePresentationGate(input({ ...p, evidenceProvenance: [] }))).toMatchObject({ blockedBy: [{ category: "evidence_provenance_not_linked" }] });
    expect(evaluatePresentationGate(input({ ...p, searchCoverage: { ...p.searchCoverage, searched: false } }))).toMatchObject({ blockedBy: [{ category: "evidence_document_not_searched" }] });
    expect(evaluatePresentationGate(input({ ...p, searchCoverage: { ...p.searchCoverage, searched: false, searchedDocumentIds: ["doc-1"] } }))).toMatchObject({ blockedBy: [{ category: "evidence_document_not_searched" }] });
    expect(evaluatePresentationGate(input({ ...p, searchCoverage: { ...p.searchCoverage, searched: true, searchedDocumentIds: [] } }))).toMatchObject({ blockedBy: [{ category: "evidence_document_not_searched" }] });
    expect(evaluatePresentationGate(input(p))).toMatchObject({ releaseReady: true });
  });
  it("allows multi-method reports and scopes requirement collisions by methodology/version", () => {
    const other = presentation(row({ rowId: "row-2", methodology: { methodologyId: "method-2", rulebookVersion: "v1" } }));
    expect(evaluatePresentationReportGate([input(presentation()), input(other)])).toMatchObject({ releaseReady: true, crossRowOutcome: "NOT_EVALUATED" });
  });
  it("blocks conflicting versions and conclusions within one composite requirement identity", () => {
    const version = presentation(row({ rowId: "row-2", methodology: { methodologyId: "method-1", rulebookVersion: "v2" }, requirement: { requirementId: "req-2", requirementReference: "REQ-2", requirementText: "Other." } }));
    expect(evaluatePresentationReportGate([input(presentation()), input(version)])).toMatchObject({ blockedBy: [{ category: "conflicting_methodology_version" }] });
    const action = presentation(row({ rowId: "row-3", upstreamStatus: "MISSING", acceptedEvidence: [], rejectedEvidence: [], evidenceProvenance: [], searchCoverage: { searched: true, searchedDocumentIds: ["doc-1"], notes: null } }), { ...assessed, requirementSupport: "NOT_SUPPORTED" });
    expect(evaluatePresentationReportGate([input(presentation()), input(action)])).toMatchObject({ blockedBy: [{ category: "conflicting_requirement_conclusion" }] });
  });
  it("blocks APPLICABLE producing NOT_APPLICABLE", () => {
    const p = presentation();
    const bad = evaluatePresentationGate(input({ ...p, conformanceConclusion: { ...p.conformanceConclusion, conclusion: "NOT_APPLICABLE", basis: "explicit_upstream_not_applicable" } }));
    expect(bad.releaseState).toBe("BLOCKED");
    if (bad.releaseState !== "BLOCKED") throw new Error("Expected BLOCKED");
    expect(bad.blockedBy).toEqual(expect.arrayContaining([expect.objectContaining({ category: "applicability_inconsistent" })]));
  });
  it("blocks NOT_APPLICABLE producing non-NOT_APPLICABLE conclusion", () => {
    const candidate = row({ applicabilityState: "NOT_APPLICABLE" });
    const p = presentation(candidate);
    const bad = evaluatePresentationGate(input({ ...p, conformanceConclusion: { ...p.conformanceConclusion, conclusion: "CONFORMS", basis: "supported_applicable_requirement" } }));
    expect(bad.releaseState).toBe("BLOCKED");
    if (bad.releaseState !== "BLOCKED") throw new Error("Expected BLOCKED");
    expect(bad.blockedBy).toEqual(expect.arrayContaining([expect.objectContaining({ category: "applicability_inconsistent" })]));
  });
  it("does not turn a per-row failure into a cross-row contradiction", () => {
    expect(evaluatePresentationReportGate([input({ ...presentation(), finalizedAt: "not-a-date" })])).toMatchObject({ releaseState: "BLOCKED", crossRowOutcome: "NOT_EVALUATED", blockedBy: [{ category: "finalized_at_invalid" }] });
  });
  it("deep-clones and freezes results without formal authority language", () => {
    const mutable = structuredClone(presentation());
    const result = evaluatePresentationGate(input(mutable));
    if (result.releaseReady === false && result.releaseState === "BLOCKED") throw new Error("Expected ready");
    deepFrozen(result); mutable.acceptedEvidence[0].quote = "changed";
    expect(result.presentations[0].acceptedEvidence[0].quote).toBe("Evidence.");
    expect(JSON.stringify(result)).not.toMatch(/approved by vvb|validated|verified|issued/i);
  });
});
