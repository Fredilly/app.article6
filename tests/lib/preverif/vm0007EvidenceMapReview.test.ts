/** @jest-environment jsdom */

import {
  approveVm0007EvidenceMapRow,
  acceptVm0007EvidenceRecord,
  compactEvidenceIdentityHash,
  editVm0007EvidenceMapRow,
  finalizeVm0007EvidenceMap,
  rejectVm0007EvidenceRecord,
  reopenVm0007EvidenceMapRow,
  vm0007EvidenceIdentity,
  vm0007FinalizedEvidenceId,
  vm0007EvidenceMapRowWorkflowState,
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
  return { ...built.package, rows: built.package.rows.map((row, index) => index === 0 ? { ...row, proposedApplicability: "UNKNOWN" as const } : row) };
}

describe("VM0007 persisted Evidence Map reviewer workflow", () => {
  beforeEach(() => localStorage.clear());

  test("derives unresolved and canonical blockers separately from real draft rows", () => {
    const base = makePackage().rows[0];
    const current = { ...base, reviewState: "approved" as const };
    expect(vm0007EvidenceMapRowWorkflowState(current)).toEqual({ unresolved: false, blockerReasons: [] });
    expect(vm0007EvidenceMapRowWorkflowState({ ...current, reviewState: "pending review" })).toEqual({ unresolved: true, blockerReasons: [] });
    expect(vm0007EvidenceMapRowWorkflowState({ ...current, reviewState: "edited" })).toEqual({ unresolved: true, blockerReasons: [] });
    expect(vm0007EvidenceMapRowWorkflowState({ ...current, reviewState: "reopened" })).toEqual({ unresolved: true, blockerReasons: [] });
    expect(vm0007EvidenceMapRowWorkflowState({ ...current, assessment: undefined })).toMatchObject({ unresolved: true, blockerReasons: ["canonical assessment missing"] });
    expect(vm0007EvidenceMapRowWorkflowState({ ...current, rowVersion: 2 })).toMatchObject({ unresolved: true, blockerReasons: ["canonical assessment stale"] });
    expect(vm0007EvidenceMapRowWorkflowState({ ...current, assessment: assessmentFor(current.rowId, { conformance: { ...assessmentFor(current.rowId).conformance, contradictionAssessment: "BLOCKING" } }) })).toMatchObject({ unresolved: true, blockerReasons: ["contradiction unresolved"] });
  });

  test("draft opens with 58 pending rows and approval/edit survive save and reload", () => {
    const pkg = makePackage();
    expect(saveVm0007EvidenceMapDraft(pkg)).toEqual({ ok: true });
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

  test.each(["pending review", "approved", "reopened"] as const)("allows repeated explicit edits from %s", (startingState) => {
    let current = makePackage();
    const rowId = current.rows[0].rowId;
    let expectedHistoryLength = 0;
    let expectedVersion = 1;
    if (startingState === "approved" || startingState === "reopened") {
      const finalized = finalizeVm0007EvidenceMap(approveAll(current), "reviewer-1", "2026-07-12T02:00:00.000Z");
      expect(finalized.ok).toBe(true);
      if (!finalized.ok) return;
      current = finalized.package;
      expectedHistoryLength = 1;
      if (startingState === "reopened") {
        const reopened = reopenVm0007EvidenceMapRow(current, rowId, "reviewer-1", "Reopen before editing.", "2026-07-12T02:01:00.000Z");
        expect(reopened.ok).toBe(true);
        if (!reopened.ok) return;
        current = reopened.package;
        expectedHistoryLength += 1;
        expectedVersion += 1;
      }
    }
    const first = editVm0007EvidenceMapRow(current, rowId, { gap: "First reviewer edit." }, "reviewer-1", "First edit.", "2026-07-12T03:00:00.000Z");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    current = first.package;
    expectedHistoryLength += 1;
    expectedVersion += 1;
    const second = editVm0007EvidenceMapRow(current, rowId, { gap: "Second reviewer edit." }, "reviewer-1", "Second edit.", "2026-07-12T03:01:00.000Z");
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    current = second.package;
    const row = current.rows[0];
    expect(row.reviewState).toBe("edited");
    expect(row.reviewHistory).toHaveLength(expectedHistoryLength + 1);
    expect(row.reviewHistory?.at(-1)).toEqual(expect.objectContaining({ previousState: "edited", newState: "edited", reasonOrNote: "Second edit." }));
    expect(row.rowVersion).toBe(expectedVersion + 1);
    expect(row.assessment).toBeUndefined();
    expect(row.finalizationState).toBe("draft");
    expect(current.finalizationState).toBe("draft");
    expect(loadVm0007EvidenceMapDraft(current.auditId)?.rows[0].gap).toBe("Second reviewer edit.");
    expect(loadVm0007EvidenceMapDraft(current.auditId)?.rows[0].reviewHistory).toHaveLength(expectedHistoryLength + 1);
    expect(loadQuickCheckReadinessPayload(current.auditId)).toBeNull();
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
    expect(pkg.rows[0].proposedApplicability).toBe("APPLICABLE");
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
    expect(approveVm0007EvidenceMapRow(pkg, pkg.rows[0].rowId, "reviewer-1").ok).toBe(false);
    const result = finalizeVm0007EvidenceMap(approveAllExcept(pkg, pkg.rows[0].rowId), "reviewer-1");
    expect(result).toMatchObject({ ok: false, blockedBy: expect.arrayContaining(["canonical assessment is missing, invalid, stale, or unresolved"]) });
    expect(loadQuickCheckReadinessPayload(pkg.auditId)).toBeNull();
  });

  test("approval rejects NOT_EVALUATED applicability", () => {
    const pkg = makePackage({ rows: makePackage().rows.map((row, index) => index === 0 ? { ...row, assessment: assessmentFor(row.rowId, { applicability: { decision: "NOT_EVALUATED", decisionBasis: null } }) } : row) });
    expect(approveVm0007EvidenceMapRow(pkg, pkg.rows[0].rowId, "reviewer-1").ok).toBe(false);
  });

  test.each([
    ["NOT_EVALUATED requirement support", { requirementSupport: "NOT_EVALUATED" as const }],
    ["NOT_EVALUATED search coverage", { searchCoverageAssessment: "NOT_EVALUATED" as const }],
    ["INCOMPLETE provenance", { provenanceAssessment: "INCOMPLETE" as const }],
    ["MISMATCHED version identity", { versionIdentityAssessment: "MISMATCHED" as const }],
    ["BLOCKING contradiction", { contradictionAssessment: "BLOCKING" as const }],
  ])("approval rejects %s", (_, conformance) => {
    const pkg = makePackage({ rows: makePackage().rows.map((row, index) => index === 0 ? { ...row, assessment: assessmentFor(row.rowId, { conformance: { ...assessmentFor(row.rowId).conformance, ...conformance } }) } : row) });
    expect(approveVm0007EvidenceMapRow(pkg, pkg.rows[0].rowId, "reviewer-1").ok).toBe(false);
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
    expect(replacement.row.proposedApplicability).toBe("NOT_APPLICABLE");
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

  test("rejects one accepted record by stable identity and preserves the other record", () => {
    const first = { quote: "Accepted source quote", page: 3, section: "Evidence", spanId: "span-1", evidenceType: "project_specific_scope" as const, provenance };
    const second = { ...first, quote: "Second accepted quote", page: 4, spanId: "span-2", provenance: { ...provenance, page: 4, spanId: "span-2" } };
    const pkg = makePackage({ rows: makePackage().rows.map((row, index) => index === 0 ? { ...row, acceptedEvidence: [first, second], rejectedEvidence: [] } : row) });
    const result = rejectVm0007EvidenceRecord(pkg, pkg.rows[0].rowId, vm0007EvidenceIdentity(first), "reviewer-1", "This record is boilerplate.", "2026-07-12T04:00:00.000Z");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.acceptedEvidence).toEqual([second]);
    expect(result.row.rejectedEvidence).toEqual([{ ...first, rejectionReason: "This record is boilerplate." }]);
    expect(result.row.rowVersion).toBe(2);
    expect(result.row.reviewState).toBe("edited");
    expect(result.row.reviewHistory).toHaveLength(1);
    expect(result.package.finalizationState).toBe("draft");
  });

  test("requires reviewer identity and a rejection reason", () => {
    const pkg = makePackage({ rows: makePackage().rows.map((row, index) => index === 0 ? { ...row, acceptedEvidence: [{ quote: "Evidence", page: 1, section: "S", spanId: "s", provenance }] } : row) });
    const identity = vm0007EvidenceIdentity(pkg.rows[0].acceptedEvidence![0]);
    expect(rejectVm0007EvidenceRecord(pkg, pkg.rows[0].rowId, identity, "reviewer-1", "   ")).toEqual({ ok: false, reason: "reviewer-metadata-required" });
    expect(rejectVm0007EvidenceRecord(pkg, pkg.rows[0].rowId, identity, "   ", "Reason")).toEqual({ ok: false, reason: "reviewer-metadata-required" });
  });

  test("accepts one rejected record, removes its reason, and persists the decision", () => {
    const rejected = { quote: "Rejected source quote", page: 7, section: "Methodology", spanId: "span-rejected", evidenceType: "methodology_boilerplate" as const, rejectionReason: "Not project evidence.", provenance: { ...provenance, page: 7, sectionPath: ["Methodology"], sectionHeading: "Methodology", spanId: "span-rejected" } };
    const other = { ...rejected, quote: "Other rejected quote", spanId: "span-other", provenance: { ...rejected.provenance, spanId: "span-other" } };
    const pkg = makePackage({ rows: makePackage().rows.map((row, index) => index === 0 ? { ...row, acceptedEvidence: [], rejectedEvidence: [rejected, other] } : row) });
    const result = acceptVm0007EvidenceRecord(pkg, pkg.rows[0].rowId, vm0007EvidenceIdentity(rejected), "reviewer-1", "Reinstated after source review.", "2026-07-12T04:01:00.000Z");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.acceptedEvidence).toEqual([{ ...rejected, rejectionReason: undefined }].map(({ rejectionReason: _reason, ...record }) => record));
    expect(result.row.rejectedEvidence).toEqual([other]);
    expect(result.row.acceptedEvidence?.[0]).toEqual(expect.objectContaining({ quote: rejected.quote, page: 7, section: "Methodology", spanId: "span-rejected", evidenceType: rejected.evidenceType, provenance: rejected.provenance }));
    expect(result.row.rowVersion).toBe(2);
    expect(loadVm0007EvidenceMapDraft(pkg.auditId)?.rows[0].acceptedEvidence).toHaveLength(1);
  });

  test("fails safely for unknown, duplicate, and repeated evidence identities", () => {
    const evidence = { quote: "Duplicate", page: 2, section: "Evidence", spanId: "same", provenance };
    const pkg = makePackage({ rows: makePackage().rows.map((row, index) => index === 0 ? { ...row, acceptedEvidence: [evidence, evidence], rejectedEvidence: [] } : row) });
    const identity = vm0007EvidenceIdentity(evidence);
    expect(rejectVm0007EvidenceRecord(pkg, pkg.rows[0].rowId, identity, "reviewer-1", "Reject duplicate.")).toEqual({ ok: false, reason: "unknown-or-ambiguous-evidence-identity" });
    expect(rejectVm0007EvidenceRecord(pkg, pkg.rows[0].rowId, "unknown", "reviewer-1", "Reject unknown.")).toEqual({ ok: false, reason: "unknown-or-ambiguous-evidence-identity" });
    const moved = rejectVm0007EvidenceRecord({ ...pkg, rows: pkg.rows.map((row, index) => index === 0 ? { ...row, acceptedEvidence: [evidence] } : row) }, pkg.rows[0].rowId, identity, "reviewer-1", "Reject once.");
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(rejectVm0007EvidenceRecord(moved.package, moved.row.rowId, identity, "reviewer-1", "Reject twice.")).toEqual({ ok: false, reason: "unknown-or-ambiguous-evidence-identity" });
    expect(moved.row.acceptedEvidence).toHaveLength(0);
    expect(moved.row.rejectedEvidence).toHaveLength(1);
  });

  test("finalization emits every reviewed accepted and rejected record with unique deterministic IDs", () => {
    const accepted = [1, 2].map((page) => ({ quote: `Accepted ${page}`, page, section: "Evidence", spanId: `accepted-${page}`, provenance: { ...provenance, page, spanId: `accepted-${page}` } }));
    const rejected = [3, 4].map((page) => ({ quote: `Rejected ${page}`, page, section: "Evidence", spanId: `rejected-${page}`, rejectionReason: "Insufficient project support.", provenance: { ...provenance, page, spanId: `rejected-${page}` } }));
    const pkg = makePackage({ rows: makePackage().rows.map((row, index) => index === 0 ? { ...row, acceptedEvidence: accepted, rejectedEvidence: rejected } : row) });
    const result = finalizeVm0007EvidenceMap(approveAll(pkg), "reviewer-1", "2026-07-12T05:00:00.000Z");
    expect(result.ok).toBe(true);
    const presentations = loadQuickCheckReadinessPayload(pkg.auditId)?.gateResult.presentations[0];
    const repeated = finalizeVm0007EvidenceMap(approveAll(pkg), "reviewer-1", "2026-07-12T05:00:00.000Z");
    expect(repeated.ok).toBe(true);
    const repeatedPresentations = repeated.ok ? repeated.pipeline.presentations[0] : null;
    expect(presentations?.acceptedEvidence).toHaveLength(2);
    expect(presentations?.rejectedEvidence).toHaveLength(2);
    expect(new Set([...(presentations?.acceptedEvidence ?? []), ...(presentations?.rejectedEvidence ?? [])].map((item) => item.evidenceId)).size).toBe(4);
    expect(presentations?.acceptedEvidence.map((item) => item.provenance.spanId)).toEqual(["accepted-1", "accepted-2"]);
    expect(presentations?.rejectedEvidence.map((item) => item.provenance.spanId)).toEqual(["rejected-3", "rejected-4"]);
    expect(presentations?.acceptedEvidence.map((item) => item.evidenceId)).toEqual(repeatedPresentations?.acceptedEvidence.map((item) => item.evidenceId));
    expect(presentations?.rejectedEvidence.map((item) => item.evidenceId)).toEqual(repeatedPresentations?.rejectedEvidence.map((item) => item.evidenceId));
    const allEvidence = [...(presentations?.acceptedEvidence ?? []), ...(presentations?.rejectedEvidence ?? [])];
    expect(allEvidence.every((item) => !item.evidenceId.includes(item.quote))).toBe(true);
    expect(allEvidence.every((item) => !item.evidenceId.includes(JSON.stringify(item.provenance)))).toBe(true);
    expect(allEvidence.every((item) => /:((accepted)|(rejected)):[a-f0-9]{16}$/.test(item.evidenceId))).toBe(true);
    expect(vm0007FinalizedEvidenceId(pkg.rows[0].rowId, "accepted", "same-identity")).not.toBe(vm0007FinalizedEvidenceId(pkg.rows[0].rowId, "rejected", "same-identity"));
    expect(compactEvidenceIdentityHash("same-identity")).toBe(compactEvidenceIdentityHash("same-identity"));
    const changed = rejectVm0007EvidenceRecord(result.ok ? result.package : pkg, pkg.rows[0].rowId, vm0007EvidenceIdentity(accepted[0]), "reviewer-1", "Correction after finalization.");
    expect(changed.ok).toBe(true);
    expect(loadQuickCheckReadinessPayload(pkg.auditId)).toBeNull();
  });
});
