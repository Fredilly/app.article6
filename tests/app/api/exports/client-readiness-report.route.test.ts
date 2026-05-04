import { describe, expect, it } from "@jest/globals";
import { POST } from "@/app/api/exports/client-readiness-report/route";
import { buildClientReadinessReport } from "@/lib/readiness/clientReadinessReport";
import { deriveRuleReadinessGaps } from "@/lib/readiness/gapEngine";
import type { RequirementCoverageRow } from "@/app/m/_lib/requirementCoverage";

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

function makePayload() {
  const readinessGaps = deriveRuleReadinessGaps({
    rows: [
      makeRow({
        ruleId: "R-1",
        expectedEvidenceTypes: ["monitoring-report"],
        linkedEvidence: [{ id: "ev-1", title: "Monitoring report", type: "monitoring-report", source: "inventory" }],
        status: "partial",
      }),
    ],
    reviewerArtifactsByRuleId: new Map([
      ["R-1", { savedAt: "2026-05-04T00:00:00Z", outcomeNote: "Support recorded." }],
    ]),
  });

  const report = buildClientReadinessReport({
    reportId: "CRR-ROUTE-001",
    generatedAt: "2026-05-04T00:00:00Z",
    project: { name: "Delta Mangrove Restoration" },
    methodology: { code: "AR-ACM0003", version: "v02-0" },
    readinessGaps,
  });

  return { report, readinessGaps };
}

describe("/api/exports/client-readiness-report route", () => {
  it("rejects missing payload pieces", async () => {
    const response = await POST(
      new Request("http://localhost/api/exports/client-readiness-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("Missing or invalid report payload");
  });

  it("returns a zip attachment for valid report export input", async () => {
    const response = await POST(
      new Request("http://localhost/api/exports/client-readiness-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makePayload()),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/zip");
    expect(response.headers.get("Content-Disposition")).toContain('attachment; filename="client-readiness-report.zip"');
  });
});
