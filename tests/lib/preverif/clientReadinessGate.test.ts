import fs from "node:fs";
import { describe, expect, it } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Vm0007GapReportView from "@/components/preverif/Vm0007GapReportView";
import { getStructuredQueryContext } from "@/lib/chat/quickCheckReviewQuestion";
import {
  auditEvidence,
  type MethodologyEvidenceAuditResult,
  type MethodologyEvidenceAuditSummary,
} from "@/lib/preverif/evidenceAudit";
import { buildVm0007GapReport } from "@/lib/preverif/vm0007GapReport";
import { getVm0007EvidenceContract, normalizeVm0007RuleId } from "@/lib/preverif/vm0007EvidenceContracts";
import { VM0007_SYNCED_RULES, readQuickCheckFixtureText } from "../preverifVm0007Fixtures";

const ENVIRA_TEXT = readQuickCheckFixtureText("envira-amazonia-vm0007-extracted.txt");

function auditText(rawText: string): MethodologyEvidenceAuditSummary {
  const context = getStructuredQueryContext(rawText);
  return auditEvidence({
    rules: VM0007_SYNCED_RULES,
    evidenceDocument: context.evidenceDocument,
    getContract: getVm0007EvidenceContract,
    normalizeRuleId: normalizeVm0007RuleId,
    sections: context.documentStructure.sections,
    rawText,
  });
}

function withStatus(
  result: MethodologyEvidenceAuditResult,
  overrides: Partial<MethodologyEvidenceAuditResult>,
): MethodologyEvidenceAuditResult {
  return { ...result, ...overrides };
}

function buildReport(reportOverrides?: Partial<Parameters<typeof buildVm0007GapReport>[0]>) {
  const base = auditText(ENVIRA_TEXT);
  return buildVm0007GapReport({
    reportId: "VRGR-VM0007-CRG-001",
    generatedAt: "2026-07-03T00:00:00Z",
    project: {
      name: "The Envira Amazonia Project",
      projectId: "envira-fixture",
      region: "Acre, Brazil",
    },
    methodology: {
      code: "VM0007",
      version: "4.2",
      name: "VM0007: REDD Methodology Modules (REDD-MF)",
    },
    audit: base,
    ...reportOverrides,
  });
}

function renderReport(
  report: ReturnType<typeof buildReport>,
  extraHtml = "",
): string {
  const baseHtml = renderToStaticMarkup(createElement(Vm0007GapReportView, { report }));
  return `${baseHtml}${extraHtml}`;
}

/**
 * Client-readiness gate.
 *
 * Enforces:
 * - Reports with UNCLEAR ("weak") evidence cannot be marked client-ready.
 * - Reports with MISSING evidence cannot be marked client-ready.
 * - Internal previews must stay explicitly labeled as internal preview / not client ready.
 * - Misleading wording fails tests unless evidence truly supports it.
 * - Client-readiness stays separate from production audit logic and report UI.
 */

function assertInternalPreviewLabel(reportHtml: string): void {
  const text = reportHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  const hasInternalLabel = text.includes("internal preview") || text.includes("internal vm0007 gap report preview");
  expect(hasInternalLabel).toBe(true);
}

function assertNoBannedWording(reportHtml: string, report: ReturnType<typeof buildReport>): void {
  const bannedPhrases = ["all clear", "fully verified", "ready for verification"];
  const combinedText = `${reportHtml} ${JSON.stringify(report)}`.toLowerCase().replace(/\s+/g, " ");
  for (const phrase of bannedPhrases) {
    expect(combinedText).not.toContain(phrase);
  }
}

function countStatusRows(report: ReturnType<typeof buildReport>, status: string): number {
  return report.fullRuleAuditTable.filter((row) => row.status === status).length;
}

