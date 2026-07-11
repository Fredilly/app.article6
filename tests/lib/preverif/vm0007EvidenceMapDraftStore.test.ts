/** @jest-environment jsdom */

import { loadVm0007EvidenceMapDraft, saveVm0007EvidenceMapDraft } from "@/lib/preverif/vm0007EvidenceMapDraftStore";
import type { Vm0007EvidenceMapDraftPackage } from "@/lib/preverif/vm0007EvidenceMapDraft";

function makePackage(): Vm0007EvidenceMapDraftPackage {
  const auditId = "storage-audit";
  const rows = Array.from({ length: 58 }, (_, index) => ({
    rowId: `${auditId}:R-${index + 1}`,
    auditId,
    stableRuleId: `R-${index + 1}`,
    ruleReference: `R-${index + 1}`,
    ruleTitle: `Rule ${index + 1}`,
    requirementText: "Requirement",
    methodologyId: "VM0007" as const,
    methodologyVersion: "v1.8" as const,
    rawAuditStatus: "missing_evidence" as const,
    upstreamStatus: "MISSING" as const,
    proposedEvidenceStatus: "MISSING" as const,
    proposedApplicability: "APPLICABLE" as const,
    proposedAcceptedEvidence: null,
    proposedRejectedEvidence: null,
    assessmentReason: "No evidence.",
    gap: "Add evidence.",
    clientAction: "Review.",
    confidence: "low" as const,
    searchCoverage: { searched: true, searchedDocumentIds: ["doc-1"], notes: null },
    sourceDocument: { documentId: "doc-1", documentName: "pdd.pdf", contentSha256: null },
    quote: null,
    page: null,
    section: null,
    spanId: null,
    provenance: null,
    finalizationState: "draft" as const,
    proposalSource: "VM0007_QUICK_CHECK_AUDIT" as const,
    proposalTimestamp: "2026-07-11T00:00:00.000Z",
  }));
  return { auditId, generatedAt: "2026-07-11T00:00:00.000Z", methodologyId: "VM0007", rulebookVersion: "v1.8", pddDeclaredMethodologyVersion: "Version 1.8", sourceDocument: rows[0].sourceDocument, proposalState: "MACHINE_PROPOSED", rows, blockedBy: [], contractVersion: "vm0007-evidence-map-draft-v1" };
}

describe("VM0007 draft package storage validation", () => {
  beforeEach(() => localStorage.clear());

  test.each([
    ["missing rows", (pkg: Vm0007EvidenceMapDraftPackage) => ({ ...pkg, rows: [] })],
    ["duplicate rule IDs", (pkg: Vm0007EvidenceMapDraftPackage) => ({ ...pkg, rows: pkg.rows.map((row, index) => index === 1 ? { ...row, ruleReference: pkg.rows[0].ruleReference } : row) })],
    ["unknown status", (pkg: Vm0007EvidenceMapDraftPackage) => ({ ...pkg, rows: pkg.rows.map((row, index) => index === 0 ? { ...row, rawAuditStatus: "future_status" } : row) })],
    ["wrong version", (pkg: Vm0007EvidenceMapDraftPackage) => ({ ...pkg, rulebookVersion: "v1.7" })],
    ["malformed provenance", (pkg: Vm0007EvidenceMapDraftPackage) => ({ ...pkg, rows: pkg.rows.map((row, index) => index === 0 ? { ...row, proposedAcceptedEvidence: { quote: "evidence", provenance: { docId: "doc-1" } } } : row) })],
  ])("rejects %s without throwing or saving", (_, mutate) => {
    const invalid = mutate(makePackage());
    expect(() => saveVm0007EvidenceMapDraft(invalid)).not.toThrow();
    expect(saveVm0007EvidenceMapDraft(invalid)).toBe(false);
    localStorage.setItem("article6:vm0007-evidence-map-draft:v1:storage-audit", JSON.stringify(invalid));
    expect(() => loadVm0007EvidenceMapDraft("storage-audit")).not.toThrow();
    expect(loadVm0007EvidenceMapDraft("storage-audit")).toBeNull();
  });

  test("rejects malformed JSON when loading", () => {
    localStorage.setItem("article6:vm0007-evidence-map-draft:v1:storage-audit", "{broken");
    expect(loadVm0007EvidenceMapDraft("storage-audit")).toBeNull();
  });
});
