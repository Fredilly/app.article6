/** @jest-environment jsdom */

import {
  approveVm0007EvidenceMapRow,
  editVm0007EvidenceMapRow,
  finalizeVm0007EvidenceMap,
  reopenVm0007EvidenceMapRow,
} from "@/lib/preverif/vm0007EvidenceMapReview";
import { loadVm0007EvidenceMapDraft, saveVm0007EvidenceMapDraft } from "@/lib/preverif/vm0007EvidenceMapDraftStore";
import { loadQuickCheckReadinessPayload } from "@/lib/evidence/quickCheckReadinessPayload";
import type { Vm0007EvidenceMapDraftPackage } from "@/lib/preverif/vm0007EvidenceMapDraft";
import type { ProjectEvidenceMapAssessment } from "@/lib/evidence/projectReadinessProductionPipeline";
import { buildVm0007EvidenceMapDraft } from "@/lib/preverif/vm0007EvidenceMapDraft";
import type { RuleSummary } from "@/app/m/_lib/methodRules";
import type { MethodologyEvidenceAuditSummary } from "@/lib/preverif/evidenceAudit";

const provenance = { docId: "doc-1", page: 3, sectionPath: ["Evidence"], spanId: "span-1", sectionHeading: "Evidence", sourceType: "PDD" };

function assessmentFor(rowId: string, overrides: Partial<ProjectEvidenceMapAssessment> = {}): ProjectEvidenceMapAssessment {
  return {
    evidenceMapRowId: rowId,
    applicability: { decision: "APPLICABLE", decisionBasis: "Reviewer confirmed the requirement applies." },
    conformance: { requirementSupport: "NOT_SUPPORTED", searchCoverageAssessment: "ADEQUATE", provenanceAssessment: "COMPLETE", versionIdentityAssessment: "MATCHED", contradictionAssessment: "NONE" },
    draftFinding: { draftFindingType: null, findingBasis: null, reviewerAssessment: null },
    reviewState: "CURRENT",
    rowVersion: 1,
    ...overrides,
  };
}

function makePackage(overrides: Partial<Vm0007EvidenceMapDraftPackage> = {}): Vm0007EvidenceMapDraftPackage {
  const auditId = "review-audit";
  const rows = Array.from({ length: 58 }, (_, index) => ({
    rowId: `${auditId}:R-${index + 1}`, auditId, stableRuleId: `R-${index + 1}`, ruleReference: `R-${index + 1}`,
    ruleTitle: `Rule ${index + 1}`, requirementText: "Requirement", methodologyId: "VM0007" as const, methodologyVersion: "v1.8" as const,
    rawAuditStatus: "missing_evidence" as const, upstreamStatus: "MISSING" as const, proposedEvidenceStatus: "MISSING" as const,
    proposedApplicability: "APPLICABLE" as const, proposedAcceptedEvidence: null, proposedRejectedEvidence: null,
    assessmentReason: "No evidence was located.", gap: "Add evidence.", clientAction: "Provide evidence.", confidence: "low" as const,
    searchCoverage: { searched: true, searchedDocumentIds: ["doc-1"], notes: null }, sourceDocument: { documentId: "doc-1", documentName: "pdd.pdf", contentSha256: null },
    quote: null, page: null, section: null, spanId: null, provenance: null, finalizationState: "draft" as const,
    proposalSource: "VM0007_QUICK_CHECK_AUDIT" as const, proposalTimestamp: "2026-07-12T00:00:00.000Z",
    assessment: assessmentFor(`${auditId}:R-${index + 1}`),
  }));
  rows[0] = { ...rows[0], upstreamStatus: "FOUND", proposedEvidenceStatus: "FOUND", proposedAcceptedEvidence: { quote: "Accepted source quote", provenance }, proposedRejectedEvidence: { quote: "Rejected source quote", reason: "Contradictory context", provenance }, quote: "Accepted source quote", page: 3, section: "Evidence", spanId: "span-1", provenance, assessment: assessmentFor(`${auditId}:R-1`, { conformance: { requirementSupport: "SUPPORTED", searchCoverageAssessment: "ADEQUATE", provenanceAssessment: "COMPLETE", versionIdentityAssessment: "MATCHED", contradictionAssessment: "NONE" } }) };
  return { auditId, generatedAt: "2026-07-12T00:00:00.000Z", methodologyId: "VM0007", rulebookVersion: "v1.8", pddDeclaredMethodologyVersion: "v1.8", sourceDocument: rows[0].sourceDocument, proposalState: "MACHINE_PROPOSED", rows, blockedBy: [], contractVersion: "vm0007-evidence-map-draft-v1", ...overrides } as Vm0007EvidenceMapDraftPackage;
}

