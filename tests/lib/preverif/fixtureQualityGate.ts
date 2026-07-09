import { expect } from "@jest/globals";
import type { MethodologyEvidenceAuditSummary } from "@/lib/preverif/evidenceAudit";
import type { Vm0007GapReport } from "@/lib/preverif/vm0007GapReport";
import {
  assertVm0007JudgmentFixtureSet,
  type JudgmentFixtureSet,
  type SourceExcerpts,
} from "../preverifJudgmentFixtureGate";

export type FixtureQualityGateInput = {
  rules: readonly { id: string }[];
  audit: MethodologyEvidenceAuditSummary;
  report: Vm0007GapReport;
  reportHtml: string;
  judgmentFixtureSet: JudgmentFixtureSet;
  sourceExcerpts: SourceExcerpts;
  expectedVisibleWording?: readonly string[];
  bannedWording?: readonly string[];
};

const FALLBACK_EVIDENCE_TEXT = "Evidence is not currently available in the PDD.";

const DEFAULT_BANNED_WORDING = ["passed", "all clear", "confirmed"];

function normalize(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function assertNoOverstatedWording(reportHtml: string, report: Vm0007GapReport, bannedWording: readonly string[]): void {
  const reportText = normalize(`${reportHtml} ${JSON.stringify(report)}`);
  for (const wording of bannedWording) {
    expect(reportText).not.toContain(normalize(wording));
  }
}

function assertVisibleWording(reportHtml: string, expectedVisibleWording: readonly string[]): void {
  const reportText = normalize(reportHtml);
  for (const wording of expectedVisibleWording) {
    expect(reportText).toContain(normalize(wording));
  }
}

function assertVersionMismatchIsQuarantined(audit: MethodologyEvidenceAuditSummary, report: Vm0007GapReport): void {
  expect(audit.versionMatch).toBe(false);
  expect(audit.auditStatus).toBe("BLOCKED_VERSION_MISMATCH");
  expect(normalize(report.limitationBanner)).toContain("methodology version mismatch:");
  expect(normalize(report.limitationBanner)).toContain("internal preview only");
  expect(normalize(report.executiveSummary.limitations.join(" "))).toContain("methodology version mismatch:");
  expect(normalize(report.reportName)).toContain("internal vm0007 gap report preview");
}

function assertRuleCoverage(rules: readonly { id: string }[], audit: MethodologyEvidenceAuditSummary, report: Vm0007GapReport): void {
  const expectedRuleIds = [...rules].map((rule) => rule.id).sort();
  const auditRuleIds = [...audit.results].map((result) => result.ruleId).sort();
  const reportRuleIds = [...report.fullRuleAuditTable].map((row) => row.ruleId).sort();
  const appendixRuleIds = [...report.evidenceAppendix].map((row) => row.ruleId).sort();

  expect(audit.totalRules).toBe(rules.length);
  expect(report.fullRuleAuditTable).toHaveLength(rules.length);
  expect(report.evidenceAppendix).toHaveLength(rules.length);
  expect(auditRuleIds).toEqual(expectedRuleIds);
  expect(reportRuleIds).toEqual(expectedRuleIds);
  expect(appendixRuleIds).toEqual(expectedRuleIds);
}

function assertReportRowQuality(report: Vm0007GapReport): void {
  for (const row of report.fullRuleAuditTable) {
    const appendixRow = report.evidenceAppendix.find((entry) => entry.ruleId === row.ruleId);
    expect(appendixRow).toBeDefined();

    if (row.status === "supported") {
      const supportedEvidence = normalize(`${row.evidenceSummary} ${appendixRow?.quote ?? ""}`);
      expect(row.evidenceSummary).not.toContain(FALLBACK_EVIDENCE_TEXT);
      expect(appendixRow?.quote).not.toBe(FALLBACK_EVIDENCE_TEXT);
      expect(appendixRow?.page).not.toBeNull();
      expect(appendixRow?.section.trim().length).toBeGreaterThan(0);
      if (appendixRow?.span !== undefined) {
        expect(appendixRow.span.trim().length).toBeGreaterThan(0);
      }
      expect(supportedEvidence).not.toMatch(/\bhttps?:\/\//);
      expect(supportedEvidence).not.toContain("table of contents");
      expect(supportedEvidence).not.toContain("all clear");
      expect(supportedEvidence).not.toContain("passed");
      expect(supportedEvidence).not.toContain("confirmed");
      expect(row.gapGuidance).toBe("");
      expect(row.clientAction).toBe("");
      continue;
    }

    if (row.status === "weak") {
      expect(row.gapGuidance.trim().length).toBeGreaterThan(0);
      expect(row.clientAction.trim().length).toBeGreaterThan(0);
      expect(appendixRow?.quote).toBeTruthy();
      continue;
    }

    if (row.status === "missing") {
      expect(row.gapGuidance.trim().length).toBeGreaterThan(0);
      expect(row.clientAction.trim().length).toBeGreaterThan(0);
      expect(appendixRow?.quote).toBe(FALLBACK_EVIDENCE_TEXT);
      continue;
    }

    expect(row.status).toBe("not applicable");
    expect(row.gapGuidance.trim().length).toBeGreaterThan(0);
    expect(row.clientAction.trim().length).toBeGreaterThan(0);
  }
}

export function assertFixtureQualityGate(input: FixtureQualityGateInput): void {
  assertVm0007JudgmentFixtureSet(input.judgmentFixtureSet, input.sourceExcerpts);
  assertVersionMismatchIsQuarantined(input.audit, input.report);
  assertRuleCoverage(input.rules, input.audit, input.report);

  for (const fixture of input.judgmentFixtureSet.checks) {
    expect(fixture.checkId.trim().length).toBeGreaterThan(0);
    for (const rejectedQuote of fixture.knownBadQuotesToReject) {
      expect(normalize(rejectedQuote.quote)).toBeTruthy();
      expect(normalize(rejectedQuote.rejectionReason)).toBeTruthy();
    }
  }

  assertReportRowQuality(input.report);

  assertVisibleWording(input.reportHtml, input.expectedVisibleWording ?? []);
  assertNoOverstatedWording(input.reportHtml, input.report, input.bannedWording ?? DEFAULT_BANNED_WORDING);
}
