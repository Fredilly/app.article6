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
              ? "No accepted project-specific PDD quote is encoded for this rule in the reviewed fixture truth."
              : "This rule is encoded as N/A in the reviewed fixture truth because the project scope does not trigger it.",
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
    limitationBanner: "Internal preview only. This route renders reviewed fixture truth for analysis and is not client-ready.",
    summary: {
      totalRules: input.fullAuditFixtureSet.expectedTotalRules,
      counts: input.fullAuditFixtureSet.expectedStatusCounts,
      headline:
        "Summary counts and row detail come from reviewed fixture truth, not the current live audit output.",
    },
    project: input.project,
    methodology: input.methodology,
    evidenceMapRows,
  };
}