function approveAll(pkg: Vm0007EvidenceMapDraftPackage): Vm0007EvidenceMapDraftPackage {
  let current = pkg;
  for (const row of pkg.rows) {
    const result = approveVm0007EvidenceMapRow(current, row.rowId, "reviewer-1", "Reviewed row.", "2026-07-12T01:00:00.000Z");
    if (!result.ok) throw new Error(result.reason);
    current = result.package;
  }
  return current;
}

function approveAllExcept(pkg: Vm0007EvidenceMapDraftPackage, excludedRowId: string): Vm0007EvidenceMapDraftPackage {
  let current = pkg;
  for (const row of pkg.rows) {
    if (row.rowId === excludedRowId) continue;
    const result = approveVm0007EvidenceMapRow(current, row.rowId, "reviewer-1", "Reviewed row.", "2026-07-12T01:00:00.000Z");
    if (!result.ok) throw new Error(result.reason);
    current = result.package;
  }
  return current;
}

function buildProductionDraft(): Vm0007EvidenceMapDraftPackage {
  const rules: RuleSummary[] = Array.from({ length: 58 }, (_, index) => ({ id: `R-${index + 1}`, title: `Rule ${index + 1}`, snippet: "Requirement", text: "Requirement", tags: [] }));
  const results = rules.map((rule) => ({ ruleId: rule.id, stableId: rule.id, title: rule.title, ruleLogic: "Requirement", status: "missing_evidence" as const, bestEvidenceQuote: null, page: null, section: null, span: null, reasonSelected: "No match", assessmentReason: "No evidence was located.", gap: "Add evidence.", clientAction: "Provide evidence.", confidence: "low" as const }));
  const audit: MethodologyEvidenceAuditSummary = { auditStatus: "AUDITED", methodologyId: "VM0007", rulebookVersion: "v1.8", pddDeclaredMethodologyVersion: "v1.8", versionMatch: true, results, totals: { supported_by_pdd: 0, partially_supported: 0, missing_evidence: 58, not_applicable: 0, manual_review_needed: 0 }, totalRules: 58 };
  const built = buildVm0007EvidenceMapDraft({ auditId: "production-draft", generatedAt: "2026-07-12T00:00:00.000Z", rules, audit, sourceDocument: { documentId: "doc-1", documentName: "pdd.pdf", contentSha256: null } });
  if (!built.ok) throw new Error(built.blockedBy.join(", "));
  return built.package;
}

