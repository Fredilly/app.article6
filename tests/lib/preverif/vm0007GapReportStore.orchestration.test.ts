/** @jest-environment jsdom */

import { beforeEach, describe, expect, test, jest } from "@jest/globals";
import type { Vm0007EvidenceMapDraftPackage, DraftBuildResult } from "@/lib/preverif/vm0007EvidenceMapDraft";
import { completeVm0007EvidenceMapGeneration, type Vm0007GapReportAuditRecord } from "@/lib/preverif/vm0007GapReportStore";

const audit = { auditId: "audit-1" } as Vm0007GapReportAuditRecord;
const draftPackage = {} as Vm0007EvidenceMapDraftPackage;
const builtDraft: DraftBuildResult = { ok: true, package: draftPackage };

describe("VM0007 Evidence Map generation orchestration", () => {
  beforeEach(() => localStorage.clear());

  test("keeps audit success separate when draft build is blocked", () => {
    const result = completeVm0007EvidenceMapGeneration({ audit, auditSaved: true, draft: { ok: false, blockedBy: ["pdd_declared_version_mismatch"] } });
    expect(result).toMatchObject({ auditSaved: true, draftBuilt: false, draftSaved: false, blockedBy: ["pdd_declared_version_mismatch"], auditId: "audit-1" });
  });

  test("reports successful audit and draft persistence only after reload", () => {
    const saveDraft = jest.fn(() => true);
    const loadDraft = jest.fn(() => draftPackage);
    const result = completeVm0007EvidenceMapGeneration({ audit, auditSaved: true, draft: builtDraft, saveDraft, loadDraft });
    expect(result).toMatchObject({ auditSaved: true, draftBuilt: true, draftSaved: true, blockedBy: [] });
    expect(saveDraft).toHaveBeenCalledWith(draftPackage);
    expect(loadDraft).toHaveBeenCalledWith("audit-1");
  });

  test("treats save false and load null as draft failures", () => {
    expect(completeVm0007EvidenceMapGeneration({ audit, auditSaved: true, draft: builtDraft, saveDraft: () => false, loadDraft: () => draftPackage })).toMatchObject({ draftBuilt: true, draftSaved: false, blockedBy: ["draft_persistence_failed"] });
    expect(completeVm0007EvidenceMapGeneration({ audit, auditSaved: true, draft: builtDraft, saveDraft: () => true, loadDraft: () => null })).toMatchObject({ draftBuilt: true, draftSaved: false, blockedBy: ["draft_persistence_failed"] });
  });

  test("removes only the new orphan audit when terminal draft persistence fails", () => {
    localStorage.setItem("a6:vm0007-gap-report-audit:v1:audit-1", "new audit");
    localStorage.setItem("a6:vm0007-gap-report-audit:v1:previous", "previous audit");
    localStorage.setItem("article6:vm0007-evidence-map-draft:v1:previous", "previous draft");

    const result = completeVm0007EvidenceMapGeneration({ audit, auditSaved: true, draft: builtDraft, saveDraft: () => false, loadDraft: () => draftPackage });

    expect(result.blockedBy).toEqual(["draft_persistence_failed"]);
    expect(localStorage.getItem("a6:vm0007-gap-report-audit:v1:audit-1")).toBeNull();
    expect(localStorage.getItem("a6:vm0007-gap-report-audit:v1:previous")).toBe("previous audit");
    expect(localStorage.getItem("article6:vm0007-evidence-map-draft:v1:previous")).toBe("previous draft");
  });

  test("converts a thrown draft persistence error into the structured generation contract", () => {
    const result = completeVm0007EvidenceMapGeneration({
      audit,
      auditSaved: true,
      draft: builtDraft,
      saveDraft: () => {
        throw new Error("Quota exceeded while writing localStorage");
      },
      loadDraft: () => draftPackage,
    });

    expect(result).toMatchObject({
      draftBuilt: true,
      draftSaved: false,
      blockedBy: ["draft_persistence_failed"],
      error: {
        category: "GENERATION_ERROR",
        userMessage: expect.stringContaining("Retry generation"),
        technicalMessage: "Quota exceeded while writing localStorage",
      },
    });
    expect(result.error?.userMessage).not.toContain("Evidence Map could not be created. You can retry.");
  });

  test("preserves internal blocker reasons while failing an unsaved audit", () => {
    const result = completeVm0007EvidenceMapGeneration({ audit, auditSaved: false, draft: builtDraft });
    expect(result).toMatchObject({ auditSaved: false, draftSaved: false, blockedBy: ["audit_persistence_failed"] });
  });
});
