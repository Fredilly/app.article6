import {
  EXPECTED_EVIDENCE_LABELS,
  summarizeExpectedEvidence,
  type RequirementCoverageExpectedEvidenceType,
  type RequirementCoverageLinkedEvidence,
  type RequirementCoverageRow,
} from "@/app/m/_lib/requirementCoverage";
import type { ReviewCandidateEvidence, RuleReview } from "@/lib/verify/reviewStore";

type PopulateDraftReviewsInput = {
  methodology: string;
  version: string;
  rows: RequirementCoverageRow[];
  now?: string;
};

function candidateEvidenceLabel(items: RequirementCoverageLinkedEvidence[]): string {
  return items.slice(0, 3).map((item) => item.title).join(", ");
}

function mergeCandidates(
  candidateEvidence: RequirementCoverageLinkedEvidence[],
  linkedEvidence: RequirementCoverageLinkedEvidence[],
): RequirementCoverageLinkedEvidence[] {
  const byId = new Map<string, RequirementCoverageLinkedEvidence>();
  for (const item of [...candidateEvidence, ...linkedEvidence]) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  return Array.from(byId.values());
}

function buildDraftSummary(input: {
  expectedEvidenceTypes: RequirementCoverageExpectedEvidenceType[];
  candidateEvidence: RequirementCoverageLinkedEvidence[];
}): string {
  const expectedSummary = summarizeExpectedEvidence(input.expectedEvidenceTypes);
  if (!input.candidateEvidence.length) {
    return input.expectedEvidenceTypes.length
      ? `Draft initializer only. Needs reviewer confirmation. No candidate evidence found yet. Expected evidence: ${expectedSummary}. Next step: add or link ${expectedSummary}.`
      : "Draft initializer only. Needs reviewer confirmation. No candidate evidence found and no methodology-owned expected evidence is defined for this rule.";
  }

  const candidateSummary = candidateEvidenceLabel(input.candidateEvidence);
  return input.expectedEvidenceTypes.length
    ? `Draft initializer only. Needs reviewer confirmation. Candidate evidence found: ${candidateSummary}. Expected evidence: ${expectedSummary}.`
    : `Draft initializer only. Needs reviewer confirmation. Candidate evidence found: ${candidateSummary}. No methodology-owned expected evidence is defined for this rule.`;
}

function toReviewCandidates(items: RequirementCoverageLinkedEvidence[]): ReviewCandidateEvidence[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    type: item.type,
    source: item.source,
    provenanceSummary: item.provenanceSummary,
    excerpt: item.excerpt,
    documentLabel: item.documentLabel,
  }));
}

export function populateDraftReviewsFromEvidence(input: PopulateDraftReviewsInput): RuleReview[] {
  const now = input.now ?? new Date().toISOString();
  return [...input.rows]
    .sort((a, b) => a.ruleId.localeCompare(b.ruleId))
    .map((row) => {
      const candidateEvidence = row.candidateEvidence ?? [];
      const linkedEvidence = row.linkedEvidence ?? [];
      const combinedCandidates = mergeCandidates(candidateEvidence, linkedEvidence);
      const summary = buildDraftSummary({
        expectedEvidenceTypes: row.expectedEvidenceTypes,
        candidateEvidence: combinedCandidates,
      });

      const expectedEvidenceLine = row.expectedEvidenceTypes.length
        ? `Expected evidence: ${row.expectedEvidenceTypes.map((type) => EXPECTED_EVIDENCE_LABELS[type] ?? type).join(", ")}.`
        : "No methodology-owned expected evidence is defined for this rule.";
      const candidateEvidenceLine = combinedCandidates.length
        ? `Candidate evidence only: ${candidateEvidenceLabel(combinedCandidates)}. Reviewer must confirm or reject each suggestion manually.`
        : row.expectedEvidenceTypes.length
          ? `No candidate evidence found. Next step: add or link ${row.expectedEvidenceTypes.map((type) => EXPECTED_EVIDENCE_LABELS[type] ?? type).join(", ")}.`
          : "No candidate evidence found. Reviewer must add or link supporting evidence manually.";

      return {
        ruleId: row.ruleId,
        methodology: input.methodology,
        version: input.version,
        status: "pending",
        rationale: `${summary} ${expectedEvidenceLine} ${candidateEvidenceLine}`.trim(),
        supportReference: "",
        evidenceLink: undefined,
        evidenceAttachments: [],
        reviewedBy: "",
        reviewedAt: now,
        updatedAt: now,
        draftSource: "populate_from_evidence",
        draftState: "needs_reviewer_confirmation",
        draftSummary: summary,
        candidateEvidence: toReviewCandidates(combinedCandidates),
      } satisfies RuleReview;
    });
}
