/** @jest-environment jsdom */

import { describe, expect, test } from "@jest/globals";
import { deriveApplicability } from "@/lib/evidence/applicabilityContract";
import { deriveConformanceConclusion } from "@/lib/evidence/conformanceConclusionContract";
import type { EvidenceMapRow } from "@/lib/evidence/evidenceMapDependencyContract";
import { deriveDraftFinding } from "@/lib/evidence/draftFindingContract";
import { createReportPresentationObject } from "@/lib/evidence/reportPresentationObject";
import { createReadinessReportViewModel } from "@/lib/evidence/readinessReport";
import { createProjectReadinessReportViewModel, hasProjectReadinessPayload, loadProjectReadinessPayload, projectReadinessPayloadStorageKey, saveProjectReadinessPayload } from "@/lib/evidence/projectReadinessPayload";

describe("project readiness payload boundary", () => {
  function realGateResult() {
    const provenance = { docId: "project-pdd.pdf", page: 5, sectionPath: ["2"], spanId: "project-span-1", sectionHeading: "Requirement", sourceType: "PDD" };
    const row: EvidenceMapRow = {
      rowId: "project-row-1",
      requirement: { requirementId: "project-req-1", requirementReference: "REQ-1", requirementText: "Project requirement." },
      methodology: { methodologyId: "VM0007", rulebookVersion: "1.8" },
      upstreamStatus: "FOUND",
      applicabilityState: "APPLICABLE",
      acceptedEvidence: [{ evidenceId: "project-evidence-1", quote: "Project evidence.", provenance }],
      rejectedEvidence: [],
      assessmentReason: "Project review assessment.",
      clientAction: null,
      searchCoverage: { searched: true, searchedDocumentIds: ["project-pdd.pdf"], notes: null },
      sourceDocument: { documentId: "project-pdd.pdf", documentName: "Project PDD", contentSha256: "sha256:project" },
      evidenceProvenance: [provenance],
      finalizationState: "finalized",
      finalizationActorRef: "reviewer:project",
      finalizedAt: "2026-07-11T00:00:00Z",
      finalizationBasis: "Finalized project review.",
      reviewHistoryRef: "history:project-row-1",
      evidenceMapContractVersion: "v1",
      reviewPolicyVersion: "policy-v1",
    };
    const applicability = deriveApplicability(row, { decision: "APPLICABLE", decisionBasis: "Project requirement applies." });
    const conformance = deriveConformanceConclusion(row, applicability, { requirementSupport: "SUPPORTED", searchCoverageAssessment: "ADEQUATE", provenanceAssessment: "COMPLETE", versionIdentityAssessment: "MATCHED", contradictionAssessment: "NONE" });
    const draft = deriveDraftFinding(row, conformance, { draftFindingType: null, findingBasis: null, reviewerAssessment: null });
    const packaged = createReportPresentationObject(row, applicability, conformance, draft);
    if (!packaged.ready) throw new Error("Expected valid project presentation");
    return { releaseReady: true, releaseState: "PRE_VALIDATION_RELEASE_READY", crossRowOutcome: "NOT_EVALUATED", presentations: [packaged.presentation] } as const;
  }

  test("fails closed when the project payload is missing or invalid", () => {
    expect(createProjectReadinessReportViewModel(null).release.label).toBe("not assessed");
    window.localStorage.setItem(projectReadinessPayloadStorageKey("project-1"), JSON.stringify({ projectId: "other-project", gateResult: {} }));
    expect(loadProjectReadinessPayload("project-1")).toBeNull();
    expect(hasProjectReadinessPayload("project-1")).toBe(false);
  });

  test("accepts a real Phase 7 result without re-deriving its release state", () => {
    const gateResult = realGateResult();
    const report = createProjectReadinessReportViewModel({ projectId: "project-1", gateResult });
    expect(report.gate).toEqual(gateResult);
    expect(report.release.releaseReady).toBe(true);
    expect(report.rows[0].evidenceMapRowId).toBe("project-row-1");
    expect(saveProjectReadinessPayload({ projectId: "project-1", gateResult })).toBe(true);
    expect(hasProjectReadinessPayload("project-1")).toBe(true);
    expect(createReadinessReportViewModel(gateResult).release.state).toBe("PRE_VALIDATION_RELEASE_READY");
  });
});
