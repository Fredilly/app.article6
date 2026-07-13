import { buildMachineEvidenceMapPresentation, buildReviewedEvidenceMapPresentation, summarizeEvidenceMapPresentation } from "@/components/preverif/evidence-map/evidenceMapPresentationModel";
import type { Vm0007EvidenceMapDraftPackage } from "@/lib/preverif/vm0007EvidenceMapDraft";
import type { ReviewedEvidenceMapSnapshot } from "@/lib/preverif/reviewedEvidenceMapTypes";

test("machine and reviewed presentations use separate status, outcome, and evidence fields without mutation", () => {
  const provenance = { docId: "doc", page: 1, sectionPath: ["Machine"], spanId: "machine-span", sectionHeading: "Machine", sourceType: "PDD" };
  const machine = { rows: [{ rowId: "row", stableRuleId: "rule", ruleReference: "R-1", ruleTitle: "Rule", requirementText: "Requirement", proposedEvidenceStatus: "MISSING", proposedApplicability: "APPLICABLE", proposedAcceptedEvidence: { quote: "Machine quote", provenance }, proposedRejectedEvidence: null, reviewState: "pending review", assessmentReason: "Machine reason", gap: "Machine gap", clientAction: "Machine action", rawAuditStatus: "missing_evidence", confidence: "low" }] } as Vm0007EvidenceMapDraftPackage;
  const reviewed = { readOnly: true, rows: [{ rowId: "row", stableRuleId: "rule", ruleReference: "R-1", requirementText: "Requirement", finalEvidenceState: "FOUND", reviewerOutcome: "CONFORMS", reviewerEvidence: [{ quote: "Reviewed quote", page: 9, section: "Reviewed", spanId: "reviewed-span", provenance: { ...provenance, page: 9, spanId: "reviewed-span", sectionHeading: "Reviewed" } }], rejectedEvidence: [], draftFindingCandidate: null, contradictionState: "NONE_IDENTIFIED", clientAction: "" }] } as ReviewedEvidenceMapSnapshot;
  const before = structuredClone(machine);
  const machineView = buildMachineEvidenceMapPresentation(machine);
  const reviewedView = buildReviewedEvidenceMapPresentation(reviewed);
  expect(machineView.rows[0]).toMatchObject({ evidenceState: "MISSING", acceptedEvidence: [{ quote: "Machine quote" }] });
  expect(reviewedView.rows[0]).toMatchObject({ evidenceState: "FOUND", reviewerOutcome: "CONFORMS", acceptedEvidence: [{ quote: "Reviewed quote", page: 9 }] });
  expect(summarizeEvidenceMapPresentation(reviewedView.rows)).toMatchObject({ found: 1, actionRequired: 0 });
  expect(machine).toEqual(before);
});
