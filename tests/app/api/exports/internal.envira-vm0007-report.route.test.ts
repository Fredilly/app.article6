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
    expect(text).toContain("FOUND: 30");
    expect(text).toContain("UNCLEAR: 8");
    expect(text).toContain("MISSING: 3");
    expect(text).toContain("N/A: 17");
    expect(text).toContain("Total rules: 58");
    expect(normalized).toContain(
      "Internal preview only. This route renders reviewed fixture truth for analysis and is not client-ready.",
    );

    for (const row of report.evidenceMapRows) {
      expect(text).toContain(`Rule ID: ${row.ruleId}`);
      expect(text).toContain(`Rule name: ${row.ruleName}`);
    }

    expect((text.match(/Rule ID:/g) ?? []).length).toBe(58);
    expect(normalized).toContain("Rejected evidence quote: the land is legally permitted to be converted to non-forest");
    expect(normalized).toContain(
      "Rejection reason: Generic methodology-applicability language is not the underlying authorization document.",
    );

    for (const banned of [
      "all clear",
      "passed",
      "fully verified",
      "ready for verification",
      "58 supported",
      "all rules supported",
      "client-ready claim",
    ]) {
      expect(lower).not.toContain(banned);
    }
  }, 20000);
});