describe("VM0007 persisted Evidence Map reviewer workflow", () => {
  beforeEach(() => localStorage.clear());

  test("draft opens with 58 pending rows and approval/edit survive save and reload", () => {
    const pkg = makePackage();
    expect(saveVm0007EvidenceMapDraft(pkg)).toBe(true);
    let loaded = loadVm0007EvidenceMapDraft(pkg.auditId)!;
    expect(loaded.rows).toHaveLength(58);
    expect(loaded.rows[0].reviewState).toBe("pending review");
    loaded = approveVm0007EvidenceMapRow(loaded, loaded.rows[0].rowId, "reviewer-1", "Approved after review.", "2026-07-12T01:00:00.000Z").package!;
    loaded = editVm0007EvidenceMapRow(loaded, loaded.rows[0].rowId, { assessmentReason: "Reviewer clarified the evidence assessment." }, "reviewer-1", "Clarified assessment.", "2026-07-12T01:01:00.000Z").package!;
    const reloaded = loadVm0007EvidenceMapDraft(pkg.auditId)!;
    expect(reloaded.rows[0].reviewState).toBe("edited");
    expect(reloaded.rows[0].assessmentReason).toContain("clarified");
    expect(reloaded.rows[0].reviewHistory).toHaveLength(2);
    expect(reloaded.rows[0].rowVersion).toBe(2);
  });

  test("a buildVm0007EvidenceMapDraft production draft gets assessment through reviewer workflow and finalizes after reload", () => {
    let pkg = buildProductionDraft();
    expect(pkg.rows.every((row) => row.assessment === undefined)).toBe(true);
    for (const row of pkg.rows) {
      const attached = editVm0007EvidenceMapRow(pkg, row.rowId, { assessment: assessmentFor(row.rowId) }, "reviewer-1", "Completed canonical assessment.", "2026-07-12T01:00:00.000Z");
      expect(attached.ok).toBe(true);
      if (!attached.ok) return;
      pkg = attached.package;
    }
    pkg = approveAll(pkg);
    const reloaded = loadVm0007EvidenceMapDraft(pkg.auditId)!;
    const result = finalizeVm0007EvidenceMap(reloaded, "reviewer-1", "2026-07-12T02:00:00.000Z");
    expect(result.ok).toBe(true);
    expect(loadQuickCheckReadinessPayload(pkg.auditId)?.gateResult.presentations).toHaveLength(58);
  });

  test("finalization fails closed for unreviewed rows and missing reviewer metadata", () => {
    const pkg = makePackage();
    expect(finalizeVm0007EvidenceMap(pkg, "")).toMatchObject({ ok: false, blockedBy: expect.arrayContaining(["missing reviewer metadata", "one or more rows are not approved"]) });
    const reviewed = approveAll(pkg);
    const missingApplicability = { ...reviewed, rows: reviewed.rows.map((row, index) => index === 1 ? { ...row, proposedApplicability: "UNKNOWN" as const } : row) };
    expect(finalizeVm0007EvidenceMap(missingApplicability, "reviewer-1")).toMatchObject({ ok: false });
  });

  test("FOUND alone cannot become SUPPORTED or CONFORMS", () => {
    const pkg = makePackage({ rows: makePackage().rows.map((row, index) => index === 0 ? { ...row, upstreamStatus: "FOUND" as const, proposedEvidenceStatus: "FOUND" as const, assessment: undefined } : row) });
    const result = finalizeVm0007EvidenceMap(approveAllExcept(pkg, pkg.rows[0].rowId), "reviewer-1");
    expect(result).toMatchObject({ ok: false, blockedBy: expect.arrayContaining(["canonical assessment is missing, invalid, stale, or unresolved"]) });
  });

  test.each([
    ["incomplete search coverage", { searchCoverageAssessment: "INADEQUATE" as const }],
    ["incomplete provenance", { provenanceAssessment: "INCOMPLETE" as const }],
    ["unresolved version identity", { versionIdentityAssessment: "UNRESOLVED" as const }],
    ["blocking contradiction", { contradictionAssessment: "BLOCKING" as const }],
  ])("canonical %s blocks finalization and release readiness", (_, conformance) => {
    const pkg = makePackage({ rows: makePackage().rows.map((row, index) => index === 0 ? { ...row, assessment: assessmentFor(row.rowId, { conformance: { ...assessmentFor(row.rowId).conformance, ...conformance } }) } : row) });
    const result = finalizeVm0007EvidenceMap(approveAll(pkg), "reviewer-1");
    expect(result).toMatchObject({ ok: false, pipeline: { ready: false } });
    expect(loadQuickCheckReadinessPayload(pkg.auditId)).toBeNull();
  });

  test("an incomplete presentation-gate review state blocks finalization", () => {
    const pkg = approveAll(makePackage());
    const withPendingAssessment = { ...pkg, rows: pkg.rows.map((row, index) => index === 0 ? { ...row, assessment: { ...row.assessment!, reviewState: "PENDING_REVIEW" as const } } : row) };
    const result = finalizeVm0007EvidenceMap(withPendingAssessment, "reviewer-1");
    expect(result).toMatchObject({ ok: false, blockedBy: expect.arrayContaining(["canonical assessment is missing, invalid, stale, or unresolved"]) });
    expect(loadQuickCheckReadinessPayload(pkg.auditId)).toBeNull();
  });

  test("valid finalization survives reload and populates the existing readiness pipeline", () => {
    const reviewed = approveAll(makePackage());
    const result = finalizeVm0007EvidenceMap(reviewed, "reviewer-1", "2026-07-12T02:00:00.000Z");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const reloaded = loadVm0007EvidenceMapDraft(reviewed.auditId)!;
    expect(reloaded.finalizationState).toBe("finalized");
    expect(reloaded.rows.every((row) => row.finalizationState === "finalized")).toBe(true);
    const payload = loadQuickCheckReadinessPayload(reviewed.auditId);
    expect(payload?.gateResult.releaseState).toBe("PRE_VALIDATION_RELEASE_READY");
    expect(payload?.gateResult.presentations).toHaveLength(58);
    expect(payload?.gateResult.presentations[0].acceptedEvidence[0].quote).toBe("Accepted source quote");
    expect(payload?.gateResult.presentations[0].rejectedEvidence[0].quote).toBe("Rejected source quote");
  });

  test("row edits clear stale assessments and complete replacements permit reapproval", () => {
    let pkg = approveAll(makePackage());
    const rowId = pkg.rows[0].rowId;
    const edited = editVm0007EvidenceMapRow(pkg, rowId, { proposedApplicability: "NOT_APPLICABLE" }, "reviewer-1", "Changed applicability.", "2026-07-12T03:00:00.000Z");
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.row.assessment).toBeUndefined();
    expect(approveVm0007EvidenceMapRow(edited.package, rowId, "reviewer-1").ok).toBe(false);
    const replacement = editVm0007EvidenceMapRow(edited.package, rowId, { assessment: assessmentFor(rowId, { applicability: { decision: "NOT_APPLICABLE", decisionBasis: "Reviewer confirmed the requirement is out of scope." } }) }, "reviewer-1", "Reassessed applicability.", "2026-07-12T03:01:00.000Z");
    expect(replacement.ok).toBe(true);
    if (!replacement.ok) return;
    expect(replacement.row.assessment?.rowVersion).toBe(replacement.row.rowVersion);
    expect(approveVm0007EvidenceMapRow(replacement.package, rowId, "reviewer-1").ok).toBe(true);
  });

  test("reopening preserves history, invalidates finalization, and clears the release-ready report", () => {
    const result = finalizeVm0007EvidenceMap(approveAll(makePackage()), "reviewer-1", "2026-07-12T02:00:00.000Z");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(loadQuickCheckReadinessPayload(result.package.auditId)).not.toBeNull();
    const reopened = reopenVm0007EvidenceMapRow(result.package, result.package.rows[0].rowId, "reviewer-1", "Reopen for clarification.", "2026-07-12T03:00:00.000Z");
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) return;
    expect(reopened.package.finalizationState).toBe("draft");
    expect(reopened.row.reviewState).toBe("reopened");
    expect(reopened.row.reviewHistory).toHaveLength(2);
    expect(loadVm0007EvidenceMapDraft(result.package.auditId)?.rows[0].reviewHistory).toHaveLength(2);
    expect(loadQuickCheckReadinessPayload(result.package.auditId)).toBeNull();
    expect(reopened.row.assessment?.reviewState).toBe("REOPENED");
    expect(approveVm0007EvidenceMapRow(reopened.package, reopened.row.rowId, "reviewer-1").ok).toBe(false);
  });
});
