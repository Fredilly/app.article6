/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import { finalizeQuickCheckEvidenceMapForReadiness } from "@/lib/evidence/quickCheckReadinessProductionPipeline";
import { loadQuickCheckReadinessPayload } from "@/lib/evidence/quickCheckReadinessPayload";
import type { EvidenceMapRow } from "@/lib/evidence/evidenceMapDependencyContract";
import type { ProjectEvidenceMapAssessment } from "@/lib/evidence/projectReadinessProductionPipeline";
import { saveVm0007GapReportAudit } from "@/lib/preverif/vm0007GapReportStore";

function row(overrides: Partial<EvidenceMapRow> = {}): EvidenceMapRow {
  const provenance = { docId: "pdd-real-1", page: 4, sectionPath: ["3.1 Evidence"], spanId: "span-real", sectionHeading: "3.1 Evidence", sourceType: "PDD" };
  return {
    rowId: "quick-row-1",
    requirement: { requirementId: "R-FOUND", requirementReference: "R-FOUND", requirementText: "The project provides evidence." },
    methodology: { methodologyId: "VM0007", rulebookVersion: "v1-8" },
    upstreamStatus: "FOUND",
    applicabilityState: "APPLICABLE",
    acceptedEvidence: [{ evidenceId: "accepted", quote: "The project provides evidence.", provenance }],
    rejectedEvidence: [{ evidenceId: "rejected", quote: "Methodology boilerplate only.", rejectionReason: "Boilerplate evidence rejected.", provenance }],
    assessmentReason: "The finalized Evidence Map records the explicit audit evidence.",
    clientAction: null,
    searchCoverage: { searched: true, searchedDocumentIds: ["pdd-real-1"], notes: null },
    sourceDocument: { documentId: "pdd-real-1", documentName: "real-project.pdd.pdf", contentSha256: "sha256:real" },
    evidenceProvenance: [provenance],
    finalizationState: "finalized",
    finalizationActorRef: "reviewer:quick-check",
    finalizedAt: "2026-07-11T00:00:00.000Z",
    finalizationBasis: "Explicit reviewer finalization.",
    reviewHistoryRef: "history:quick-row-1",
    evidenceMapContractVersion: "v1",
    reviewPolicyVersion: "policy-v1",
    ...overrides,
  };
}

function assessment(): ProjectEvidenceMapAssessment {
  return {
    evidenceMapRowId: "quick-row-1",
    applicability: { decision: "APPLICABLE", decisionBasis: "Explicit reviewer applicability decision." },
    conformance: { requirementSupport: "SUPPORTED", searchCoverageAssessment: "ADEQUATE", provenanceAssessment: "COMPLETE", versionIdentityAssessment: "MATCHED", contradictionAssessment: "NONE" },
    draftFinding: { draftFindingType: null, findingBasis: null, reviewerAssessment: null },
    reviewState: "CURRENT",
  };
}

describe("Quick Check readiness producer", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  test("saves only explicitly finalized rows through the Phase 2–7 contracts", () => {
    const result = finalizeQuickCheckEvidenceMapForReadiness({ auditId: "audit-real-1", auditGeneratedAt: "2026-07-11T00:00:00.000Z", rows: [row()], assessments: [assessment()] });
    const payload = loadQuickCheckReadinessPayload("audit-real-1");
    expect(result.ready).toBe(true);
    expect(payload?.gateResult.presentations).toHaveLength(1);
    expect(payload?.gateResult.presentations[0].acceptedEvidence[0].quote).toBe("The project provides evidence.");
    expect(payload?.gateResult.presentations[0].rejectedEvidence[0].rejectionReason).toBe("Boilerplate evidence rejected.");
    expect(payload?.gateResult.presentations[0].evidenceProvenance[0]).toMatchObject({ docId: "pdd-real-1", page: 4, spanId: "span-real" });
    expect(payload?.gateResult.presentations[0].sourceDocument).toEqual({ documentId: "pdd-real-1", documentName: "real-project.pdd.pdf", contentSha256: "sha256:real" });
    expect(payload?.gateResult.releaseState).toBe("PRE_VALIDATION_RELEASE_READY");
  });

  test("fails closed for non-finalized rows and missing explicit assessments", () => {
    const result = finalizeQuickCheckEvidenceMapForReadiness({ auditId: "audit-real-1", auditGeneratedAt: "2026-07-11T00:00:00.000Z", rows: [row({ finalizationState: "draft" })], assessments: [] });
    expect(result).toMatchObject({ ready: false, state: "NOT_ASSESSED" });
    expect(loadQuickCheckReadinessPayload("audit-real-1")).toBeNull();
  });

  test("saving a Quick Check audit does not finalize or save readiness", () => {
    saveVm0007GapReportAudit({
      auditId: "audit-only-1",
      methodologyId: "VM0007",
      methodologyVersion: "v1-8",
      loadedRulebookId: "VM0007",
      loadedRulebookVersion: "v1-8",
      generatedAt: "2026-07-11T00:00:00.000Z",
      audit: { results: [], totals: { supported_by_pdd: 0, partially_supported: 0, missing_evidence: 0, not_applicable: 0, manual_review_needed: 0 }, totalRules: 0 },
    });
    expect(loadQuickCheckReadinessPayload("audit-only-1")).toBeNull();
  });
});
