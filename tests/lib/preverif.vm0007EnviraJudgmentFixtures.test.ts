import fs from "node:fs";
import { describe, expect, it } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Vm0007GapReportView from "@/components/preverif/Vm0007GapReportView";
import { buildVm0007GapReport } from "@/lib/preverif/vm0007GapReport";
import type { EvidenceAuditStatus, MethodologyEvidenceAuditResult, MethodologyEvidenceAuditSummary } from "@/lib/preverif/evidenceAudit";

type FixtureStatus = "FOUND" | "UNCLEAR" | "MISSING" | "N/A";

type RejectedQuote = {
  quote: string;
  rejectionReason: string;
};

type JudgmentFixture = {
  checkId: string;
  checkName: string;
  expectedStatus: FixtureStatus;
  expectedAnswer: string;
  goldQuote: string | null;
  page: number | null;
  sectionHeading: string | null;
  spanId: string | null;
  whyQuoteIsSufficientOrInsufficient: string;
  knownBadQuotesToReject: RejectedQuote[];
  expectedClientAction: string | null;
  coverageTags: string[];
};

type JudgmentFixtureSet = {
  fixtureSetId: string;
  title: string;
  inputPdfName: string;
  inputPdfPath: string;
  sourcePdfTitle: string;
  documentFamily: string;
  methodology: string;
  fixtureTruthPolicy: string;
  expectedWarnings: string[];
  checks: JudgmentFixture[];
};

type ReportFixture = {
  fixtureSetId: string;
  title: string;
  expectedReportTitle: string;
  expectedSectionOrdering: string[];
  expectedStatusCounts: {
    supported: number;
    weak: number;
    missing: number;
    notApplicable: number;
  };
  expectedVisibleWording: string[];
  bannedWording: string[];
  expectedEvidenceRendering: string[];
  expectedWeakOrMissingExplanation: string[];
  expectedClientActionWording: string[];
};

type SourceExcerpts = {
  inputPdfName: string;
  inputPdfPath: string;
  sourcePdfTitle: string;
  documentFamily: string;
  sourceTypeConfirmation: {
    page: number;
    sectionHeading: string;
    quote: string;
  };
  pageExcerpts: Record<string, string>;
};

const AUDIT_FIXTURE = JSON.parse(
  fs.readFileSync("tests/fixtures/preverif/envira-vm0007-judgment-fixtures.json", "utf8"),
) as JudgmentFixtureSet;

const REPORT_FIXTURE = JSON.parse(
  fs.readFileSync("tests/fixtures/preverif/envira-vm0007-report-fixture.json", "utf8"),
) as ReportFixture;

const SOURCE_EXCERPTS = JSON.parse(
  fs.readFileSync("tests/fixtures/preverif/envira-vm0007-source-excerpts.json", "utf8"),
) as SourceExcerpts;

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function toAuditStatus(status: FixtureStatus): EvidenceAuditStatus {
  switch (status) {
    case "FOUND":
      return "supported_by_pdd";
    case "UNCLEAR":
      return "manual_review_needed";
    case "MISSING":
      return "missing_evidence";
    case "N/A":
      return "not_applicable";
  }
}

function buildAuditFromFixtures(checks: JudgmentFixture[]): MethodologyEvidenceAuditSummary {
  const results: MethodologyEvidenceAuditResult[] = checks.map((check) => ({
    ruleId: check.checkId,
    stableId: check.checkId,
    title: check.checkName,
    ruleLogic: check.checkName,
    status: toAuditStatus(check.expectedStatus),
    bestEvidenceQuote: check.goldQuote,
    page: check.page,
    section: check.sectionHeading,
    span: check.spanId,
    reasonSelected: check.goldQuote
      ? "Fixture-provided PDF-backed quote selected for report expectation coverage."
      : "No usable PDF-backed quote exists for this fixture.",
    assessmentReason: check.whyQuoteIsSufficientOrInsufficient,
    gap: check.expectedStatus === "FOUND" || check.expectedStatus === "N/A"
      ? ""
      : check.whyQuoteIsSufficientOrInsufficient,
    clientAction: check.expectedClientAction ?? "",
    confidence: check.expectedStatus === "FOUND" ? "high" : "medium",
  }));

  return {
    results,
    totals: {
      supported_by_pdd: results.filter((result) => result.status === "supported_by_pdd").length,
      partially_supported: 0,
      missing_evidence: results.filter((result) => result.status === "missing_evidence").length,
      not_applicable: results.filter((result) => result.status === "not_applicable").length,
      manual_review_needed: results.filter((result) => result.status === "manual_review_needed").length,
    },
    totalRules: results.length,
  };
}

