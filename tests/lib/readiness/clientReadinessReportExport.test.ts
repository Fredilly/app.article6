import { describe, expect, test } from "@jest/globals";
import JSZip from "jszip";
import type { RequirementCoverageRow } from "@/app/m/_lib/requirementCoverage";
import { buildClientReadinessReportExport } from "@/lib/readiness/clientReadinessExport";
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

function buildSampleExport() {
  const readinessGaps = deriveRuleReadinessGaps({
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
    ],
    reviewerArtifactsByRuleId: new Map([
      [
        "R-1",
        {
          savedAt: "2026-05-04T00:00:00Z",
          outcomeNote: "Readiness support documented.",
        },
      ],
    ]),
  });

  const report = buildClientReadinessReport({
    reportId: "CRR-EXPORT-001",
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
    missingDocuments: [{ id: "missing-spreadsheet-workbook", label: "Spreadsheet workbook", type: "spreadsheet-workbook" }],
    readinessGaps,
  });

  return buildClientReadinessReportExport({ report, readinessGaps });
}

describe("buildClientReadinessReportExport", () => {
  test("packages the readiness report, appendix, and evidence index into a deterministic zip", async () => {
    const first = buildSampleExport();
    const second = buildSampleExport();

    expect(first.zipBytes.equals(second.zipBytes)).toBe(true);

    const zip = await JSZip.loadAsync(first.zipBytes);
    const paths = Object.keys(zip.files).sort();
    expect(paths).toEqual([
      "client-readiness-report/appendix/audit-pack-appendix.json",
      "client-readiness-report/appendix/evidence-reference-index.json",
      "client-readiness-report/report.html",
      "client-readiness-report/report.json",
      "manifest.json",
    ]);
  });

  test("keeps forbidden verifier and registry claims out of exported artifacts", async () => {
    const result = buildSampleExport();
    const zip = await JSZip.loadAsync(result.zipBytes);
    const html = (await zip.file("client-readiness-report/report.html")?.async("string")) ?? "";
    const appendix = (await zip.file("client-readiness-report/appendix/audit-pack-appendix.json")?.async("string")) ?? "";
    const serialized = `${html}\n${appendix}`.toLowerCase();

    expect(serialized).not.toContain("verification opinion");
    expect(serialized).not.toContain("registry approval");
    expect(serialized).not.toContain("credit issuance");
    expect(serialized).not.toContain("verified credits");
    expect(serialized).not.toContain("assurance opinion");
  });

  test("includes traceable appendix fields for report id, timestamp, rules, and evidence ids", async () => {
    const result = buildSampleExport();
    const zip = await JSZip.loadAsync(result.zipBytes);
    const appendixRaw = await zip.file("client-readiness-report/appendix/audit-pack-appendix.json")?.async("string");
    expect(appendixRaw).toBeTruthy();
    const appendix = JSON.parse(appendixRaw ?? "{}") as {
      reportId: string;
      generatedAt: string;
      traceability: {
        rules: Array<{
          ruleId: string;
          linkedEvidence: Array<{ id: string }>;
        }>;
      };
    };

    expect(appendix.reportId).toBe("CRR-EXPORT-001");
    expect(appendix.generatedAt).toBe("2026-05-04T00:00:00Z");
    expect(appendix.traceability.rules.map((rule) => rule.ruleId)).toEqual(["R-1", "R-2"]);
    expect(appendix.traceability.rules[0]?.linkedEvidence.map((item) => item.id)).toEqual(["ev-1"]);
  });
});
