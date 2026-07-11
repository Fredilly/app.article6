/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import {
  PROJECT_READINESS_PAYLOAD_EVENT,
  loadProjectReadinessPayload,
  projectReadinessPayloadStorageKey,
} from "@/lib/evidence/projectReadinessPayload";
import {
  finalizeProjectEvidenceMapForReadiness,
  type ProjectEvidenceMapAssessment,
} from "@/lib/evidence/projectReadinessProductionPipeline";
import type { EvidenceMapRow } from "@/lib/evidence/evidenceMapDependencyContract";

function row(overrides: Partial<EvidenceMapRow> = {}): EvidenceMapRow {
  const acceptedProvenance = {
    docId: "project-pdd.pdf",
    page: 8,
    sectionPath: ["3.1"],
    spanId: "accepted-span",
    sectionHeading: "Requirement evidence",
    sourceType: "PDD",
  };
  const rejectedProvenance = {
    docId: "project-pdd.pdf",
    page: 9,
    sectionPath: ["3.2"],
    spanId: "rejected-span",
    sectionHeading: "Rejected evidence",
    sourceType: "PDD",
  };
  return {
    rowId: "project-row-1",
    requirement: {
      requirementId: "requirement-1",
      requirementReference: "REQ-1",
      requirementText: "The project maintains requirement evidence.",
    },
    methodology: { methodologyId: "VM0007", rulebookVersion: "1.8" },
    upstreamStatus: "FOUND",
    applicabilityState: "APPLICABLE",
    acceptedEvidence: [{ evidenceId: "accepted-1", quote: "Accepted project evidence.", provenance: acceptedProvenance }],
    rejectedEvidence: [{ evidenceId: "rejected-1", quote: "Rejected project evidence.", rejectionReason: "Boilerplate only.", provenance: rejectedProvenance }],
    assessmentReason: "The reviewed project evidence supports the requirement.",
    clientAction: null,
    searchCoverage: { searched: true, searchedDocumentIds: ["project-pdd.pdf"], notes: null },
    sourceDocument: { documentId: "project-pdd.pdf", documentName: "Project PDD", contentSha256: "sha256:project" },
    evidenceProvenance: [acceptedProvenance, rejectedProvenance],
    finalizationState: "finalized",
    finalizationActorRef: "reviewer:project",
    finalizedAt: "2026-07-11T00:00:00Z",
    finalizationBasis: "Explicit project Evidence Map finalization.",
    reviewHistoryRef: "history:project-row-1",
    evidenceMapContractVersion: "v1",
    reviewPolicyVersion: "policy-v1",
    ...overrides,
  };
}

function assessment(evidenceMapRowId = "project-row-1"): ProjectEvidenceMapAssessment {
  return {
    evidenceMapRowId,
    applicability: { decision: "APPLICABLE", decisionBasis: "The finalized row is applicable." },
    conformance: {
      requirementSupport: "SUPPORTED",
      searchCoverageAssessment: "ADEQUATE",
      provenanceAssessment: "COMPLETE",
      versionIdentityAssessment: "MATCHED",
      contradictionAssessment: "NONE",
    },
    draftFinding: { draftFindingType: null, findingBasis: null, reviewerAssessment: null },
    reviewState: "CURRENT",
  };
}

