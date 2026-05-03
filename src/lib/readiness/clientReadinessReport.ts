import { EXPECTED_EVIDENCE_LABELS } from "@/app/m/_lib/requirementCoverage";
import type { RequirementCoverageExpectedEvidenceType, RequirementCoverageLinkedEvidence } from "@/app/m/_lib/requirementCoverage";
import type { ReadinessGapSeverity, ReadinessGapState, RuleReadinessGap } from "@/lib/readiness/gapEngine";

export type ClientReadinessDocument = {
  id: string;
  label: string;
  type: string;
  note?: string;
};

export type ClientReadinessReportInput = {
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
    sector?: string;
  };
  suppliedDocuments?: ClientReadinessDocument[];
  missingDocuments?: ClientReadinessDocument[];
  readinessGaps: RuleReadinessGap[];
};

export type ClientReadinessRuleFindingCategory =
  | "ready_for_readiness_review"
  | "missing_evidence"
  | "clarification_needed"
  | "reviewer_judgment_needed"
  | "unknown_or_not_assessable"
  | "not_started";

export type ClientReadinessRuleFinding = {
  ruleId: string;
  ruleTitle: string;
  state: ReadinessGapState;
  severity: ReadinessGapSeverity;
  category: ClientReadinessRuleFindingCategory;
  assessment: string;
  linkedEvidenceCount: number;
  missingExpectedEvidence: string[];
  nextActions: string[];
};

export type ClientReadinessOpenFinding = {
  ruleId: string;
  ruleTitle: string;
  severity: ReadinessGapSeverity;
  assessment: string;
  nextActions: string[];
};

export type ClientReadinessEvidenceChecklistItem = {
  ruleId: string;
  ruleTitle: string;
  expectedEvidence: string[];
  linkedEvidence: string[];
  missingEvidence: string[];
  status: ReadinessGapState;
};

export type ClientReadinessCorrectiveAction = {
  ruleId: string;
  ruleTitle: string;
  priority: ReadinessGapSeverity;
  action: string;
  basis: string;
};

export type ClientReadinessReport = {
  reportId: string;
  executiveReadinessSummary: {
    readinessPosition: "early" | "mixed" | "advanced";
    headline: string;
    totals: {
      rules: number;
      ready: number;
      missingEvidence: number;
      clarificationNeeded: number;
      reviewerJudgmentNeeded: number;
      unknownOrNotAssessable: number;
      notStarted: number;
    };
    highlights: string[];
    limitations: string[];
  };
  scopeCriteriaAndLimits: {
    reportPurpose: string;
    criteriaBasis: string[];
    scopeSummary: string;
    limitations: string[];
  };
  projectAndMethodologyContext: {
    projectName: string;
    projectId?: string;
    proponent?: string;
    region?: string;
    projectDescription?: string;
    methodologyCode: string;
    methodologyVersion: string;
    methodologyName?: string;
    sector?: string;
  };
  documentsReviewed: {
    suppliedDocuments: ClientReadinessDocument[];
    missingDocuments: ClientReadinessDocument[];
    reviewedEvidence: Array<{
      id: string;
      label: string;
      type: string;
      source: string;
      linkedRuleIds: string[];
    }>;
  };
  readinessAssessmentApproach: {
    approachSummary: string;
    stateInterpretation: Array<{
      state: ReadinessGapState;
      meaning: string;
    }>;
    evidencePolicy: string;
    reviewerJudgmentPolicy: string;
  };
  ruleFindingsMatrix: ClientReadinessRuleFinding[];
  openFindings: {
    missingEvidence: ClientReadinessOpenFinding[];
    clarificationNeeded: ClientReadinessOpenFinding[];
    reviewerJudgmentNeeded: ClientReadinessOpenFinding[];
    unknownOrNotAssessable: ClientReadinessOpenFinding[];
  };
  evidenceChecklist: {
    items: ClientReadinessEvidenceChecklistItem[];
  };
  recommendedCorrectiveActions: {
    items: ClientReadinessCorrectiveAction[];
  };
  technicalAppendix: {
    generatedAt: string;
    disclaimers: string[];
    stateDefinitions: Array<{
      state: ReadinessGapState;
      description: string;
    }>;
    evidenceReferenceIndex: Array<{
      id: string;
      label: string;
      type: string;
      source: string;
      linkedRuleIds: string[];
    }>;
  };
};

