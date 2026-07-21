import { buildMarcondesPreValidationPdf } from "@/lib/preverif/marcondesPreValidationPdf";
import { buildMarcondesPreValidationReadinessReport } from "@/lib/preverif/marcondesPreValidationReport";

describe("Marcondes pre-validation readiness PDF", () => {
  it("consumes the report model and preserves finalized truth", () => {
    const report = buildMarcondesPreValidationReadinessReport();
    const pdf = buildMarcondesPreValidationPdf(report).toString("latin1");
    expect(pdf).toContain("%PDF-1.4");
    expect(pdf).toContain("Marcondes REDD+");
    expect(pdf).toContain("Prepared from reviewed Evidence Map");
    expect(pdf).toContain("Page 1 of 65");
    expect(pdf).toContain("FOUND: 6 | UNCLEAR: 21 | MISSING: 9 | N/A: 22");
    expect(pdf).toContain("BLOCKED_PENDING_VERSION_RECONCILIATION");
    expect(pdf).toContain("DOCUMENT_INCONSISTENCY_OUTDATED_REFERENCE");
    expect((pdf.match(/Rule Appendix \d+ of 58/g) ?? []).length).toBe(58);
    expect(pdf).toContain("Methodology Reconciliation");
    expect(pdf).toContain("Disclaimer");
    expect(pdf).toContain("Rule ID");
    expect(pdf).toContain("Rule title");
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
    expect(pdf).toContain("internal release candidate");
    expect(pdf).toContain("release blocker");
  });
});
