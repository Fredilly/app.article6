import { describe, expect, test } from "@jest/globals";
import type { RequirementCoverageRow } from "@/app/m/_lib/requirementCoverage";
import { deriveRuleReadinessGaps } from "@/lib/readiness/gapEngine";

function makeRow(overrides: Partial<RequirementCoverageRow> = {}): RequirementCoverageRow {
  return {
    ruleId: "R-1",
    ruleSummary: {
      title: "Monitoring frequency",
      snippet: "Maintain a monitoring report.",
      when: [],
      tags: [],
    },
    provenance: {
      tools: [],
      citations: [],
    },
    expectedEvidenceTypes: [],
    linkedEvidence: [],
    candidateEvidence: [],
    status: "missing",
    ...overrides,
  };
}

describe("deriveRuleReadinessGaps", () => {
  test("marks fully linked expected evidence with a saved reviewer record as ready", () => {
    const gaps = deriveRuleReadinessGaps({
      rows: [
        makeRow({
          expectedEvidenceTypes: ["monitoring-report", "spreadsheet-workbook"],
          linkedEvidence: [
            { id: "ev-1", title: "Q1 monitoring report", type: "monitoring-report", source: "inventory" },
            { id: "ev-2", title: "Workbook tab A", type: "Workbook", source: "inventory" },
          ],
          status: "linked",
        }),
      ],
      reviewerArtifactsByRuleId: new Map([
        [
          "R-1",
          {
            savedAt: "2026-05-04T00:00:00Z",
            minutes: "Checked linked evidence.",
          },
        ],
      ]),
    });

    expect(gaps[0]).toMatchObject({
      ruleId: "R-1",
      state: "ready",
      severity: "none",
      baseState: "ready",
      baseSeverity: "none",
      missingExpectedEvidenceTypes: [],
    });
    expect(gaps[0]?.recommendations.map((item) => item.code)).toEqual(["ready_for_review"]);
  });

  test("marks missing expected evidence as high severity when nothing is linked", () => {
    const gaps = deriveRuleReadinessGaps({
      rows: [
        makeRow({
          expectedEvidenceTypes: ["monitoring-report", "spreadsheet-workbook"],
          candidateEvidence: [{ id: "cand-1", title: "Workbook group", type: "calculation_table", source: "inventory" }],
        }),
      ],
    });

    expect(gaps[0]).toMatchObject({
      state: "not_started",
      severity: "high",
      missingExpectedEvidenceTypes: ["monitoring-report", "spreadsheet-workbook"],
    });
    expect(gaps[0]?.recommendations.map((item) => item.code)).toEqual([
      "link_expected_evidence",
      "review_candidate_evidence",
    ]);
  });

  test("marks partially satisfied expectations as missing evidence", () => {
    const gaps = deriveRuleReadinessGaps({
      rows: [
        makeRow({
          expectedEvidenceTypes: ["monitoring-report", "spreadsheet-workbook"],
          linkedEvidence: [{ id: "ev-1", title: "Q1 monitoring report", type: "monitoring-report", source: "inventory" }],
          status: "partial",
        }),
      ],
    });

    expect(gaps[0]).toMatchObject({
      state: "missing_evidence",
      severity: "medium",
      missingExpectedEvidenceTypes: ["spreadsheet-workbook"],
    });
    expect(gaps[0]?.summary).toContain("Spreadsheet workbook");
  });

  test("marks linked evidence without a reviewer record as missing reviewer record when expectations are satisfied", () => {
    const gaps = deriveRuleReadinessGaps({
      rows: [
        makeRow({
          expectedEvidenceTypes: ["monitoring-report"],
          linkedEvidence: [{ id: "ev-1", title: "Q1 monitoring report", type: "monitoring-report", source: "inventory" }],
          status: "partial",
        }),
      ],
    });

    expect(gaps[0]).toMatchObject({
      state: "missing_reviewer_record",
      severity: "medium",
      missingExpectedEvidenceTypes: [],
    });
    expect(gaps[0]?.recommendations.map((item) => item.code)).toContain("save_reviewer_record");
  });

  test("treats linked evidence without methodology expectations as unknown expectation", () => {
    const gaps = deriveRuleReadinessGaps({
      rows: [
        makeRow({
          ruleId: "R-2",
          linkedEvidence: [{ id: "ev-1", title: "Boundary map", type: "STAC item", source: "inventory" }],
          candidateEvidence: [{ id: "cand-1", title: "Workbook group", type: "calculation_table", source: "inventory" }],
          status: "partial",
        }),
      ],
    });

    expect(gaps[0]).toMatchObject({
      ruleId: "R-2",
      state: "unknown_expectation",
      severity: "low",
    });
    expect(gaps[0]?.recommendations.map((item) => item.code)).toEqual([
      "review_candidate_evidence",
      "define_expected_evidence",
    ]);
  });

  test("treats unsaved reviewer judgment on no-expectation rules as needs review", () => {
    const gaps = deriveRuleReadinessGaps({
      rows: [
        makeRow({
          ruleId: "R-3",
          linkedEvidence: [{ id: "ev-1", title: "Boundary map", type: "STAC item", source: "inventory" }],
          status: "partial",
        }),
      ],
      reviewerArtifactsByRuleId: new Map([
        [
          "R-3",
          {
            minutes: "",
            outcomeNote: "",
          },
        ],
      ]),
      overridesByRuleId: new Map([
        [
          "R-3",
          {
            state: "needs_review",
            severity: "medium",
            reason: "Reviewer wants to keep this open until expectations are confirmed.",
            reviewer: "Verifier A",
            updatedAt: "2026-05-04T00:00:00Z",
          },
        ],
      ]),
    });

    expect(gaps[0]).toMatchObject({
      state: "needs_review",
      severity: "medium",
      baseState: "unknown_expectation",
      override: {
        state: "needs_review",
        severity: "medium",
        reason: "Reviewer wants to keep this open until expectations are confirmed.",
        reviewer: "Verifier A",
      },
    });
    expect(gaps[0]?.recommendations.map((item) => item.code)).toContain("review_override");
  });
});
