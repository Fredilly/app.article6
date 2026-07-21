import { renderToStaticMarkup } from "react-dom/server";
import MarcondesPreValidationReadinessPage from "@/app/internal/reports/prevalidation/marcondes/[auditId]/page";
import { buildMarcondesPreValidationPdf } from "@/lib/preverif/marcondesPreValidationPdf";
import { buildMarcondesPreValidationReadinessReport } from "@/lib/preverif/marcondesPreValidationReport";
import { buildMarcondesClientReportPresentation, clientRuleFields } from "@/lib/preverif/marcondesClientReportPresentation";

function decodePdfText(pdf: string): string {
  return [...pdf.matchAll(/(\((?:\\.|[^\\)])*\)|<FEFF[0-9A-F]+>) Tj/g)].map(([, encoded]) => {
    if (encoded.startsWith("(")) return encoded.slice(1, -1).replace(/\\([\\()])/g, "$1");
    const bytes = Buffer.from(encoded.slice(5, -1), "hex");
    let text = "";
    for (let index = 0; index < bytes.length; index += 2) text += String.fromCharCode(bytes[index] * 256 + bytes[index + 1]);
    return text;
  }).join(" ");
}

function visibleHtmlText(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
}

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

  it("uses byte-for-byte identical model field strings in website and PDF content for all 58 rules", async () => {
    const report = buildMarcondesPreValidationReadinessReport();
    const presentation = buildMarcondesClientReportPresentation(report);
    const html = visibleHtmlText(renderToStaticMarkup(await MarcondesPreValidationReadinessPage({ params: Promise.resolve({ auditId: "marcondes-redd-5953" }) })));
    const pdfText = decodePdfText(buildMarcondesPreValidationPdf(report).toString("latin1"));
    expect(presentation.rules).toHaveLength(58);
    for (const rule of presentation.rules) for (const field of clientRuleFields(rule)) {
      const expected = `${field.label}: ${field.value}`;
      expect(html).toContain(expected);
      expect(pdfText.replace(/\s+/g, " ")).toContain(expected.replace(/\s+/g, " "));
    }
    expect(html).toContain("2013–2023");
    expect(pdfText).toContain("2013–2023");
  });
});
