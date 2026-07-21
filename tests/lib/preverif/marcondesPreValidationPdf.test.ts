import { buildMarcondesPreValidationPdf } from "@/lib/preverif/marcondesPreValidationPdf";
import { buildMarcondesPreValidationReadinessReport } from "@/lib/preverif/marcondesPreValidationReport";

describe("Marcondes pre-validation readiness PDF", () => {
  it("consumes the report model and preserves finalized truth", () => {
    const report = buildMarcondesPreValidationReadinessReport();
    const pdf = buildMarcondesPreValidationPdf(report).toString("latin1");
    expect(pdf).toContain("%PDF-1.4");
    expect(pdf).toContain("FOUND: 6 | UNCLEAR: 21 | MISSING: 9 | N/A: 22");
    expect(pdf).toContain("BLOCKED_PENDING_VERSION_RECONCILIATION");
    expect(pdf).toContain("DOCUMENT_INCONSISTENCY_OUTDATED_REFERENCE");
    expect((pdf.match(/Rule Appendix \d+ of 58/g) ?? []).length).toBe(58);
    expect(pdf).toContain("Methodology Reconciliation");
    expect(pdf).toContain("Disclaimer");
  });

  it("does not strengthen the report conclusions or make forbidden positive claims", () => {
    const pdf = buildMarcondesPreValidationPdf(buildMarcondesPreValidationReadinessReport()).toString("latin1").toLowerCase();
    expect(pdf).not.toMatch(/\b(verified|validated|approved|certified)\b/);
    expect(pdf).not.toContain("ready for verification");
    expect(pdf).toContain("internal release candidate");
    expect(pdf).toContain("release blocker");
  });
});
