import type { FixtureStatus, FullAuditFixtureSet, JudgmentFixtureSet } from "../../../tests/lib/preverifJudgmentFixtureGate";

export type Vm0007FixtureBackedStatus = FixtureStatus;

export type Vm0007EvidenceMapRejectedEvidence = {
  quote: string;
  rejectionReason: string;
};

export type Vm0007EvidenceMapRow = {
  ruleId: string;
  ruleName: string;
  status: Vm0007FixtureBackedStatus;
  acceptedQuote: string | null;
  page: number | null;
  sectionHeading: string | null;
  spanId: string | null;
  whyEvidenceIsAccepted: string;
  rejectedEvidenceExamples: Vm0007EvidenceMapRejectedEvidence[];
  whyRejectedEvidenceIsNotEnough: string | null;
  clientAction: string | null;
  naReason: string | null;
};

export type Vm0007FixtureBackedReport = {
  reportId: string;
  reportName: string;
  generatedAt: string;
  quarantine: {
    label: string;
    status: "quarantined";
    versionMatch: false;
    pddDeclaredMethodologyVersion: string;
    loadedRulebookVersion: string;
    note: string;
  };
  limitationBanner: string;
  summary: {
    totalRules: number;
    counts: Record<Vm0007FixtureBackedStatus, number>;
    headline: string;
  };
  project: {
    name: string;
    description: string;
  };
  methodology: {
    code: string;
    version: string;
    name: string;
  };
  evidenceMapRows: Vm0007EvidenceMapRow[];
};

export const VM0007_VERSION_MISMATCH_BLOCK_MESSAGE =
  "Methodology version mismatch: PDD declares REDD-MF v1.5, but loaded rulebook is VM0007 v1.8. Evidence judgment blocked.";

export const VM0007_FIXTURE_BACKED_STATUS_ORDER: Vm0007FixtureBackedStatus[] = [
  "MISSING",
  "UNCLEAR",
  "FOUND",
  "N/A",
];

function compareRuleIds(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true });
}

export function sortEvidenceMapRows(rows: Vm0007EvidenceMapRow[]): Vm0007EvidenceMapRow[] {
  const order = new Map(VM0007_FIXTURE_BACKED_STATUS_ORDER.map((status, index) => [status, index]));
  return rows.slice().sort((left, right) => {
    const statusDiff = (order.get(left.status) ?? 99) - (order.get(right.status) ?? 99);
    if (statusDiff !== 0) return statusDiff;
    return compareRuleIds(left.ruleId, right.ruleId);
  });
}

export function groupEvidenceMapRowsByStatus(rows: Vm0007EvidenceMapRow[]): Array<{
  status: Vm0007FixtureBackedStatus;
  rows: Vm0007EvidenceMapRow[];
}> {
  const grouped = VM0007_FIXTURE_BACKED_STATUS_ORDER.map((status) => ({
    status,
    rows: sortEvidenceMapRows(rows).filter((row) => row.status === status),
  }));
  return grouped.filter((group) => group.rows.length > 0);
}

export function getPriorityClientActionRows(rows: Vm0007EvidenceMapRow[]): Vm0007EvidenceMapRow[] {
  return sortEvidenceMapRows(rows).filter((row) => row.status === "MISSING" || row.status === "UNCLEAR");
}

export function isVm0007VersionMismatchBlocked(report: Pick<Vm0007FixtureBackedReport, "quarantine">): boolean {
  return report.quarantine.versionMatch === false;
}

function buildJudgmentIndex(judgmentFixtureSet?: JudgmentFixtureSet): Map<string, JudgmentFixtureSet["checks"][number]> {
  return new Map((judgmentFixtureSet?.checks ?? []).map((check) => [check.checkId, check]));
}

export function buildEvidenceMapRows(
  fullAuditFixtureSet: FullAuditFixtureSet,
  judgmentFixtureSet?: JudgmentFixtureSet,
): Vm0007EvidenceMapRow[] {
  const judgmentIndex = buildJudgmentIndex(judgmentFixtureSet);

  return fullAuditFixtureSet.checks.map((check) => {
    const judgmentCheck = judgmentIndex.get(check.checkId);
    const rejectedEvidenceExamples = judgmentCheck?.knownBadQuotesToReject ?? [];
    const whyRejectedEvidenceIsNotEnough =
      rejectedEvidenceExamples.length > 0
        ? judgmentCheck?.whyQuoteIsSufficientOrInsufficient ?? check.reason
        : null;

    return {
      ruleId: check.checkId,
      ruleName: check.checkName,
      status: check.expectedStatus,
      acceptedQuote: check.evidence?.quote ?? null,
      page: check.page,
      sectionHeading: check.sectionHeading,
      spanId: check.spanId,
      whyEvidenceIsAccepted:
        check.expectedStatus === "FOUND"
          ? check.reason
          : check.expectedStatus === "UNCLEAR"
            ? check.reason
            : check.expectedStatus === "MISSING"
              ? "No accepted project-specific PDD quote is encoded for this rule in the quarantined legacy mismatch fixture."
              : "This rule is encoded as N/A in the quarantined legacy mismatch fixture because the project scope does not trigger it.",
      rejectedEvidenceExamples,
      whyRejectedEvidenceIsNotEnough,
      clientAction:
        check.expectedStatus === "UNCLEAR" || check.expectedStatus === "MISSING"
          ? check.clientAction
          : null,
      naReason: check.expectedStatus === "N/A" ? check.reason : null,
    };
  });
}

export function buildFixtureBackedVm0007Report(input: {
  reportId: string;
  reportName: string;
  generatedAt: string;
  project: Vm0007FixtureBackedReport["project"];
  methodology: Vm0007FixtureBackedReport["methodology"];
  fullAuditFixtureSet: FullAuditFixtureSet;
  judgmentFixtureSet?: JudgmentFixtureSet;
}): Vm0007FixtureBackedReport {
  const evidenceMapRows = buildEvidenceMapRows(input.fullAuditFixtureSet, input.judgmentFixtureSet);

  return {
    reportId: input.reportId,
    reportName: input.reportName,
    generatedAt: input.generatedAt,
    quarantine: {
      label: "Legacy v1.5 mismatch regression fixture",
      status: "quarantined",
      versionMatch: false,
      pddDeclaredMethodologyVersion: "REDD-MF / VM0007 v1.5",
      loadedRulebookVersion: `${input.methodology.code} ${input.methodology.version}`,
      note: "Historical counts are contaminated legacy output and must not be treated as validated truth.",
    },
    limitationBanner:
      "Internal preview only. This route renders a quarantined legacy mismatch fixture for analysis and is not client-ready.",
    summary: {
      totalRules: input.fullAuditFixtureSet.expectedTotalRules,
      counts: input.fullAuditFixtureSet.expectedStatusCounts,
      headline:
        "Summary counts and row detail come from quarantined legacy mismatch output, not validated VM0007 truth.",
    },
    project: input.project,
    methodology: input.methodology,
    evidenceMapRows,
  };
}