describe("Envira VM0007 judgment fixtures", () => {
  it("confirms Phase 0 is documented and the exact source document is the Envira project description PDF", () => {
    const phase0Plan = fs.readFileSync("docs/roadmaps/vm0007-judgement-fixtures/PLAN.md", "utf8");

    expect(phase0Plan).toContain("Phase 0 is documentation-only.");
    expect(phase0Plan).toContain("fixtures must use PDF truth, not current app output");
    expect(AUDIT_FIXTURE.inputPdfName).toBe("PROJ_DESC_1382_04APR2015.pdf");
    expect(AUDIT_FIXTURE.inputPdfPath).toBe("/Users/stphen/Desktop/PROJ_DESC_1382_04APR2015.pdf");
    expect(AUDIT_FIXTURE.sourcePdfTitle).toBe("Microsoft Word - Envira Amazonia VCS PD 2015.04.03");
    expect(AUDIT_FIXTURE.documentFamily).toBe("Project Description / PD");
    expect(AUDIT_FIXTURE.fixtureTruthPolicy).toContain("exact quotes, page numbers, and section headings");
    expect(SOURCE_EXCERPTS.sourceTypeConfirmation.page).toBe(1);
    expect(SOURCE_EXCERPTS.sourceTypeConfirmation.quote).toContain("PROJECT DESCRIPTION");
    expect(SOURCE_EXCERPTS.pageExcerpts["1"]).toContain("THE ENVIRA AMAZONIA PROJECT");
  });

  it("defines a complete 5-10 check fixture contract with required status and rejection coverage", () => {
    expect(AUDIT_FIXTURE.methodology).toBe("VM0007");
    expect(AUDIT_FIXTURE.checks.length).toBeGreaterThanOrEqual(5);
    expect(AUDIT_FIXTURE.checks.length).toBeLessThanOrEqual(10);
    expect(AUDIT_FIXTURE.expectedWarnings).toHaveLength(3);

    expect(AUDIT_FIXTURE.checks.some((check) => check.coverageTags.includes("clean_found"))).toBe(true);
    expect(AUDIT_FIXTURE.checks.some((check) => check.expectedStatus === "UNCLEAR")).toBe(true);
    expect(AUDIT_FIXTURE.checks.some((check) => check.expectedStatus === "MISSING")).toBe(true);
    expect(AUDIT_FIXTURE.checks.some((check) => check.coverageTags.includes("false_supported_risk"))).toBe(true);
    expect(AUDIT_FIXTURE.checks.some((check) => check.coverageTags.includes("reject_module_table_text"))).toBe(true);
    expect(
      AUDIT_FIXTURE.checks.some((check) =>
        check.coverageTags.includes("reject_registry_url") || check.coverageTags.includes("reject_generic_country_reference"),
      ),
    ).toBe(true);

    for (const check of AUDIT_FIXTURE.checks) {
      expect(check.checkId).toMatch(/^R-\d-\d{4}$/);
      expect(check.checkName.trim().length).toBeGreaterThan(0);
      expect(check.expectedAnswer.trim().length).toBeGreaterThan(0);
      expect(check.whyQuoteIsSufficientOrInsufficient.trim().length).toBeGreaterThan(0);
      expect(check.knownBadQuotesToReject.length).toBeGreaterThan(0);

      if (check.expectedStatus === "FOUND") {
        expect(check.goldQuote).not.toBeNull();
        expect(check.page).not.toBeNull();
        expect(check.sectionHeading).not.toBeNull();
        expect(check.spanId ?? check.sectionHeading).not.toBeNull();
      }

      if (check.expectedStatus === "UNCLEAR" || check.expectedStatus === "MISSING") {
        expect(check.expectedClientAction?.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("anchors every gold quote and section heading to exact excerpts from the specified PDF", () => {
    expect(SOURCE_EXCERPTS.inputPdfName).toBe(AUDIT_FIXTURE.inputPdfName);
    expect(SOURCE_EXCERPTS.inputPdfPath).toBe(AUDIT_FIXTURE.inputPdfPath);
    expect(SOURCE_EXCERPTS.sourcePdfTitle).toBe(AUDIT_FIXTURE.sourcePdfTitle);
    expect(SOURCE_EXCERPTS.documentFamily).toBe(AUDIT_FIXTURE.documentFamily);

    for (const check of AUDIT_FIXTURE.checks) {
      if (check.page == null) {
        expect(check.goldQuote).toBeNull();
        expect(check.sectionHeading).toBeNull();
        continue;
      }

      const excerpt = SOURCE_EXCERPTS.pageExcerpts[String(check.page)];
      expect(excerpt).toBeTruthy();
      expect(normalizeText(excerpt)).toContain(normalizeText(check.sectionHeading));
      expect(normalizeText(excerpt)).toContain(normalizeText(check.goldQuote));

      for (const rejected of check.knownBadQuotesToReject) {
        expect(rejected.rejectionReason.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("renders the fixture-backed report contract without misleading wording", () => {
    const report = buildVm0007GapReport({
      reportId: "fixture-report",
      generatedAt: "2026-07-01T00:00:00Z",
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
      audit: buildAuditFromFixtures(AUDIT_FIXTURE.checks),
    });

    const reportHtml = renderToStaticMarkup(createElement(Vm0007GapReportView, { report }));
    const reportJson = JSON.stringify(report).toLowerCase();

    expect(report.reportName).toBe(REPORT_FIXTURE.expectedReportTitle);
    expect({
      supported: report.executiveSummary.totals.supported,
      weak: report.executiveSummary.totals.weak,
      missing: report.executiveSummary.totals.missing,
      notApplicable: report.executiveSummary.totals.notApplicable,
    }).toEqual(REPORT_FIXTURE.expectedStatusCounts);

    for (const wording of REPORT_FIXTURE.expectedVisibleWording) {
      expect(reportHtml).toContain(wording);
    }
    for (const evidenceText of REPORT_FIXTURE.expectedEvidenceRendering) {
      expect(reportHtml).toContain(evidenceText);
    }
    for (const explanation of REPORT_FIXTURE.expectedWeakOrMissingExplanation) {
      expect(reportHtml).toContain(explanation);
    }
    for (const action of REPORT_FIXTURE.expectedClientActionWording) {
      expect(reportHtml).toContain(action);
    }
    for (const banned of REPORT_FIXTURE.bannedWording) {
      expect(reportJson).not.toContain(banned.toLowerCase());
    }

    expect([
      "Executive Summary",
      "Project Snapshot",
      "Methodology Scope",
      "Key Supported Findings",
      "Not Applicable Rules",
      "Main Evidence Gaps",
      "Follow-up Action List",
      "Full VM0007 Rule Audit Table",
      "Evidence Appendix",
    ]).toEqual(REPORT_FIXTURE.expectedSectionOrdering);
  });
});