const READINESS_STATES: ReadinessGapState[] = [
  "ready",
  "missing_evidence",
  "missing_reviewer_record",
  "needs_review",
  "unknown_expectation",
  "not_started",
];

function expectedEvidenceLabel(type: RequirementCoverageExpectedEvidenceType): string {
  return EXPECTED_EVIDENCE_LABELS[type] ?? type;
}

function findingCategoryForGap(gap: RuleReadinessGap): ClientReadinessRuleFindingCategory {
  switch (gap.state) {
    case "ready":
      return "ready_for_readiness_review";
    case "missing_evidence":
      return "missing_evidence";
    case "missing_reviewer_record":
      return "reviewer_judgment_needed";
    case "needs_review":
      return "clarification_needed";
    case "unknown_expectation":
      return "unknown_or_not_assessable";
    case "not_started":
      return "not_started";
  }
}

function findingAssessment(gap: RuleReadinessGap): string {
  switch (gap.state) {
    case "ready":
      return "Available evidence and reviewer records support a readiness conclusion for this rule.";
    case "missing_evidence":
      return "Expected evidence is incomplete, so readiness cannot yet be supported for this rule.";
    case "missing_reviewer_record":
      return "Evidence is linked, but reviewer judgment has not been recorded clearly enough to support this rule.";
    case "needs_review":
      return "The current record needs reviewer clarification before this rule can be relied on in a readiness report.";
    case "unknown_expectation":
      return "Encoded methodology expectations are not specific enough to assess this rule consistently yet.";
    case "not_started":
      return "The rule has not started from a readiness perspective because expected evidence has not been linked.";
  }
}

function stateMeaning(state: ReadinessGapState): string {
  switch (state) {
    case "ready":
      return "Evidence and reviewer record are sufficient for a readiness assessment at rule level.";
    case "needs_review":
      return "The rule needs clarification before a stable readiness conclusion can be presented.";
    case "missing_evidence":
      return "Expected evidence is partly or wholly absent.";
    case "missing_reviewer_record":
      return "Evidence exists, but reviewer rationale or minutes are still missing.";
    case "not_started":
      return "No linked evidence has been assembled against the encoded expectation.";
    case "unknown_expectation":
      return "The methodology expectation is not yet specific enough to assess the rule consistently.";
  }
}

function readinessPositionFromGaps(gaps: RuleReadinessGap[]): "early" | "mixed" | "advanced" {
  if (!gaps.length) return "early";
  const readyCount = gaps.filter((gap) => gap.state === "ready").length;
  if (readyCount === 0) return "early";
  if (readyCount === gaps.length) return "advanced";
  return "mixed";
}

function headlineForPosition(position: "early" | "mixed" | "advanced", gaps: RuleReadinessGap[]): string {
  const methodLabel = gaps.length === 1 ? "rule" : "rules";
  if (position === "advanced") return `Readiness support is comparatively advanced across ${gaps.length} assessed ${methodLabel}, subject to the limitations below.`;
  if (position === "mixed") return `Readiness evidence is mixed across ${gaps.length} assessed ${methodLabel}, with open items that still require follow-up.`;
  return `Readiness support remains early-stage across ${gaps.length} assessed ${methodLabel}, with core evidence and reviewer records still incomplete.`;
}

