import type { RuleSummary } from "@/app/m/_lib/methodRules";
import {
  buildRequirementCoverageRows,
  type RequirementCoverageRow,
  type RequirementCoverageStatus,
} from "@/app/m/_lib/requirementCoverage";
import { buildClientReadinessReport } from "@/lib/readiness/clientReadinessReport";
import {
  deriveRuleReadinessGaps,
  type RuleReadinessGap,
} from "@/lib/readiness/gapEngine";
import type { Project, RuleReview } from "@/lib/projects/types";

export type ProjectReadinessSummaryItem = {
  ruleId: string;
  title: string;
  state: RuleReadinessGap["state"];
  severity: RuleReadinessGap["severity"];
  summary: string;
  recommendedFix: string;
};

export type ProjectReadinessSummary = {
  reportId: string;
  uploadedEvidenceCount: number;
  assessedRuleCount: number;
  topItems: ProjectReadinessSummaryItem[];
  methodologyReferences: Array<{
    ruleId: string;
    title: string;
  }>;
  recommendedNextAction: string;
  readinessGaps: RuleReadinessGap[];
  report: ReturnType<typeof buildClientReadinessReport>;
};

type ProjectLinkedEvidenceInput = {
  id: string;
  title: string;
  type: string;
  source: "inventory";
  evidenceId: string;
};

function reviewStatusToCoverageStatus(review: RuleReview): RequirementCoverageStatus {
  switch (review.status) {
    case "verified":
      return "linked";
    case "gap":
      return review.evidenceIds.length > 0 ? "needs-review" : "missing";
    case "in-progress":
      return "partial";
    case "not-applicable":
      return "linked";
    case "not-started":
    default:
      return "missing";
  }
}

function reviewToLinkedEvidence(review: RuleReview): ProjectLinkedEvidenceInput[] {
  return review.evidenceIds.map((evidenceId) => ({
    id: evidenceId,
    title: evidenceId,
    type: "project-evidence",
    source: "inventory",
    evidenceId,
  }));
}

function createRows(project: Project, rules: RuleSummary[]): RequirementCoverageRow[] {
  const reviewsByRuleId = new Map(project.reviews.map((review) => [review.ruleId, review]));
  const linkedEvidenceByRuleId = new Map<string, ProjectLinkedEvidenceInput[]>();
  const statusesByRuleId = new Map<string, RequirementCoverageStatus>();

  for (const review of project.reviews) {
    if (review.status === "not-applicable") continue;
    linkedEvidenceByRuleId.set(review.ruleId, reviewToLinkedEvidence(review));
    statusesByRuleId.set(review.ruleId, reviewStatusToCoverageStatus(review));
  }

  return buildRequirementCoverageRows({
    rules: rules
      .filter((rule) => {
        const review = reviewsByRuleId.get(rule.id);
        return !review || review.status !== "not-applicable";
      })
      .map((rule) => ({
        id: rule.id,
        title: rule.title,
        snippet: rule.snippet,
        text: rule.text,
        summary: rule.summary,
        logic: rule.logic,
        notes: rule.notes,
        when: rule.when,
        expectedEvidence: rule.expectedEvidence,
        type: rule.type,
        tags: rule.tags,
        sectionId: rule.sectionId,
        anchor: rule.anchor,
        refs: rule.refs
          ? {
              primarySection: rule.refs.primarySection,
              sectionAnchor: rule.refs.sectionAnchor,
              sectionStableId: rule.refs.sectionStableId,
              tools: rule.refs.tools,
            }
          : undefined,
        citations: rule.citations,
      })),
    linkedEvidenceByRuleId,
    statusesByRuleId,
  });
}

function sortGapPriority(left: RuleReadinessGap, right: RuleReadinessGap): number {
  const severityRank: Record<RuleReadinessGap["severity"], number> = {
    high: 0,
    medium: 1,
    low: 2,
    none: 3,
  };
  const stateRank: Record<RuleReadinessGap["state"], number> = {
    missing_evidence: 0,
    not_started: 1,
    needs_review: 2,
    missing_reviewer_record: 3,
    unknown_expectation: 4,
    ready: 5,
  };
  return (
    severityRank[left.severity] - severityRank[right.severity] ||
    stateRank[left.state] - stateRank[right.state] ||
    left.ruleId.localeCompare(right.ruleId)
  );
}

function summarizeTopItems(gaps: RuleReadinessGap[]): ProjectReadinessSummaryItem[] {
  return gaps
    .filter((gap) => gap.state !== "ready")
    .sort(sortGapPriority)
    .slice(0, 3)
    .map((gap) => ({
      ruleId: gap.ruleId,
      title: gap.title,
      state: gap.state,
      severity: gap.severity,
      summary: gap.summary,
      recommendedFix:
        gap.recommendations[0]?.detail ??
        "Needs follow-up before this rule can support a readiness conclusion.",
    }));
}

export function buildProjectReadinessSummary(input: {
  project: Project;
  rules: RuleSummary[];
  generatedAt?: string;
}): ProjectReadinessSummary {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const rows = createRows(input.project, input.rules);
  const reviewerArtifactsByRuleId = new Map(
    input.project.reviews
      .filter((review) => review.status !== "not-started" && review.status !== "not-applicable")
      .map((review) => [
        review.ruleId,
        {
          savedAt: review.reviewedAt ?? generatedAt,
          outcomeNote: review.note ?? null,
        },
      ]),
  );

  const readinessGaps = deriveRuleReadinessGaps({
    rows,
    reviewerArtifactsByRuleId,
  });
  const topItems = summarizeTopItems(readinessGaps);
  const reportId = `dev-readiness-${input.project.id}`;
  const report = buildClientReadinessReport({
    reportId,
    generatedAt,
    project: {
      name: input.project.name,
      projectId: input.project.projectCode,
      proponent: input.project.proponent,
      region: input.project.countryLocation,
      description:
        input.project.description ??
        "Pre-verification readiness summary generated from the project workspace.",
    },
    methodology: {
      code: input.project.methodCode ?? "unknown-method",
      version: input.project.methodVersion ?? "unknown-version",
      name: input.project.methodology,
      sector: input.project.methodCategory,
    },
    suppliedDocuments: input.project.documents.map((document) => ({
      id: document.id,
      label: document.fileName,
      type: document.mimeType,
      note: document.manualFindingExtractionMessage,
    })),
    readinessGaps,
  });

  return {
    reportId,
    uploadedEvidenceCount: input.project.documents.length,
    assessedRuleCount: rows.length,
    topItems,
    methodologyReferences: input.rules.slice(0, 6).map((rule) => ({
      ruleId: rule.id,
      title: rule.title,
    })),
    recommendedNextAction:
      topItems[0]?.recommendedFix ??
      "Export the readiness gap report and review the remaining rule references.",
    readinessGaps,
    report,
  };
}
