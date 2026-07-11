import { describe, expect, it } from "@jest/globals";
import type { EvidenceMapRow } from "@/lib/evidence/evidenceMapDependencyContract";
import { isReportPresentationObject } from "@/lib/evidence/reportPresentationObject";
import { evaluatePresentationReportGate } from "@/lib/evidence/presentationGate";
import {
  migrateReviewedFixtureTruth,
  type ReviewedFixtureTruth,
} from "../../fixtures/fixturePresentationAdapter";

const acceptedProvenance = {
  docId: "reviewed-pdd.pdf",
  page: 25,
  sectionPath: ["2", "2.2"],
  spanId: "span:accepted-1",
  sectionHeading: "Applicability of Methodology",
  sourceType: "PDD",
} as const;
const rejectedProvenance = {
  docId: "reviewed-pdd.pdf",
  page: 24,
  sectionPath: ["2", "2.1"],
  spanId: "span:rejected-1",
  sectionHeading: "Methodology Reference",
  sourceType: "PDD",
} as const;

function row(overrides: Partial<EvidenceMapRow> = {}): EvidenceMapRow {
  return {
    rowId: "fixture-row-1",
    requirement: {
      requirementId: "req-1",
      requirementReference: "VM0007-2.2",
      requirementText: "The project satisfies the applicability condition.",
    },
    methodology: { methodologyId: "VM0007", rulebookVersion: "1.8" },
    upstreamStatus: "FOUND",
    applicabilityState: "APPLICABLE",
    acceptedEvidence: [{ evidenceId: "accepted-1", quote: "The project satisfies this condition.", provenance: acceptedProvenance }],
    rejectedEvidence: [{ evidenceId: "rejected-1", quote: "Table of Contents", rejectionReason: "Navigation text is not project evidence.", provenance: rejectedProvenance }],
    assessmentReason: "Reviewed against the project description.",
    clientAction: null,
    searchCoverage: { searched: true, searchedDocumentIds: ["reviewed-pdd.pdf"], notes: null },
    sourceDocument: { documentId: "reviewed-pdd.pdf", documentName: "Reviewed PDD", contentSha256: "sha256:fixture" },
    evidenceProvenance: [acceptedProvenance, rejectedProvenance],
    finalizationState: "finalized",
    finalizationActorRef: "reviewer:fixture",
    finalizedAt: "2026-07-11T00:00:00Z",
    finalizationBasis: "Reviewed fixture truth.",
    reviewHistoryRef: "history:fixture-row-1",
    evidenceMapContractVersion: "v1",
    reviewPolicyVersion: "policy-v1",
    ...overrides,
  };
}

const supportedAssessment = {
  requirementSupport: "SUPPORTED",
  searchCoverageAssessment: "ADEQUATE",
  provenanceAssessment: "COMPLETE",
  versionIdentityAssessment: "MATCHED",
  contradictionAssessment: "NONE",
} as const;

function truth(overrides: Partial<ReviewedFixtureTruth> = {}): ReviewedFixtureTruth {
  return {
    row: row(),
    applicabilityAssessment: { decision: "APPLICABLE", decisionBasis: "The reviewed row marks this requirement applicable." },
    conformanceAssessment: supportedAssessment,
    draftFindingAssessment: { draftFindingType: null, findingBasis: null, reviewerAssessment: null },
    ...overrides,
  };
}

