import type {
  EvidenceAuditStatus,
  MethodologyEvidenceAuditResult,
  MethodologyEvidenceAuditSummary,
} from "@/lib/preverif/evidenceAudit";

export type Vm0007GapReportInput = {
  reportId: string;
  generatedAt: string;
  project: {
    name: string;
    projectId?: string;
    proponent?: string;
    region?: string;
    description?: string;
  };
  methodology: {
    code: string;
    version: string;
    name?: string;
    scope?: string;
  };
  audit: MethodologyEvidenceAuditSummary;
};

export type Vm0007GapReportDisplayStatus =
  | "supported"
  | "weak"
  | "missing"
  | "not applicable";

export type Vm0007GapReportFinding = {
  ruleId: string;
  title: string;
  status: Vm0007GapReportDisplayStatus;
  issue: string;
  currentPddEvidence: string;
  whyItMatters: string;
  whatToAdd: string;
  section: string | null;
  page: number | null;
  confidence: MethodologyEvidenceAuditResult["confidence"];
};

export type Vm0007GapReport = {
  reportId: string;
  generatedAt: string;
  reportName: "Internal VM0007 Gap Report Preview";
  statementOfCoverage: string;
  limitationBanner: string;
  executiveSummary: {
    headline: string;
    allSupportedWarning: string | null;
    totals: {
      supported: number;
      weak: number;
      missing: number;
      notApplicable: number;
      needsClientAction: number;
    };
    highlights: string[];
    limitations: string[];
  };
  projectSnapshot: Vm0007GapReportInput["project"];
  methodologyScope: {
    code: string;
    version: string;
    name?: string;
    scope?: string;
    summary: string;
    notes: string[];
  };
  keySupportedFindings: Vm0007GapReportFinding[];
  notApplicableRules: Vm0007GapReportFinding[];
  mainEvidenceGaps: Vm0007GapReportFinding[];
  clientActionList: Vm0007GapReportFinding[];
  fullRuleAuditTable: Array<{
    ruleId: string;
    title: string;
    status: Vm0007GapReportDisplayStatus;
    section: string;
    evidenceSummary: string;
    gapGuidance: string;
    clientAction: string;
  }>;
  evidenceAppendix: Array<{
    ruleId: string;
    title: string;
    quote: string;
    section: string;
    page: number | null;
    reasonSelected: string;
  }>;
};

const NO_PDD_EVIDENCE_TEXT = "Evidence is not currently available in the PDD.";

function toDisplayStatus(status: EvidenceAuditStatus): Vm0007GapReportDisplayStatus {
  switch (status) {
    case "supported_by_pdd":
      return "supported";
    case "missing_evidence":
      return "missing";
    case "not_applicable":
      return "not applicable";
    case "partially_supported":
    case "manual_review_needed":
      return "weak";
  }
}

function compareRuleIds(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true });
}

function evidenceText(result: MethodologyEvidenceAuditResult): string {
  return result.bestEvidenceQuote?.trim() || NO_PDD_EVIDENCE_TEXT;
}

function issueLabel(result: MethodologyEvidenceAuditResult): string {
  switch (result.status) {
    case "supported_by_pdd":
      return "Current PDD support is usable for this rule.";
    case "not_applicable":
      return "Current PDD evidence supports a not-applicable conclusion.";
    case "missing_evidence":
      return "Current PDD support is missing for this rule.";
    case "manual_review_needed":
      return "Current PDD support is too unclear to classify confidently.";
    case "partially_supported":
      return "Current PDD support is present but incomplete.";
  }
}

function gapGuidance(result: MethodologyEvidenceAuditResult): string {
  if (result.status === "supported_by_pdd") return "";
  if (result.status === "not_applicable") {
    const clientAction = result.clientAction.trim();
    return /^(no client action required|keep scope basis clear\.?)$/i.test(clientAction) ? clientAction : "";
  }
  return result.gap.trim() || result.clientAction.trim();
}

function clientActionText(result: MethodologyEvidenceAuditResult): string {
  if (result.status === "supported_by_pdd") return "";
  if (result.status === "not_applicable") {
    const clientAction = result.clientAction.trim();
    return /^(no client action required|keep scope basis clear\.?)$/i.test(clientAction) ? clientAction : "";
  }
  return result.clientAction;
}
function toFinding(result: MethodologyEvidenceAuditResult): Vm0007GapReportFinding {
  return {
    ruleId: result.ruleId,
    title: result.title,
    status: toDisplayStatus(result.status),
    issue: issueLabel(result),
    currentPddEvidence: evidenceText(result),
    whyItMatters: result.assessmentReason,
    whatToAdd: clientActionText(result),
    section: result.section,
    page: result.page,
    confidence: result.confidence,
  };
}

