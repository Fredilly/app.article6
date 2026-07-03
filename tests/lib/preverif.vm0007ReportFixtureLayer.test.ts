import fs from "node:fs";
import { describe, expect, it } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Vm0007GapReportView from "@/components/preverif/Vm0007GapReportView";
import { NO_PDD_EVIDENCE_TEXT } from "@/lib/preverif/vm0007GapReport";
import {
  assertVm0007FullAuditFixtureSet,
  type SourceExcerpts,
} from "./preverifJudgmentFixtureGate";
import {
  FULL_AUDIT_FIXTURE,
  REPORT_FIXTURE,
  buildFixtureReport,
} from "./preverifVm0007ReportFixtures";
import { VM0007_SYNCED_RULES } from "./preverifVm0007Fixtures";

const SOURCE_EXCERPTS = JSON.parse(
  fs.readFileSync("tests/fixtures/preverif/envira-vm0007-source-excerpts.json", "utf8"),
) as SourceExcerpts;

function buildHtml(): string {
  return renderToStaticMarkup(createElement(Vm0007GapReportView, { report: buildFixtureReport() }));
}

describe("VM0007 report fixture layer", () => {
  it("derives the report from the finalized 58-rule Envira audit fixture", () => {
    assertVm0007FullAuditFixtureSet(FULL_AUDIT_FIXTURE, VM0007_SYNCED_RULES, SOURCE_EXCERPTS);

    const report = buildFixtureReport();
    expect(report.reportName).toBe(REPORT_FIXTURE.expectedReportTitle);
    expect(report.statementOfCoverage).toBe(
      `${REPORT_FIXTURE.expectedStatusCounts.totalRules} VM0007 rules assessed for validation readiness.`,
    );
    expect(report.fullRuleAuditTable).toHaveLength(REPORT_FIXTURE.expectedStatusCounts.totalRules);
    expect(report.evidenceAppendix).toHaveLength(REPORT_FIXTURE.expectedStatusCounts.totalRules);
    expect(report.executiveSummary.totals).toEqual({
      supported: REPORT_FIXTURE.expectedStatusCounts.supported,
      weak: REPORT_FIXTURE.expectedStatusCounts.weak,
      missing: REPORT_FIXTURE.expectedStatusCounts.missing,
      notApplicable: REPORT_FIXTURE.expectedStatusCounts.notApplicable,
      needsClientAction: REPORT_FIXTURE.expectedStatusCounts.weak + REPORT_FIXTURE.expectedStatusCounts.missing,
    });
  });

  it("renders the expected sections in stable order with internal-preview wording only", () => {
    const html = buildHtml();
    const sectionIndexes = REPORT_FIXTURE.expectedSectionOrdering.map((heading) => html.indexOf(heading));

    for (const wording of REPORT_FIXTURE.expectedVisibleWording) {
      expect(html).toContain(wording);
    }

    expect(sectionIndexes.every((index) => index >= 0)).toBe(true);
    expect([...sectionIndexes]).toEqual([...sectionIndexes].sort((left, right) => left - right));
  });

  it("keeps deterministic grouping and preserves all rows across supported, weak, missing, and not-applicable buckets", () => {
    const report = buildFixtureReport();
    const supportedIds = FULL_AUDIT_FIXTURE.checks
      .filter((check) => check.expectedStatus === "FOUND")
      .map((check) => check.checkId)
      .sort();
    const weakIds = REPORT_FIXTURE.expectedGroupingSamples.weakRuleIds;
    const missingIds = REPORT_FIXTURE.expectedGroupingSamples.missingRuleIds;
    const notApplicableIds = FULL_AUDIT_FIXTURE.checks
      .filter((check) => check.expectedStatus === "N/A")
      .map((check) => check.checkId)
      .sort();

    expect(report.keySupportedFindings.map((finding) => finding.ruleId)).toEqual(supportedIds.slice(0, 10));
    expect(report.mainEvidenceGaps.map((finding) => finding.ruleId)).toEqual([...missingIds, ...weakIds]);
    expect(report.notApplicableRules.map((finding) => finding.ruleId).slice(0, 3)).toEqual(
      REPORT_FIXTURE.expectedGroupingSamples.notApplicableFirstRuleIds,
    );

    const fullRowsByStatus = {
      supported: report.fullRuleAuditTable.filter((row) => row.status === "supported").map((row) => row.ruleId),
      weak: report.fullRuleAuditTable.filter((row) => row.status === "weak").map((row) => row.ruleId),
      missing: report.fullRuleAuditTable.filter((row) => row.status === "missing").map((row) => row.ruleId),
      notApplicable: report.fullRuleAuditTable.filter((row) => row.status === "not applicable").map((row) => row.ruleId),
    };

    expect(fullRowsByStatus.supported).toEqual(supportedIds);
    expect(fullRowsByStatus.weak).toEqual(weakIds);
    expect(fullRowsByStatus.missing).toEqual(missingIds);
    expect(fullRowsByStatus.notApplicable).toEqual(notApplicableIds);
    expect(new Set(report.fullRuleAuditTable.map((row) => row.ruleId)).size).toBe(58);
  });

  it("renders representative FOUND, UNCLEAR, MISSING, and N/A rows without overstating weak or absent evidence", () => {
    const report = buildFixtureReport();

    for (const expectation of REPORT_FIXTURE.expectedRepresentativeRows) {
      const row = report.fullRuleAuditTable.find((item) => item.ruleId === expectation.ruleId);
      const appendix = report.evidenceAppendix.find((item) => item.ruleId === expectation.ruleId);
      expect(row?.status).toBe(expectation.status);

      if (expectation.quoteSnippet) {
        expect(row?.evidenceSummary).toContain(expectation.quoteSnippet);
        expect(appendix?.quote).toContain(expectation.quoteSnippet);
      } else {
        expect(row?.evidenceSummary).toBe(NO_PDD_EVIDENCE_TEXT);
        expect(appendix?.quote).toBe(NO_PDD_EVIDENCE_TEXT);
      }

      if (expectation.page != null) {
        expect(appendix?.page).toBe(expectation.page);
      } else {
        expect(appendix?.page ?? null).toBeNull();
      }

      if (expectation.section) {
        expect(appendix?.section).toBe(expectation.section);
      }

      const finding =
        expectation.status === "supported"
          ? report.keySupportedFindings.find((item) => item.ruleId === expectation.ruleId)
          : expectation.status === "not applicable"
            ? report.notApplicableRules.find((item) => item.ruleId === expectation.ruleId)
            : report.mainEvidenceGaps.find((item) => item.ruleId === expectation.ruleId);
      expect(finding?.whyItMatters).toContain(expectation.reasonSnippet);

      if (expectation.clientActionSnippet) {
        expect(finding?.whatToAdd).toContain(expectation.clientActionSnippet);
      }
    }

    for (const finding of [...report.mainEvidenceGaps, ...report.notApplicableRules]) {
      const combined = `${finding.issue} ${finding.currentPddEvidence} ${finding.whyItMatters} ${finding.whatToAdd}`.toLowerCase();
      expect(combined).not.toContain("confirmed");
    }
  });

  it("keeps banned wording out of the report html and data", () => {
    const report = buildFixtureReport();
    const combined = `${buildHtml()} ${JSON.stringify(report)}`.toLowerCase();

    for (const banned of REPORT_FIXTURE.bannedWording) {
      expect(combined).not.toContain(banned.toLowerCase());
    }
  });
});
