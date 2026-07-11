/** @jest-environment jsdom */

import { describe, expect, test } from "@jest/globals";
import { act } from "react";
import { createRoot } from "react-dom/client";
import ProjectPreValidationReadinessReport from "@/components/projects/ProjectPreValidationReadinessReport";
import { clearProjectReadinessPayload, saveProjectReadinessPayload } from "@/lib/evidence/projectReadinessPayload";
import { createReadinessReportViewModel } from "@/lib/evidence/readinessReport";
import { deriveApplicability } from "@/lib/evidence/applicabilityContract";
import { deriveConformanceConclusion } from "@/lib/evidence/conformanceConclusionContract";
import { deriveDraftFinding } from "@/lib/evidence/draftFindingContract";
import { createReportPresentationObject } from "@/lib/evidence/reportPresentationObject";
import type { EvidenceMapRow } from "@/lib/evidence/evidenceMapDependencyContract";

function realPresentation() {
  const provenance = { docId: "project-pdd.pdf", page: 5, sectionPath: ["2"], spanId: "project-span-1", sectionHeading: "Requirement", sourceType: "PDD" };
  const row: EvidenceMapRow = { rowId: "project-row-1", requirement: { requirementId: "project-req-1", requirementReference: "REQ-1", requirementText: "Project requirement." }, methodology: { methodologyId: "VM0007", rulebookVersion: "1.8" }, upstreamStatus: "FOUND", applicabilityState: "APPLICABLE", acceptedEvidence: [{ evidenceId: "project-evidence-1", quote: "Project evidence.", provenance }], rejectedEvidence: [], assessmentReason: "Project review assessment.", clientAction: null, searchCoverage: { searched: true, searchedDocumentIds: ["project-pdd.pdf"], notes: null }, sourceDocument: { documentId: "project-pdd.pdf", documentName: "Project PDD", contentSha256: "sha256:project" }, evidenceProvenance: [provenance], finalizationState: "finalized", finalizationActorRef: "reviewer:project", finalizedAt: "2026-07-11T00:00:00Z", finalizationBasis: "Finalized project review.", reviewHistoryRef: "history:project-row-1", evidenceMapContractVersion: "v1", reviewPolicyVersion: "policy-v1" };
  const applicability = deriveApplicability(row, { decision: "APPLICABLE", decisionBasis: "Project requirement applies." });
  const conformance = deriveConformanceConclusion(row, applicability, { requirementSupport: "SUPPORTED", searchCoverageAssessment: "ADEQUATE", provenanceAssessment: "COMPLETE", versionIdentityAssessment: "MATCHED", contradictionAssessment: "NONE" });
  const draft = deriveDraftFinding(row, conformance, { draftFindingType: null, findingBasis: null, reviewerAssessment: null });
  const packaged = createReportPresentationObject(row, applicability, conformance, draft);
  if (!packaged.ready) throw new Error("Expected valid project presentation");
  return packaged.presentation;
}

describe("ProjectPreValidationReadinessReport", () => {
  beforeEach(() => window.localStorage.clear());

  test("renders not-assessed when the real project payload is missing", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => { root.render(<ProjectPreValidationReadinessReport projectId="missing-project" />); });
    expect(container.textContent).toContain("not assessed");
    act(() => { root.unmount(); });
  });

  test("renders a blocked real gate result and preserves the reviewer surface", async () => {
    const presentation = realPresentation();
    expect(saveProjectReadinessPayload({ projectId: "project-1", gateResult: {
      releaseReady: false,
      releaseState: "BLOCKED",
      crossRowOutcome: "NOT_EVALUATED",
      presentations: [presentation],
      blockedBy: [{ category: "review_state_not_current", evidenceMapRowId: presentation.evidenceMapRowId, detail: "REOPENED" }],
    } })).toBe(true);
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => { root.render(<ProjectPreValidationReadinessReport projectId="project-1" />); });
    expect(container.textContent).toContain("blocked");
    expect(container.textContent).toContain("Project evidence.");
    act(() => { root.unmount(); });
  });

  test("updates immediately for the linked project's save and clear events, but ignores another project", async () => {
    const presentation = realPresentation();
    const gateResult = {
      releaseReady: false as const,
      releaseState: "BLOCKED" as const,
      crossRowOutcome: "NOT_EVALUATED" as const,
      presentations: [presentation],
      blockedBy: [{ category: "review_state_not_current" as const, evidenceMapRowId: presentation.evidenceMapRowId, detail: "REOPENED" }],
    };
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => { root.render(<ProjectPreValidationReadinessReport projectId="project-1" />); });
    expect(container.textContent).toContain("not assessed");

    await act(async () => { expect(saveProjectReadinessPayload({ projectId: "project-1", gateResult })).toBe(true); });
    expect(container.textContent).toContain("Project evidence.");

    await act(async () => { expect(saveProjectReadinessPayload({ projectId: "project-2", gateResult })).toBe(true); });
    expect(container.textContent).toContain("Project evidence.");

    await act(async () => { expect(clearProjectReadinessPayload("project-1")).toBe(true); });
    expect(container.textContent).toContain("not assessed");
    act(() => { root.unmount(); });
  });
});
