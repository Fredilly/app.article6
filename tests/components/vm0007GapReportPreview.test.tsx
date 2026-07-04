/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act } from "react";
import { createRoot } from "react-dom/client";
import Vm0007GapReportPreview from "@/components/preverif/Vm0007GapReportPreview";
import type { MethodologyEvidenceAuditResult, MethodologyEvidenceAuditSummary } from "@/lib/preverif/evidenceAudit";
import { saveVm0007GapReportAudit } from "@/lib/preverif/vm0007GapReportStore";
import {
  REPORT_FIXTURE,
  buildAuditFromFullFixture,
} from "../lib/preverifVm0007ReportFixtures";

function buildAllSupportedAudit() {
  const supportedOnlyResults: MethodologyEvidenceAuditResult[] = Array.from({ length: 58 }, (_, index) => ({
    ruleId: `R-6-${String(index + 1).padStart(4, "0")}`,
    stableId: `R-6-${String(index + 1).padStart(4, "0")}`,
    title: `Rule ${index + 1}`,
    ruleLogic: `Rule ${index + 1}`,
    status: "supported_by_pdd",
    bestEvidenceQuote: `Evidence quote ${index + 1}.`,
    page: 1,
    section: "Synthetic supported fixture",
    span: `span-${index + 1}`,
    reasonSelected: "Synthetic all-supported warning check.",
    assessmentReason: "Synthetic all-supported warning check.",
    gap: "",
    clientAction: "",
    confidence: "high",
  }));

  return {
    results: supportedOnlyResults,
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

function buildBlockedAudit(): MethodologyEvidenceAuditSummary {
  return {
    auditStatus: "BLOCKED_VERSION_MISMATCH",
    methodologyId: "VM0007",
    rulebookVersion: "v1.8",
    pddDeclaredMethodologyVersion: "REDD-MF / VM0007 v1.5",
    versionMatch: false,
    versionMismatchReason: "Version lock blocked: rulebook version mismatch: PDD declares v1.5, loaded contract is v1.8.",
    results: [],
    totals: {
      supported_by_pdd: 0,
      partially_supported: 0,
      missing_evidence: 0,
      not_applicable: 0,
      manual_review_needed: 0,
    },
    totalRules: 58,
  };
}

function buildWarningAcceptedAudit(): MethodologyEvidenceAuditSummary {
  return {
    auditStatus: "VERSION_WARNING_ACCEPTED",
    methodologyId: "VM0007",
    rulebookVersion: "v1-8",
    pddDeclaredMethodologyVersion: "REDD-MF / VM0007 v1.5",
    versionMatch: false,
    versionMismatchReason: "Version lock blocked: rulebook version mismatch: PDD declares v1.5, loaded contract is v1-8.",
    userAcceptedVersionWarning: true,
    results: buildAllSupportedAudit().results,
    totals: buildAllSupportedAudit().totals,
    totalRules: 58,
  };
}

describe("Vm0007GapReportPreview", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    window.localStorage.clear();
    window.print = jest.fn();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  test("renders the saved finalized VM0007 fixture audit into the internal report preview", async () => {
    saveVm0007GapReportAudit({
      auditId: "audit-preview",
      methodologyId: "VM0007",
      methodologyVersion: "v1-8",
      generatedAt: "2026-07-03T00:00:00Z",
      evidenceFileName: "envira-amazonia-vm0007.pdf",
      audit: buildAuditFromFullFixture(),
    });

    await act(async () => {
      root.render(<Vm0007GapReportPreview auditId="audit-preview" />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const text = container.textContent ?? "";
    expect(text).toContain(REPORT_FIXTURE.expectedReportTitle);
    expect(text).toContain("Print / Save PDF");
    expect(text).toContain("58 VM0007 rules assessed for validation readiness.");
    expect(text).toContain("30");
    expect(text).toContain("8");
    expect(text).toContain("3");
    expect(text).toContain("17");
    expect(text).toContain("Follow-up Action List");
    expect(text).toContain("Internal preview only. This report shows current audit output and has not been manually reviewed.");
  });

  test("shows the all-supported caution when every rule is marked supported", async () => {
    saveVm0007GapReportAudit({
      auditId: "audit-preview-supported",
      methodologyId: "VM0007",
      methodologyVersion: "v1-8",
      generatedAt: "2026-07-03T00:00:00Z",
      evidenceFileName: "envira-amazonia-vm0007.pdf",
      audit: buildAllSupportedAudit(),
    });

    await act(async () => {
      root.render(<Vm0007GapReportPreview auditId="audit-preview-supported" />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent ?? "").toContain(
      "All rules are currently marked supported. Review evidence quality before relying on this result.",
    );
  });

  test("short-circuits to a blocked-only view when the audit is version-mismatched", async () => {
    saveVm0007GapReportAudit({
      auditId: "audit-blocked",
      methodologyId: "VM0007",
      methodologyVersion: "v1.8",
      generatedAt: "2026-07-03T00:00:00Z",
      evidenceFileName: "envira-amazonia-vm0007.pdf",
      audit: buildBlockedAudit(),
    });

    await act(async () => {
      root.render(<Vm0007GapReportPreview auditId="audit-blocked" />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Version lock blocked: rulebook version mismatch: PDD declares v1.5, loaded contract is v1.8.");
    expect(text).not.toContain("Print / Save PDF");
    expect(text).not.toContain(REPORT_FIXTURE.expectedReportTitle);
    expect(text).not.toContain("58 VM0007 rules assessed for validation readiness.");
    expect(text).not.toContain("Follow-up Action List");
    expect(text).not.toContain("Saved audit payload");
    expect(text).not.toContain("REDD-MF / VM0007 v1.5");
    expect(text).toContain("rulebook version mismatch");
  });

  test("renders the full report with a warning banner when a mismatched audit is accepted", async () => {
    saveVm0007GapReportAudit({
      auditId: "audit-warning-accepted",
      methodologyId: "VM0007",
      methodologyVersion: "v1-8",
      generatedAt: "2026-07-03T00:00:00Z",
      evidenceFileName: "envira-amazonia-vm0007.pdf",
      userAcceptedVersionWarning: true,
      audit: buildWarningAcceptedAudit(),
    });

    await act(async () => {
      root.render(<Vm0007GapReportPreview auditId="audit-warning-accepted" />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const text = container.textContent ?? "";
    expect(text).toContain("VERSION_WARNING_ACCEPTED");
    expect(text).toContain("Version warning accepted before audit generation.");
    expect(text).toContain("Methodology version mismatch:");
    expect(text).toContain("Print / Save PDF");
    expect(text).toContain(REPORT_FIXTURE.expectedReportTitle);
    expect(text).toContain("User accepted warning");
    expect(text).toContain("true");
  });

  test("keeps banned wording out of the rendered internal preview", async () => {
    saveVm0007GapReportAudit({
      auditId: "audit-preview",
      methodologyId: "VM0007",
      methodologyVersion: "v1-8",
      generatedAt: "2026-07-03T00:00:00Z",
      evidenceFileName: "envira-amazonia-vm0007.pdf",
      audit: buildAuditFromFullFixture(),
    });

    await act(async () => {
      root.render(<Vm0007GapReportPreview auditId="audit-preview" />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const text = (container.textContent ?? "").toLowerCase();
    for (const banned of REPORT_FIXTURE.bannedWording) {
      expect(text).not.toContain(banned.toLowerCase());
    }
  });
});