function sortGapFindings(left: Vm0007GapReportFinding, right: Vm0007GapReportFinding): number {
  const severity = new Map<Vm0007GapReportDisplayStatus, number>([
    ["missing", 0],
    ["weak", 1],
    ["not applicable", 2],
    ["supported", 3],
  ]);
  const severityDiff = (severity.get(left.status) ?? 99) - (severity.get(right.status) ?? 99);
  if (severityDiff !== 0) return severityDiff;
  return compareRuleIds(left.ruleId, right.ruleId);
}

function makeHeadline(input: Vm0007GapReport["executiveSummary"]["totals"]): string {
  if (input.supported === 58) {
    return "The current audit output marks every VM0007 rule as supported, but evidence quality still requires manual review.";
  }
  if (input.needsClientAction === 0) {
    return "The current audit output supports most VM0007 rules, with remaining items limited to scope-based not-applicable decisions.";
  }
  if (input.supported >= input.needsClientAction) {
    return "The current audit output shows a usable base of support, but several VM0007 rules still need clearer project-specific evidence before review confidence improves.";
  }
  return "The current audit output still shows material evidence gaps across VM0007 and needs targeted project-team follow-up before review confidence improves.";
}

export function buildVm0007GapReport(input: Vm0007GapReportInput): Vm0007GapReport {
  const findings = input.audit.results.map(toFinding);
  const supported = findings.filter((finding) => finding.status === "supported");
  const weak = findings.filter((finding) => finding.status === "weak");
  const missing = findings.filter((finding) => finding.status === "missing");
  const notApplicable = findings.filter((finding) => finding.status === "not applicable");
  const needsClientAction = findings.filter((finding) =>
    finding.status === "weak" || finding.status === "missing",
  );

  const totals = {
    supported: supported.length,
    weak: weak.length,
    missing: missing.length,
    notApplicable: notApplicable.length,
    needsClientAction: needsClientAction.length,
  };

  const keySupportedFindings = supported
    .slice()
    .sort((left, right) => compareRuleIds(left.ruleId, right.ruleId))
    .slice(0, 10);

  const notApplicableRules = notApplicable
    .slice()
    .sort((left, right) => compareRuleIds(left.ruleId, right.ruleId));

  const mainEvidenceGaps = needsClientAction
    .slice()
    .sort(sortGapFindings);

  return {
    reportId: input.reportId,
    generatedAt: input.generatedAt,
    reportName: "Internal VM0007 Gap Report Preview",
    statementOfCoverage: `${input.audit.totalRules} VM0007 rules assessed for validation readiness.`,
    limitationBanner: "Internal preview only. This report shows current audit output and has not been manually reviewed.",
    executiveSummary: {
      headline: makeHeadline(totals),
      allSupportedWarning:
        totals.supported === input.audit.totalRules
          ? "All rules are currently marked supported. Review evidence quality before relying on this result."
          : null,
      totals,
      highlights: [
        `${totals.supported} rules currently show supported PDD evidence.`,
        `${totals.weak} rules show weak support and need clearer project-specific detail.`,
        `${totals.missing} rules do not yet show the required evidence in the current PDD.`,
        `${totals.notApplicable} rules are treated as not applicable only where the PDD itself supports that conclusion.`,
      ],
      limitations: [
        "This preview summarizes current PDD support and evidence gaps for internal project-team follow-up.",
        "Evidence quotes are limited to the audit results already selected by the existing VM0007 evidence audit.",
        "Supported outcomes may still rely on broad methodology or project-description text and should be reviewed before reuse.",
      ],
    },
    projectSnapshot: input.project,
    methodologyScope: {
      code: input.methodology.code,
      version: input.methodology.version,
      name: input.methodology.name,
      scope: input.methodology.scope,
      summary: `${input.methodology.code}@${input.methodology.version} audit output rendered into an internal preview from the existing evidence audit.`,
      notes: [
        "The renderer uses existing VM0007 audit results only and does not rerun methodology logic.",
        "Status language is limited to supported, weak, missing, and not applicable.",
        "Weak and missing rules keep follow-up guidance from the audit output without changing the underlying audit logic.",
      ],
    },
    keySupportedFindings,
    notApplicableRules,
    mainEvidenceGaps,
    clientActionList: mainEvidenceGaps,
    fullRuleAuditTable: input.audit.results
      .slice()
      .sort((left, right) => compareRuleIds(left.ruleId, right.ruleId))
      .map((result) => ({
        ruleId: result.ruleId,
        title: result.title,
        status: toDisplayStatus(result.status),
        section: result.section ?? "Section not identified",
        evidenceSummary: evidenceText(result),
        gapGuidance: gapGuidance(result),
        clientAction: clientActionText(result),
      })),
    evidenceAppendix: input.audit.results
      .slice()
      .sort((left, right) => compareRuleIds(left.ruleId, right.ruleId))
      .map((result) => ({
        ruleId: result.ruleId,
        title: result.title,
        quote: evidenceText(result),
        section: result.section ?? "Section not identified",
        page: result.page,
        reasonSelected: result.reasonSelected,
      })),
  };
}

export { NO_PDD_EVIDENCE_TEXT };
