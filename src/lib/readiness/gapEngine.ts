import type {
  RequirementCoverageExpectedEvidenceType,
  RequirementCoverageLinkedEvidence,
  RequirementCoverageRow,
} from "@/app/m/_lib/requirementCoverage";
import { EXPECTED_EVIDENCE_LABELS } from "@/app/m/_lib/requirementCoverage";
import { hasReviewerArtifact } from "@/lib/verify/runState";

export type ReadinessGapState =
  | "ready"
  | "needs_review"
  | "missing_evidence"
  | "missing_reviewer_record"
  | "not_started"
  | "unknown_expectation";

export type ReadinessGapSeverity = "none" | "low" | "medium" | "high";

export type ReadinessGapOverride = {
  state?: ReadinessGapState | null;
  severity?: ReadinessGapSeverity | null;
  reason: string;
  reviewer?: string | null;
  updatedAt?: string | null;
};

export type ReadinessGapRecommendationCode =
  | "link_expected_evidence"
  | "review_candidate_evidence"
  | "save_reviewer_record"
  | "define_expected_evidence"
  | "review_override"
  | "ready_for_review";

export type ReadinessGapRecommendation = {
  code: ReadinessGapRecommendationCode;
  label: string;
  detail: string;
};

export type RuleReadinessGap = {
  ruleId: string;
  title: string;
  state: ReadinessGapState;
  severity: ReadinessGapSeverity;
  summary: string;
  expectedEvidenceTypes: RequirementCoverageExpectedEvidenceType[];
  linkedEvidence: RequirementCoverageLinkedEvidence[];
  candidateEvidence: RequirementCoverageLinkedEvidence[];
  missingExpectedEvidenceTypes: RequirementCoverageExpectedEvidenceType[];
  recommendations: ReadinessGapRecommendation[];
  override: ReadinessGapOverride | null;
  baseState: ReadinessGapState;
  baseSeverity: ReadinessGapSeverity;
};

export type DeriveRuleReadinessGapsInput = {
  rows: RequirementCoverageRow[];
  reviewerArtifactsByRuleId?: Map<
    string,
    {
      savedAt?: string | null;
      minutes?: string | null;
      outcomeNote?: string | null;
    }
  >;
  overridesByRuleId?: Map<string, ReadinessGapOverride>;
};

