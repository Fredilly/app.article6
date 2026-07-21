/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import { act } from "react";
import { createRoot } from "react-dom/client";
import Vm0007GapReportLaunchButton from "@/components/preverif/Vm0007GapReportLaunchButton";
import { saveVm0007EvidenceMapDraft } from "@/lib/preverif/vm0007EvidenceMapDraftStore";
import type { Vm0007EvidenceMapDraftPackage } from "@/lib/preverif/vm0007EvidenceMapDraft";
import { createEvidenceMapGenerationError } from "@/lib/preverif/evidenceMapGenerationError";

describe("Vm0007GapReportLaunchButton", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    window.localStorage.clear();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    window.localStorage.clear();
    process.env.NODE_ENV = originalNodeEnv;
  });

  function makeDraft(auditId: string): Vm0007EvidenceMapDraftPackage {
    const sourceDocument = { documentId: "doc-1", documentName: "pdd.pdf", contentSha256: null };
    const rows = Array.from({ length: 58 }, (_, index) => ({
      rowId: `${auditId}:R-${index + 1}`, auditId, stableRuleId: `R-${index + 1}`, ruleReference: `R-${index + 1}`,
      ruleTitle: `Rule ${index + 1}`, requirementText: "Requirement", methodologyId: "VM0007" as const, methodologyVersion: "v1.8" as const,
      rawAuditStatus: index === 0 ? "supported_by_pdd" as const : "missing_evidence" as const,
      upstreamStatus: index === 0 ? "FOUND" as const : "MISSING" as const, proposedEvidenceStatus: index === 0 ? "FOUND" as const : "MISSING" as const,
      proposedApplicability: "APPLICABLE" as const,
      proposedAcceptedEvidence: index === 0 ? { quote: "Evidence", provenance: { docId: "doc-1", page: 1, sectionPath: ["S-1"], spanId: "span-1", sectionHeading: "Evidence", sourceType: "PDD" } } : null,
      proposedRejectedEvidence: null, assessmentReason: "Assessment reason.", gap: "", clientAction: "Review.", confidence: "high" as const,
      searchCoverage: { searched: true, searchedDocumentIds: ["doc-1"], notes: null }, sourceDocument, quote: index === 0 ? "Evidence" : null,
      page: index === 0 ? 1 : null, section: index === 0 ? "Evidence" : null, spanId: index === 0 ? "span-1" : null,
      provenance: index === 0 ? { docId: "doc-1", page: 1, sectionPath: ["S-1"], spanId: "span-1", sectionHeading: "Evidence", sourceType: "PDD" } : null,
      finalizationState: "draft" as const, proposalSource: "VM0007_QUICK_CHECK_AUDIT" as const, proposalTimestamp: "2026-07-01T00:00:00Z",
    }));
    return { auditId, generatedAt: "2026-07-01T00:00:00Z", methodologyId: "VM0007", rulebookVersion: "v1.8", pddDeclaredMethodologyVersion: "v1.8", sourceDocument, proposalState: "MACHINE_PROPOSED", rows, blockedBy: [], contractVersion: "vm0007-evidence-map-draft-v1" };
  }

  test("shows Generate Evidence Map before generation", async () => {
    await act(async () => {
      root.render(<Vm0007GapReportLaunchButton isVm0007Result auditId={null} onGenerate={jest.fn()} />);
    });
    expect(container.textContent).toContain("Generate Evidence Map");
    expect(container.textContent).toContain("Create a machine-proposed Evidence Map from the VM0007 methodology requirements and the uploaded PDD.");
  });

  test("shows Open Evidence Map only after a valid draft is saved", async () => {
    const auditId = "audit-1";
    await act(async () => { root.render(<Vm0007GapReportLaunchButton isVm0007Result auditId={auditId} />); });
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("Evidence Map was not created for this audit.");

    await act(async () => {
      saveVm0007EvidenceMapDraft(makeDraft(auditId));
    });

    const link = container.querySelector("a");
    expect(link?.textContent).toContain("Open Evidence Map");
    expect(link?.getAttribute("href")).toBe("/internal/reports/vm0007-evidence-map/audit-1");
    expect(container.textContent).toContain("VM0007 v1.8 · 58 requirements");
    expect(container.textContent).not.toContain("Pre-Validation Readiness Report");
  });

  test("keeps retry available when a stale audit id has no valid draft", async () => {
    const onGenerate = jest.fn();
    await act(async () => {
      root.render(
        <Vm0007GapReportLaunchButton
          isVm0007Result
          auditId="stale-audit"
          onGenerate={onGenerate}
          generationError={createEvidenceMapGenerationError("METHODOLOGY_ERROR", "pdd_declared_version_mismatch")}
        />,
      );
    });
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("METHODOLOGY ERROR");
    expect(container.textContent).toContain("methodology or version could not be confirmed");
    expect(container.textContent).toContain("Retry Evidence Map");
    container.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  test("shows technical diagnostics and source outside production", async () => {
    process.env.NODE_ENV = "development";
    await act(async () => {
      root.render(
        <Vm0007GapReportLaunchButton
          isVm0007Result
          auditId="stale-audit"
          onGenerate={jest.fn()}
          failureSource="quick-check-panel/upload-evidence-map"
          generationError={createEvidenceMapGenerationError("GENERATION_ERROR", "draft persistence failed: duplicate audit id")}
        />,
      );
    });

    expect(container.querySelector('[data-testid="evidence-map-generation-diagnostics"]')?.textContent).toContain(
      "Technical: draft persistence failed: duplicate audit id",
    );
    expect(container.textContent).toContain("Source: quick-check-panel/upload-evidence-map");
  });

  test("hides technical diagnostics in production", async () => {
    process.env.NODE_ENV = "production";
    await act(async () => {
      root.render(
        <Vm0007GapReportLaunchButton
          isVm0007Result
          auditId="stale-audit"
          onGenerate={jest.fn()}
          failureSource="quick-check-panel/upload-evidence-map"
          generationError={createEvidenceMapGenerationError("GENERATION_ERROR", "draft persistence failed: duplicate audit id")}
        />,
      );
    });

    expect(container.textContent).toContain("GENERATION ERROR");
    expect(container.textContent).toContain("Evidence Map generation failed before it could be saved");
    expect(container.querySelector('[data-testid="evidence-map-generation-diagnostics"]')).toBeNull();
    expect(container.textContent).not.toContain("duplicate audit id");
  });

  test("shows a disabled helper state when VM0007 result has no audit id yet", async () => {
    await act(async () => {
      root.render(<Vm0007GapReportLaunchButton isVm0007Result auditId={null} />);
    });

    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("Internal report");
    expect(container.textContent).toContain("Evidence Map not available yet");
    expect(container.textContent).toContain("Upload a VM0007 v1.8 PDD and run Quick Check to generate the Evidence Map.");
    expect(container.querySelector("button")?.hasAttribute("disabled")).toBe(true);
  });

  test("shows a generate action when upload-flow generation is available", async () => {
    const onGenerate = jest.fn();

    await act(async () => {
      root.render(
        <Vm0007GapReportLaunchButton
          isVm0007Result
          auditId={null}
          title="Internal VM0007 report"
          onGenerate={onGenerate}
        />,
      );
    });

    const button = container.querySelector("button");
    expect(container.textContent).toContain("Internal VM0007 report");
    expect(button?.textContent).toContain("Generate Evidence Map");
    expect(button?.className).not.toContain("bg-green-600");

    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  test("does not render anything for non-VM0007 results", async () => {
    await act(async () => {
      root.render(<Vm0007GapReportLaunchButton isVm0007Result={false} auditId="audit-1" />);
    });

    expect(container.textContent).not.toContain("Internal report");
    expect(container.querySelector("a")).toBeNull();
  });
});
