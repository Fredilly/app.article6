import fs from "node:fs";
import path from "node:path";
import type { MethodologyEvidenceAuditResult, MethodologyEvidenceAuditSummary } from "@/lib/preverif/evidenceAudit";
import {
  buildVm0007GapReport,
  type Vm0007GapReport,
  type Vm0007GapReportDisplayStatus,
} from "@/lib/preverif/vm0007GapReport";
import type { FullAuditFixtureSet } from "./preverifJudgmentFixtureGate";

export type Vm0007ReportFixtureRepresentativeRow = {
  ruleId: string;
  status: Vm0007GapReportDisplayStatus;
  quoteSnippet?: string;
  page?: number;
  section?: string;
  reasonSnippet: string;
  clientActionSnippet?: string;
};

export type Vm0007ReportFixture = {
  fixtureSetId: string;
  title: string;
  sourceAuditFixtureSetId: string;
  expectedReportTitle: string;
  expectedSectionOrdering: string[];
  expectedStatusCounts: {
    supported: number;
    weak: number;
    missing: number;
    notApplicable: number;
    totalRules: number;
  };
  expectedVisibleWording: string[];
  bannedWording: string[];
  expectedRepresentativeRows: Vm0007ReportFixtureRepresentativeRow[];
  expectedGroupingSamples: {
    supportedFirstRuleIds: string[];
    weakRuleIds: string[];
    missingRuleIds: string[];
    notApplicableFirstRuleIds: string[];
  };
};

const FIXTURES_DIR = path.join(process.cwd(), "tests/fixtures/preverif");

export const FULL_AUDIT_FIXTURE = JSON.parse(
  fs.readFileSync(path.join(FIXTURES_DIR, "envira-vm0007-full-audit-fixture-shape.json"), "utf8"),
) as FullAuditFixtureSet;

export const REPORT_FIXTURE = JSON.parse(
  fs.readFileSync(path.join(FIXTURES_DIR, "envira-vm0007-report-fixture.json"), "utf8"),
) as Vm0007ReportFixture;

function toAuditResultStatus(
  status: FullAuditFixtureSet["checks"][number]["expectedStatus"],
): MethodologyEvidenceAuditResult["status"] {
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

function toAuditResult(
  check: FullAuditFixtureSet["checks"][number],
): MethodologyEvidenceAuditResult {
  return {
    ruleId: check.checkId,
    stableId: check.checkId,
    title: check.checkName,
    ruleLogic: check.checkName,
    status: toAuditResultStatus(check.expectedStatus),
    bestEvidenceQuote: check.evidence?.quote ?? null,
    page: check.evidence?.page ?? null,
    section: check.evidence?.sectionHeading ?? null,
    span: check.evidence?.spanId ?? null,
    reasonSelected: check.evidence
      ? "Fixture-provided PDF-backed quote selected for report expectation coverage."
      : check.expectedStatus === "N/A"
        ? "Fixture marks this rule as not applicable for the current project scope."
        : "No usable PDF-backed quote exists for this fixture row.",
    assessmentReason: check.reason,
    gap: check.expectedStatus === "FOUND" || check.expectedStatus === "N/A" ? "" : check.reason,
    clientAction: check.clientAction ?? "",
    confidence: check.expectedStatus === "FOUND" || check.expectedStatus === "N/A" ? "high" : "medium",
  };
}

export function buildAuditFromFullFixture(): MethodologyEvidenceAuditSummary {
  const results = FULL_AUDIT_FIXTURE.checks.map(toAuditResult);

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

export function buildFixtureReport(): Vm0007GapReport {
  return buildVm0007GapReport({
    reportId: "VRGR-VM0007-ENVIRA-FIXTURE",
    generatedAt: "2026-07-03T00:00:00Z",
    project: {
      name: "The Envira Amazonia Project",
      projectId: "VM0007-ENVIRA-FIXTURE",
      proponent: "Envira Amazonia Project Proponents",
      region: "Acre, Brazil",
      description: "Internal preview rendered from the finalized Phase 3 Envira VM0007 58-rule audit fixture.",
    },
    methodology: {
      code: "VM0007",
      version: "4.2",
      name: "VM0007: REDD Methodology Modules (REDD-MF)",
      scope: "Internal preview rendered from the finalized Phase 3 fixture only.",
    },
    audit: buildAuditFromFullFixture(),
  });
}
