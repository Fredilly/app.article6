import { buildMarcondesPreValidationPdf } from "@/lib/preverif/marcondesPreValidationPdf";
import { buildMarcondesPreValidationReadinessReport } from "@/lib/preverif/marcondesPreValidationReport";

describe("Marcondes pre-validation readiness PDF", () => {
  it("consumes the report model and preserves finalized truth", () => {
    const report = buildMarcondesPreValidationReadinessReport();
    const pdf = buildMarcondesPreValidationPdf(report).toString("latin1");
    expect(pdf).toContain("%PDF-1.4");
    expect(pdf).toContain("Marcondes REDD+");
    expect(pdf).toContain("Prepared from reviewed Evidence Map");
    expect(pdf).toMatch(/Page 1 of \d+/);
    const yPositions = [...pdf.matchAll(/1 0 0 1 50 (-?\d+) Tm/g)].map((match) => Number(match[1]));
    expect(yPositions.length).toBeGreaterThan(100);
    expect(yPositions.every((y) => y >= 28 && y <= 770)).toBe(true);
    expect(pdf).toContain("FOUND: 6 | UNCLEAR: 21 | MISSING: 9 | N/A: 22");
    expect(pdf).toContain("BLOCKED_PENDING_VERSION_RECONCILIATION");
    expect(pdf).toContain("DOCUMENT_INCONSISTENCY_OUTDATED_REFERENCE");
    expect((pdf.match(/Rule Appendix \d+ of 58/g) ?? []).length).toBe(58);
    expect(pdf).toContain("Methodology Reconciliation");
    expect(pdf).toContain("Disclaimer");
    expect(pdf).toContain("Rule ID");
    expect(pdf).toContain("Rule title");
    expect(pdf).toContain("Methodology requirement");
    expect(pdf).toContain("Why it matters");
    expect(pdf).toContain("Required action");
    expect(pdf).toContain("Reviewer outcome");
  });

  it("does not strengthen the report conclusions or make forbidden positive claims", () => {
    const report = buildMarcondesPreValidationReadinessReport();
    const reportText = JSON.stringify(report).toLowerCase();
    const pdf = buildMarcondesPreValidationPdf(report).toString("latin1").toLowerCase();
    // Check for forbidden conclusions, not incidental source wording such as
    // "verified carbon standard" or a quoted future validation-stage action.
    const forbidden = /\b(?:report|project|readiness|review|conclusion)\s+(?:is\s+)?(?:verified|validated|approved|certified)\b|\bready for verification\b/;
    expect(reportText).not.toMatch(forbidden);
    expect(pdf).not.toMatch(forbidden);
    expect(pdf).not.toMatch(/machine-selected|machine proposal|truncated evidence|mislocated evidence|blind audit|prior accepted quote|re-adjudication/i);
    expect(pdf).toContain("internal release candidate");
    expect(pdf).toContain("release blocker");
  });
});
