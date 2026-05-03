import { describe, expect, test } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import ClientReadinessReportView from "@/components/readiness/ClientReadinessReportView";
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

function buildReportHtml(rows: RequirementCoverageRow[]) {
  const gaps = deriveRuleReadinessGaps({
    rows,
    reviewerArtifactsByRuleId: new Map([
      [
        "R-1",
        {
          savedAt: "2026-05-04T00:00:00Z",
          outcomeNote: "Ready for readiness review.",
        },
      ],
    ]),
    overridesByRuleId: new Map([
      [
        "R-3",
        {
          state: "needs_review",
          severity: "medium",
          reason: "Clarification still needed.",
        },
      ],
    ]),
  });

  const report = buildClientReadinessReport({
    reportId: "CRR-UI-001",
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
    suppliedDocuments: [{ id: "doc-1", label: "Project Design Document", type: "pdd" }],
    missingDocuments: [{ id: "doc-2", label: "QA/QC record", type: "qa-qc-record" }],
    readinessGaps: gaps,
  });

  return renderToStaticMarkup(<ClientReadinessReportView report={report} />);
}

describe("ClientReadinessReportView", () => {
  test("renders a compact client-facing readiness report with required sections", () => {
    const html = buildReportHtml([
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
    ]);

    expect(html).toContain("Client readiness report");
    expect(html).toContain("Pre-verification readiness assessment");
    expect(html).toContain("Executive Readiness Summary");
    expect(html).toContain("Documents Reviewed");
    expect(html).toContain("Missing Documents");
    expect(html).toContain("Rule Findings Matrix");
    expect(html).toContain("Open Findings: Missing Evidence");
    expect(html).toContain("Evidence Checklist");
    expect(html).toContain("Recommended Corrective Actions");
    expect(html).toContain("Technical Appendix");
    expect(html).toContain("Delta Mangrove Restoration");
    expect(html).toContain("AR-ACM0003@v02-0");
  });

  test("keeps forbidden claim language out of the rendered report", () => {
    const html = buildReportHtml([
      makeRow({
        ruleId: "R-1",
        expectedEvidenceTypes: ["monitoring-report"],
        linkedEvidence: [{ id: "ev-1", title: "Monitoring report", type: "monitoring-report", source: "inventory" }],
        status: "partial",
      }),
    ]).toLowerCase();

    expect(html).not.toContain("verification opinion");
    expect(html).not.toContain("registry approval");
    expect(html).not.toContain("credit issuance");
    expect(html).not.toContain("verified credits");
    expect(html).not.toContain("assurance opinion");
  });

  test("renders early-stage reports honestly without looking broken", () => {
    const html = buildReportHtml([
      makeRow({
        ruleId: "R-9",
        expectedEvidenceTypes: ["other"],
        candidateEvidence: [{ id: "cand-1", title: "Field memo", type: "memo", source: "inventory" }],
      }),
    ]);

    expect(html).toContain("Readiness support remains early-stage");
    expect(html).toContain("No reviewed evidence is linked yet.");
    expect(html).toContain("Missing Documents");
    expect(html).toContain("No items in this group right now.");
  });
});
