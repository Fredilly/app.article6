import { describe, expect, it } from "@jest/globals";
import type { RequirementCoverageRow } from "@/app/m/_lib/requirementCoverage";
import { populateDraftReviewsFromEvidence } from "@/lib/verify/populateFromEvidence";

const baseRow: RequirementCoverageRow = {
  ruleId: "R-1-0001",
  ruleSummary: {
    title: "Monitoring report coverage",
    snippet: "Submit the monitoring report for the reporting period.",
    when: [],
    tags: [],
  },
  provenance: {
    tools: [],
    citations: [],
  },
  expectedEvidenceTypes: ["monitoring-report"],
  linkedEvidence: [],
  candidateEvidence: [],
  status: "missing",
};

describe("populateDraftReviewsFromEvidence", () => {
  it("creates pending draft rows that require reviewer confirmation", () => {
    const drafts = populateDraftReviewsFromEvidence({
      methodology: "AR-ACM0003",
      version: "v02-0",
      now: "2026-05-04T13:00:00.000Z",
      rows: [
        {
          ...baseRow,
          candidateEvidence: [
            {
              id: "group-1",
              title: "Workbook A · Monitoring period table",
              type: "calculation_table",
              source: "inventory",
              provenanceSummary: "Workbook A · Sheet1 · A1:D8",
            },
          ],
        },
      ],
    });

    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      ruleId: "R-1-0001",
      status: "pending",
      draftSource: "populate_from_evidence",
      draftState: "needs_reviewer_confirmation",
      supportReference: "",
      reviewedBy: "",
    });
    expect(drafts[0]?.rationale).toContain("Draft initializer only. Needs reviewer confirmation.");
    expect(drafts[0]?.rationale).toContain("Candidate evidence only:");
    expect(drafts[0]?.candidateEvidence).toEqual([
      expect.objectContaining({
        id: "group-1",
        title: "Workbook A · Monitoring period table",
        source: "inventory",
      }),
    ]);
  });

  it("keeps rows with no candidate evidence in draft state and marks them explicitly", () => {
    const drafts = populateDraftReviewsFromEvidence({
      methodology: "AR-ACM0003",
      version: "v02-0",
      now: "2026-05-04T13:00:00.000Z",
      rows: [baseRow],
    });

    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.status).toBe("pending");
    expect(drafts[0]?.candidateEvidence).toEqual([]);
    expect(drafts[0]?.rationale).toContain("No candidate evidence found.");
    expect(drafts[0]?.rationale).toContain("Expected evidence: Monitoring report.");
    expect(drafts[0]?.rationale).toContain("Next step: add or link Monitoring report.");
    expect(drafts[0]?.rationale).not.toContain("Verified");
    expect(drafts[0]?.rationale).not.toContain("Supported");
  });
});