function linkedEvidenceTypesForGap(item: RequirementCoverageLinkedEvidence): RequirementCoverageExpectedEvidenceType[] {
  const haystack = [
    item.type,
    item.title,
    item.documentLabel,
    item.provenanceSummary,
    item.fragmentLabel,
    item.sectionHeading,
    item.sectionLabel,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const matched = new Set<RequirementCoverageExpectedEvidenceType>();
  if (haystack.includes("monitoring-report") || haystack.includes("monitoring report")) matched.add("monitoring-report");
  if (haystack.includes("spreadsheet-workbook") || haystack.includes("spreadsheet workbook") || haystack.includes("workbook")) {
    matched.add("spreadsheet-workbook");
  }
  if (haystack.includes("calculation-support") || haystack.includes("calculation support") || haystack.includes("calculation")) {
    matched.add("calculation-support");
  }
  if (haystack.includes("pdd")) matched.add("pdd");
  if (haystack.includes("gis") || haystack.includes("stac") || haystack.includes("map evidence")) matched.add("gis");
  if (haystack.includes("qa/qc") || haystack.includes("qa-qc") || haystack.includes("qa qc")) matched.add("qa-qc-record");
  if (haystack.includes("eligibility")) matched.add("eligibility-proof");
  return Array.from(matched);
}

function missingExpectedEvidenceTypes(row: RequirementCoverageRow): RequirementCoverageExpectedEvidenceType[] {
  if (!row.expectedEvidenceTypes.length) return [];
  const satisfied = new Set<RequirementCoverageExpectedEvidenceType>();
  for (const item of row.linkedEvidence) {
    for (const matchedType of linkedEvidenceTypesForGap(item)) satisfied.add(matchedType);
  }
  return row.expectedEvidenceTypes.filter((type) => !satisfied.has(type));
}

function hasSavedReviewerRecord(input: {
  savedAt?: string | null;
  minutes?: string | null;
  outcomeNote?: string | null;
}): boolean {
  if (input.savedAt?.trim()) return true;
  return hasReviewerArtifact({ minutes: input.minutes, outcomeNote: input.outcomeNote });
}

function baseGapState(input: {
  row: RequirementCoverageRow;
  reviewerSaved: boolean;
  missingExpected: RequirementCoverageExpectedEvidenceType[];
}): ReadinessGapState {
  const { row, reviewerSaved, missingExpected } = input;
  if (!row.expectedEvidenceTypes.length) {
    if (row.linkedEvidence.length > 0 || row.candidateEvidence.length > 0) return "unknown_expectation";
    return "not_started";
  }
  if (!row.linkedEvidence.length) {
    return "not_started";
  }
  if (row.expectedEvidenceTypes.length > 0 && missingExpected.length > 0) return "missing_evidence";
  if (!reviewerSaved) {
    return "missing_reviewer_record";
  }
  return "ready";
}

function baseGapSeverity(input: {
  state: ReadinessGapState;
  row: RequirementCoverageRow;
  missingExpected: RequirementCoverageExpectedEvidenceType[];
}): ReadinessGapSeverity {
  const { state, row, missingExpected } = input;
  if (state === "ready") return "none";
  if (state === "unknown_expectation") return row.candidateEvidence.length > 0 || row.linkedEvidence.length > 0 ? "low" : "medium";
  if (state === "needs_review") return "medium";
  if (state === "missing_reviewer_record") return "medium";
  if (state === "not_started") return row.expectedEvidenceTypes.length > 0 ? "high" : "medium";
  if (missingExpected.length >= 2) return "high";
  return "medium";
}

function formatExpectedEvidenceTypes(types: RequirementCoverageExpectedEvidenceType[]): string {
  return types.map((type) => EXPECTED_EVIDENCE_LABELS[type] ?? type).join(", ");
}

function gapSummary(input: {
  state: ReadinessGapState;
  row: RequirementCoverageRow;
  missingExpected: RequirementCoverageExpectedEvidenceType[];
  reviewerSaved: boolean;
}): string {
  const { state, row, missingExpected, reviewerSaved } = input;
  if (state === "ready") return "Expected evidence is linked and reviewer record is saved.";
  if (state === "missing_reviewer_record") return "Expected evidence is linked, but the reviewer record is not saved yet.";
  if (state === "needs_review") return "Evidence is linked, but the rule still needs reviewer judgment.";
  if (state === "unknown_expectation") {
    if (row.candidateEvidence.length > 0) {
      return "Candidate evidence exists, but no methodology expectation is defined for this rule yet.";
    }
    return reviewerSaved
      ? "Reviewer record is saved, but no methodology expectation is defined for this rule yet."
      : "No methodology expectation is defined for this rule yet.";
  }
  if (state === "not_started") {
    if (row.expectedEvidenceTypes.length > 0) {
      return `No linked evidence yet. Expected: ${formatExpectedEvidenceTypes(row.expectedEvidenceTypes)}.`;
    }
    return "No linked evidence or reviewer record exists for this rule yet.";
  }
  const missingLabels = formatExpectedEvidenceTypes(missingExpected);
  return reviewerSaved
    ? `Some expected evidence is still missing: ${missingLabels}. Reviewer record is saved.`
    : `Some expected evidence is still missing: ${missingLabels}.`;
}

function recommendation(
  code: ReadinessGapRecommendationCode,
  label: string,
  detail: string,
): ReadinessGapRecommendation {
  return { code, label, detail };
}

function gapRecommendations(input: {
  state: ReadinessGapState;
  row: RequirementCoverageRow;
  missingExpected: RequirementCoverageExpectedEvidenceType[];
  override: ReadinessGapOverride | null;
}): ReadinessGapRecommendation[] {
  const { state, row, missingExpected, override } = input;
  const next: ReadinessGapRecommendation[] = [];
  if (state === "ready") {
    next.push(recommendation("ready_for_review", "Ready for review", "Expected evidence is linked and reviewer record is saved."));
  }
  if (state === "not_started" || state === "missing_evidence") {
    const detail = missingExpected.length
      ? `Link evidence that satisfies: ${formatExpectedEvidenceTypes(missingExpected)}.`
      : "Link evidence to start the rule review.";
    next.push(recommendation("link_expected_evidence", "Link expected evidence", detail));
  }
  if (row.candidateEvidence.length > 0 && (state === "not_started" || state === "unknown_expectation" || state === "missing_evidence")) {
    next.push(
      recommendation(
        "review_candidate_evidence",
        "Review candidate evidence",
        `${row.candidateEvidence.length} candidate evidence item${row.candidateEvidence.length === 1 ? "" : "s"} can be reviewed for linkage.`,
      ),
    );
  }
  if (state === "missing_reviewer_record" || state === "needs_review") {
    next.push(
      recommendation(
        "save_reviewer_record",
        "Save reviewer record",
        "Add reviewer minutes or an outcome note to explain the current rule status.",
      ),
    );
  }
  if (state === "unknown_expectation") {
    next.push(
      recommendation(
        "define_expected_evidence",
        "Define expected evidence",
        "Methodology expectations are not defined for this rule, so readiness can only be treated as reviewer judgment for now.",
      ),
    );
  }
  if (override) {
    next.push(
      recommendation(
        "review_override",
        "Review override",
        `Reviewer override applied: ${override.reason.trim()}`,
      ),
    );
  }
  return next;
}

function normalizeOverride(override: ReadinessGapOverride | undefined): ReadinessGapOverride | null {
  if (!override) return null;
  const reason = override.reason?.trim();
  if (!reason) return null;
  return {
    state: override.state ?? null,
    severity: override.severity ?? null,
    reason,
    reviewer: override.reviewer?.trim() || null,
    updatedAt: override.updatedAt?.trim() || null,
  };
}

export function deriveRuleReadinessGaps(input: DeriveRuleReadinessGapsInput): RuleReadinessGap[] {
  const reviewerArtifactsByRuleId = input.reviewerArtifactsByRuleId ?? new Map();
  const overridesByRuleId = input.overridesByRuleId ?? new Map();

  return [...input.rows]
    .map((row) => {
      const reviewer = reviewerArtifactsByRuleId.get(row.ruleId);
      const reviewerSaved = hasSavedReviewerRecord(reviewer ?? {});
      const missingExpected = missingExpectedEvidenceTypes(row);
      const baseState = baseGapState({ row, reviewerSaved, missingExpected });
      const baseSeverity = baseGapSeverity({ state: baseState, row, missingExpected });
      const override = normalizeOverride(overridesByRuleId.get(row.ruleId));
      const effectiveState = override?.state ?? baseState;
      const effectiveSeverity = override?.severity ?? baseSeverity;

      return {
        ruleId: row.ruleId,
        title: row.ruleSummary.title,
        state: effectiveState,
        severity: effectiveSeverity,
        summary: gapSummary({ state: baseState, row, missingExpected, reviewerSaved }),
        expectedEvidenceTypes: [...row.expectedEvidenceTypes],
        linkedEvidence: [...row.linkedEvidence],
        candidateEvidence: [...row.candidateEvidence],
        missingExpectedEvidenceTypes: missingExpected,
        recommendations: gapRecommendations({ state: effectiveState, row, missingExpected, override }),
        override,
        baseState,
        baseSeverity,
      } satisfies RuleReadinessGap;
    })
    .sort((a, b) => a.ruleId.localeCompare(b.ruleId));
}
