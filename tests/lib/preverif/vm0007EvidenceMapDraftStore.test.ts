/** @jest-environment jsdom */

import { loadVm0007EvidenceMapDraft, saveVm0007EvidenceMapDraft } from "@/lib/preverif/vm0007EvidenceMapDraftStore";
import { validateVm0007EvidenceMapDraftPackage } from "@/lib/preverif/vm0007EvidenceMapDraft";
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

const richEvidenceRecord = {
  quote: "Project-specific evidence.",
  page: 1,
  section: "Evidence",
  spanId: "span-rich-1",
  provenance: { docId: "doc-1", page: 1, sectionPath: ["Evidence"], spanId: "span-rich-1", sectionHeading: "Evidence", sourceType: "PDD" },
};

describe("VM0007 draft package storage validation", () => {
  beforeEach(() => localStorage.clear());

  test.each([
    ["missing rows", (pkg: Vm0007EvidenceMapDraftPackage) => ({ ...pkg, rows: [] })],
    ["duplicate rule IDs", (pkg: Vm0007EvidenceMapDraftPackage) => ({ ...pkg, rows: pkg.rows.map((row, index) => index === 1 ? { ...row, ruleReference: pkg.rows[0].ruleReference } : row) })],
    ["unknown status", (pkg: Vm0007EvidenceMapDraftPackage) => ({ ...pkg, rows: pkg.rows.map((row, index) => index === 0 ? { ...row, rawAuditStatus: "future_status" } : row) })],
    ["wrong version", (pkg: Vm0007EvidenceMapDraftPackage) => ({ ...pkg, rulebookVersion: "v1.7" })],
    ["malformed provenance", (pkg: Vm0007EvidenceMapDraftPackage) => ({ ...pkg, rows: pkg.rows.map((row, index) => index === 0 ? { ...row, proposedAcceptedEvidence: { quote: "evidence", provenance: { docId: "doc-1" } } } : row) })],
    ["malformed rich evidence", (pkg: Vm0007EvidenceMapDraftPackage) => ({ ...pkg, rows: pkg.rows.map((row, index) => index === 0 ? { ...row, rejectedEvidence: [{ quote: "evidence", page: 1, section: "Evidence", spanId: "span-1", rejectionReason: "Rejected.", provenance: { docId: "doc-1" } }] } : row) })],
    ["malformed component coverage", (pkg: Vm0007EvidenceMapDraftPackage) => ({ ...pkg, rows: pkg.rows.map((row, index) => index === 0 ? { ...row, supportedComponents: ["valid", " "] } : row) })],
  ])("rejects %s without throwing or saving", (_, mutate) => {
    const invalid = mutate(makePackage());
    expect(() => saveVm0007EvidenceMapDraft(invalid)).not.toThrow();
    expect(saveVm0007EvidenceMapDraft(invalid)).toEqual({ ok: false, reason: "draft_validation_failed" });
    localStorage.setItem("article6:vm0007-evidence-map-draft:v1:storage-audit", JSON.stringify(invalid));
    expect(() => loadVm0007EvidenceMapDraft("storage-audit")).not.toThrow();
    expect(loadVm0007EvidenceMapDraft("storage-audit")).toBeNull();
  });

  test("rejects malformed JSON when loading", () => {
    localStorage.setItem("article6:vm0007-evidence-map-draft:v1:storage-audit", "{broken");
    expect(loadVm0007EvidenceMapDraft("storage-audit")).toBeNull();
  });

  test("accepts persisted draft packages created before rich presentation fields were added", () => {
    const legacyPackage = makePackage();
    expect(legacyPackage.rows.every((row) => !("acceptedEvidence" in row) && !("rejectedEvidence" in row) && !("supportedComponents" in row) && !("missingComponents" in row) && !("reasonSelected" in row))).toBe(true);
    expect(validateVm0007EvidenceMapDraftPackage(legacyPackage, legacyPackage.auditId)).toBe(true);
    expect(saveVm0007EvidenceMapDraft(legacyPackage)).toEqual({ ok: true });
    expect(loadVm0007EvidenceMapDraft(legacyPackage.auditId)).not.toBeNull();
  });

  test("accepts optional aggregate component coverage on a row", () => {
    const pkg = makePackage();
    pkg.rows[0] = { ...pkg.rows[0], supportedComponents: ["equation", "inputs"], missingComponents: ["result"] };

    expect(validateVm0007EvidenceMapDraftPackage(pkg)).toBe(true);
  });

  test("accepts rich accepted evidence without a rejection reason", () => {
    const pkg = makePackage();
    pkg.rows[0] = { ...pkg.rows[0], acceptedEvidence: [richEvidenceRecord] };

    expect(pkg.rows[0].acceptedEvidence?.[0].rejectionReason).toBeUndefined();
    expect(validateVm0007EvidenceMapDraftPackage(pkg)).toBe(true);
  });

  test("accepts rich rejected evidence with a non-empty rejection reason", () => {
    const pkg = makePackage();
    pkg.rows[0] = { ...pkg.rows[0], rejectedEvidence: [{ ...richEvidenceRecord, rejectionReason: "Methodology boilerplate is not project evidence." }] };

    expect(validateVm0007EvidenceMapDraftPackage(pkg)).toBe(true);
  });

  test("rejects a rich rejected evidence record without a rejection reason", () => {
    const pkg = makePackage();
    pkg.rows[0] = { ...pkg.rows[0], rejectedEvidence: [richEvidenceRecord] };

    expect(validateVm0007EvidenceMapDraftPackage(pkg)).toBe(false);
    expect(saveVm0007EvidenceMapDraft(pkg)).toEqual({ ok: false, reason: "draft_validation_failed" });
  });

  test("allows supported and explicitly not-applicable rows with empty gaps", () => {
    const pkg = makePackage();
    pkg.rows[0] = {
      ...pkg.rows[0], rawAuditStatus: "supported_by_pdd", upstreamStatus: "FOUND", proposedEvidenceStatus: "FOUND", gap: "",
      proposedAcceptedEvidence: { quote: "Supported evidence", provenance: { docId: "doc-1", page: 1, sectionPath: ["S-1"], spanId: "span-1", sectionHeading: "Evidence", sourceType: "PDD" } },
      quote: "Supported evidence", page: 1, section: "Evidence", spanId: "span-1", provenance: { docId: "doc-1", page: 1, sectionPath: ["S-1"], spanId: "span-1", sectionHeading: "Evidence", sourceType: "PDD" },
    };
    pkg.rows[1] = {
      ...pkg.rows[1], rawAuditStatus: "not_applicable", upstreamStatus: "UNCLEAR", proposedEvidenceStatus: "UNCLEAR", proposedApplicability: "NOT_APPLICABLE", gap: "",
      assessmentReason: "Not applicable because this rule is outside the project scope.",
      proposedAcceptedEvidence: { quote: "Scope evidence", provenance: { docId: "doc-1", page: 1, sectionPath: ["S-1"], spanId: "span-2", sectionHeading: "Scope", sourceType: "PDD" } },
      quote: "Scope evidence", page: 1, section: "Scope", spanId: "span-2", provenance: { docId: "doc-1", page: 1, sectionPath: ["S-1"], spanId: "span-2", sectionHeading: "Scope", sourceType: "PDD" },
    };
    expect(validateVm0007EvidenceMapDraftPackage(pkg)).toBe(true);
    expect(saveVm0007EvidenceMapDraft(pkg)).toEqual({ ok: true });
    const loaded = loadVm0007EvidenceMapDraft(pkg.auditId);
    expect(loaded?.rows[0].gap).toBe("");
    expect(loaded?.rows[1].proposedApplicability).toBe("NOT_APPLICABLE");
    expect(validateVm0007EvidenceMapDraftPackage(loaded, pkg.auditId)).toBe(true);
  });
});