describe("project readiness production pipeline", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  test("finalized real Evidence Map rows create and save Phase 6/7 output unchanged", () => {
    const event = jest.fn();
    window.addEventListener(PROJECT_READINESS_PAYLOAD_EVENT, event);
    const result = finalizeProjectEvidenceMapForReadiness({
      source: "PROJECT_EVIDENCE_MAP",
      projectId: "project-1",
      rows: [row()],
      assessments: [assessment()],
    });
    window.removeEventListener(PROJECT_READINESS_PAYLOAD_EVENT, event);

    expect(result.ready).toBe(true);
    if (!result.ready) return;
    expect(result.payload.projectId).toBe("project-1");
    expect(result.payload.gateResult).toBe(result.gateResult);
    expect(result.gateResult.releaseState).toBe("PRE_VALIDATION_RELEASE_READY");
    expect(result.gateResult.presentations[0].acceptedEvidence[0].quote).toBe("Accepted project evidence.");
    expect(result.gateResult.presentations[0].rejectedEvidence[0].rejectionReason).toBe("Boilerplate only.");
    expect(result.gateResult.presentations[0].evidenceProvenance[0].spanId).toBe("accepted-span");
    expect(result.gateResult.presentations[0].finalizationActorRef).toBe("reviewer:project");
    expect(event).toHaveBeenCalledTimes(1);
    expect(event.mock.calls[0][0].detail.state).toBe("saved");
    expect(loadProjectReadinessPayload("project-1")?.gateResult).toEqual(result.gateResult);
  });

  test("malformed assessment entries fail closed without throwing", () => {
    expect(() => finalizeProjectEvidenceMapForReadiness({
      source: "PROJECT_EVIDENCE_MAP",
      projectId: "project-1",
      rows: [row()],
      assessments: [null],
    })).not.toThrow();
    const result = finalizeProjectEvidenceMapForReadiness({
      source: "PROJECT_EVIDENCE_MAP",
      projectId: "project-1",
      rows: [row()],
      assessments: [null],
    });
    expect(result).toMatchObject({ ready: false, state: "NOT_ASSESSED" });
    expect(loadProjectReadinessPayload("project-1")).toBeNull();
  });

  test("non-finalized rows fail closed and do not write a payload", () => {
    const result = finalizeProjectEvidenceMapForReadiness({
      source: "PROJECT_EVIDENCE_MAP",
      projectId: "project-1",
      rows: [row({ finalizationState: "draft" })],
      assessments: [assessment()],
    });
    expect(result).toMatchObject({ ready: false, state: "NOT_ASSESSED" });
    expect(loadProjectReadinessPayload("project-1")).toBeNull();
  });

  test("missing review/finalization information fails closed", () => {
    const result = finalizeProjectEvidenceMapForReadiness({
      source: "PROJECT_EVIDENCE_MAP",
      projectId: "project-1",
      rows: [row({ reviewHistoryRef: "" })],
      assessments: [assessment()],
    });
    expect(result).toMatchObject({ ready: false, state: "NOT_ASSESSED" });
    expect(loadProjectReadinessPayload("project-1")).toBeNull();
  });

  test("missing explicit review state fails closed", () => {
    const result = finalizeProjectEvidenceMapForReadiness({
      source: "PROJECT_EVIDENCE_MAP",
      projectId: "project-1",
      rows: [row()],
      assessments: [{ ...assessment(), reviewState: undefined } as unknown as ProjectEvidenceMapAssessment],
    });
    expect(result).toMatchObject({ ready: false, state: "NOT_ASSESSED" });
    expect(loadProjectReadinessPayload("project-1")).toBeNull();
  });

  test("a failed later finalization clears a previously saved payload and emits immediately", () => {
    const first = finalizeProjectEvidenceMapForReadiness({
      source: "PROJECT_EVIDENCE_MAP",
      projectId: "project-1",
      rows: [row()],
      assessments: [assessment()],
    });
    expect(first.ready).toBe(true);
    const event = jest.fn();
    window.addEventListener(PROJECT_READINESS_PAYLOAD_EVENT, event);
    const failed = finalizeProjectEvidenceMapForReadiness({
      source: "PROJECT_EVIDENCE_MAP",
      projectId: "project-1",
      rows: [row({ finalizationState: "draft" })],
      assessments: [assessment()],
    });
    window.removeEventListener(PROJECT_READINESS_PAYLOAD_EVENT, event);
    expect(failed).toMatchObject({ ready: false, state: "NOT_ASSESSED" });
    expect(loadProjectReadinessPayload("project-1")).toBeNull();
    expect(event).toHaveBeenCalledTimes(1);
    expect(event.mock.calls[0][0].detail).toEqual({ projectId: "project-1", payload: null, state: "cleared" });
  });

  test("reopened rows clear stale release-ready payloads", () => {
    expect(finalizeProjectEvidenceMapForReadiness({
      source: "PROJECT_EVIDENCE_MAP",
      projectId: "project-1",
      rows: [row()],
      assessments: [assessment()],
    }).ready).toBe(true);
    const result = finalizeProjectEvidenceMapForReadiness({
      source: "PROJECT_EVIDENCE_MAP",
      projectId: "project-1",
      rows: [row()],
      assessments: [{ ...assessment(), reviewState: "REOPENED" }],
    });
    expect(result).toMatchObject({ ready: false, state: "NOT_ASSESSED" });
    expect(loadProjectReadinessPayload("project-1")).toBeNull();
  });

  test("clearing one project does not clear another project", () => {
    expect(finalizeProjectEvidenceMapForReadiness({
      source: "PROJECT_EVIDENCE_MAP",
      projectId: "project-1",
      rows: [row()],
      assessments: [assessment()],
    }).ready).toBe(true);
    expect(finalizeProjectEvidenceMapForReadiness({
      source: "PROJECT_EVIDENCE_MAP",
      projectId: "project-2",
      rows: [row({ rowId: "project-row-2" })],
      assessments: [assessment("project-row-2")],
    }).ready).toBe(true);
    finalizeProjectEvidenceMapForReadiness({
      source: "PROJECT_EVIDENCE_MAP",
      projectId: "project-1",
      rows: [row({ finalizationState: "draft" })],
      assessments: [assessment()],
    });
    expect(loadProjectReadinessPayload("project-1")).toBeNull();
    expect(loadProjectReadinessPayload("project-2")?.projectId).toBe("project-2");
  });

  test("legacy audit and fixture/preview inputs cannot enter the production producer", () => {
    const legacy = finalizeProjectEvidenceMapForReadiness({
      auditId: "vm0007-gap-1",
      audit: { results: [] },
      projectId: "project-1",
    });
    const fixture = finalizeProjectEvidenceMapForReadiness({
      source: "READINESS_PREVIEW_FIXTURE",
      projectId: "project-1",
      rows: [row()],
      assessments: [assessment()],
    });
    expect(legacy).toMatchObject({ ready: false, state: "NOT_ASSESSED" });
    expect(fixture).toMatchObject({ ready: false, state: "NOT_ASSESSED" });
    expect(window.localStorage.getItem(projectReadinessPayloadStorageKey("project-1"))).toBeNull();
  });
});
