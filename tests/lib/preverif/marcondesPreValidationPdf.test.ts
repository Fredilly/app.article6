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

function textWithPdfLineWrap(value: string): string {
  return value
    .replace(/Marcondes VM0007 v1\.8 Pre-Validation Readiness Report(?: \| Page \d+ of \d+)?/g, "")
    .replace(/Internal Release Candidate/g, "")
    .replace(/Rule-by-rule Appendix \d+ of 58(?: \(continued\))?/g, "")
    .replace(/\s+/g, " ");
}

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
    expect((pdf.match(/Rule-by-rule Appendix \d+ of 58\) Tj/g) ?? []).length).toBe(58);
    expect(pdf).toContain("Methodology Reconciliation");
    expect(pdf).toContain("Disclaimer");
    expect(pdf).toContain("Rule ID");
    expect(pdf).toContain("Title");
    expect(pdf).toContain("Why it matters");
    expect(pdf).toContain("Required action");
    expect(pdf).toContain("Reviewer outcome");
    expect(pdf).not.toContain("Recommended action");
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
    expect(pdf).not.toMatch(/machine-selected|machine proposal|machine-generated|truncated evidence|mislocated evidence|blind audit|prior accepted quote|re-adjudication|replaced the machine|corrected the machine/i);
    expect(pdf).toContain("internal release candidate");
    expect(pdf).toContain("release blocker");
  });

  it("uses one client presentation model for website and PDF ordering", async () => {
    const report = buildMarcondesPreValidationReadinessReport();
    const presentation = buildMarcondesClientReportPresentation(report);
    const html = renderToStaticMarkup(await MarcondesPreValidationReadinessPage({ params: Promise.resolve({ auditId: "marcondes-redd-5953" }) }));
    const pdf = buildMarcondesPreValidationPdf(report).toString("latin1");
    expect(presentation.rules).toHaveLength(58);
    expect(presentation.priorityGaps.map((gap) => gap.category)).toEqual([
      ...Array(9).fill("Missing evidence"),
      ...Array(21).fill("Unclear evidence"),
    ].concat(Array(0).fill("Other actions")));
    const visibleHtml = visibleHtmlText(html);
    const pdfText = decodePdfText(pdf);
    for (const rule of presentation.rules) for (const field of clientRuleFields(rule)) {
      expect(visibleHtml).toContain(`${field.label}: ${field.value}`);
      expect(textWithPdfLineWrap(pdfText)).toContain(textWithPdfLineWrap(`${field.label}: ${field.value}`));
    }
    expect(visibleHtml).toContain("2013–2023");
    expect(pdfText).toContain("2013–2023");
    expect(visibleHtml.match(/Rule ID:/g)).toHaveLength(58);
    expect(pdfText.match(/Rule ID:/g)).toHaveLength(88);
    const gapPositions = ["Missing evidence", "Unclear evidence", "Other actions"].map((category) => html.indexOf(`priority-gap-group-${category.toLowerCase().replaceAll(" ", "-")}`));
    expect(gapPositions).toEqual([...gapPositions].sort((left, right) => left - right));
    expect(html).not.toMatch(/machine-selected|machine proposal|machine-generated|truncated evidence|mislocated evidence|blind audit|re-adjudication/i);
    expect(pdf).not.toMatch(/machine-selected|machine proposal|machine-generated|truncated evidence|mislocated evidence|blind audit|re-adjudication/i);
  });
});
