import { describe, expect, it } from "@jest/globals";
import type { RuleSummary } from "@/app/m/_lib/methodRules";
import { buildProjectReadinessSummary } from "@/lib/readiness/projectReadinessSummary";
import type { Project } from "@/lib/projects/types";

function makeRule(overrides: Partial<RuleSummary> = {}): RuleSummary {
  return {
    id: overrides.id ?? "R-1",
    title: overrides.title ?? "Monitoring frequency",
    snippet: overrides.snippet ?? "Maintain a monitoring report.",
    tags: overrides.tags ?? [],
    expectedEvidence: overrides.expectedEvidence ?? ["monitoring-report"],
    sectionId: overrides.sectionId ?? "S-1",
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-readiness",
    name: "Delta Mangrove Restoration",
    reviewMode: "methodology-linked",
    methodCode: "AR-ACM0003",
    methodVersion: "v02-0",
    methodCategory: "Forestry",
    status: "in-progress",
    createdAt: "2026-05-27T00:00:00.000Z",
    reviews: [
      {
        ruleId: "R-1",
        ruleTitle: "Monitoring frequency",
        sectionId: "S-1",
        status: "gap",
        evidenceIds: [],
      },
      {
        ruleId: "R-2",
        ruleTitle: "Boundary evidence",
        sectionId: "S-1",
        status: "verified",
        evidenceIds: ["ev-boundary"],
        note: "Boundary file uploaded.",
        reviewedAt: "2026-05-27T00:02:00.000Z",
      },
    ],
    documents: [
      {
        id: "doc-1",
        fileName: "project-pdd.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        uploadedAt: "2026-05-27T00:01:00.000Z",
      },
    ],
    manualFindings: [],
    extractedManualFindingDrafts: [],
    learningCases: [],
    ...overrides,
  };
}

describe("buildProjectReadinessSummary", () => {
  it("produces a readiness-safe summary and export payload", () => {
    const summary = buildProjectReadinessSummary({
      project: makeProject(),
      rules: [
        makeRule(),
        makeRule({
          id: "R-2",
          title: "Boundary evidence",
          expectedEvidence: ["gis"],
        }),
      ],
      generatedAt: "2026-05-27T00:03:00.000Z",
    });

    expect(summary.uploadedEvidenceCount).toBe(1);
    expect(summary.topItems[0]?.ruleId).toBe("R-1");
    expect(summary.recommendedNextAction).toContain("Link evidence");
    expect(JSON.stringify(summary.report)).toContain("pre-verification");
    expect(JSON.stringify(summary.report)).not.toContain("final decision");
    expect(JSON.stringify(summary.report)).not.toContain("verification opinion");
  });
});
