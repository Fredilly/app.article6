/** @jest-environment jsdom */

import {
  acceptVm0007EvidenceRecord,
  approveVm0007EvidenceMapRow,
  editVm0007EvidenceMapRow,
  finalizeVm0007EvidenceMap,
  rejectVm0007EvidenceRecord,
  reopenVm0007EvidenceMapRow,
  vm0007EvidenceIdentity,
  vm0007EvidenceMapRowRequiresAttention,
} from "@/lib/preverif/vm0007EvidenceMapReview";
import {
  loadVm0007EvidenceMapDraft,
  saveVm0007EvidenceMapDraft,
} from "@/lib/preverif/vm0007EvidenceMapDraftStore";
import type { Vm0007EvidenceMapDraftPackage } from "@/lib/preverif/vm0007EvidenceMapDraft";
import type { ProjectEvidenceMapAssessment } from "@/lib/evidence/projectReadinessProductionPipeline";
import { createQuickCheckReadinessReportViewModel, loadQuickCheckReadinessPayload } from "@/lib/evidence/quickCheckReadinessPayload";
import type { ReviewedEvidenceMapSnapshot } from "@/lib/preverif/reviewedEvidenceMapTypes";
import {
  buildMachineEvidenceMapPresentation,
  buildReviewedEvidenceMapPresentation,
  filterEvidenceMapPresentation,
  findEvidenceMapNavigationTarget,
  summarizeEvidenceMapWorkflow,
} from "@/components/preverif/evidence-map/evidenceMapPresentationModel";

const provenance = {
  docId: "pdd-1",
  page: 3,
  sectionPath: ["Project activity"],
  spanId: "span-1",
  sectionHeading: "Project activity",
  sourceType: "PDD",
};

function assessmentFor(rowId: string, rowVersion = 1, overrides: Partial<ProjectEvidenceMapAssessment> = {}): ProjectEvidenceMapAssessment {
  return {
    evidenceMapRowId: rowId,
    applicability: { decision: "APPLICABLE", decisionBasis: "The requirement applies to this project." },
    conformance: {
      requirementSupport: "NOT_SUPPORTED",
      searchCoverageAssessment: "ADEQUATE",
      provenanceAssessment: "COMPLETE",
      versionIdentityAssessment: "MATCHED",
      contradictionAssessment: "NONE",
    },
    draftFinding: { draftFindingType: null, findingBasis: null, reviewerAssessment: null },
    reviewState: "CURRENT",
    rowVersion,
    ...overrides,
  };
}

function makePackage(): Vm0007EvidenceMapDraftPackage {
  const auditId = "rc4-4-full-workflow";
  const rows = Array.from({ length: 58 }, (_, index) => {
    const rowId = `${auditId}:R-${index + 1}`;
    return {
      rowId,
      auditId,
      stableRuleId: `R-${index + 1}`,
      ruleReference: `R-${index + 1}`,
      ruleTitle: `Rule ${index + 1}`,
      requirementText: `Requirement ${index + 1}`,
      methodologyId: "VM0007",
      methodologyVersion: "v1.8",
      rawAuditStatus: "missing_evidence" as const,
      upstreamStatus: "MISSING" as const,
      proposedEvidenceStatus: "MISSING" as const,
      proposedApplicability: "APPLICABLE" as const,
      proposedAcceptedEvidence: null,
      proposedRejectedEvidence: null,
      acceptedEvidence: [],
      rejectedEvidence: [],
      assessmentReason: "No project evidence was located.",
      gap: `Gap ${index + 1}`,
      clientAction: `Client action ${index + 1}`,
      confidence: "low" as const,
      searchCoverage: { searched: true, searchedDocumentIds: ["pdd-1"], notes: null },
      sourceDocument: { documentId: "pdd-1", documentName: "project.pdd.pdf", contentSha256: null },
      quote: null,
      page: null,
      section: null,
      spanId: null,
      provenance: null,
      finalizationState: "draft" as const,
      reviewState: "pending review" as const,
      reviewHistory: [],
      rowVersion: 1,
      finalizationActorRef: null,
      finalizedAt: null,
      finalizationBasis: null,
      reviewHistoryRef: null,
      assessment: assessmentFor(rowId),
      proposalSource: "VM0007_QUICK_CHECK_AUDIT" as const,
      proposalTimestamp: "2026-07-16T00:00:00.000Z",
    };
  });
  rows[0] = {
    ...rows[0],
    upstreamStatus: "FOUND",
    proposedEvidenceStatus: "FOUND",
    acceptedEvidence: [{ quote: "Project-specific evidence.", page: 3, section: "Project activity", spanId: "span-1", provenance }],
    rejectedEvidence: [{ quote: "Generic methodology text.", page: 4, section: "Methodology", spanId: "span-rejected", rejectionReason: "Boilerplate.", provenance: { ...provenance, page: 4, sectionPath: ["Methodology"], sectionHeading: "Methodology", spanId: "span-rejected" } }],
    proposedAcceptedEvidence: { quote: "Project-specific evidence.", provenance },
  };
  return {
    auditId,
    generatedAt: "2026-07-16T00:00:00.000Z",
    methodologyId: "VM0007",
    rulebookVersion: "v1.8",
    pddDeclaredMethodologyVersion: "v1.8",
    sourceDocument: rows[0].sourceDocument,
    proposalState: "MACHINE_PROPOSED",
    rows,
    blockedBy: [],
    contractVersion: "vm0007-evidence-map-draft-v1",
  };
}

