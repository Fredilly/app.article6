import { describe, expect, it, test } from "@jest/globals";
import { GET } from "@/app/api/exports/internal/envira-vm0007-report/route";
import { buildEnviraVm0007FixtureBackedReport } from "@/lib/preverif/enviraVm0007FixtureBackedReport";

describe("/api/exports/internal/envira-vm0007-report route", () => {
  it("returns a PDF attachment with correct headers", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain('attachment; filename="internal-envira-vm0007-fixture-backed-report.pdf"');

    const bytes = await response.arrayBuffer();
    const header = new Uint8Array(bytes, 0, 5);
    expect(Array.from(header).map(b => String.fromCharCode(b)).join("")).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });

  test("fixture counts and all 58 rows are correct", () => {
    const report = buildEnviraVm0007FixtureBackedReport();
    expect(report.summary.counts.FOUND).toBe(30);
    expect(report.summary.counts.UNCLEAR).toBe(8);
    expect(report.summary.counts.MISSING).toBe(3);
    expect(report.summary.counts["N/A"]).toBe(17);
    expect(report.summary.totalRules).toBe(58);
    expect(report.evidenceMapRows).toHaveLength(58);

    const missingRows = report.evidenceMapRows.filter(r => r.status === "MISSING");
    const unclearRows = report.evidenceMapRows.filter(r => r.status === "UNCLEAR");
    const foundRows = report.evidenceMapRows.filter(r => r.status === "FOUND");
    const naRows = report.evidenceMapRows.filter(r => r.status === "N/A");

    expect(missingRows).toHaveLength(3);
    expect(unclearRows).toHaveLength(8);
    expect(foundRows).toHaveLength(30);
    expect(naRows).toHaveLength(17);
  });

  test("priority actions include all 11 MISSING + UNCLEAR rows", () => {
    const report = buildEnviraVm0007FixtureBackedReport();
    const priorityActions = report.evidenceMapRows.filter(
      r => r.status === "MISSING" || r.status === "UNCLEAR",
    );
    expect(priorityActions).toHaveLength(11);

    // Verify specific UNCLEAR rows have expected content
    const apdefRow = priorityActions.find(r => r.ruleId === "R-1-0004");
    expect(apdefRow).toBeDefined();
    expect(apdefRow!.clientAction).toContain("Add the conversion authorization document");

    const auwdRow = priorityActions.find(r => r.ruleId === "R-1-0013");
    expect(auwdRow).toBeDefined();
    expect(auwdRow!.clientAction).toContain("Add the project-specific eligibility analysis");
  });

  test("rejected evidence examples are preserved", () => {
    const report = buildEnviraVm0007FixtureBackedReport();
    const rowWithRejected = report.evidenceMapRows.find(
      r => r.rejectedEvidenceExamples.length > 0,
    );
    expect(rowWithRejected).toBeDefined();
    const firstRejected = rowWithRejected!.rejectedEvidenceExamples[0];
    expect(firstRejected.quote).toBeTruthy();
    expect(firstRejected.rejectionReason).toBeTruthy();
  });
});
