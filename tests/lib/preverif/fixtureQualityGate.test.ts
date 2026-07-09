import fs from "node:fs";
import { describe, expect, it } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Vm0007GapReportView from "@/components/preverif/Vm0007GapReportView";
import { getStructuredQueryContext } from "@/lib/chat/quickCheckReviewQuestion";
import { auditEvidence, type MethodologyEvidenceAuditResult, type MethodologyEvidenceAuditSummary } from "@/lib/preverif/evidenceAudit";
import { buildVm0007GapReport } from "@/lib/preverif/vm0007GapReport";
import { getVm0007EvidenceContract, normalizeVm0007RuleId } from "@/lib/preverif/vm0007EvidenceContracts";
import { VM0007_SYNCED_RULES, readQuickCheckFixtureText } from "../preverifVm0007Fixtures";
import { assertLegacyVm0007MismatchFixtureQualityGate } from "./fixtureQualityGate";
import type { JudgmentFixtureSet, SourceExcerpts } from "../preverifJudgmentFixtureGate";

const AUDIT_FIXTURE = JSON.parse(
  fs.readFileSync("tests/fixtures/preverif/envira-vm0007-judgment-fixtures.json", "utf8"),
) as JudgmentFixtureSet;

const REPORT_FIXTURE = JSON.parse(
  fs.readFileSync("tests/fixtures/preverif/envira-vm0007-report-fixture.json", "utf8"),
);

const SOURCE_EXCERPTS = JSON.parse(
  fs.readFileSync("tests/fixtures/preverif/envira-vm0007-source-excerpts.json", "utf8"),
) as SourceExcerpts;

const ENVIRA_TEXT = readQuickCheckFixtureText("envira-amazonia-vm0007-extracted.txt");
const ENVIRA_V18_TEXT = ENVIRA_TEXT.replace("VM0007 Version 4.2", "REDD-MF / VM0007 v1.8");

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

function buildMixedAudit(): MethodologyEvidenceAuditSummary {
  const base = auditText(ENVIRA_V18_TEXT);
  const results = base.results.map((result) => {
    if (result.ruleId === "R-1-0002") {
      return withStatus(result, {
        status: "partially_supported",
        gap: "The current PDD names the baseline category but does not explain why that category fits the project area.",
        clientAction: "Add the project-specific baseline deforestation category rationale and the supporting land-use evidence.",
      });
    }
    if (result.ruleId === "R-1-0003") {
      return withStatus(result, {
        status: "missing_evidence",
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
    if (result.ruleId === "R-1-0005") {
      return withStatus(result, {
        status: "not_applicable",
        bestEvidenceQuote: "This is a REDD/APD project in upland forest landscapes. No peat soils or tidal wetland activity occur in the project area.",
        section: "Project Activity Description",
        page: 2,
        span: "envira-amazonia-vm0007:p2:b5:span-2",
        gap: "",
        clientAction: "Keep scope basis clear.",
        assessmentReason: "The current PDD scope statement shows this wetland-specific rule does not apply to the project.",
      });
    }
    return result;
  });

  return {
    results,
    totals: {
      supported_by_pdd: results.filter((entry) => entry.status === "supported_by_pdd").length,
      partially_supported: results.filter((entry) => entry.status === "partially_supported").length,
      missing_evidence: results.filter((entry) => entry.status === "missing_evidence").length,
      not_applicable: results.filter((entry) => entry.status === "not_applicable").length,
      manual_review_needed: results.filter((entry) => entry.status === "manual_review_needed").length,
    },
    totalRules: results.length,
    auditStatus: "BLOCKED_VERSION_MISMATCH",
    methodologyId: "VM0007",
    rulebookVersion: "v1.8",
    pddDeclaredMethodologyVersion: "REDD-MF / VM0007 v1.5",
    versionMatch: false,
    versionMismatchReason: "Version lock blocked: rulebook version mismatch: PDD declares v1.5, loaded contract is v1.8.",
    userAcceptedVersionWarning: true,
  };
}

function buildReport(audit: MethodologyEvidenceAuditSummary) {
  return buildVm0007GapReport({
    reportId: "VRGR-VM0007-001",
    generatedAt: "2026-07-01T10:00:00Z",
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
    audit,
  });
}

describe("legacy mismatch fixture quality gate", () => {
  it("accepts the quarantined Envira legacy mismatch fixture and report", () => {
    const audit = buildMixedAudit();
    const report = buildReport(audit);
    const reportHtml = renderToStaticMarkup(createElement(Vm0007GapReportView, { report }));

    assertLegacyVm0007MismatchFixtureQualityGate({
      rules: VM0007_SYNCED_RULES,
      audit,
      report,
      reportHtml,
      judgmentFixtureSet: AUDIT_FIXTURE,
      sourceExcerpts: SOURCE_EXCERPTS,
      expectedVisibleWording: REPORT_FIXTURE.expectedVisibleWording,
      bannedWording: REPORT_FIXTURE.bannedWording,
    });
  });

  it("fails if bad evidence is promoted to supported wording", () => {
    const audit = buildMixedAudit();
    const report = JSON.parse(JSON.stringify(buildReport(audit))) as ReturnType<typeof buildReport>;
    const supportedRow = report.fullRuleAuditTable.find((row) => row.ruleId === "R-2-0003");
    const appendixRow = report.evidenceAppendix.find((row) => row.ruleId === "R-2-0003");
    expect(supportedRow).toBeDefined();
    expect(appendixRow).toBeDefined();
    if (supportedRow) {
      supportedRow.evidenceSummary = "http://climate-standards.org/projects/";
    }
    if (appendixRow) {
      appendixRow.quote = "http://climate-standards.org/projects/";
    }
    const reportHtml = renderToStaticMarkup(createElement(Vm0007GapReportView, { report }));

    expect(() =>
      assertLegacyVm0007MismatchFixtureQualityGate({
        rules: VM0007_SYNCED_RULES,
        audit,
        report,
        reportHtml,
        judgmentFixtureSet: AUDIT_FIXTURE,
        sourceExcerpts: SOURCE_EXCERPTS,
      }),
    ).toThrow();
  });

  it("fails if report wording overstates fixture truth", () => {
    const audit = buildMixedAudit();
    const report = buildReport(audit);
    const reportHtml = `${renderToStaticMarkup(createElement(Vm0007GapReportView, { report }))}<div>All clear. Passed. Confirmed.</div>`;

    expect(() =>
      assertLegacyVm0007MismatchFixtureQualityGate({
        rules: VM0007_SYNCED_RULES,
        audit,
        report,
        reportHtml,
        judgmentFixtureSet: AUDIT_FIXTURE,
        sourceExcerpts: SOURCE_EXCERPTS,
      }),
    ).toThrow();
  });

  it("fails if the fixture stops declaring the version mismatch as blocked", () => {
    const audit = buildMixedAudit();
    const report = buildReport(audit);
    const brokenAudit = {
      ...audit,
      auditStatus: "AUDITED" as const,
      versionMatch: true,
      versionMismatchReason: "",
    };

    expect(() =>
      assertLegacyVm0007MismatchFixtureQualityGate({
        rules: VM0007_SYNCED_RULES,
        audit: brokenAudit,
        report,
        reportHtml: renderToStaticMarkup(createElement(Vm0007GapReportView, { report })),
        judgmentFixtureSet: AUDIT_FIXTURE,
        sourceExcerpts: SOURCE_EXCERPTS,
      }),
    ).toThrow();
  });
});
