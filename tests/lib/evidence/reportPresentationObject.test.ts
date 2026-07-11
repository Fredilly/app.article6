import { deriveApplicability } from "@/lib/evidence/applicabilityContract";
import { deriveConformanceConclusion, type ConformanceAssessmentInput } from "@/lib/evidence/conformanceConclusionContract";
import { deriveDraftFinding } from "@/lib/evidence/draftFindingContract";
import { createReportPresentationObject, isReportPresentationObject } from "@/lib/evidence/reportPresentationObject";
import type { EvidenceMapRow } from "@/lib/evidence/evidenceMapDependencyContract";

const provenance = { docId: "doc-1", page: 2, sectionPath: ["3", "3.1"], spanId: "span-1", sectionHeading: "Evidence", sourceType: "PDD" };
function row(overrides: Partial<EvidenceMapRow> = {}): EvidenceMapRow {
  return {
    rowId: "row-1", requirement: { requirementId: "req-1", requirementReference: "REQ-1", requirementText: "A requirement." },
    methodology: { methodologyId: "method-1", rulebookVersion: "v1.0" }, upstreamStatus: "MISSING", applicabilityState: "APPLICABLE",
    acceptedEvidence: [{ evidenceId: "accepted-1", quote: "Accepted quote.", provenance }],
    rejectedEvidence: [{ evidenceId: "rejected-1", quote: "Rejected quote.", rejectionReason: "Boilerplate.", provenance }],
    assessmentReason: "The requirement is not demonstrated.", clientAction: "Provide supporting evidence.",
    searchCoverage: { searched: true, searchedDocumentIds: ["doc-1"], notes: "Searched source." },
    sourceDocument: { documentId: "doc-1", documentName: "source.pdf", contentSha256: "hash-1" }, evidenceProvenance: [provenance],
    finalizationState: "finalized", finalizationActorRef: "actor-1", finalizedAt: "2026-07-10T00:00:00Z", finalizationBasis: "reviewed row",
    reviewHistoryRef: "history-1", evidenceMapContractVersion: "v1", reviewPolicyVersion: "policy-v1", ...overrides,
  };
}
const conformanceAssessment: ConformanceAssessmentInput = {
  requirementSupport: "NOT_SUPPORTED", searchCoverageAssessment: "ADEQUATE", provenanceAssessment: "COMPLETE",
  versionIdentityAssessment: "MATCHED", contradictionAssessment: "NONE",
};
function inputs(candidate: EvidenceMapRow = row()) {
  const applicability = deriveApplicability(candidate, { decision: "APPLICABLE", decisionBasis: "  Requirement applies to this project.  " });
  const conformance = deriveConformanceConclusion(candidate, applicability, conformanceAssessment);
  const draftFinding = deriveDraftFinding(candidate, conformance, { draftFindingType: "NIR_CANDIDATE", findingBasis: "Provide missing evidence.", reviewerAssessment: "Candidate for review." });
  return { applicability, conformance, draftFinding };
}
function expectDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  Object.values(value).forEach(expectDeepFrozen);
}

