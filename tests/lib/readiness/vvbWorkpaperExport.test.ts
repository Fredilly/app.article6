import { describe, expect, test } from "@jest/globals";
import JSZip from "jszip";
import type { RequirementCoverageRow } from "@/app/m/_lib/requirementCoverage";
import { deriveRuleReadinessGaps } from "@/lib/readiness/gapEngine";
import { buildVvbWorkpaperExport } from "@/lib/readiness/vvbWorkpaperExport";
import { buildVvbWorkpaperReport } from "@/lib/readiness/vvbWorkpaperReport";

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

function buildSampleReport() {
  const readinessGaps = deriveRuleReadinessGaps({
    rows: [
      makeRow({
        ruleId: "R-1",
        expectedEvidenceTypes: ["monitoring-report"],
        linkedEvidence: [{ id: "ev-1", title: "Monitoring report", type: "monitoring-report", source: "inventory" }],
        candidateEvidence: [{ id: "cand-1", title: "Candidate workbook", type: "spreadsheet-workbook", source: "inventory" }],
        status: "partial",
      }),
      makeRow({
        ruleId: "R-2",
        ruleSummary: {
          title: "Boundary reconciliation",
          snippet: "Boundary inputs must reconcile with project records.",
          when: [],
          tags: [],
        },
        expectedEvidenceTypes: ["pdd", "gis"],
        status: "missing",
      }),
    ],
    reviewerArtifactsByRuleId: new Map([
      ["R-1", { savedAt: "2026-05-05T00:00:00Z", outcomeNote: "Saved reviewer artifact." }],
    ]),
  });

  return buildVvbWorkpaperReport({
    reportId: "VVB-WP-001",
    generatedAt: "2026-05-05T00:00:00Z",
    project: {
      name: "Delta Mangrove Restoration",
      projectId: "Not provided",
      proponent: "Project Dev Ltd",
      region: "Indonesia",
    },
    methodology: {
      code: "AR-ACM0003",
      version: "v02-0",
      name: "Afforestation and reforestation",
    },
    suppliedDocuments: [{ id: "doc-1", label: "Project Design Document", type: "pdd" }],
    missingDocuments: [{ id: "missing-gis", label: "GIS / map evidence", type: "gis" }],
    readinessGaps,
    reviewsByRuleId: {
      "R-1": {
        status: "verified",
        rationale: "Monitoring report covers the period.",
        supportReference: "PDD section 3 and linked monitoring report.",
        evidenceAttachments: [{ id: "att-1", type: "url", label: "Monitoring report URL", url: "https://example.test/report", addedAt: "2026-05-05T00:00:00Z" }],
        reviewedBy: "local-reviewer",
        reviewedAt: "2026-05-05T00:00:00Z",
        updatedAt: "2026-05-05T00:00:00Z",
      },
      "R-2": {
        status: "pending",
        rationale: "",
        supportReference: "",
        evidenceAttachments: [],
        reviewedBy: "",
        reviewedAt: "",
        updatedAt: "2026-05-05T00:00:00Z",
      },
    },
    reviewerArtifactsByRuleId: {
      "R-1": { savedAt: "2026-05-05T00:00:00Z", outcomeNote: "Saved reviewer artifact." },
    },
    provenance: {
      sourceRunId: "run-1234",
      artifactState: "finalized",
      snapshotExportedAt: "2026-05-05T00:00:00Z",
      finalizedAt: "2026-05-05T00:00:00Z",
      auditPackReference: "audit-pack.AR-ACM0003.v02-0.run-1234.zip",
      clientReadinessReference: "CRR-AR-ACM0003-v02-0-run-1234",
      traceBundleReference: "verify-run:run-1234",
    },
  });
}

