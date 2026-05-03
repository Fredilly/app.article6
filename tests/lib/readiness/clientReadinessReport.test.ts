import { describe, expect, test } from "@jest/globals";
import type { RequirementCoverageRow } from "@/app/m/_lib/requirementCoverage";
import { buildClientReadinessReport } from "@/lib/readiness/clientReadinessReport";
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

describe("buildClientReadinessReport", () => {
  test("builds a VVB-shaped readiness contract from readiness gap outputs", () => {
    const gaps = deriveRuleReadinessGaps({
      rows: [
        makeRow({
          ruleId: "R-1",
          expectedEvidenceTypes: ["monitoring-report"],
          linkedEvidence: [{ id: "ev-1", title: "Monitoring report", type: "monitoring-report", source: "inventory" }],
          status: "partial",
        }),
        makeRow({
          ruleId: "R-2",
          expectedEvidenceTypes: ["spreadsheet-workbook"],
          status: "missing",
        }),
        makeRow({
          ruleId: "R-3",
          linkedEvidence: [{ id: "ev-2", title: "Boundary map", type: "STAC item", source: "inventory" }],
          status: "partial",
        }),
      ],
      reviewerArtifactsByRuleId: new Map([
        [
          "R-1",
          {
            savedAt: "2026-05-04T00:00:00Z",
            outcomeNote: "Looks supportable.",
          },
        ],
      ]),
      overridesByRuleId: new Map([
        [
          "R-3",
          {
            state: "needs_review",
            severity: "medium",
            reason: "Expectation encoding still needs reviewer clarification.",
          },
        ],
      ]),
    });

    const report = buildClientReadinessReport({
      reportId: "CRR-001",
      generatedAt: "2026-05-04T00:00:00Z",
      project: {
        name: "Delta Mangrove Restoration",
        projectId: "P-001",
        proponent: "Project Dev Ltd",
        region: "Indonesia",
      },
      methodology: {
        code: "AR-ACM0003",
        version: "v02-0",
        name: "Afforestation and reforestation",
      },
      suppliedDocuments: [
        { id: "doc-1", label: "Project Design Document", type: "pdd" },
        { id: "doc-2", label: "Monitoring workbook", type: "spreadsheet-workbook" },
      ],
      missingDocuments: [{ id: "doc-3", label: "QA/QC record", type: "qa-qc-record" }],
      readinessGaps: gaps,
    });

    expect(report).toEqual(
      expect.objectContaining({
        executiveReadinessSummary: expect.any(Object),
        scopeCriteriaAndLimits: expect.any(Object),
        projectAndMethodologyContext: expect.any(Object),
        documentsReviewed: expect.any(Object),
        readinessAssessmentApproach: expect.any(Object),
        ruleFindingsMatrix: expect.any(Array),
        openFindings: expect.any(Object),
        evidenceChecklist: expect.any(Object),
        recommendedCorrectiveActions: expect.any(Object),
        technicalAppendix: expect.any(Object),
      }),
    );
    expect(report.ruleFindingsMatrix).toHaveLength(3);
    expect(report.documentsReviewed.suppliedDocuments).toHaveLength(2);
    expect(report.documentsReviewed.missingDocuments).toHaveLength(1);
    expect(report.documentsReviewed.reviewedEvidence.map((item) => item.id)).toEqual(["ev-1", "ev-2"]);
  });

  test("does not emit formal verification, registry, or credit issuance claims", () => {
    const report = buildClientReadinessReport({
      reportId: "CRR-002",
      generatedAt: "2026-05-04T00:00:00Z",
      project: { name: "Delta Mangrove Restoration" },
      methodology: { code: "AR-ACM0003", version: "v02-0" },
      readinessGaps: [],
    });

    const serialized = JSON.stringify(report).toLowerCase();
    expect(serialized).not.toContain("verification opinion");
    expect(serialized).not.toContain("registry approval");
    expect(serialized).not.toContain("credit issuance");
    expect(serialized).not.toContain("verified credits");
  });

  test("surfaces missing evidence and reviewer judgment needs in report sections", () => {
    const gaps = deriveRuleReadinessGaps({
      rows: [
        makeRow({
          ruleId: "R-10",
          expectedEvidenceTypes: ["monitoring-report"],
          status: "missing",
        }),
        makeRow({
          ruleId: "R-11",
          expectedEvidenceTypes: ["pdd"],
          linkedEvidence: [{ id: "ev-11", title: "PDD excerpt", type: "pdd", source: "inventory" }],
          status: "partial",
        }),
      ],
    });

    const report = buildClientReadinessReport({
      reportId: "CRR-003",
      generatedAt: "2026-05-04T00:00:00Z",
      project: { name: "Delta Mangrove Restoration" },
      methodology: { code: "AR-ACM0003", version: "v02-0" },
      readinessGaps: gaps,
    });

    expect(report.openFindings.missingEvidence.map((item) => item.ruleId)).toContain("R-10");
    expect(report.openFindings.reviewerJudgmentNeeded.map((item) => item.ruleId)).toContain("R-11");
    expect(report.ruleFindingsMatrix.find((item) => item.ruleId === "R-10")?.category).toBe("not_started");
    expect(report.ruleFindingsMatrix.find((item) => item.ruleId === "R-11")?.category).toBe("reviewer_judgment_needed");
  });

  test("surfaces unknown expectations and clarification-needed findings separately", () => {
    const gaps = deriveRuleReadinessGaps({
      rows: [
        makeRow({
          ruleId: "R-20",
          linkedEvidence: [{ id: "ev-20", title: "Map evidence", type: "STAC item", source: "inventory" }],
          status: "partial",
        }),
      ],
      overridesByRuleId: new Map([
        [
          "R-20",
          {
            state: "needs_review",
            severity: "medium",
            reason: "Hold for reviewer clarification.",
          },
        ],
      ]),
    });

    const report = buildClientReadinessReport({
      reportId: "CRR-004",
      generatedAt: "2026-05-04T00:00:00Z",
      project: { name: "Delta Mangrove Restoration" },
      methodology: { code: "AR-ACM0003", version: "v02-0" },
      readinessGaps: gaps,
    });

    expect(report.ruleFindingsMatrix[0]).toMatchObject({
      ruleId: "R-20",
      category: "clarification_needed",
      state: "needs_review",
    });
    expect(report.openFindings.clarificationNeeded.map((item) => item.ruleId)).toContain("R-20");
  });
});
