/** @jest-environment jsdom */

import { beforeEach, describe, expect, test, jest } from "@jest/globals";
import type { Vm0007EvidenceMapDraftPackage, DraftBuildResult } from "@/lib/preverif/vm0007EvidenceMapDraft";
import type { Vm0007EvidenceMapDraftSaveResult } from "@/lib/preverif/vm0007EvidenceMapDraftStore";
import { completeVm0007EvidenceMapGeneration, type Vm0007GapReportAuditRecord } from "@/lib/preverif/vm0007GapReportStore";
import { EVIDENCE_MAP_GENERATION_STAGES, classifyEvidenceMapGenerationError } from "@/lib/preverif/evidenceMapGenerationError";

const audit = { auditId: "audit-1", generatedAt: "2026-07-01T00:00:00Z", evidenceFileName: "pdd.pdf", audit: { totalRules: 58 } } as Vm0007GapReportAuditRecord;
const draftPackage = {} as Vm0007EvidenceMapDraftPackage;
const builtDraft: DraftBuildResult = { ok: true, package: draftPackage };

describe("VM0007 Evidence Map generation orchestration", () => {
  beforeEach(() => localStorage.clear());
  test("keeps audit success separate when draft build is blocked", () => {
    const result = completeVm0007EvidenceMapGeneration({ audit, auditSaved: true, draft: { ok: false, blockedBy: ["pdd_declared_version_mismatch"] } });
    expect(result).toMatchObject({ auditSaved: true, draftBuilt: false, draftSaved: false, blockedBy: ["pdd_declared_version_mismatch"], auditId: "audit-1" });
  });

  test("reports successful audit and draft persistence only after reload", () => {
    const saveDraft = jest.fn((): Vm0007EvidenceMapDraftSaveResult => ({ ok: true }));
    const loadDraft = jest.fn(() => draftPackage);
    const result = completeVm0007EvidenceMapGeneration({ audit, auditSaved: true, draft: builtDraft, saveDraft, loadDraft });
    expect(result).toMatchObject({ auditSaved: true, draftBuilt: true, draftSaved: true, blockedBy: [] });
    expect(saveDraft).toHaveBeenCalledWith(draftPackage);
    expect(loadDraft).toHaveBeenCalledWith("audit-1");
  });

  test("distinguishes draft validation and storage failures", () => {
    expect(completeVm0007EvidenceMapGeneration({ audit, auditSaved: true, draft: builtDraft, saveDraft: () => ({ ok: false, reason: "draft_validation_failed" }), loadDraft: () => draftPackage })).toMatchObject({ blockedBy: ["draft_validation_failed"], error: { category: "VALIDATION_ERROR", diagnostic: { stage: "draft_validation" } } });
    expect(completeVm0007EvidenceMapGeneration({ audit, auditSaved: true, draft: builtDraft, saveDraft: () => ({ ok: false, reason: "storage_unavailable" }), loadDraft: () => draftPackage })).toMatchObject({ blockedBy: ["storage_unavailable"], error: { category: "PERSISTENCE_ERROR", diagnostic: { stage: "draft_persistence" } } });
    expect(completeVm0007EvidenceMapGeneration({ audit, auditSaved: true, draft: builtDraft, saveDraft: () => ({ ok: false, reason: "storage_write_failed" }), loadDraft: () => draftPackage })).toMatchObject({ blockedBy: ["storage_write_failed"], error: { category: "PERSISTENCE_ERROR", diagnostic: { stage: "draft_persistence" } } });
    expect(completeVm0007EvidenceMapGeneration({ audit, auditSaved: true, draft: builtDraft, saveDraft: () => ({ ok: true }), loadDraft: () => null })).toMatchObject({ blockedBy: ["draft_reload_verification_failed"], error: { category: "PERSISTENCE_ERROR", diagnostic: { stage: "draft_reload_verification" } } });
  });

  test("converts a thrown draft persistence error into the structured generation contract", () => {
    const result = completeVm0007EvidenceMapGeneration({ audit, auditSaved: true, draft: builtDraft, saveDraft: () => { throw new Error("Quota exceeded while writing localStorage"); }, loadDraft: () => draftPackage });
    expect(result).toMatchObject({ draftBuilt: true, draftSaved: false, blockedBy: ["draft_persistence_failed"], error: { category: "PERSISTENCE_ERROR", userMessage: expect.stringContaining("could not be saved"), diagnostic: { stage: "draft_persistence" } } });
  });

  test("keeps save and reload exceptions in their exact stages", () => {
    const saveResult = completeVm0007EvidenceMapGeneration({ audit, auditSaved: true, draft: builtDraft, saveDraft: () => { throw new Error("not a load error"); }, loadDraft: () => draftPackage });
    expect(saveResult.error?.diagnostic.stage).toBe("draft_persistence");
    const reloadResult = completeVm0007EvidenceMapGeneration({ audit, auditSaved: true, draft: builtDraft, saveDraft: () => ({ ok: true }), loadDraft: () => { throw new Error("write wording only"); } });
    expect(reloadResult.error?.diagnostic.stage).toBe("draft_reload_verification");
  });

  test.each(["null", "exception"])("removes both new records on terminal draft reload %s", (failure) => {
    localStorage.setItem("a6:vm0007-gap-report-audit:v1:audit-1", "new audit");
    localStorage.setItem("article6:vm0007-evidence-map-draft:v1:audit-1", "new draft");
    localStorage.setItem("a6:vm0007-gap-report-audit:v1:previous", "previous audit");
    localStorage.setItem("article6:vm0007-evidence-map-draft:v1:previous", "previous draft");
    localStorage.setItem("article6:unrelated", "keep");
    const result = completeVm0007EvidenceMapGeneration({ audit, auditSaved: true, draft: builtDraft, saveDraft: () => ({ ok: true }), loadDraft: failure === "null" ? () => null : () => { throw new Error("reload failed"); } });
    expect(result.blockedBy).toEqual(["draft_reload_verification_failed"]);
    expect(localStorage.getItem("a6:vm0007-gap-report-audit:v1:audit-1")).toBeNull();
    expect(localStorage.getItem("article6:vm0007-evidence-map-draft:v1:audit-1")).toBeNull();
    expect(localStorage.getItem("a6:vm0007-gap-report-audit:v1:previous")).toBe("previous audit");
    expect(localStorage.getItem("article6:vm0007-evidence-map-draft:v1:previous")).toBe("previous draft");
    expect(localStorage.getItem("article6:unrelated")).toBe("keep");
  });

  test("preserves every PR #1127 diagnostic stage", () => {
    expect(EVIDENCE_MAP_GENERATION_STAGES).toEqual(["input_validation", "machine_proposal_generation", "audit_persistence", "draft_validation", "draft_persistence", "draft_reload_verification"]);
    for (const stage of EVIDENCE_MAP_GENERATION_STAGES) expect(classifyEvidenceMapGenerationError({ stage }).diagnostic.stage).toBe(stage);
  });

  test("preserves internal blocker reasons while failing an unsaved audit", () => {
    const result = completeVm0007EvidenceMapGeneration({ audit, auditSaved: false, draft: builtDraft });
    expect(result).toMatchObject({ auditSaved: false, draftSaved: false, blockedBy: ["audit_persistence_failed"] });
  });
});
