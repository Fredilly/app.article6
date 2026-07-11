/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import { buildAndSaveQuickCheckReadinessPayload } from "@/lib/evidence/quickCheckReadinessProductionPipeline";
import { loadQuickCheckReadinessPayload } from "@/lib/evidence/quickCheckReadinessPayload";
import type { Vm0007GapReportAuditRecord } from "@/lib/preverif/vm0007GapReportStore";

function auditRecord(): Vm0007GapReportAuditRecord {
  return {
    auditId: "audit-real-1",
    methodologyId: "VM0007",
    methodologyVersion: "v1-8",
    loadedRulebookId: "VM0007",
    loadedRulebookVersion: "v1-8",
    generatedAt: "2026-07-11T00:00:00.000Z",
    sourceDocument: { documentId: "pdd-real-1", documentName: "real-project.pdd.pdf", contentSha256: "sha256:real" },
    audit: {
      auditStatus: "AUDITED",
      results: [
        { ruleId: "R-FOUND", stableId: "R-FOUND", title: "Found requirement", ruleLogic: "The project provides evidence.", status: "supported_by_pdd", bestEvidenceQuote: "The project provides evidence.", page: 4, section: "3.1 Evidence", span: "span-found", reasonSelected: "Project-specific evidence found.", assessmentReason: "The audit found project-specific evidence.", gap: "", clientAction: "", confidence: "high" },
        { ruleId: "R-MISSING", stableId: "R-MISSING", title: "Missing requirement", ruleLogic: "The project retains records.", status: "missing_evidence", bestEvidenceQuote: null, page: null, section: null, span: null, reasonSelected: "No project evidence found.", assessmentReason: "The audit found no project evidence.", gap: "Provide records.", clientAction: "Provide records.", confidence: "low" },
        { ruleId: "R-REJECTED", stableId: "R-REJECTED", title: "Rejected requirement", ruleLogic: "The project documents scope.", status: "manual_review_needed", bestEvidenceQuote: "Methodology boilerplate only.", page: 8, section: "4 Scope", span: "span-rejected", reasonSelected: "Boilerplate evidence rejected.", assessmentReason: "The audit rejected non-project evidence.", gap: "Use project evidence.", clientAction: "Provide project evidence.", confidence: "low" },
      ],
      totals: { supported_by_pdd: 1, partially_supported: 0, missing_evidence: 1, not_applicable: 0, manual_review_needed: 1 },
      totalRules: 3,
    },
  };
}

describe("Quick Check readiness producer", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  test("saves real rows through the Phase 2–7 contracts without colliding with project storage", () => {
    buildAndSaveQuickCheckReadinessPayload(auditRecord());
    const payload = loadQuickCheckReadinessPayload("audit-real-1");
    expect(payload?.gateResult.presentations).toHaveLength(3);
    expect(payload?.gateResult.presentations[0].acceptedEvidence[0].quote).toBe("The project provides evidence.");
    expect(payload?.gateResult.presentations[2].rejectedEvidence[0].rejectionReason).toBe("Boilerplate evidence rejected.");
    expect(payload?.gateResult.presentations[0].evidenceProvenance[0]).toMatchObject({ docId: "pdd-real-1", page: 4, spanId: "span-found" });
    expect(payload?.gateResult.presentations[0].sourceDocument).toEqual({ documentId: "pdd-real-1", documentName: "real-project.pdd.pdf", contentSha256: "sha256:real" });
    expect(payload?.gateResult.releaseState).toBe("INTERNAL_REVIEW_ONLY");
  });

  test("does not produce a payload when explicit assessment input is missing", () => {
    const record = auditRecord();
    record.audit.results = record.audit.results.slice(0, 0);
    buildAndSaveQuickCheckReadinessPayload(record);
    expect(loadQuickCheckReadinessPayload(record.auditId)).toBeNull();
  });
});