describe("createReportPresentationObject", () => {
  it("keeps the strict Phase 6 validator fail-closed for missing metadata and identity mismatch", () => {
    const candidate = row();
    const { applicability, conformance, draftFinding } = inputs(candidate);
    const result = createReportPresentationObject(candidate, applicability, conformance, draftFinding);
    if (!result.ready) throw new Error("Expected a ready presentation");
    const missingMetadata = { ...result.presentation };
    delete (missingMetadata as { finalizationActorRef?: string }).finalizationActorRef;
    const mismatchedApplicability = {
      ...result.presentation,
      applicabilityResult: { ...result.presentation.applicabilityResult, evidenceMapRowId: "other-row" },
    };
    expect(isReportPresentationObject(missingMetadata)).toBe(false);
    expect(isReportPresentationObject(mismatchedApplicability)).toBe(false);
  });

  it("packages a valid finalized row into one immutable presentation object", () => {
    const candidate = row();
    const before = structuredClone(candidate);
    const { applicability, conformance, draftFinding } = inputs(candidate);
    const result = createReportPresentationObject(candidate, applicability, conformance, draftFinding);
    expect(result).toMatchObject({ ready: true, presentation: {
      profile: "GENERIC_PRE_VALIDATION", evidenceMapRowId: "row-1", presentationContractVersion: "v1",
      applicabilityResult: applicability, conformanceConclusion: conformance, draftFindingResult: draftFinding,
      requirement: candidate.requirement, methodology: candidate.methodology, upstreamStatus: "MISSING",
      assessmentReason: candidate.assessmentReason, clientAction: candidate.clientAction,
      finalizationActorRef: candidate.finalizationActorRef, finalizedAt: candidate.finalizedAt,
      finalizationBasis: candidate.finalizationBasis, reviewHistoryRef: candidate.reviewHistoryRef,
      evidenceMapContractVersion: candidate.evidenceMapContractVersion, reviewPolicyVersion: candidate.reviewPolicyVersion,
      machineProposalTraceability: null,
    } });
    if (!result.ready) throw new Error("Expected a ready presentation");
    expect(result.presentation.acceptedEvidence).toEqual(candidate.acceptedEvidence);
    expect(result.presentation.rejectedEvidence).toEqual(candidate.rejectedEvidence);
    expect(result.presentation.evidenceProvenance).toEqual(candidate.evidenceProvenance);
    expect(result.presentation.sourceDocument).toEqual(candidate.sourceDocument);
    expect(result.presentation.applicabilityResult).toEqual({ applicability: "APPLICABLE", evidenceMapRowId: "row-1", basis: "explicit_applicable_decision", decisionBasis: "Requirement applies to this project." });
    expect(candidate).toEqual(before);
    expect(Object.isFrozen(result.presentation)).toBe(true);
    expect(Object.isFrozen(result.presentation.acceptedEvidence)).toBe(true);
    expect(Object.isFrozen(result.presentation.rejectedEvidence[0])).toBe(true);
  });
  it("preserves supplied conclusions and draft classifications without recalculation", () => {
    const candidate = row();
    const { applicability, conformance, draftFinding } = inputs(candidate);
    const result = createReportPresentationObject(candidate, applicability, conformance, draftFinding);
    if (!result.ready) throw new Error("Expected a ready presentation");
    expect(result.presentation.conformanceConclusion).toEqual(conformance);
    expect(result.presentation.draftFindingResult).toEqual(draftFinding);
    expect(result.presentation.draftFindingResult).toMatchObject({ draftFindingType: "NIR_CANDIDATE" });
  });
  it.each(["applicability", "conformance", "draftFinding"])("fails closed for a %s row identity mismatch", (kind) => {
    const candidate = row();
    const other = row({ rowId: "row-2" });
    const current = inputs(candidate);
    const foreign = inputs(other);
    const result = createReportPresentationObject(candidate, kind === "applicability" ? foreign.applicability : current.applicability, kind === "conformance" ? foreign.conformance : current.conformance, kind === "draftFinding" ? foreign.draftFinding : current.draftFinding);
    expect(result).toMatchObject({ ready: false, conclusion: "NOT_ASSESSED" });
    const category = kind === "draftFinding" ? "draft_finding_row_id_mismatch" : `${kind}_row_id_mismatch`;
    expect(result).toMatchObject({ blockedBy: [expect.objectContaining({ category })] });
  });
  it("rejects blocked applicability and blocked conformance", () => {
    const candidate = row();
    const blockedApplicability = deriveApplicability(candidate, { decision: "NOT_EVALUATED", decisionBasis: null });
    expect(createReportPresentationObject(candidate, blockedApplicability, null, null)).toMatchObject({ ready: false, blockedBy: [{ category: "applicability_blocked" }] });
    const { applicability } = inputs(candidate);
    const blockedConformance = deriveConformanceConclusion(candidate, applicability, { ...conformanceAssessment, requirementSupport: "NOT_EVALUATED" });
    expect(createReportPresentationObject(candidate, applicability, blockedConformance, null)).toMatchObject({ ready: false, blockedBy: [{ category: "conformance_blocked" }] });
  });
  it("rejects malformed input and draft/conclusion contradictions", () => {
    const malformed = createReportPresentationObject({}, null, null, null);
    expect(malformed).toMatchObject({ ready: false });
    if (malformed.ready) throw new Error("Expected malformed input to be blocked");
    expect(malformed.blockedBy).toEqual(expect.arrayContaining([expect.objectContaining({ category: "evidence_map_dependency_blocked" })]));
    const candidate = row({ applicabilityState: "NOT_APPLICABLE", upstreamStatus: "FOUND" });
    const applicability = deriveApplicability(candidate, { decision: "NOT_APPLICABLE", decisionBasis: "Not applicable." });
    const conformance = deriveConformanceConclusion(candidate, applicability, { ...conformanceAssessment, requirementSupport: "SUPPORTED" });
    const draft = deriveDraftFinding(candidate, conformance, { draftFindingType: "NIR_CANDIDATE", findingBasis: "Basis.", reviewerAssessment: "Review." });
    expect(createReportPresentationObject(candidate, applicability, conformance, draft)).toMatchObject({ ready: false, blockedBy: [{ category: "draft_finding_blocked" }] });
  });
  it("rejects adversarial result shapes and draft identity corruption", () => {
    const candidate = row();
    const { applicability, conformance, draftFinding } = inputs(candidate);
    if (draftFinding.draftFindingRecord === null) throw new Error("Expected a draft finding record");
    expect(createReportPresentationObject(candidate, applicability, conformance, {
      ...draftFinding,
      draftFindingRecord: { ...draftFinding.draftFindingRecord, requirementId: "wrong-requirement" },
    })).toMatchObject({ ready: false, blockedBy: [{ category: "draft_finding_requirement_id_mismatch" }] });
    expect(createReportPresentationObject(candidate, applicability, conformance, {
      ...draftFinding,
      draftFindingRecord: { ...draftFinding.draftFindingRecord, findingId: "draft:wrong-row" },
    })).toMatchObject({ ready: false, blockedBy: [{ category: "draft_finding_id_mismatch" }] });
    expect(createReportPresentationObject(candidate, applicability, conformance, {
      ...draftFinding,
      issued: true,
    })).toMatchObject({ ready: false, blockedBy: [{ category: "invalid_draft_finding_result" }] });
    expect(createReportPresentationObject(candidate, applicability, {
      ...conformance,
      authority: "formal",
    }, draftFinding)).toMatchObject({ ready: false, blockedBy: [{ category: "invalid_conformance_result" }] });

    const blocked = deriveConformanceConclusion(candidate, applicability, { ...conformanceAssessment, requirementSupport: "NOT_EVALUATED" });
    if (blocked.conclusion !== "NOT_ASSESSED") throw new Error("Expected a blocked conformance result");
    expect(createReportPresentationObject(candidate, applicability, {
      ...blocked,
      blockedBy: [{ category: "forged_blocker" }],
    }, draftFinding)).toMatchObject({ ready: false, blockedBy: [{ category: "invalid_conformance_result" }] });
  });
  it("does not add formal authority fields or language", () => {
    const candidate = row();
    const { applicability, conformance, draftFinding } = inputs(candidate);
    const result = createReportPresentationObject(candidate, applicability, conformance, draftFinding);
    expect(JSON.stringify(result)).not.toMatch(/issued|approved|closed|validated|verified|authority/i);
    if (!result.ready) throw new Error("Expected a ready presentation");
    expect(Object.keys(result.presentation)).not.toEqual(expect.arrayContaining(["finding", "authority", "approval", "validation"]));
  });
  it("deep-clones shallow-frozen Evidence Map and validated result inputs", () => {
    const candidate = row();
    Object.freeze(candidate.acceptedEvidence);
    Object.freeze(candidate.rejectedEvidence);
    const { applicability, conformance, draftFinding } = inputs(candidate);
    Object.freeze(applicability);
    Object.freeze(conformance);
    Object.freeze(draftFinding);

    if (draftFinding.draftFindingRecord === null) throw new Error("Expected a draft finding record");
    const originalAcceptedItem = candidate.acceptedEvidence[0];
    const originalApplicability = applicability;
    const originalConformance = conformance;
    const originalDraftRecord = draftFinding.draftFindingRecord;
    const result = createReportPresentationObject(candidate, applicability, conformance, draftFinding);
    if (!result.ready) throw new Error("Expected a ready presentation");

    expect(result.presentation.acceptedEvidence).not.toBe(candidate.acceptedEvidence);
    expect(result.presentation.acceptedEvidence[0]).not.toBe(originalAcceptedItem);
    expect(result.presentation.acceptedEvidence[0].provenance).not.toBe(originalAcceptedItem.provenance);
    expect(result.presentation.applicabilityResult).not.toBe(originalApplicability);
    expect(result.presentation.conformanceConclusion).not.toBe(originalConformance);
    expect(result.presentation.draftFindingResult).not.toBe(draftFinding);
    expect(result.presentation.draftFindingResult.draftFindingRecord).not.toBe(originalDraftRecord);
    expectDeepFrozen(result.presentation);

    const mutableAcceptedItem = originalAcceptedItem as unknown as { quote: string; provenance: { sectionHeading: string } };
    mutableAcceptedItem.quote = "Mutated after packaging.";
    mutableAcceptedItem.provenance.sectionHeading = "Mutated heading.";
    expect(result.presentation.acceptedEvidence[0].quote).toBe("Accepted quote.");
    expect(result.presentation.acceptedEvidence[0].provenance.sectionHeading).toBe("Evidence");
  });
});
