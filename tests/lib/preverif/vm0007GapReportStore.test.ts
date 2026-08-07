/** @jest-environment jsdom */

import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { sha256ArrayBuffer } from "@/lib/proof/hash";
import {
  buildAndSaveVm0007GapReportAudit,
  completeVm0007EvidenceMapGeneration,
  loadVm0007GapReportAudit,
} from "@/lib/preverif/vm0007GapReportStore";
import { EVIDENCE_MAP_ERROR_CATEGORIES, getBrowserStorageDiagnostics } from "@/lib/preverif/evidenceMapGenerationError";
import { buildVm0007EvidenceMapDraft } from "@/lib/preverif/vm0007EvidenceMapDraft";
import {
  readQuickCheckFixtureText,
  VM0007_SYNCED_RULES,
} from "../preverifVm0007Fixtures";

const rawPddText = readQuickCheckFixtureText(
  "envira-amazonia-vm0007-extracted.txt",
).replace("VM0007 Version 4.2", "REDD-MF / VM0007 v1.8");

afterEach(() => window.localStorage.clear());

describe("VM0007 uploaded PDF source identity propagation", () => {
  test("classifies timeout failures as generation errors without adding a public category", () => {
    const result = completeVm0007EvidenceMapGeneration({
      audit: { auditId: "audit-timeout" } as never,
      auditSaved: true,
      draft: { ok: true, package: {} as never },
      saveDraft: () => {
        throw new Error("Evidence Map generation timed out");
      },
      loadDraft: () => null,
    });

    expect(result.error).toMatchObject({
      category: "GENERATION_ERROR",
      userMessage: expect.stringContaining("Retry generation"),
      technicalMessage: "Evidence Map generation timed out",
    });
    expect(result.error?.category).not.toBe("TIMEOUT_ERROR");
    expect(EVIDENCE_MAP_ERROR_CATEGORIES).not.toContain("TIMEOUT_ERROR");
  });

  test("returns a structured validation error when draft generation is blocked", () => {
    const audit = {
      auditId: "audit-failure",
      methodologyId: "VM0007",
      methodologyVersion: "v1.8",
      loadedRulebookId: "VM0007",
      loadedRulebookVersion: "v1.8",
      methodology: null,
      generatedAt: "2026-07-01T00:00:00Z",
      audit: {} as never,
    };
    const result = completeVm0007EvidenceMapGeneration({
      audit,
      auditSaved: true,
      draft: { ok: false, blockedBy: ["canonical_rule_count_is_not_58"] },
    });

    expect(result.error).toMatchObject({
      category: "VALIDATION_ERROR",
      userMessage: "Evidence Map requires all 58 canonical VM0007 requirements.",
      technicalMessage: "canonical_rule_count_is_not_58",
      diagnostic: { stage: "draft_validation", diagnosticId: expect.stringMatching(/^vm0007-gen-/), blockedBy: ["canonical_rule_count_is_not_58"] },
    });
    expect(result.error?.technicalMessage).not.toContain("Error:");
  });

  test("classifies a machine proposal exception and redacts extracted text", () => {
    const secretText = "PRIVATE PROJECT EVIDENCE 123";
    const result = buildAndSaveVm0007GapReportAudit({
      methodology: { methodologyId: "VM0007", methodologyName: "VM0007", methodologyAlias: null, pddDeclaredMethodologyVersion: "v1.8", versionStatus: "DECLARED", evidencePage: 1, evidenceSection: "Methodology", evidenceQuote: "VM0007 v1.8" },
      loadedRulebookId: "VM0007", loadedRulebookVersion: "v1.8", rawPddText: secretText, rules: VM0007_SYNCED_RULES,
      buildMachineProposal: () => { throw new Error(`proposal failed: ${secretText}`); },
    });
    expect(result.error?.diagnostic).toMatchObject({ stage: "machine_proposal_generation", extractedTextLength: secretText.length, ruleCount: 58 });
    expect(JSON.stringify(result.error?.diagnostic)).not.toContain(secretText);
  });

  test("classifies explicit localStorage quota and unavailable storage failures as persistence errors", () => {
    const quota = completeVm0007EvidenceMapGeneration({ audit: { auditId: "quota", generatedAt: "2026-07-01T00:00:00Z", audit: { totalRules: 58 } } as never, auditSaved: true, draft: { ok: true, package: {} as never }, saveDraft: () => { const error = new DOMException("quota", "QuotaExceededError"); throw error; }, loadDraft: () => null });
    expect(quota.error?.category).toBe("PERSISTENCE_ERROR");
    expect(quota.error?.diagnostic.stage).toBe("draft_persistence");
    const unavailable = completeVm0007EvidenceMapGeneration({ audit: { auditId: "unavailable", generatedAt: "2026-07-01T00:00:00Z", audit: { totalRules: 58 } } as never, auditSaved: true, draft: { ok: true, package: {} as never }, saveDraft: () => ({ ok: false, reason: "storage_unavailable" }), loadDraft: () => null });
    expect(unavailable.error?.category).toBe("PERSISTENCE_ERROR");
    expect(unavailable.error?.diagnostic.blockedBy).toContain("storage_unavailable");
  });

  test("reports unavailable localStorage without exposing document content", () => {
    const localStorageGetter = jest.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    try {
      expect(getBrowserStorageDiagnostics().localStorageAvailable).toBe(false);
    } finally {
      localStorageGetter.mockRestore();
    }
  });

  test("classifies a saved draft that cannot be reloaded", () => {
    const result = completeVm0007EvidenceMapGeneration({ audit: { auditId: "reload", generatedAt: "2026-07-01T00:00:00Z", audit: { totalRules: 58 } } as never, auditSaved: true, draft: { ok: true, package: {} as never }, saveDraft: () => ({ ok: true }), loadDraft: () => null });
    expect(result.error?.diagnostic.stage).toBe("draft_reload_verification");
    expect(result.error?.diagnostic.blockedBy).toEqual(["draft_reload_verification_failed"]);
  });

  test("persists the SHA-256 of uploaded bytes through audit and Evidence Map package", async () => {
    const uploadedPdfBytes = new TextEncoder().encode(
      "original uploaded PDF bytes",
    ).buffer;
    const sourcePdfSha256 = await sha256ArrayBuffer(uploadedPdfBytes);
    const result = buildAndSaveVm0007GapReportAudit({
      methodology: {
        methodologyId: "VM0007",
        methodologyName: "VM0007",
        methodologyAlias: null,
        pddDeclaredMethodologyVersion: "v1.8",
        versionStatus: "DECLARED",
        evidencePage: 1,
        evidenceSection: "Methodology",
        evidenceQuote: "VM0007 v1.8",
      },
      loadedRulebookId: "VM0007",
      loadedRulebookVersion: "v1.8",
      evidenceFileName: "uploaded-marcondes.pdf",
      sourcePdfSha256,
      rawPddText,
      rules: VM0007_SYNCED_RULES,
      userAcceptedVersionWarning: true,
    });

    expect(result.auditSaved).toBe(true);
    expect(result.draftBuilt).toBe(true);
    const audit = loadVm0007GapReportAudit(result.auditId);
    expect(audit?.sourceDocument).toEqual(
      expect.objectContaining({
        documentName: "uploaded-marcondes.pdf",
        contentSha256: sourcePdfSha256,
      }),
    );

    const directDraft = buildVm0007EvidenceMapDraft({
      auditId: result.audit!.auditId,
      generatedAt: result.audit!.generatedAt,
      rules: VM0007_SYNCED_RULES,
      audit: result.audit!.audit,
      sourceDocument: result.audit!.sourceDocument,
    });
    expect(directDraft.ok).toBe(true);
    if (!directDraft.ok) return;
    let persisted: typeof directDraft.package | null = null;
    const persistedResult = completeVm0007EvidenceMapGeneration({
      audit: result.audit!,
      auditSaved: true,
      draft: directDraft,
      saveDraft: (draft) => {
        persisted = draft;
        return { ok: true };
      },
      loadDraft: () => persisted,
    });
    expect(persistedResult.draftSaved).toBe(true);
    expect(persisted?.sourceDocument).toEqual(
      expect.objectContaining({
        documentName: "uploaded-marcondes.pdf",
        contentSha256: sourcePdfSha256,
      }),
    );
    expect(
      persisted?.rows.every(
        (row) => row.sourceDocument.contentSha256 === sourcePdfSha256,
      ),
    ).toBe(true);
  });
});