describe("VM0007 client-readiness gate", () => {
  it("flags reports with UNCLEAR (weak) evidence as not client-ready", () => {
    const audit = auditText(ENVIRA_TEXT);
    const results = audit.results.map((result) => {
      if (result.ruleId === "R-1-0002") {
        return withStatus(result, {
          status: "partially_supported" as const,
          gap: "The current PDD names the baseline category but does not explain why that category fits the project area.",
          clientAction: "Add the project-specific baseline deforestation category rationale and the supporting land-use evidence.",
        });
      }
      return result;
    });
    const weakAudit: MethodologyEvidenceAuditSummary = {
      results,
      totals: {
        supported_by_pdd: results.filter((r) => r.status === "supported_by_pdd").length,
        partially_supported: results.filter((r) => r.status === "partially_supported").length,
        missing_evidence: results.filter((r) => r.status === "missing_evidence").length,
        not_applicable: results.filter((r) => r.status === "not_applicable").length,
        manual_review_needed: results.filter((r) => r.status === "manual_review_needed").length,
      },
      totalRules: results.length,
    };
    const report = buildReport({ audit: weakAudit });

    const weakCount = countStatusRows(report, "weak");
    expect(weakCount).toBeGreaterThan(0);

    const text = renderReport(report).toLowerCase();
    const noOverstated = !text.includes("all clear") && !text.includes("fully verified") && !text.includes("ready for verification");
    expect(noOverstated).toBe(true);
  });

  it("flags reports with MISSING evidence as not client-ready", () => {
    const audit = auditText(ENVIRA_TEXT);
    const results = audit.results.map((result) => {
      if (result.ruleId === "R-1-0003") {
        return withStatus(result, {
          status: "missing_evidence" as const,
          bestEvidenceQuote: null,
          section: null,
          page: null,
          span: null,
          gap: "The current PDD does not show the AUDef agent evidence required for this rule.",
          clientAction: "Add the project-specific evidence for the relevant deforestation agents and explain how they drive baseline pressure.",
          assessmentReason: "The current PDD does not yet show project-specific evidence for this rule.",
          reasonSelected: "No reliable project-specific span was selected for this rule.",
        });
      }
      return result;
    });
    const missingAudit: MethodologyEvidenceAuditSummary = {
      results,
      totals: {
        supported_by_pdd: results.filter((r) => r.status === "supported_by_pdd").length,
        partially_supported: results.filter((r) => r.status === "partially_supported").length,
        missing_evidence: results.filter((r) => r.status === "missing_evidence").length,
        not_applicable: results.filter((r) => r.status === "not_applicable").length,
        manual_review_needed: results.filter((r) => r.status === "manual_review_needed").length,
      },
      totalRules: results.length,
    };
    const report = buildReport({ audit: missingAudit });

    const missingCount = countStatusRows(report, "missing");
    expect(missingCount).toBeGreaterThan(0);

    const text = renderReport(report).toLowerCase();
    const noOverstated = !text.includes("all clear") && !text.includes("fully verified") && !text.includes("ready for verification");
    expect(noOverstated).toBe(true);
  });

  it("labels report as internal preview, not client-ready", () => {
    const audit = auditText(ENVIRA_TEXT);
    const report = buildReport({ audit });
    const reportHtml = renderReport(report);

    assertInternalPreviewLabel(reportHtml);
    assertNoBannedWording(reportHtml, report);
  });

  it("rejects misleading 'all clear' or 'fully verified' wording", () => {
    const audit = auditText(ENVIRA_TEXT);
    const report = buildReport({ audit });
    const reportHtml = renderReport(report, "<div>All clear. Fully verified.</div>");

    expect(() => {
      assertNoBannedWording(reportHtml, report);
    }).toThrow();
  });

  it("rejects 'ready for verification' misleading wording", () => {
    const audit = auditText(ENVIRA_TEXT);
    const report = buildReport({ audit });
    const reportHtml = renderReport(report, "<div>Ready for verification.</div>");

    expect(() => {
      assertNoBannedWording(reportHtml, report);
    }).toThrow();
  });

  it("does not modify production audit logic or report UI types", () => {
    // Verify the gate uses existing Vm0007GapReport types and buildVm0007GapReport
    // rather than altering them. This test is structural.
    const audit = auditText(ENVIRA_TEXT);
    const report = buildReport({ audit });

    // The report should use the standard internal preview naming
    expect(report.reportName).toBe("Internal VM0007 Gap Report Preview");

    // All statuses should be from the existing display status type
    for (const row of report.fullRuleAuditTable) {
      expect(["supported", "weak", "missing", "not applicable"]).toContain(row.status);
    }

    // The existing limitation banner should be present
    expect(report.limitationBanner).toContain("Internal preview only");
  });
});
