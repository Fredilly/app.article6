import { describe, expect, it, test } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import FixtureBackedVm0007ReportView from "@/components/preverif/FixtureBackedVm0007ReportView";
import Vm0007GapReportView from "@/components/preverif/Vm0007GapReportView";
import { getStructuredQueryContext } from "@/lib/chat/quickCheckReviewQuestion";
import { buildEnviraVm0007FixtureBackedReport } from "@/lib/preverif/enviraVm0007FixtureBackedReport";
import {
  auditEvidence,
  type MethodologyEvidenceAuditResult,
  type MethodologyEvidenceAuditSummary,
} from "@/lib/preverif/evidenceAudit";
import { buildVm0007GapReport, type Vm0007GapReport } from "@/lib/preverif/vm0007GapReport";
import { getVm0007EvidenceContract, normalizeVm0007RuleId } from "@/lib/preverif/vm0007EvidenceContracts";
import { VM0007_SYNCED_RULES, readQuickCheckFixtureText } from "../preverifVm0007Fixtures";
import {
  assertClientReadinessGate,
  assertInternalPreviewBoundaries,
  assertInternalPreviewLabelVisible,
  assertNoBannedClientReadyWording,
  assertNoMissingEvidence,
  assertNoUnclearEvidence,
  assertUsesStandardReportShape,
} from "./clientReadinessGate";

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

function buildReport(auditOverride?: MethodologyEvidenceAuditSummary) {
  const base = auditOverride ?? auditText(ENVIRA_TEXT);
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
  });
}

function renderReport(report: Vm0007GapReport, extraHtml = ""): string {
  const baseHtml = renderToStaticMarkup(createElement(Vm0007GapReportView, { report }));
  return `${baseHtml}${extraHtml}`;
}

function makeWeakAudit(baseAudit: MethodologyEvidenceAuditSummary): MethodologyEvidenceAuditSummary {
  const results = baseAudit.results.map((result) => {
    if (result.ruleId === "R-1-0002") {
      return withStatus(result, {
        status: "partially_supported" as const,
        gap: "The current PDD names the baseline category but does not explain why that category fits the project area.",
        clientAction: "Add the project-specific baseline deforestation category rationale and the supporting land-use evidence.",
      });
    }
    return result;
  });
  return {
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
}

function makeMissingAudit(baseAudit: MethodologyEvidenceAuditSummary): MethodologyEvidenceAuditSummary {
  const results = baseAudit.results.map((result) => {
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
  return {
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
}

function makeCleanAudit(baseAudit: MethodologyEvidenceAuditSummary): MethodologyEvidenceAuditSummary {
  const results = baseAudit.results.map((result) => {
    if (result.status === "missing_evidence" || result.status === "partially_supported" || result.status === "manual_review_needed") {
      return withStatus(result, {
        status: "supported_by_pdd" as const,
        bestEvidenceQuote: "Evidence found in the PDD.",
      });
    }
    return result;
  });
  return {
    results,
    totals: {
      supported_by_pdd: results.filter((r) => r.status === "supported_by_pdd").length,
      partially_supported: 0,
      missing_evidence: 0,
      not_applicable: results.filter((r) => r.status === "not_applicable").length,
      manual_review_needed: 0,
    },
    totalRules: results.length,
  };
}

describe("clientReadinessGate helper", () => {
  describe("assertNoUnclearEvidence", () => {
    it("passes when report has zero weak rows", () => {
      const report = buildReport(makeCleanAudit(auditText(ENVIRA_TEXT)));
      expect(() => assertNoUnclearEvidence(report)).not.toThrow();
    });

    it("fails when report has weak rows", () => {
      const report = buildReport(makeWeakAudit(auditText(ENVIRA_TEXT)));
      expect(() => assertNoUnclearEvidence(report)).toThrow();
    });
  });

  describe("assertNoMissingEvidence", () => {
    it("passes when report has zero missing rows", () => {
      const report = buildReport(makeCleanAudit(auditText(ENVIRA_TEXT)));
      expect(() => assertNoMissingEvidence(report)).not.toThrow();
    });

    it("fails when report has missing rows", () => {
      const report = buildReport(makeMissingAudit(auditText(ENVIRA_TEXT)));
      expect(() => assertNoMissingEvidence(report)).toThrow();
    });
  });

  describe("assertInternalPreviewLabelVisible", () => {
    it("passes when internal preview label is present", () => {
      const report = buildReport();
      const html = renderReport(report);
      expect(() => assertInternalPreviewLabelVisible(html)).not.toThrow();
    });

    it("fails when internal preview label is stripped", () => {
      const html = "<div>Client-ready report</div>";
      expect(() => assertInternalPreviewLabelVisible(html)).toThrow();
    });
  });

  describe("assertNoBannedClientReadyWording", () => {
    it("passes when no banned wording is present", () => {
      const report = buildReport();
      const html = renderReport(report);
      expect(() => assertNoBannedClientReadyWording(html, report)).not.toThrow();
    });

    it("fails when 'all clear' is injected into HTML", () => {
      const report = buildReport();
      const html = renderReport(report, "<div>All clear.</div>");
      expect(() => assertNoBannedClientReadyWording(html, report)).toThrow();
    });

    it("fails when 'fully verified' is injected into HTML", () => {
      const report = buildReport();
      const html = renderReport(report, "<div>Fully verified.</div>");
      expect(() => assertNoBannedClientReadyWording(html, report)).toThrow();
    });

    it("fails when 'ready for verification' is injected into HTML", () => {
      const report = buildReport();
      const html = renderReport(report, "<div>Ready for verification.</div>");
      expect(() => assertNoBannedClientReadyWording(html, report)).toThrow();
    });
  });

  describe("assertUsesStandardReportShape", () => {
    it("passes for a standard Vm0007GapReport", () => {
      const report = buildReport();
      expect(() => assertUsesStandardReportShape(report)).not.toThrow();
    });
  });

  describe("assertClientReadinessGate (composite)", () => {
    it("passes for a clean report (no weak, no missing, internal label, no banned wording)", () => {
      const report = buildReport(makeCleanAudit(auditText(ENVIRA_TEXT)));
      const html = renderReport(report);

      expect(() => assertClientReadinessGate({ reportHtml: html, report })).not.toThrow();
    });

    it("fails on UNCLEAR evidence", () => {
      const report = buildReport(makeWeakAudit(auditText(ENVIRA_TEXT)));
      const html = renderReport(report);
      expect(() => assertClientReadinessGate({ reportHtml: html, report })).toThrow();
    });

    it("fails on MISSING evidence", () => {
      const report = buildReport(makeMissingAudit(auditText(ENVIRA_TEXT)));
      const html = renderReport(report);
      expect(() => assertClientReadinessGate({ reportHtml: html, report })).toThrow();
    });

    it("fails on banned wording in HTML", () => {
      const report = buildReport();
      const html = renderReport(report, "<div>Ready for verification</div>");
      expect(() => assertClientReadinessGate({ reportHtml: html, report })).toThrow();
    });
  });
});

describe("clientReadinessGate", () => {
  test("internal Envira fixture-backed preview stays inside internal-only wording boundaries", () => {
    const html = renderToStaticMarkup(
      createElement(FixtureBackedVm0007ReportView, { report: buildEnviraVm0007FixtureBackedReport() }),
    );

    assertInternalPreviewBoundaries(html);
  });
});
