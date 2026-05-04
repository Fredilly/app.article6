import { describe, expect, test } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import RuleReviewPanel, {
  draftMetadataForSave,
  populatedDraftNeedsReviewerConfirmation,
} from "@/components/verify/RuleReviewPanel";
import type { RuleReview } from "@/lib/verify/reviewStore";

function buildPopulatedDraft(overrides?: Partial<RuleReview>): RuleReview {
  return {
    ruleId: "R-1",
    methodology: "AR-ACM0003",
    version: "v02-0",
    status: "pending",
    rationale: "Draft initializer only. Needs reviewer confirmation before any judgment is recorded.",
    supportReference: "",
    evidenceAttachments: [],
    reviewedBy: "",
    reviewedAt: "2026-05-04T00:00:00Z",
    updatedAt: "2026-05-04T00:00:00Z",
    draftSource: "populate_from_evidence",
    draftState: "needs_reviewer_confirmation",
    draftSummary: "Draft initializer only. Needs reviewer confirmation before any judgment is recorded.",
    candidateEvidence: [
      {
        id: "inventory-1",
        title: "Monitoring report FY25",
        type: "monitoring-report",
        source: "inventory",
        provenanceSummary: "Imported from evidence inventory",
      },
    ],
    ...overrides,
  };
}

describe("RuleReviewPanel", () => {
  test("keeps populate-from-evidence confirmation metadata only while the review is still pending", () => {
    const draft = buildPopulatedDraft();

    expect(populatedDraftNeedsReviewerConfirmation(draft)).toBe(true);
    expect(draftMetadataForSave(draft, "pending")).toEqual({
      draftSource: "populate_from_evidence",
      draftState: "needs_reviewer_confirmation",
      draftSummary: "Draft initializer only. Needs reviewer confirmation before any judgment is recorded.",
      candidateEvidence: draft.candidateEvidence,
    });
    expect(draftMetadataForSave(draft, "verified")).toEqual({
      draftSource: "populate_from_evidence",
      draftState: undefined,
      draftSummary: undefined,
      candidateEvidence: draft.candidateEvidence,
    });
  });

  test("shows the draft banner only for pending populated drafts and avoids blank reviewed-by copy", () => {
    const pendingHtml = renderToStaticMarkup(
      <RuleReviewPanel
        ruleId="R-1"
        ruleText="Monitoring report must be available."
        methodology="AR-ACM0003"
        version="v02-0"
        existingReview={buildPopulatedDraft()}
        onSave={() => {}}
      />,
    );
    expect(pendingHtml).toContain("Draft initializer from evidence");
    expect(pendingHtml).toContain("Reviewer confirmation is still required");
    expect(pendingHtml).not.toContain("Reviewed by  ·");

    const completedHtml = renderToStaticMarkup(
      <RuleReviewPanel
        ruleId="R-1"
        ruleText="Monitoring report must be available."
        methodology="AR-ACM0003"
        version="v02-0"
        existingReview={buildPopulatedDraft({
          status: "verified",
          reviewedBy: "local-reviewer",
          draftState: undefined,
          draftSummary: undefined,
        })}
        onSave={() => {}}
      />,
    );
    expect(completedHtml).not.toContain("Draft initializer from evidence");
    expect(completedHtml).toContain("historical context only");
    expect(completedHtml).not.toContain("Reviewer confirmation is still required");
    expect(completedHtml).toContain("Reviewed by local-reviewer");
  });
});