function approveAll(pkg: Vm0007EvidenceMapDraftPackage): Vm0007EvidenceMapDraftPackage {
  let current = pkg;
  for (const row of pkg.rows) {
    const result = approveVm0007EvidenceMapRow(current, row.rowId, "reviewer:rc4-4", "Reviewed canonical assessment.", "2026-07-16T01:00:00.000Z");
    if (!result.ok) throw new Error(result.reason);
    current = result.package;
  }
  return current;
}

function reassess(pkg: Vm0007EvidenceMapDraftPackage, rowId: string, note = "Reassessed current canonical truth."): Vm0007EvidenceMapDraftPackage {
  const row = pkg.rows.find((candidate) => candidate.rowId === rowId)!;
  const result = editVm0007EvidenceMapRow(pkg, rowId, { assessment: assessmentFor(rowId, (row.rowVersion ?? 1) + 1) }, "reviewer:rc4-4", note, "2026-07-16T06:00:00.000Z");
  if (!result.ok) throw new Error(result.reason);
  return result.package;
}

function reviewedSnapshotFromPackage(pkg: Vm0007EvidenceMapDraftPackage): ReviewedEvidenceMapSnapshot {
  return {
    canonicalAuditId: pkg.auditId,
    stableProjectId: "rc4-4-project",
    sourceDocument: { ...pkg.sourceDocument, contentSha256: "rc4-4-reviewed-hash" },
    methodologyId: pkg.methodologyId,
    methodologyVersion: pkg.rulebookVersion,
    rows: pkg.rows.map((row) => ({
      rowId: row.rowId,
      stableRuleId: row.stableRuleId,
      ruleReference: row.ruleReference,
      requirementText: row.requirementText,
      finalEvidenceState: row.proposedEvidenceStatus === "FOUND" ? "FOUND" : "MISSING",
      reviewerOutcome: row.assessment?.draftFinding.draftFindingType ? "ACTION_REQUIRED" : "CONFORMS",
      reviewerEvidence: (row.acceptedEvidence ?? []).map((record) => ({ ...record, rejectionReason: undefined })),
      rejectedEvidence: row.rejectedEvidence ?? [],
      draftFindingCandidate: row.assessment?.draftFinding.draftFindingType ?? null,
      contradictionState: row.assessment?.conformance.contradictionAssessment === "BLOCKING" ? "BLOCKING" : "NONE_IDENTIFIED",
      clientAction: row.clientAction,
    })),
    readOnly: true,
  };
}

