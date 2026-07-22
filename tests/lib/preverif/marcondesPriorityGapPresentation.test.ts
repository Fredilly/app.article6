import { renderToStaticMarkup } from "react-dom/server";
import MarcondesPreValidationReadinessPage from "@/app/internal/reports/prevalidation/marcondes/[auditId]/page";
import { buildMarcondesPreValidationReadinessReport } from "@/lib/preverif/marcondesPreValidationReport";
import {
  buildMarcondesPriorityGapPresentation,
  marcondesPriorityGapFields,
  PRIORITY_GAP_HEADINGS,
} from "@/lib/preverif/marcondesPriorityGapPresentation";
import { buildMarcondesPreValidationPdf } from "@/lib/preverif/marcondesPreValidationPdf";

function visibleText(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
}

function decodePdfText(pdf: string): string {
  const unicodeMaps = [...pdf.matchAll(/\/CIDInit[\s\S]*?endcmap/g)].map((match) => {
    const map = new Map<number, number>();
    for (const [, source, target] of match[0].matchAll(/<([0-9A-Fa-f]{4})> <([0-9A-Fa-f]{4})>/g)) map.set(Number.parseInt(source, 16), Number.parseInt(target, 16));
    return map;
  });
  return [...pdf.matchAll(/\/F[12] \d+ Tf|(\((?:\\.|[^\\)])*\)|<[0-9A-F]+>) Tj/g)].flatMap(([, encoded]) => {
    if (!encoded) return [];
    if (encoded.startsWith("(")) return [encoded.slice(1, -1).replace(/\\([\\()])/g, "$1")];
    const bytes = Buffer.from(encoded.slice(1, -1), "hex");
    let text = "";
    for (let index = 0; index < bytes.length; index += 2) text += String.fromCodePoint(unicodeMaps[0]?.get(bytes[index] * 256 + bytes[index + 1]) ?? 0xfffd);
    return [text];
  }).join(" ");
}

function appearsInOrder(text: string, values: string[]): boolean {
  let offset = 0;
  for (const value of values) {
    const index = text.indexOf(value, offset);
    if (index < 0) return false;
    offset = index + value.length;
  }
  return true;
}

describe("Marcondes Priority Gap presentation parity", () => {
  it("defines the required shared field order and values", () => {
    const gaps = buildMarcondesPriorityGapPresentation(buildMarcondesPreValidationReadinessReport());

    expect(gaps).toHaveLength(30);
    for (const gap of gaps) {
      expect(marcondesPriorityGapFields(gap).map(({ label }) => label)).toEqual(PRIORITY_GAP_HEADINGS);
      expect(marcondesPriorityGapFields(gap).map(({ value }) => value)).toEqual([
        gap.ruleId,
        gap.title,
        gap.evidenceStatus,
        gap.whyItMatters,
        gap.requiredAction,
      ]);
    }
  });

  it("uses the same ordered fields in the website and PDF renderers", async () => {
    const report = buildMarcondesPreValidationReadinessReport();
    const gaps = buildMarcondesPriorityGapPresentation(report);
    const html = visibleText(renderToStaticMarkup(await MarcondesPreValidationReadinessPage({ params: Promise.resolve({ auditId: "marcondes-redd-5953" }) })));
    const pdf = decodePdfText(buildMarcondesPreValidationPdf(report).toString("latin1"));

    const expectedHtmlFields = gaps.flatMap((gap) => marcondesPriorityGapFields(gap).map(({ label, value }) => `${label}: ${value}`));
    expect(appearsInOrder(html, expectedHtmlFields)).toBe(true);

    const priorityGapPdf = pdf.slice(pdf.indexOf("Priority Gaps"), pdf.indexOf("Rule Appendix"));
    const normalizedPriorityGapPdf = priorityGapPdf.replace(/\s+/g, " ");
    expect((normalizedPriorityGapPdf.match(/Rule ID:/g) ?? []).length).toBe(gaps.length);
    expect((normalizedPriorityGapPdf.match(/Title:/g) ?? []).length).toBe(gaps.length);
    expect((normalizedPriorityGapPdf.match(/Evidence status:/g) ?? []).length).toBe(gaps.length);
    expect((normalizedPriorityGapPdf.match(/Why it matters:/g) ?? []).length).toBe(gaps.length);
    expect((normalizedPriorityGapPdf.match(/Required action:/g) ?? []).length).toBe(gaps.length);
  });
});