function uniqueEvidenceIndex(gaps: RuleReadinessGap[]): ClientReadinessReport["documentsReviewed"]["reviewedEvidence"] {
  const byId = new Map<string, ClientReadinessReport["documentsReviewed"]["reviewedEvidence"][number]>();
  for (const gap of gaps) {
    for (const evidence of gap.linkedEvidence) {
      const existing = byId.get(evidence.id);
      if (existing) {
        if (!existing.linkedRuleIds.includes(gap.ruleId)) existing.linkedRuleIds.push(gap.ruleId);
        continue;
      }
      byId.set(evidence.id, {
        id: evidence.id,
        label: evidenceLabel(evidence),
        type: evidence.type,
        source: evidence.source,
        linkedRuleIds: [gap.ruleId],
      });
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
}

function evidenceLabel(evidence: RequirementCoverageLinkedEvidence): string {
  return evidence.title?.trim() || evidence.fragmentLabel?.trim() || evidence.documentLabel?.trim() || evidence.id;
}

function recommendationTexts(gap: RuleReadinessGap): string[] {
  return gap.recommendations.map((item) => item.label);
}

function openFindingFromGap(gap: RuleReadinessGap): ClientReadinessOpenFinding {
  return {
    ruleId: gap.ruleId,
    ruleTitle: gap.title,
    severity: gap.severity,
    assessment: findingAssessment(gap),
    nextActions: recommendationTexts(gap),
  };
}

function correctiveActionFromGap(gap: RuleReadinessGap): ClientReadinessCorrectiveAction | null {
  if (gap.state === "ready") return null;
  return {
    ruleId: gap.ruleId,
    ruleTitle: gap.title,
    priority: gap.severity,
    action: recommendationTexts(gap).join("; ") || "Review this rule and update the readiness record.",
    basis: findingAssessment(gap),
  };
}

export function buildClientReadinessReport(input: ClientReadinessReportInput): ClientReadinessReport {
  const gaps = [...input.readinessGaps].sort((a, b) => a.ruleId.localeCompare(b.ruleId));
  const reviewedEvidence = uniqueEvidenceIndex(gaps);
  const totals = {
    rules: gaps.length,
    ready: gaps.filter((gap) => gap.state === "ready").length,
    missingEvidence: gaps.filter((gap) => gap.state === "missing_evidence" || gap.state === "not_started").length,
    clarificationNeeded: gaps.filter((gap) => gap.state === "needs_review").length,
    reviewerJudgmentNeeded: gaps.filter((gap) => gap.state === "missing_reviewer_record").length,
    unknownOrNotAssessable: gaps.filter((gap) => gap.state === "unknown_expectation").length,
    notStarted: gaps.filter((gap) => gap.state === "not_started").length,
  };
  const readinessPosition = readinessPositionFromGaps(gaps);
  const highlights = [
    `${totals.ready} rule${totals.ready === 1 ? "" : "s"} are currently supported for readiness review.`,
    `${totals.missingEvidence} rule${totals.missingEvidence === 1 ? "" : "s"} still lack required evidence linkage or document support.`,
    `${totals.reviewerJudgmentNeeded} rule${totals.reviewerJudgmentNeeded === 1 ? "" : "s"} still need clearer reviewer judgment records.`,
    `${totals.unknownOrNotAssessable} rule${totals.unknownOrNotAssessable === 1 ? "" : "s"} remain not assessable because encoded expectations are still incomplete.`,
  ];

  return {
    reportId: input.reportId,
    executiveReadinessSummary: {
      readinessPosition,
      headline: headlineForPosition(readinessPosition, gaps),
      totals,
      highlights,
      limitations: [
        "This contract supports a pre-verification readiness assessment only.",
        "It does not express a formal opinion, registry outcome, issuance outcome, or quantified credit claim.",
        "Rules marked as unknown or not assessable depend on future expectation encoding or reviewer clarification.",
      ],
    },
    scopeCriteriaAndLimits: {
      reportPurpose: "Assess whether project evidence, reviewer records, and encoded methodology expectations are sufficiently assembled for a client readiness review.",
      criteriaBasis: [
        "Encoded methodology expectations available in the app at the time of report generation",
        "Linked project evidence and reviewer records available in the current workspace",
        "Rule-level readiness-gap derivation outputs",
      ],
      scopeSummary: `Assessment scope covers ${input.methodology.code}@${input.methodology.version} for project readiness review preparation, not a final assurance conclusion.`,
      limitations: [
        "Supplied materials may be incomplete or still awaiting client clarification.",
        "Readiness states depend on currently linked evidence and may change as more evidence is attached.",
        "Reviewer-facing rendering and export formatting are outside this contract and may summarize these sections differently later.",
      ],
    },
    projectAndMethodologyContext: {
      projectName: input.project.name,
      projectId: input.project.projectId,
      proponent: input.project.proponent,
      region: input.project.region,
      projectDescription: input.project.description,
      methodologyCode: input.methodology.code,
      methodologyVersion: input.methodology.version,
      methodologyName: input.methodology.name,
      sector: input.methodology.sector,
    },
    documentsReviewed: {
      suppliedDocuments: [...(input.suppliedDocuments ?? [])],
      missingDocuments: [...(input.missingDocuments ?? [])],
      reviewedEvidence,
    },
    readinessAssessmentApproach: {
      approachSummary: "The readiness assessment reviews rule-level evidence coverage, missing expected evidence, reviewer record completeness, and encoded expectation quality before any client-facing export is rendered.",
      stateInterpretation: READINESS_STATES.map((state) => ({
        state,
        meaning: stateMeaning(state),
      })),
      evidencePolicy: "Supplied documents, linked evidence, and candidate evidence are distinguished so the report can show what was actually reviewed versus what is still absent.",
      reviewerJudgmentPolicy: "Rules that still depend on reviewer rationale or minutes remain open even when evidence is already linked.",
    },
    ruleFindingsMatrix: gaps.map((gap) => ({
      ruleId: gap.ruleId,
      ruleTitle: gap.title,
      state: gap.state,
      severity: gap.severity,
      category: findingCategoryForGap(gap),
      assessment: findingAssessment(gap),
      linkedEvidenceCount: gap.linkedEvidence.length,
      missingExpectedEvidence: gap.missingExpectedEvidenceTypes.map(expectedEvidenceLabel),
      nextActions: recommendationTexts(gap),
    })),
    openFindings: {
      missingEvidence: gaps
        .filter((gap) => gap.state === "missing_evidence" || gap.state === "not_started")
        .map(openFindingFromGap),
      clarificationNeeded: gaps.filter((gap) => gap.state === "needs_review").map(openFindingFromGap),
      reviewerJudgmentNeeded: gaps.filter((gap) => gap.state === "missing_reviewer_record").map(openFindingFromGap),
      unknownOrNotAssessable: gaps.filter((gap) => gap.state === "unknown_expectation").map(openFindingFromGap),
    },
    evidenceChecklist: {
      items: gaps.map((gap) => ({
        ruleId: gap.ruleId,
        ruleTitle: gap.title,
        expectedEvidence: gap.expectedEvidenceTypes.map(expectedEvidenceLabel),
        linkedEvidence: gap.linkedEvidence.map(evidenceLabel),
        missingEvidence: gap.missingExpectedEvidenceTypes.map(expectedEvidenceLabel),
        status: gap.state,
      })),
    },
    recommendedCorrectiveActions: {
      items: gaps.map(correctiveActionFromGap).filter((item): item is ClientReadinessCorrectiveAction => item !== null),
    },
    technicalAppendix: {
      generatedAt: input.generatedAt,
      disclaimers: [
        "This readiness report contract is designed for later HTML or PDF rendering.",
        "It is intentionally structured to resemble a VVB-style assessment layout without presenting a verifier conclusion.",
        "All findings remain subject to additional evidence linkage, reviewer clarification, and export-surface presentation decisions.",
      ],
      stateDefinitions: READINESS_STATES.map((state) => ({
        state,
        description: stateMeaning(state),
      })),
      evidenceReferenceIndex: reviewedEvidence,
    },
  };
}