describe("migrateReviewedFixtureTruth", () => {
  it("preserves accepted, rejected, and canonical provenance fields unchanged", () => {
    const reviewed = truth();
    const migrated = migrateReviewedFixtureTruth(reviewed);

    expect(migrated.finalizedEvidenceMapRow).toBe(reviewed.row);
    expect(migrated.finalizedEvidenceMapRow.acceptedEvidence).toEqual(reviewed.row.acceptedEvidence);
    expect(migrated.finalizedEvidenceMapRow.rejectedEvidence).toEqual(reviewed.row.rejectedEvidence);
    expect(migrated.finalizedEvidenceMapRow.evidenceProvenance).toEqual(reviewed.row.evidenceProvenance);
    expect(migrated.presentationResult).toMatchObject({ ready: true });
    if (!migrated.presentationResult.ready) throw new Error("Expected strict presentation object");
    expect(migrated.presentationResult.presentation.acceptedEvidence).toEqual(reviewed.row.acceptedEvidence);
    expect(migrated.presentationResult.presentation.rejectedEvidence).toEqual(reviewed.row.rejectedEvidence);
    expect(migrated.presentationResult.presentation.evidenceProvenance).toEqual(reviewed.row.evidenceProvenance);
    expect(isReportPresentationObject(migrated.presentationResult.presentation)).toBe(true);
  });

  it("does not silently drop a rejected evidence item during adaptation", () => {
    const reviewed = truth();
    const migrated = migrateReviewedFixtureTruth(reviewed);
    if (!migrated.presentationResult.ready) throw new Error("Expected presentation");
    expect(migrated.presentationResult.presentation.rejectedEvidence).toHaveLength(1);
    expect(migrated.presentationResult.presentation.rejectedEvidence[0]).toEqual(reviewed.row.rejectedEvidence[0]);
    expect(migrated.presentationResult.presentation.acceptedEvidence).not.toContainEqual(reviewed.row.rejectedEvidence[0]);
  });

  it("keeps upstream status unchanged and produces typed release-ready expectations", () => {
    const reviewed = truth();
    const migrated = migrateReviewedFixtureTruth(reviewed);
    expect(reviewed.row.upstreamStatus).toBe("FOUND");
    expect(migrated.finalizedEvidenceMapRow.upstreamStatus).toBe("FOUND");
    expect(migrated.applicabilityResult).toMatchObject({ applicability: "APPLICABLE" });
    expect(migrated.conformanceResult).toMatchObject({ conclusion: "CONFORMS" });
    expect(migrated.draftFindingResult).toEqual({ draftFindingType: null, draftFindingRecord: null });
    expect(migrated.gateResult).toMatchObject({ releaseState: "PRE_VALIDATION_RELEASE_READY", releaseReady: true, crossRowOutcome: "NOT_EVALUATED" });
  });

  it("uses explicit assessments for action-required and pending-review fixtures", () => {
    const action = migrateReviewedFixtureTruth(truth({
      row: row({ upstreamStatus: "UNCLEAR", acceptedEvidence: [], evidenceProvenance: [rejectedProvenance] }),
      conformanceAssessment: { ...supportedAssessment, requirementSupport: "NOT_SUPPORTED" },
      draftFindingAssessment: { draftFindingType: "NIR_CANDIDATE", findingBasis: "The evidence needs clarification.", reviewerAssessment: "Review the missing project-specific detail." },
      reviewState: "PENDING_REVIEW",
    }));
    expect(action.conformanceResult).toMatchObject({ conclusion: "ACTION_REQUIRED" });
    expect(action.draftFindingResult).toMatchObject({ draftFindingType: "NIR_CANDIDATE" });
    expect(action.gateResult).toMatchObject({ releaseState: "INTERNAL_REVIEW_ONLY", releaseReady: false });
  });

  it("fails closed for contradictory fixture expectations", () => {
    const contradictory = migrateReviewedFixtureTruth(truth({
      row: row({ upstreamStatus: "UNCLEAR" }),
      conformanceAssessment: supportedAssessment,
    }));
    expect(contradictory.conformanceResult).toMatchObject({ conclusion: "NOT_ASSESSED" });
    expect(contradictory.presentationResult).toMatchObject({ ready: false, conclusion: "NOT_ASSESSED" });
    expect(contradictory.gateResult).toMatchObject({ releaseState: "BLOCKED", releaseReady: false });
  });

  it("keeps single-row cross-row outcome unevaluated and passes compatible multi-row fixtures", () => {
    const first = migrateReviewedFixtureTruth(truth());
    const second = migrateReviewedFixtureTruth(truth({ row: row({ rowId: "fixture-row-2", requirement: { requirementId: "req-2", requirementReference: "VM0007-2.3", requirementText: "Another requirement." } }) }));
    if (!first.presentationResult.ready || !second.presentationResult.ready) throw new Error("Expected presentations");
    expect(first.gateResult.crossRowOutcome).toBe("NOT_EVALUATED");
    expect(evaluatePresentationReportGate([
      { presentation: first.presentationResult.presentation },
      { presentation: second.presentationResult.presentation },
    ])).toMatchObject({ releaseReady: true, crossRowOutcome: "PASS" });
  });
});
