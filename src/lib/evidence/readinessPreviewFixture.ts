import { deriveApplicability } from "@/lib/evidence/applicabilityContract";
import { deriveConformanceConclusion } from "@/lib/evidence/conformanceConclusionContract";
import type { EvidenceMapRow } from "@/lib/evidence/evidenceMapDependencyContract";
import { deriveDraftFinding } from "@/lib/evidence/draftFindingContract";
import { evaluatePresentationGate, type PresentationGateResult, type PresentationReviewState } from "@/lib/evidence/presentationGate";
import { createReportPresentationObject } from "@/lib/evidence/reportPresentationObject";
import type { ReviewerWorkflowState } from "@/lib/evidence/readinessReport";

export type ReadinessPreviewScenario = "client-release-ready" | "internal-review-only" | "blocked" | "not-assessed";

export type ReadinessPreviewFixture = Readonly<{
  scenario: ReadinessPreviewScenario;
  gateResult: PresentationGateResult;
  workflowState?: ReviewerWorkflowState;
}>;

const provenance = {
  docId: "fixture-reviewed-pdd.pdf",
  page: 25,
  sectionPath: ["2", "2.2"],
  spanId: "span:preview-accepted-1",
  sectionHeading: "Applicability of Methodology",
  sourceType: "PDD",
};
const rejectedProvenance = {
  docId: "fixture-reviewed-pdd.pdf",
  page: 24,
  sectionPath: ["2", "2.1"],
  spanId: "span:preview-rejected-1",
  sectionHeading: "Methodology Reference",
  sourceType: "PDD",
};

const row: EvidenceMapRow = {
  rowId: "preview-row-1",
  requirement: { requirementId: "preview-req-1", requirementReference: "VM0007-2.2", requirementText: "The project satisfies the applicability condition." },
  methodology: { methodologyId: "VM0007", rulebookVersion: "1.8" },
  upstreamStatus: "FOUND",
  applicabilityState: "APPLICABLE",
  acceptedEvidence: [{ evidenceId: "preview-accepted-1", quote: "The project satisfies this condition.", provenance }],
  rejectedEvidence: [{ evidenceId: "preview-rejected-1", quote: "Table of Contents", rejectionReason: "Navigation text is not project evidence.", provenance: rejectedProvenance }],
  assessmentReason: "Reviewed against the project description.",
  clientAction: "No client action recorded.",
  searchCoverage: { searched: true, searchedDocumentIds: [provenance.docId, rejectedProvenance.docId], notes: null },
  sourceDocument: { documentId: provenance.docId, documentName: "Fixture-reviewed PDD", contentSha256: "sha256:readiness-preview" },
  evidenceProvenance: [provenance, rejectedProvenance],
  finalizationState: "finalized",
  finalizationActorRef: "reviewer:readiness-preview",
  finalizedAt: "2026-07-11T00:00:00Z",
  finalizationBasis: "Fixture-backed Phase 9 preview.",
  reviewHistoryRef: "history:readiness-preview",
  evidenceMapContractVersion: "v1",
  reviewPolicyVersion: "policy-v1",
};

const assessment = {
  requirementSupport: "SUPPORTED",
  searchCoverageAssessment: "ADEQUATE",
  provenanceAssessment: "COMPLETE",
  versionIdentityAssessment: "MATCHED",
  contradictionAssessment: "NONE",
} as const;

function gateFor(reviewState?: PresentationReviewState): PresentationGateResult {
  const applicability = deriveApplicability(row, { decision: "APPLICABLE", decisionBasis: "The reviewed row marks this requirement applicable." });
  const conformance = deriveConformanceConclusion(row, applicability, assessment);
  const draftFinding = deriveDraftFinding(row, conformance, { draftFindingType: null, findingBasis: null, reviewerAssessment: null });
  const presentation = createReportPresentationObject(row, applicability, conformance, draftFinding);
  if (!presentation.ready) return evaluatePresentationGate(null);
  return evaluatePresentationGate(reviewState === undefined ? { presentation: presentation.presentation } : { presentation: presentation.presentation, reviewState });
}

export function buildReadinessPreviewFixture(scenario: ReadinessPreviewScenario): ReadinessPreviewFixture {
  if (scenario === "not-assessed") return { scenario, gateResult: evaluatePresentationGate(null) };
  if (scenario === "internal-review-only") return { scenario, gateResult: gateFor("PENDING_REVIEW"), workflowState: "pending review" };
  if (scenario === "blocked") return { scenario, gateResult: gateFor("REOPENED"), workflowState: "reopened" };
  return { scenario, gateResult: gateFor(), workflowState: "approved" };
}
