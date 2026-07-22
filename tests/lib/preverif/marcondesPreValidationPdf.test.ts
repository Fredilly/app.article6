import { renderToStaticMarkup } from "react-dom/server";
import MarcondesPreValidationReadinessPage from "@/app/internal/reports/prevalidation/marcondes/[auditId]/page";
import { buildMarcondesPreValidationPdf, buildMarcondesPreValidationPdfPresentation } from "@/lib/preverif/marcondesPreValidationPdf";
import { buildMarcondesPreValidationReadinessReport } from "@/lib/preverif/marcondesPreValidationReport";
import { buildMarcondesClientReportPresentation, clientRuleFields } from "@/lib/preverif/marcondesClientReportPresentation";

function decodePdfText(pdf: string): string {
  const unicodeMaps = [...pdf.matchAll(/\/CIDInit[\s\S]*?endcmap/g)].map((match) => {
    const map = new Map<number, number>();
    for (const [, source, target] of match[0].matchAll(/<([0-9A-Fa-f]{4})> <([0-9A-Fa-f]{4})>/g)) map.set(Number.parseInt(source, 16), Number.parseInt(target, 16));
    return map;
  });
  return [...pdf.matchAll(/\/F([12]) \d+ Tf|(\((?:\\.|[^\\)])*\)|<[0-9A-F]+>) Tj/g)].flatMap(([, selectedFont, encoded]) => {
    if (selectedFont) return [];
    if (!encoded) return [];
    if (encoded.startsWith("(")) return [encoded.slice(1, -1).replace(/\\([\\()])/g, "$1")];
    const bytes = Buffer.from(encoded.slice(1, -1), "hex");
    let text = "";
    for (let index = 0; index < bytes.length; index += 2) text += String.fromCodePoint(unicodeMaps[0]?.get(bytes[index] * 256 + bytes[index + 1]) ?? 0xfffd);
    return [text];
  }).join(" ");
}

function visibleHtmlText(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
}

function normalizedPdfText(value: string): string {
  return value.replace(/Rule Appendix \d+ of 58(?: \(continued\))?/g, "").replace(/Priority Gaps(?: \(continued\))?/g, "").replace(/\s+/g, " ");
}

describe("Marcondes pre-validation readiness PDF", () => {
  it("consumes the report model and preserves finalized truth", () => {
    const report = buildMarcondesPreValidationReadinessReport();
    const pdf = buildMarcondesPreValidationPdf(report).toString("latin1");
    const pdfText = decodePdfText(pdf);
    expect(pdf).toContain("%PDF-1.4");
    expect(pdfText).toContain("FOUND: 6 | UNCLEAR: 21 | MISSING: 9 | N/A: 22");
    expect(pdfText).toContain("BLOCKED_PENDING_VERSION_RECONCILIATION");
    expect(pdfText).toContain("DOCUMENT_INCONSISTENCY_OUTDATED_REFERENCE");
    expect((pdfText.match(/Rule Appendix \d+ of 58(?! \(continued\))/g) ?? []).length).toBe(58);
    expect(pdfText).toContain("Methodology Reconciliation");
    expect(pdfText).toContain("Disclaimer");
  });

  it("does not strengthen the report conclusions or make forbidden positive claims", () => {
    const report = buildMarcondesPreValidationReadinessReport();
    const reportText = JSON.stringify(report).toLowerCase();
    const pdf = decodePdfText(buildMarcondesPreValidationPdf(report).toString("latin1")).toLowerCase();
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
    expect(buildMarcondesPreValidationPdfPresentation(report)).toEqual(presentation);
    for (const rule of presentation.rules) for (const field of clientRuleFields(rule)) {
      const expected = `${field.label}: ${field.value}`;
      expect(html).toContain(expected);
    }
    expect(html).toContain("2013–2023");
    expect(pdfText).toContain("2013–2023");
  });

  it("uses identical shared priority-gap fields for website and PDF presentation output", async () => {
    const report = buildMarcondesPreValidationReadinessReport();
    const presentation = buildMarcondesClientReportPresentation(report);
    const pdfPresentation = buildMarcondesPreValidationPdfPresentation(report);
    const html = visibleHtmlText(renderToStaticMarkup(await MarcondesPreValidationReadinessPage({ params: Promise.resolve({ auditId: "marcondes-redd-5953" }) })));
    const pdfText = decodePdfText(buildMarcondesPreValidationPdf(report).toString("latin1"));
    const normalizedPdfText = pdfText.replace(/\s+/g, " ");
    expect(pdfPresentation.priorityGaps).toEqual(presentation.priorityGaps);
    for (const gap of presentation.priorityGaps) {
      for (const [label, value] of [["Rule ID", gap.ruleId], ["Title", gap.title], ["Evidence status", gap.evidenceStatus], ["Why it matters", gap.whyItMatters], ["Required action", gap.requiredAction]] as const) {
        expect(html).toContain(`${label}: ${value}`);
        expect(normalizedPdfText).toContain(`${label}: ${value}`.replace(/\s+/g, " "));
      }
    }
    expect(presentation.priorityGaps.some((gap) => gap.whyItMatters.startsWith("The available project evidence is incomplete and does not support CONFORMS."))).toBe(true);
  });

  it("renders required Unicode glyphs without missing-glyph fallbacks", async () => {
    const pdf = buildMarcondesPreValidationPdf(buildMarcondesPreValidationReadinessReport());
    expect(pdf.toString("ascii")).toContain("/Subtype /Type0");
    expect(pdf.toString("ascii")).toContain("/ToUnicode");
    expect(pdf.toString("ascii")).toContain("/CIDToGIDMap");
    const extracted = decodePdfText(pdf.toString("latin1"));
    for (const value of ["Priority Gaps", "2013–2023", "VM0007’s", "§5.1.1", "CO₂", "Rémi Denecheau", "Nhamundá", "São Tomé", "Participações", "−"]) expect(extracted).toContain(value);
    expect(extracted).not.toContain("�");
  });

  it("keeps priority gaps in the website category order", () => {
    const report = buildMarcondesPreValidationReadinessReport();
    const pdfText = normalizedPdfText(decodePdfText(buildMarcondesPreValidationPdf(report).toString("latin1")));
    const expected = [
      "R-3-0007", "R-5-0001", "R-5-0005", "R-5-0006", "R-5-0007", "R-5-0009", "R-6-0003", "R-6-0004", "R-6-0007",
      "R-1-0001", "R-1-0004", "R-2-0005", "R-2-0007", "R-3-0001", "R-6-0001", "R-6-0008", "R-2-0001", "R-2-0006", "R-2-0008", "R-3-0002", "R-2-0003", "R-2-0010", "R-2-0012", "R-2-0013", "R-3-0003", "R-3-0004", "R-5-0003", "R-5-0008", "R-6-0002", "R-6-0005",
    ];
    expect([...pdfText.matchAll(/Rule ID:\s+(R-\d-\d{4})/g)].map(([, ruleId]) => ruleId).slice(0, expected.length)).toEqual(expected);
  });
});
