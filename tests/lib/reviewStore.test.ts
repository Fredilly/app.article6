import { beforeEach, describe, expect, it } from "@jest/globals";
import {
  addEvidenceAttachment,
  checkFinalizeGate,
  getReview,
  getReviewProgress,
  saveReview,
  removeEvidenceAttachment,
  type RuleReview,
} from "@/lib/verify/reviewStore";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

const baseReview: RuleReview = {
  ruleId: "R-1",
  methodology: "AR-ACM0003",
  version: "v02-0",
  status: "verified",
  rationale: "Rule is satisfied by the saved monitoring evidence.",
  supportReference: "Monitoring report section 3.2",
  evidenceLink: undefined,
  evidenceAttachments: [],
  reviewedBy: "local-reviewer",
  reviewedAt: "2026-04-16T00:00:00.000Z",
  updatedAt: "2026-04-16T00:00:00.000Z",
};

describe("reviewStore phase 2 helpers", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: localStorageMock,
      configurable: true,
      writable: true,
    });
    globalThis.localStorage.clear();
  });

  it("adds and removes evidence attachments on saved reviews", () => {
    saveReview(baseReview);

    const withAttachment = addEvidenceAttachment("R-1", "AR-ACM0003", "v02-0", {
      type: "reference",
      label: "Workbook tab A",
    });

    expect(withAttachment?.evidenceAttachments).toHaveLength(1);
    expect(withAttachment?.evidenceAttachments[0]?.label).toBe("Workbook tab A");

    const removed = removeEvidenceAttachment(
      "R-1",
      "AR-ACM0003",
      "v02-0",
      withAttachment?.evidenceAttachments[0]?.id ?? "",
    );

    expect(removed?.evidenceAttachments).toHaveLength(0);
  });

  it("calculates progress from non-pending reviews only", () => {
    saveReview(baseReview);
    saveReview({
      ...baseReview,
      ruleId: "R-2",
      status: "needs_followup",
      rationale: "Need more source support.",
      supportReference: "Open monitoring issue",
    });
    saveReview({
      ...baseReview,
      ruleId: "R-3",
      status: "pending",
      rationale: "",
      supportReference: "",
    });

    expect(getReview("R-3", "AR-ACM0003", "v02-0")?.status).toBe("pending");

    expect(getReviewProgress("AR-ACM0003", "v02-0", 4)).toEqual({
      total: 4,
      reviewed: 2,
      verified: 1,
      notVerified: 0,
      needsFollowup: 1,
      pending: 2,
      percentReviewed: 50,
    });
  });

  it("blocks finalize until every rule is non-pending and supported", () => {
    saveReview(baseReview);
    saveReview({
      ...baseReview,
      ruleId: "R-2",
      status: "pending",
      rationale: "",
      supportReference: "",
    });
    saveReview({
      ...baseReview,
      ruleId: "R-3",
      status: "not_verified",
      rationale: "",
      supportReference: "",
    });

    expect(checkFinalizeGate("AR-ACM0003", "v02-0", 3)).toEqual({
      canFinalize: false,
      reasons: [
        "1 rule still pending review",
        "Rule R-3: missing rationale",
        "Rule R-3: missing support reference",
      ],
    });
  });

  it("scopes reviews to the linked workspace when a workspace id is provided", () => {
    saveReview({ ...baseReview, workspaceId: "ws_alpha" });
    saveReview({ ...baseReview, ruleId: "R-2", workspaceId: "ws_beta" });

    expect(getReviewProgress("AR-ACM0003", "v02-0", 2, "ws_alpha")).toEqual({
      total: 2,
      reviewed: 1,
      verified: 1,
      notVerified: 0,
      needsFollowup: 0,
      pending: 1,
      percentReviewed: 50,
    });
    expect(getReviewProgress("AR-ACM0003", "v02-0", 2, "ws_beta")).toEqual({
      total: 2,
      reviewed: 1,
      verified: 1,
      notVerified: 0,
      needsFollowup: 0,
      pending: 1,
      percentReviewed: 50,
    });
  });

  it("blocks finalize when the review workspace is missing linked project or methodology context", () => {
    saveReview({ ...baseReview, workspaceId: "ws_alpha" });

    expect(
      checkFinalizeGate("AR-ACM0003", "v02-0", 1, {
        workspaceId: "ws_alpha",
        projectLinked: false,
        methodologyLinked: false,
      }),
    ).toEqual({
      canFinalize: false,
      reasons: [
        "Review workspace is not linked to a project",
        "Review workspace is missing a methodology version",
      ],
    });
  });
});
