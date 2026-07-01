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
      generatedAt: "2026-07-01T00:00:00Z",
      evidenceFileName: "envira.pdf",
      audit: makeAudit(),
    });

    await act(async () => {
      root.render(<Vm0007GapReportLaunchButton auditId="audit-1" />);
    });

    const link = container.querySelector("a");
    expect(link?.textContent).toContain("View Gap Report");
    expect(link?.getAttribute("href")).toBe("/internal/reports/vm0007-gap/audit-1");
  });

  test("does not appear when no saved VM0007 audit output exists", async () => {
    await act(async () => {
      root.render(<Vm0007GapReportLaunchButton auditId="missing-audit" />);
    });

    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).not.toContain("View Gap Report");
  });
});