describe("buildVvbWorkpaperExport", () => {
  test("packages the workpaper report, appendix, and evidence index into a deterministic zip", async () => {
    const first = buildVvbWorkpaperExport({ report: buildSampleReport() });
    const second = buildVvbWorkpaperExport({ report: buildSampleReport() });

    expect(first.zipBytes.equals(second.zipBytes)).toBe(true);

    const zip = await JSZip.loadAsync(first.zipBytes);
    const paths = Object.keys(zip.files).sort();
    expect(paths).toEqual([
      "manifest.json",
      "vvb-draft-workpaper/appendix/evidence-reference-index.json",
      "vvb-draft-workpaper/appendix/workpaper-traceability.json",
      "vvb-draft-workpaper/workpaper.html",
      "vvb-draft-workpaper/workpaper.json",
    ]);
  });

  test("keeps forbidden verifier, registry, and issuance claims out of exported artifacts", async () => {
    const result = buildVvbWorkpaperExport({ report: buildSampleReport() });
    const zip = await JSZip.loadAsync(result.zipBytes);
    const html = (await zip.file("vvb-draft-workpaper/workpaper.html")?.async("string")) ?? "";
    const appendix = (await zip.file("vvb-draft-workpaper/appendix/workpaper-traceability.json")?.async("string")) ?? "";
    const serialized = `${html}\n${appendix}`.toLowerCase();

    expect(serialized).not.toContain("verification opinion");
    expect(serialized).not.toContain("formal verification opinion");
    expect(serialized).not.toContain("registry approval");
    expect(serialized).not.toContain("credit issuance");
    expect(serialized).not.toContain("credit eligibility");
    expect(serialized).not.toContain("vvb approval");
  });

  test("keeps candidate evidence distinct from linked support and preserves traceability", async () => {
    const result = buildVvbWorkpaperExport({ report: buildSampleReport() });
    const zip = await JSZip.loadAsync(result.zipBytes);
    const appendixRaw = await zip.file("vvb-draft-workpaper/appendix/workpaper-traceability.json")?.async("string");
    const evidenceIndexRaw = await zip.file("vvb-draft-workpaper/appendix/evidence-reference-index.json")?.async("string");
    const reportHtml = (await zip.file("vvb-draft-workpaper/workpaper.html")?.async("string")) ?? "";

    expect(appendixRaw).toBeTruthy();
    expect(evidenceIndexRaw).toBeTruthy();

    const appendix = JSON.parse(appendixRaw ?? "{}") as {
      reportId: string;
      traceability: {
        rules: Array<{
          ruleId: string;
          candidateEvidenceRefs: string[];
        }>;
      };
    };
    const evidenceIndex = JSON.parse(evidenceIndexRaw ?? "[]") as Array<{
      id: string;
      referenceState: string;
      note: string;
    }>;

    expect(appendix.reportId).toBe("VVB-WP-001");
    expect(appendix.traceability.rules.find((rule) => rule.ruleId === "R-1")?.candidateEvidenceRefs).toEqual(["cand-1"]);
    expect(evidenceIndex.find((item) => item.id === "cand-1")).toEqual(
      expect.objectContaining({
        referenceState: "candidate_evidence",
        note: expect.stringContaining("Candidate evidence suggestion only"),
      }),
    );
    expect(reportHtml).toContain("Candidate evidence refs");
    expect(reportHtml).toContain("cand-1");
  });

  test("uses softened buyer-facing review status labels in the exported workpaper", async () => {
    const result = buildVvbWorkpaperExport({ report: buildSampleReport() });
    const zip = await JSZip.loadAsync(result.zipBytes);
    const reportRaw = await zip.file("vvb-draft-workpaper/workpaper.json")?.async("string");
    const reportHtml = (await zip.file("vvb-draft-workpaper/workpaper.html")?.async("string")) ?? "";

    expect(reportRaw).toBeTruthy();
    const report = JSON.parse(reportRaw ?? "{}") as {
      ruleReviewWorkpaperTable: Array<{ ruleId: string; reviewStatusLabel: string }>;
    };

    expect(report.ruleReviewWorkpaperTable.find((row) => row.ruleId === "R-1")?.reviewStatusLabel).toBe(
      "Reviewer marked supported",
    );
    expect(report.ruleReviewWorkpaperTable.find((row) => row.ruleId === "R-2")?.reviewStatusLabel).toBe(
      "Pending reviewer confirmation",
    );
    expect(reportHtml).toContain("Reviewer marked supported");
    expect(reportHtml).not.toContain(">Verified<");
    expect(reportHtml).not.toContain(">Not verified<");
    expect(reportHtml).not.toContain(">Needs follow-up<");
  });

  test("allows explicit non-claim language even when it references blocked concepts", () => {
    const report = buildSampleReport();
    report.limitationsAndNonClaims.nonClaims = [
      "This draft workpaper is not a verification opinion.",
      "This draft workpaper is not registry approval or VVB approval.",
      "This draft workpaper is not credit issuance or credit eligibility.",
    ];

    expect(() => buildVvbWorkpaperExport({ report })).not.toThrow();
  });

  test("still rejects affirmative forbidden claim language", () => {
    const report = buildSampleReport();
    report.limitationsAndNonClaims.nonClaims = [
      "This draft workpaper is a verification opinion.",
    ];

    expect(() => buildVvbWorkpaperExport({ report })).toThrow(
      "VVB workpaper export contains forbidden claim language: verification opinion",
    );
  });
});
