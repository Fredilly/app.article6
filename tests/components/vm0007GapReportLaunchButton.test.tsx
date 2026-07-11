/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import { act } from "react";
import { createRoot } from "react-dom/client";
import Vm0007GapReportLaunchButton from "@/components/preverif/Vm0007GapReportLaunchButton";
import type { MethodologyEvidenceAuditResult, MethodologyEvidenceAuditSummary } from "@/lib/preverif/evidenceAudit";
import { saveVm0007GapReportAudit } from "@/lib/preverif/vm0007GapReportStore";

function makeAudit(): MethodologyEvidenceAuditSummary {
  const results: MethodologyEvidenceAuditResult[] = Array.from({ length: 58 }, (_, index) => ({
    ruleId: `R-6-${String(index + 1).padStart(4, "0")}`,
    stableId: `R-6-${String(index + 1).padStart(4, "0")}`,
    title: `Rule ${index + 1}`,
    ruleLogic: `Rule logic ${index + 1}`,
    status: "supported_by_pdd",
    bestEvidenceQuote: `Evidence quote ${index + 1}.`,
    page: 1,
    section: "Monitoring Plan",
    span: `span-${index + 1}`,
    reasonSelected: `Selected span ${index + 1}.`,
    assessmentReason: `Assessment reason ${index + 1}.`,
    gap: "",
    clientAction: `Client action ${index + 1}.`,
    confidence: "high",
  }));

  return {
    results,
    totals: {
      supported_by_pdd: 58,
      partially_supported: 0,
      missing_evidence: 0,
      not_applicable: 0,
      manual_review_needed: 0,
    },
    totalRules: 58,
  };
}

const METHODOLOGY_IDENTITY = {
  methodologyId: "VM0007",
  methodologyName: "REDD Methodology Modules",
  methodologyAlias: "REDD-MF",
  pddDeclaredMethodologyVersion: null,
  versionStatus: "NOT_EXPLICITLY_DECLARED" as const,
  evidencePage: 31,
  evidenceSection: "Title and Reference of Methodology",
  evidenceQuote: "VM0007: REDD Methodology Modules (REDD-MF)",
};

describe("Vm0007GapReportLaunchButton", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

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
  });

  test("appears when saved VM0007 audit output exists", async () => {
    saveVm0007GapReportAudit({
      auditId: "audit-1",
      methodologyId: "VM0007",
      methodologyVersion: "v1-8",
      loadedRulebookId: "VM0007",
      loadedRulebookVersion: "v1-8",
      methodology: METHODOLOGY_IDENTITY,
      generatedAt: "2026-07-01T00:00:00Z",
      evidenceFileName: "envira.pdf",
      audit: makeAudit(),
    });

    await act(async () => {
      root.render(<Vm0007GapReportLaunchButton isVm0007Result auditId="audit-1" />);
    });

    const link = container.querySelector("a");
    expect(container.textContent).toContain("Internal report");
    expect(link?.textContent).toContain("View Gap Report");
    expect(link?.getAttribute("href")).toBe("/quick-check/pre-validation-readiness?auditId=audit-1");
    expect(link?.className).toContain("bg-green-600");
    expect(link?.className).toContain("text-white");
  });

  test("shows a disabled helper state when VM0007 result has no audit id yet", async () => {
    await act(async () => {
      root.render(<Vm0007GapReportLaunchButton isVm0007Result auditId={null} />);
    });

    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("Internal report");
    expect(container.textContent).toContain("Gap report not available yet");
    expect(container.textContent).toContain("Run a VM0007 evidence audit to generate the internal report preview.");
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
    expect(button?.textContent).toContain("Generate Gap Report Preview");
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
