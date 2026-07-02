import fs from "node:fs";
import { describe, expect, it } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Vm0007GapReportView from "@/components/preverif/Vm0007GapReportView";
import type { EvidenceAuditStatus, MethodologyEvidenceAuditResult, MethodologyEvidenceAuditSummary } from "@/lib/preverif/evidenceAudit";
import {
  assertQuoteDoesNotAppearInSourceExcerpts,
  assertVm0007FullAuditFixtureSet,
  assertVm0007JudgmentFixtureSet,
  type FullAuditFixtureSet,
  type FixtureStatus,
  type JudgmentFixture,
  type JudgmentFixtureSet,
  type SourceExcerpts,
} from "./preverifJudgmentFixtureGate";
import { FULL_AUDIT_FIXTURE, REPORT_FIXTURE, buildFixtureReport } from "./preverifVm0007ReportFixtures";
import { VM0007_SYNCED_RULES } from "./preverifVm0007Fixtures";

const AUDIT_FIXTURE = JSON.parse(
  fs.readFileSync("tests/fixtures/preverif/envira-vm0007-judgment-fixtures.json", "utf8"),
) as JudgmentFixtureSet;

const PD_REDD_FIXTURE = JSON.parse(
  fs.readFileSync("tests/fixtures/preverif/pd-redd-vm0007-judgment-fixtures.json", "utf8"),
) as JudgmentFixtureSet;

const SOURCE_EXCERPTS = JSON.parse(
  fs.readFileSync("tests/fixtures/preverif/envira-vm0007-source-excerpts.json", "utf8"),
) as SourceExcerpts;

const PD_REDD_SOURCE_EXCERPTS = JSON.parse(
  fs.readFileSync("tests/fixtures/preverif/pd-redd-vm0007-source-excerpts.json", "utf8"),
) as SourceExcerpts;

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
    assertVm0007JudgmentFixtureSet(AUDIT_FIXTURE, SOURCE_EXCERPTS);
  });

  it("keeps Envira quotes out of the PD_REDD source excerpts", () => {
    const enviraQuote = AUDIT_FIXTURE.checks.find((check) => check.checkId === "R-1-0002")?.goldQuote;
    expect(enviraQuote).toBeTruthy();
    assertQuoteDoesNotAppearInSourceExcerpts(enviraQuote!, PD_REDD_SOURCE_EXCERPTS);
  });

  it("fails when a gold quote is stitched, paraphrased, on the wrong page, or on the wrong section", () => {
    const stitched = JSON.parse(JSON.stringify(AUDIT_FIXTURE)) as JudgmentFixtureSet;
    stitched.checks = stitched.checks.map((check) =>
      check.checkId === "R-5-0003"
        ? {
            ...check,
            goldQuote: "Leakage emissions from displacement of planned deforestation are estimated in conformance with the VCS modular REDD methodology VM0007, specifically the LK-ASP and LK-ME modules. The initial PRA indicated that the agents of deforestation comprise in majority the local population",
          }
        : check,
    );

    const paraphrased = JSON.parse(JSON.stringify(AUDIT_FIXTURE)) as JudgmentFixtureSet;
    paraphrased.checks = paraphrased.checks.map((check) =>
      check.checkId === "R-2-0014"
        ? { ...check, goldQuote: "The crediting period lasts 30 years from August 2, 2012 until August 1, 2042." }
        : check,
    );

    const wrongPage = JSON.parse(JSON.stringify(AUDIT_FIXTURE)) as JudgmentFixtureSet;
    wrongPage.checks = wrongPage.checks.map((check) =>
      check.checkId === "R-3-0001"
        ? { ...check, page: 29 }
        : check,
    );

    const wrongSection = JSON.parse(JSON.stringify(AUDIT_FIXTURE)) as JudgmentFixtureSet;
    wrongSection.checks = wrongSection.checks.map((check) =>
      check.checkId === "R-6-0002"
        ? { ...check, sectionHeading: "3.3 Leakage" }
        : check,
    );

    expect(() => assertVm0007JudgmentFixtureSet(stitched, SOURCE_EXCERPTS)).toThrow();
    expect(() => assertVm0007JudgmentFixtureSet(paraphrased, SOURCE_EXCERPTS)).toThrow();
    expect(() => assertVm0007JudgmentFixtureSet(wrongPage, SOURCE_EXCERPTS)).toThrow();
    expect(() => assertVm0007JudgmentFixtureSet(wrongSection, SOURCE_EXCERPTS)).toThrow();
  });

  it("fails when Envira evidence is injected into PD_REDD fixtures", () => {
    const mutated = JSON.parse(JSON.stringify(PD_REDD_FIXTURE)) as JudgmentFixtureSet;
    mutated.checks = mutated.checks.map((check) =>
      check.checkId === "R-3-0001"
        ? {
            ...check,
            goldQuote: "Baseline deforestation in the project area falls within the planned deforestation category, as the agents of deforestation is the project proponent.",
            page: 32,
            sectionHeading: "2.2 Applicability of Methodology",
          }
        : check,
    );

    expect(() => assertVm0007JudgmentFixtureSet(mutated, PD_REDD_SOURCE_EXCERPTS)).toThrow();
  });

  it("renders the fixture-backed report contract from the finalized 58-rule Envira audit fixture", () => {
    assertVm0007FullAuditFixtureSet(
      FULL_AUDIT_FIXTURE as FullAuditFixtureSet,
      VM0007_SYNCED_RULES,
      SOURCE_EXCERPTS,
    );
    const report = buildFixtureReport();
    const reportHtml = renderToStaticMarkup(createElement(Vm0007GapReportView, { report }));
    const reportJson = JSON.stringify(report).toLowerCase();

    expect(report.reportName).toBe(REPORT_FIXTURE.expectedReportTitle);
    expect({
      supported: report.executiveSummary.totals.supported,
      weak: report.executiveSummary.totals.weak,
      missing: report.executiveSummary.totals.missing,
      notApplicable: report.executiveSummary.totals.notApplicable,
      totalRules: report.fullRuleAuditTable.length,
    }).toEqual(REPORT_FIXTURE.expectedStatusCounts);

    for (const wording of REPORT_FIXTURE.expectedVisibleWording) {
      expect(reportHtml).toContain(wording);
    }
    for (const representative of REPORT_FIXTURE.expectedRepresentativeRows) {
      if (representative.quoteSnippet) {
        expect(reportHtml).toContain(representative.quoteSnippet);
      }
      expect(reportHtml).toContain(representative.reasonSnippet);
      if (representative.clientActionSnippet) {
        expect(reportHtml).toContain(representative.clientActionSnippet);
      }
    }
    for (const banned of REPORT_FIXTURE.bannedWording) {
      expect(reportJson).not.toContain(banned.toLowerCase());
    }
    expect(REPORT_FIXTURE.expectedSectionOrdering).toEqual([
      "Executive Summary",
      "Project Snapshot",
      "Methodology Scope",
      "Key Supported Findings",
      "Not Applicable Rules",
      "Main Evidence Gaps",
      "Follow-up Action List",
      "Full VM0007 Rule Audit Table",
      "Evidence Appendix",
    ]);
  });
});
