import { describe, expect, it } from "@jest/globals";
import { GET } from "@/app/api/exports/internal/envira-vm0007-report/route";
import { extractPdfTextWithPdfParse } from "@/lib/chat/quickCheckPdfExtractor";
import { buildEnviraVm0007FixtureBackedReport } from "@/lib/preverif/enviraVm0007FixtureBackedReport";

describe("/api/exports/internal/envira-vm0007-report route", () => {
  it("returns a parseable PDF attachment built from fixture-backed report data", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain('attachment; filename="internal-envira-vm0007-fixture-backed-report.pdf"');

    const bytes = await response.arrayBuffer();
    const parsed = await extractPdfTextWithPdfParse({ bytes });
    const text = parsed.text;
    const lower = text.toLowerCase();
    const normalized = text.replace(/\s+/g, " ").trim();
    const report = buildEnviraVm0007FixtureBackedReport();

    expect(text).toContain("Internal Envira VM0007 Fixture-Backed Report Preview");
    expect(text).toContain("Internal only. Not client-ready.");
    expect(text).toContain("Project: Envira VM0007");
    expect(text).toContain("This is an internal fixture-backed Evidence Map preview.");
    expect(text).toContain("It is based on fixture-backed methodology truth.");
    expect(text).toContain("Purpose: show evidence status, weak evidence, missing evidence, and client actions.");
    expect(text).toContain("Executive Summary");
    expect(text).toContain("FOUND: 30");
    expect(text).toContain("UNCLEAR: 8");
    expect(text).toContain("MISSING: 3");
    expect(text).toContain("N/A: 17");
    expect(text).toContain("Total rules: 58");
    expect(text).toContain("Priority Client Actions");
    expect(text).toContain("MISSING (3 rows)");
    expect(text).toContain("UNCLEAR (8 rows)");
    expect(text).toContain("FOUND (30 rows)");
    expect(text).toContain("N/A (17 rows)");

    for (const row of report.evidenceMapRows) {
      expect(text).toContain(`Rule ID: ${row.ruleId}`);
      expect(text).toContain(`Rule name: ${row.ruleName}`);
    }

    expect((text.match(/Rule ID:/g) ?? []).length).toBe(58);
    expect(normalized).toContain("Rejected evidence examples:");
    expect(normalized).toContain("the land is legally permitted to be converted to non-forest");
    expect(normalized).toContain("Generic methodology-applicability language is not the underlying authorization document.");
    expect(text).not.toContain("Span ID: Not available");
    expect(text).not.toContain("No rejected evidence examples encoded for this row.");
    expect(text).not.toContain("Page number: Not available");
    expect(text).not.toContain("Section heading: Not available");

    for (const banned of [
      "all clear",
      "passed",
      "fully verified",
      "ready for verification",
      "58 supported",
      "all rules supported",
    ]) {
      expect(lower).not.toContain(banned);
    }
  }, 20000);
});