describe("RC4-4 full 58-rule reviewer workflow gate", () => {
  beforeEach(() => window.localStorage.clear());

  test("keeps all 58 rules addressable and makes navigation deterministic", () => {
    const pkg = makePackage();
    expect(saveVm0007EvidenceMapDraft(pkg)).toEqual({ ok: true });
    const presentation = buildMachineEvidenceMapPresentation(pkg);
    expect(presentation.rows).toHaveLength(58);
    expect(new Set(presentation.rows.map((row) => row.rowId)).size).toBe(58);
    expect(presentation.rows.map((row) => row.ruleReference)).toEqual(Array.from({ length: 58 }, (_, i) => `R-${i + 1}`));

    const unresolved = presentation.rows.map((row, index) => ({ ...row, unresolved: index === 2 || index === 57, blockerReasons: index === 57 ? ["canonical assessment stale"] : [] }));
    expect(findEvidenceMapNavigationTarget(unresolved, unresolved[2].rowId, "previous")?.rowId).toBe(unresolved[1].rowId);
    expect(findEvidenceMapNavigationTarget(unresolved, unresolved[2].rowId, "next")?.rowId).toBe(unresolved[3].rowId);
    expect(findEvidenceMapNavigationTarget(unresolved, unresolved[2].rowId, "unresolved")?.rowId).toBe(unresolved[57].rowId);
    expect(findEvidenceMapNavigationTarget(unresolved, unresolved[57].rowId, "unresolved")?.rowId).toBe(unresolved[2].rowId);
    expect(findEvidenceMapNavigationTarget(unresolved, unresolved[2].rowId, "blocker")?.rowId).toBe(unresolved[57].rowId);
    expect(findEvidenceMapNavigationTarget(unresolved, unresolved[57].rowId, "next")).toBeNull();
  });

  test("reject and reinstate preserve evidence identity, provenance, rejection reason, and history", () => {
    const pkg = makePackage();
    const rowId = pkg.rows[0].rowId;
    const record = pkg.rows[0].acceptedEvidence![0];
    const identity = vm0007EvidenceIdentity(record);
    const rejected = rejectVm0007EvidenceRecord(pkg, rowId, identity, "reviewer:rc4-4", "Not project-specific.", "2026-07-16T02:00:00.000Z");
    expect(rejected.ok).toBe(true);
    if (!rejected.ok) return;
    expect(rejected.row.acceptedEvidence).toHaveLength(0);
    expect(rejected.row.rejectedEvidence).toEqual([
      expect.objectContaining({ quote: "Generic methodology text.", rejectionReason: "Boilerplate." }),
      { ...record, rejectionReason: "Not project-specific." },
    ]);
    const reinstated = acceptVm0007EvidenceRecord(rejected.package, rowId, identity, "reviewer:rc4-4", "Reinstated after review.", "2026-07-16T02:01:00.000Z");
    expect(reinstated.ok).toBe(true);
    if (!reinstated.ok) return;
    expect(vm0007EvidenceIdentity(reinstated.row.acceptedEvidence![0])).toBe(identity);
    expect(reinstated.row.acceptedEvidence![0].provenance).toEqual(record.provenance);
    expect(reinstated.row.rejectedEvidence).toHaveLength(1);
    expect(reinstated.row.rowVersion).toBe(3);
    expect(reinstated.row.reviewHistory).toHaveLength(2);
    const reloaded = loadVm0007EvidenceMapDraft(pkg.auditId)!;
    expect(reloaded.rows[0].acceptedEvidence).toEqual(reinstated.row.acceptedEvidence);
    expect(reloaded.rows[0].rejectedEvidence).toEqual(reinstated.row.rejectedEvidence);
  });

  test("edits require metadata, version and history, invalidate assessment/finalization, and clear readiness", () => {
    const finalized = finalizeVm0007EvidenceMap(approveAll(makePackage()), "reviewer:rc4-4", "2026-07-16T03:00:00.000Z");
    expect(finalized.ok).toBe(true);
    if (!finalized.ok) return;
    const rowId = finalized.package.rows[0].rowId;
    expect(editVm0007EvidenceMapRow(finalized.package, rowId, { gap: "New gap" }, "", "Edit note")).toEqual({ ok: false, reason: "reviewer-metadata-required" });
    expect(editVm0007EvidenceMapRow(finalized.package, rowId, { clientAction: "New action" }, "reviewer:rc4-4", " ")).toEqual({ ok: false, reason: "reviewer-metadata-required" });
    const edited = editVm0007EvidenceMapRow(finalized.package, rowId, { gap: "New gap", clientAction: "New action" }, "reviewer:rc4-4", "Clarified client follow-up.", "2026-07-16T03:01:00.000Z");
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.row.rowVersion).toBe(2);
    expect(edited.row.assessment).toBeUndefined();
    expect(edited.row.reviewState).toBe("edited");
    expect(edited.row.finalizationState).toBe("draft");
    expect(edited.package.finalizationState).toBe("draft");
    expect(edited.row.reviewHistory).toHaveLength(2);
    const persisted = loadVm0007EvidenceMapDraft(finalized.package.auditId)?.rows[0];
    expect(persisted).toMatchObject({ gap: "New gap", clientAction: "New action", rowVersion: 2 });
    expect(persisted).not.toHaveProperty("assessment");
    expect(edited.package.finalizationState).toBe("draft");
  });

  test("failed approval is a no-op; successful approval wraps to the next unresolved row", () => {
    const pkg = makePackage();
    const rowId = pkg.rows[0].rowId;
    const invalid = { ...pkg, rows: pkg.rows.map((row) => row.rowId === rowId ? { ...row, assessment: undefined } : row) };
    saveVm0007EvidenceMapDraft(invalid);
    const before = window.localStorage.getItem(`article6:vm0007-evidence-map-draft:v1:${pkg.auditId}`);
    expect(approveVm0007EvidenceMapRow(invalid, rowId, "reviewer:rc4-4", "Approve.")).toEqual({ ok: false, reason: "canonical-assessment-required-or-stale" });
    expect(window.localStorage.getItem(`article6:vm0007-evidence-map-draft:v1:${pkg.auditId}`)).toBe(before);

    const approved = approveVm0007EvidenceMapRow(pkg, rowId, "reviewer:rc4-4", "Approve.", "2026-07-16T04:00:00.000Z");
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    const nextUnresolved = approved.package.rows.slice(1).find(vm0007EvidenceMapRowRequiresAttention) ?? approved.package.rows.find(vm0007EvidenceMapRowRequiresAttention);
    expect(nextUnresolved?.rowId).toBe(pkg.rows[1].rowId);
    expect(findEvidenceMapNavigationTarget(buildMachineEvidenceMapPresentation(approved.package).rows, rowId, "unresolved")?.rowId).toBe(pkg.rows[1].rowId);
    let lastFirst = pkg;
    for (const row of pkg.rows.slice(1)) {
      const result = approveVm0007EvidenceMapRow(lastFirst, row.rowId, "reviewer:rc4-4", "Approve.", "2026-07-16T04:01:00.000Z");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      lastFirst = result.package;
    }
    expect(findEvidenceMapNavigationTarget(buildMachineEvidenceMapPresentation(lastFirst).rows, pkg.rows[57].rowId, "unresolved")?.rowId).toBe(pkg.rows[0].rowId);
    const lastApproved = approveVm0007EvidenceMapRow(lastFirst, pkg.rows[0].rowId, "reviewer:rc4-4", "Approve.", "2026-07-16T04:02:00.000Z");
    expect(lastApproved.ok).toBe(true);
    if (!lastApproved.ok) return;
    expect(lastApproved.package.rows.every((row) => row.reviewState === "approved")).toBe(true);
    const wrapTarget = lastApproved.package.rows.find(vm0007EvidenceMapRowRequiresAttention);
    expect(wrapTarget?.rowId).toBeUndefined();
  });

  test("finalization blocks every incomplete class, then succeeds from persisted current canonical truth", () => {
    const pkg = makePackage();
    const approved = approveAll(pkg);
    const cases = [
      { name: "not approved", value: { ...approved, rows: approved.rows.map((row, i) => i === 0 ? { ...row, reviewState: "edited" as const } : row) } },
      { name: "missing assessment", value: { ...approved, rows: approved.rows.map((row, i) => i === 1 ? { ...row, assessment: undefined } : row) } },
      { name: "stale assessment", value: { ...approved, rows: approved.rows.map((row, i) => i === 2 ? { ...row, rowVersion: 2 } : row) } },
      { name: "canonical validation", value: { ...approved, rows: approved.rows.map((row, i) => i === 3 ? { ...row, assessment: assessmentFor(row.rowId, 1, { conformance: { ...row.assessment!.conformance, contradictionAssessment: "BLOCKING" } }) } : row) } },
    ];
    for (const entry of cases) expect(finalizeVm0007EvidenceMap(entry.value, "reviewer:rc4-4")).toMatchObject({ ok: false });

    const result = finalizeVm0007EvidenceMap(loadVm0007EvidenceMapDraft(pkg.auditId)!, "reviewer:rc4-4", "2026-07-16T05:00:00.000Z");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const reloaded = loadVm0007EvidenceMapDraft(pkg.auditId)!;
    expect(reloaded.finalizationState).toBe("finalized");
    expect(reloaded.rows).toHaveLength(58);
    expect(reloaded.rows.every((row) => row.reviewState === "approved" && row.assessment?.rowVersion === row.rowVersion)).toBe(true);
  });

  test("presentation filters and mode-shaped projections do not mutate persisted reviewer truth", () => {
    const pkg = makePackage();
    saveVm0007EvidenceMapDraft(pkg);
    const before = window.localStorage.getItem(`article6:vm0007-evidence-map-draft:v1:${pkg.auditId}`);
    const presentation = buildMachineEvidenceMapPresentation(pkg);
    filterEvidenceMapPresentation(presentation.rows, { query: "Rule 2", evidenceState: "MISSING", applicability: "APPLICABLE", reviewerOutcome: "NONE", reviewState: "pending review" });
    filterEvidenceMapPresentation(presentation.rows, { query: "", evidenceState: "ALL", applicability: "ALL", reviewerOutcome: "ALL", reviewState: "ALL" });
    expect(window.localStorage.getItem(`article6:vm0007-evidence-map-draft:v1:${pkg.auditId}`)).toBe(before);
    expect(loadVm0007EvidenceMapDraft(pkg.auditId)?.rows).toEqual(pkg.rows);
  });

  test("reopening an approved finalized row persists unresolved state until reassessment and reapproval", () => {
    const initial = makePackage();
    const finalized = finalizeVm0007EvidenceMap(approveAll(initial), "reviewer:rc4-4", "2026-07-16T07:00:00.000Z");
    expect(finalized.ok).toBe(true);
    if (!finalized.ok) return;
    const rowId = finalized.package.rows[0].rowId;
    const reopened = reopenVm0007EvidenceMapRow(finalized.package, rowId, "reviewer:rc4-4", "Reopen for additional review.", "2026-07-16T07:01:00.000Z");
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) return;
    expect(reopened.row.reviewState).toBe("reopened");
    expect(vm0007EvidenceMapRowRequiresAttention(reopened.row)).toBe(true);
    expect(reopened.package.finalizationState).toBe("draft");
    expect(reopened.row.reviewHistory).toHaveLength(2);
    expect(loadVm0007EvidenceMapDraft(initial.auditId)?.rows[0].reviewState).toBe("reopened");
    expect(finalizeVm0007EvidenceMap(loadVm0007EvidenceMapDraft(initial.auditId)!, "reviewer:rc4-4")).toMatchObject({ ok: false });

    const reassessed = reassess(loadVm0007EvidenceMapDraft(initial.auditId)!, rowId);
    expect(reassessed.rows[0].assessment?.reviewState).toBe("CURRENT");
    const reapproved = approveVm0007EvidenceMapRow(reassessed, rowId, "reviewer:rc4-4", "Reapproved after reassessment.", "2026-07-16T07:02:00.000Z");
    expect(reapproved.ok).toBe(true);
    if (!reapproved.ok) return;
    expect(reapproved.row.reviewState).toBe("approved");
    expect(reapproved.row.reviewHistory).toHaveLength(4);
    const refinalized = finalizeVm0007EvidenceMap(loadVm0007EvidenceMapDraft(initial.auditId)!, "reviewer:rc4-4", "2026-07-16T07:03:00.000Z");
    expect(refinalized.ok).toBe(true);
    expect(loadVm0007EvidenceMapDraft(initial.auditId)?.finalizationState).toBe("finalized");
  });

  test("derives unresolved and blocked counts independently from current row data", () => {
    const initial = makePackage();
    const initialSummary = summarizeEvidenceMapWorkflow(buildMachineEvidenceMapPresentation(initial).rows);
    expect(initialSummary).toEqual({ total: 58, complete: 0, unresolved: 58, blocked: 0 });
    const stale = { ...initial, rows: initial.rows.map((row, index) => index === 0 ? { ...row, rowVersion: 2 } : row) };
    expect(summarizeEvidenceMapWorkflow(buildMachineEvidenceMapPresentation(stale).rows)).toEqual({ total: 58, complete: 0, unresolved: 58, blocked: 1 });

    const approvedOne = approveVm0007EvidenceMapRow(stale, stale.rows[1].rowId, "reviewer:rc4-4", "Approve valid row.", "2026-07-16T08:00:00.000Z");
    expect(approvedOne.ok).toBe(true);
    if (!approvedOne.ok) return;
    expect(summarizeEvidenceMapWorkflow(buildMachineEvidenceMapPresentation(approvedOne.package).rows)).toEqual({ total: 58, complete: 1, unresolved: 57, blocked: 1 });
    const reopened = reopenVm0007EvidenceMapRow(approvedOne.package, stale.rows[1].rowId, "reviewer:rc4-4", "Reopen approved row.", "2026-07-16T08:01:00.000Z");
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) return;
    expect(summarizeEvidenceMapWorkflow(buildMachineEvidenceMapPresentation(reopened.package).rows)).toEqual({ total: 58, complete: 0, unresolved: 58, blocked: 2 });
    const restored = reassess(reopened.package, stale.rows[1].rowId);
    expect(summarizeEvidenceMapWorkflow(buildMachineEvidenceMapPresentation(restored).rows)).toEqual({ total: 58, complete: 0, unresolved: 58, blocked: 1 });
    const approvedAgain = approveVm0007EvidenceMapRow(restored, stale.rows[1].rowId, "reviewer:rc4-4", "Approve reassessed row.", "2026-07-16T08:02:00.000Z");
    expect(approvedAgain.ok).toBe(true);
    if (!approvedAgain.ok) return;
    const fixedStale = reassess(approvedAgain.package, stale.rows[0].rowId);
    expect(summarizeEvidenceMapWorkflow(buildMachineEvidenceMapPresentation(fixedStale).rows)).toEqual({ total: 58, complete: 1, unresolved: 57, blocked: 0 });
  });

  test("only finalized reviewed truth reaches readiness and report presentation output", () => {
    const pkg = makePackage();
    saveVm0007EvidenceMapDraft(pkg);
    expect(loadQuickCheckReadinessPayload(pkg.auditId)).toBeNull();
    expect(createQuickCheckReadinessReportViewModel(null).release.state).toBe("NOT_ASSESSED");
    const edited = editVm0007EvidenceMapRow(pkg, pkg.rows[0].rowId, { gap: "Reviewed gap", clientAction: "Reviewed client action." }, "reviewer:rc4-4", "Record reviewed downstream fields.", "2026-07-16T09:00:00.000Z");
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    const assessed = editVm0007EvidenceMapRow(edited.package, pkg.rows[0].rowId, { assessment: assessmentFor(pkg.rows[0].rowId, 3, { applicability: { decision: "NOT_APPLICABLE", decisionBasis: "Reviewer confirmed this requirement is out of scope." } }) }, "reviewer:rc4-4", "Reassess applicability and outcome.", "2026-07-16T09:01:00.000Z");
    expect(assessed.ok).toBe(true);
    if (!assessed.ok) return;
    let reviewed = assessed.package;
    for (const row of reviewed.rows) {
      if (row.rowId === pkg.rows[0].rowId) continue;
      const result = approveVm0007EvidenceMapRow(reviewed, row.rowId, "reviewer:rc4-4", "Approve row.", "2026-07-16T09:02:00.000Z");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      reviewed = result.package;
    }
    const approved = approveVm0007EvidenceMapRow(reviewed, pkg.rows[0].rowId, "reviewer:rc4-4", "Approve reviewed applicability.", "2026-07-16T09:03:00.000Z");
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    const finalized = finalizeVm0007EvidenceMap(loadVm0007EvidenceMapDraft(pkg.auditId)!, "reviewer:rc4-4", "2026-07-16T09:04:00.000Z");
    expect(finalized.ok).toBe(true);
    if (!finalized.ok) return;
    const payload = loadQuickCheckReadinessPayload(pkg.auditId);
    const readiness = createQuickCheckReadinessReportViewModel(payload);
    expect(readiness.release.state).toBe("PRE_VALIDATION_RELEASE_READY");
    expect(readiness.rows).toHaveLength(58);
    expect(finalized.pipeline.presentations[0]).toMatchObject({ clientAction: "Reviewed client action.", applicabilityResult: { applicability: "NOT_APPLICABLE" } });
    expect(finalized.package.rows[0]).toMatchObject({ gap: "Reviewed gap", clientAction: "Reviewed client action.", proposedApplicability: "NOT_APPLICABLE" });
    expect(finalized.pipeline.presentations[0].conformanceConclusion.conclusion).toBe("NOT_APPLICABLE");

    const reopened = reopenVm0007EvidenceMapRow(finalized.package, pkg.rows[0].rowId, "reviewer:rc4-4", "Reopen downstream truth.", "2026-07-16T09:05:00.000Z");
    expect(reopened.ok).toBe(true);
    expect(loadQuickCheckReadinessPayload(pkg.auditId)).toBeNull();
    expect(finalizeVm0007EvidenceMap(loadVm0007EvidenceMapDraft(pkg.auditId)!, "reviewer:rc4-4")).toMatchObject({ ok: false });
  });

  test("switching machine/reviewed presentation modes leaves every persisted field unchanged", () => {
    const pkg = finalizeVm0007EvidenceMap(approveAll(makePackage()), "reviewer:rc4-4", "2026-07-16T10:00:00.000Z");
    expect(pkg.ok).toBe(true);
    if (!pkg.ok) return;
    const snapshot = reviewedSnapshotFromPackage(pkg.package);
    const storageBefore = window.localStorage.getItem(`article6:vm0007-evidence-map-draft:v1:${pkg.package.auditId}`);
    const truthBefore = loadVm0007EvidenceMapDraft(pkg.package.auditId);
    const modes = [
      buildMachineEvidenceMapPresentation(pkg.package),
      buildReviewedEvidenceMapPresentation(snapshot),
      buildMachineEvidenceMapPresentation(pkg.package),
      buildReviewedEvidenceMapPresentation(snapshot),
    ];
    expect(modes.map((mode) => mode.rows.length)).toEqual([58, 58, 58, 58]);
    expect(window.localStorage.getItem(`article6:vm0007-evidence-map-draft:v1:${pkg.package.auditId}`)).toBe(storageBefore);
    expect(loadVm0007EvidenceMapDraft(pkg.package.auditId)).toEqual(truthBefore);
    expect(loadVm0007EvidenceMapDraft(pkg.package.auditId)?.rows[0]).toMatchObject({ rowVersion: truthBefore?.rows[0].rowVersion, acceptedEvidence: truthBefore?.rows[0].acceptedEvidence, rejectedEvidence: truthBefore?.rows[0].rejectedEvidence, reviewHistory: truthBefore?.rows[0].reviewHistory, finalizationState: "finalized" });
  });

  test("persists one complete edit/evidence/reassess/approve/reopen/refinalize chain", () => {
    const initial = makePackage();
    saveVm0007EvidenceMapDraft(initial);
    let current = loadVm0007EvidenceMapDraft(initial.auditId)!;
    const rowId = current.rows[0].rowId;
    const persisted = () => loadVm0007EvidenceMapDraft(current.auditId)!;
    const acceptedIdentity = vm0007EvidenceIdentity(current.rows[0].acceptedEvidence![0]);
    const edited = editVm0007EvidenceMapRow(current, rowId, { gap: "Chain gap", clientAction: "Chain action." }, "reviewer:rc4-4", "Chain edit.", "2026-07-16T11:00:00.000Z");
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    current = edited.package;
    expect(persisted().rows[0].gap).toBe("Chain gap");
    const rejected = rejectVm0007EvidenceRecord(current, rowId, acceptedIdentity, "reviewer:rc4-4", "Reject for identity review.", "2026-07-16T11:01:00.000Z");
    expect(rejected.ok).toBe(true);
    if (!rejected.ok) return;
    current = rejected.package;
    expect(persisted().rows[0].rejectedEvidence?.some((record) => record.rejectionReason === "Reject for identity review.")).toBe(true);
    const reinstated = acceptVm0007EvidenceRecord(current, rowId, acceptedIdentity, "reviewer:rc4-4", "Reinstate after identity review.", "2026-07-16T11:02:00.000Z");
    expect(reinstated.ok).toBe(true);
    if (!reinstated.ok) return;
    current = reinstated.package;
    const failedStorage = window.localStorage.getItem(`article6:vm0007-evidence-map-draft:v1:${current.auditId}`);
    expect(approveVm0007EvidenceMapRow(current, rowId, "reviewer:rc4-4", "Should fail while stale.")).toMatchObject({ ok: false });
    expect(window.localStorage.getItem(`article6:vm0007-evidence-map-draft:v1:${current.auditId}`)).toBe(failedStorage);
    const reassessed = reassess(current, rowId, "Chain reassessment.");
    current = reassessed;
    const approved = approveVm0007EvidenceMapRow(current, rowId, "reviewer:rc4-4", "Chain approval.", "2026-07-16T11:04:00.000Z");
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    current = approved.package;
    expect(findEvidenceMapNavigationTarget(buildMachineEvidenceMapPresentation(current).rows, rowId, "unresolved")?.rowId).toBe(current.rows[1].rowId);
    const reopened = reopenVm0007EvidenceMapRow(current, rowId, "reviewer:rc4-4", "Chain reopen.", "2026-07-16T11:05:00.000Z");
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) return;
    current = reopened.package;
    expect(persisted().rows[0].reviewHistory?.map((event) => event.newState)).toEqual(["edited", "edited", "edited", "reopened", "edited", "approved", "reopened"]);
    current = reassess(current, rowId, "Chain second reassessment.");
    const reapproved = approveVm0007EvidenceMapRow(current, rowId, "reviewer:rc4-4", "Chain reapproval.", "2026-07-16T11:07:00.000Z");
    expect(reapproved.ok).toBe(true);
    if (!reapproved.ok) return;
    current = reapproved.package;
    for (const row of current.rows) {
      if (row.rowId === rowId) continue;
      const result = approveVm0007EvidenceMapRow(current, row.rowId, "reviewer:rc4-4", "Approve remaining row.", "2026-07-16T11:08:00.000Z");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      current = result.package;
    }
    const finalized = finalizeVm0007EvidenceMap(persisted(), "reviewer:rc4-4", "2026-07-16T11:09:00.000Z");
    expect(finalized.ok).toBe(true);
    if (!finalized.ok) return;
    const reloaded = loadVm0007EvidenceMapDraft(current.auditId)!;
    expect(reloaded.rows).toHaveLength(58);
    expect(reloaded.rows.every((row) => row.reviewState === "approved" && row.assessment?.reviewState === "CURRENT" && row.assessment.rowVersion === row.rowVersion)).toBe(true);
    expect(createQuickCheckReadinessReportViewModel(loadQuickCheckReadinessPayload(current.auditId)).rows).toHaveLength(58);
    expect(loadQuickCheckReadinessPayload(current.auditId)?.gateResult.presentations[0].clientAction).toBe("Chain action.");
  });
});
