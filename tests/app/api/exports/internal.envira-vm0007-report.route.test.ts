import { describe, expect, it } from "@jest/globals";
import { GET } from "@/app/api/exports/internal/envira-vm0007-report/route";
import { buildEnviraVm0007FixtureBackedReport } from "@/lib/preverif/enviraVm0007FixtureBackedReport";

describe("/api/exports/internal/envira-vm0007-report route", () => {
  it("returns a PDF attachment with correct headers", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain(
      'attachment; filename="internal-envira-vm0007-fixture-backed-report.pdf"',
    );

    const bytes = await response.arrayBuffer();
    // Verify it's a valid PDF
    const header = new Uint8Array(bytes, 0, 5);
    expect(
      Array.from(header)
        .map((b) => String.fromCharCode(b))
        .join(""),
    ).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });

  it("contains exact readable phrases in the PDF content stream", async () => {
    const response = await GET();
    const bytes = await response.arrayBuffer();
    const pdfStr = new TextDecoder("utf-8").decode(bytes);

    // Extract all text from Tj operations in the content streams
    const tjMatches = pdfStr.match(/\(([^)]*)\)\s*Tj/g) ?? [];
    const extracted = tjMatches.map((m: string) => {
      const inner = m.replace(/^\(/, "").replace(/\)\s*Tj$/, "");
      // Un-escape PDF string escapes
      return inner.replace(/\\(.)/g, "$1");
    });
    const fullText = extracted.join("\n");

    // Verify readable content
    expect(fullText).toContain(
      "Internal Envira VM0007 Fixture-Backed Report Preview",
    );
    expect(fullText).toContain("The Envira Amazonia Project");
    expect(fullText).toContain("Executive Summary");
    expect(fullText).toContain("Priority Client Actions");
    expect(fullText).toContain("FOUND: 30");
    expect(fullText).toContain("UNCLEAR: 8");
    expect(fullText).toContain("MISSING: 3");
    expect(fullText).toContain("N/A: 17");
    expect(fullText).toContain("Evidence Map");
    expect(fullText).toContain("Internal preview only");
  });

  it("preserves all 58 rule IDs and status sections in the PDF", async () => {
    const response = await GET();
    const bytes = await response.arrayBuffer();
    const pdfStr = new TextDecoder("utf-8").decode(bytes);

    const tjMatches = pdfStr.match(/\(([^)]*)\)\s*Tj/g) ?? [];
    const extracted = tjMatches.map((m: string) => {
      const inner = m.replace(/^\(/, "").replace(/\)\s*Tj$/, "");
      return inner.replace(/\\(.)/g, "$1");
    });
    const fullText = extracted.join("\n");

    const report = buildEnviraVm0007FixtureBackedReport();
    for (const row of report.evidenceMapRows) {
      expect(fullText).toContain(row.ruleId);
    }

    // Verify grouped status sections
    expect(fullText).toContain("--- MISSING ---");
    expect(fullText).toContain("--- UNCLEAR ---");
    expect(fullText).toContain("--- FOUND ---");
    expect(fullText).toContain("--- N/A ---");

    // Verify MISSING section appears before UNCLEAR, etc.
    const missingIdx = fullText.indexOf("--- MISSING ---");
    const unclearIdx = fullText.indexOf("--- UNCLEAR ---");
    const foundIdx = fullText.indexOf("--- FOUND ---");
    const naIdx = fullText.indexOf("--- N/A ---");
    expect(missingIdx).toBeLessThan(unclearIdx);
    expect(unclearIdx).toBeLessThan(foundIdx);
    expect(foundIdx).toBeLessThan(naIdx);
  });

  it("has correct fixture counts via report data verification", () => {
    const report = buildEnviraVm0007FixtureBackedReport();
    expect(report.summary.counts.FOUND).toBe(30);
    expect(report.summary.counts.UNCLEAR).toBe(8);
    expect(report.summary.counts.MISSING).toBe(3);
    expect(report.summary.counts["N/A"]).toBe(17);
    expect(report.summary.totalRules).toBe(58);

    const f = report.evidenceMapRows.filter((r) => r.status === "FOUND");
    const u = report.evidenceMapRows.filter((r) => r.status === "UNCLEAR");
    const m = report.evidenceMapRows.filter((r) => r.status === "MISSING");
    const n = report.evidenceMapRows.filter((r) => r.status === "N/A");
    expect(f).toHaveLength(30);
    expect(u).toHaveLength(8);
    expect(m).toHaveLength(3);
    expect(n).toHaveLength(17);
  });
});
