import { deriveApplicability } from "@/lib/evidence/applicabilityContract";
import { deriveConformanceConclusion } from "@/lib/evidence/conformanceConclusionContract";
import type { EvidenceMapRow } from "@/lib/evidence/evidenceMapDependencyContract";
import { deriveDraftFinding } from "@/lib/evidence/draftFindingContract";
import { createReportPresentationObject } from "@/lib/evidence/reportPresentationObject";
import { evaluatePresentationGate } from "@/lib/evidence/presentationGate";

const p = { docId: "doc-1", page: 4, sectionPath: ["3"], spanId: "span-1", sectionHeading: "Evidence", sourceType: "PDD" };
export function presentationGateFixture({ blocked = false } = {}) {
  const row: EvidenceMapRow = { rowId: "row-1", requirement: { requirementId: "req-1", requirementReference: "REQ-1", requirementText: "Requirement text." }, methodology: { methodologyId: "VM", rulebookVersion: "1.0" }, upstreamStatus: "FOUND", applicabilityState: "APPLICABLE", acceptedEvidence: [{ evidenceId: "accepted", quote: "Accepted quote", provenance: p }], rejectedEvidence: [{ evidenceId: "rejected", quote: "Rejected quote", rejectionReason: "Out of scope", provenance: p }], assessmentReason: "Reviewed.", clientAction: "Provide appendix.", searchCoverage: { searched: true, searchedDocumentIds: ["doc-1"], notes: null }, sourceDocument: { documentId: "doc-1", documentName: "source.pdf", contentSha256: "hash" }, evidenceProvenance: [p], finalizationState: "finalized", finalizationActorRef: "reviewer", finalizedAt: "2026-07-10T00:00:00Z", finalizationBasis: "Reviewed.", reviewHistoryRef: "history", evidenceMapContractVersion: "v1", reviewPolicyVersion: "policy-v1" };
  const applicability = deriveApplicability(row, { decision: "APPLICABLE", decisionBasis: "Applies." });
  const conclusion = deriveConformanceConclusion(row, applicability, { requirementSupport: "SUPPORTED", searchCoverageAssessment: "ADEQUATE", provenanceAssessment: "COMPLETE", versionIdentityAssessment: "MATCHED", contradictionAssessment: "NONE" });
  const draft = deriveDraftFinding(row, conclusion, { draftFindingType: null, findingBasis: null, reviewerAssessment: null });
  const result = createReportPresentationObject(row, applicability, conclusion, draft);
  if (!result.ready) throw new Error("expected presentation");
  return evaluatePresentationGate(blocked ? { presentation: result.presentation, reviewState: "REOPENED" } : { presentation: result.presentation });
}
