import fs from "node:fs";
import path from "node:path";
import type { MarcondesPreValidationReadinessReport } from "./marcondesPreValidationReport";
import { buildMarcondesClientReportPresentation, clientRuleFields } from "./marcondesClientReportPresentation";

type FontDefinition = {
  file: Buffer;
  glyphFor: (codePoint: number) => number;
  widthFor: (codePoint: number) => number;
};

type PdfLine = { text?: string; label?: string; value?: string; gap?: number };
type PdfObject = string | Buffer;

function readUInt16(data: Buffer, offset: number): number { return data.readUInt16BE(offset); }
function readUInt32(data: Buffer, offset: number): number { return data.readUInt32BE(offset); }

function loadFont(fileName: string): FontDefinition {
  const file = fs.readFileSync(path.join(process.cwd(), "public/fonts", fileName));
  const tables = new Map<string, number>();
  const tableCount = readUInt16(file, 4);
  for (let index = 0; index < tableCount; index++) {
    const offset = 12 + index * 16;
    tables.set(file.toString("ascii", offset, offset + 4), readUInt32(file, offset + 8));
  }
  const cmapOffset = tables.get("cmap");
  const headOffset = tables.get("head");
  const hheaOffset = tables.get("hhea");
  const hmtxOffset = tables.get("hmtx");
  if (cmapOffset === undefined || headOffset === undefined || hheaOffset === undefined || hmtxOffset === undefined) throw new Error("Marcondes PDF font tables are incomplete");
  const cmapTables = readUInt16(file, cmapOffset + 2);
  let format4Offset: number | undefined;
  for (let index = 0; index < cmapTables; index++) {
    const offset = cmapOffset + 4 + index * 8;
    const subtable = cmapOffset + readUInt32(file, offset + 4);
    if (readUInt16(file, subtable) === 4 && (readUInt16(file, offset) === 3 || readUInt16(file, offset) === 0)) format4Offset = subtable;
  }
  if (format4Offset === undefined) throw new Error("Marcondes PDF font has no BMP cmap");
  const segments = readUInt16(file, format4Offset + 6) / 2;
  const endCodes = format4Offset + 14;
  const startCodes = endCodes + segments * 2 + 2;
  const deltas = startCodes + segments * 2;
  const ranges = deltas + segments * 2;
  const glyphFor = (codePoint: number): number => {
    if (codePoint > 0xffff) return 0;
    for (let segment = 0; segment < segments; segment++) {
      const end = readUInt16(file, endCodes + segment * 2);
      const start = readUInt16(file, startCodes + segment * 2);
      if (codePoint < start || codePoint > end) continue;
      const delta = readUInt16(file, deltas + segment * 2);
      const range = readUInt16(file, ranges + segment * 2);
      if (!range) return (codePoint + delta) & 0xffff;
      const glyphOffset = ranges + segment * 2 + range + (codePoint - start) * 2;
      const glyph = readUInt16(file, glyphOffset);
      return glyph ? (glyph + delta) & 0xffff : 0;
    }
    return 0;
  };
  const unitsPerEm = readUInt16(file, headOffset + 18);
  const metricCount = readUInt16(file, hheaOffset + 34);
  const widthFor = (codePoint: number): number => {
    const glyph = glyphFor(codePoint);
    const metric = Math.min(glyph, metricCount - 1);
    return Math.round((readUInt16(file, hmtxOffset + metric * 4) * 1000) / unitsPerEm);
  };
  return { file, glyphFor, widthFor };
}

const regularFont = loadFont("LiberationSans-Regular.ttf");
const boldFont = loadFont("LiberationSans-Bold.ttf");

function pdfText(value: string): string {
  const bytes: string[] = [];
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint > 0xffff) continue;
    bytes.push(codePoint.toString(16).padStart(4, "0"));
  }
  return `<${bytes.join("").toUpperCase()}>`;
}

function wrap(value: string, width = 92): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line ? line.length + 1 : 0) + word.length > width) { if (line) lines.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function wrapFieldValue(value: string, firstWidth: number, width = 92): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let line = "";
  let limit = firstWidth;
  for (const word of words) {
    if ((line ? line.length + 1 : 0) + word.length > limit) {
      if (line) lines.push(line);
      line = word;
      limit = width;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

function textLine(text: string, gap = 13): PdfLine { return { text, gap }; }
function field(label: string, value: string): PdfLine { return { label, value, gap: 16 }; }

function toUnicodeMap(codePoints: readonly number[]): string {
  const unique = [...new Set(codePoints)].filter((codePoint) => codePoint <= 0xffff);
  const entries = unique.map((codePoint) => `<${codePoint.toString(16).padStart(4, "0")}> <${codePoint.toString(16).padStart(4, "0")}>`);
  const blocks: string[] = [];
  for (let index = 0; index < entries.length; index += 100) blocks.push(`${Math.min(100, entries.length - index)} beginbfchar\n${entries.slice(index, index + 100).join("\n")}\nendbfchar`);
  return `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /MarcondesUnicode def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${blocks.join("\n")}\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend`;
}

function cidToGidMap(font: FontDefinition, codePoints: readonly number[]): Buffer {
  const map = Buffer.alloc(65536 * 2);
  for (const codePoint of codePoints) if (codePoint <= 0xffff) map.writeUInt16BE(font.glyphFor(codePoint), codePoint * 2);
  return map;
}

function fontObjects(font: FontDefinition, name: string, codePoints: readonly number[], startId: number): { objects: PdfObject[]; id: number } {
  const fileId = startId;
  const descriptorId = startId + 1;
  const cidMapId = startId + 2;
  const cidFontId = startId + 3;
  const toUnicodeId = startId + 4;
  const type0Id = startId + 5;
  const widths = [...new Set(codePoints)].filter((codePoint) => codePoint <= 0xffff).map((codePoint) => `${codePoint} [${font.widthFor(codePoint)}]`).join(" ");
  return {
    id: type0Id,
    objects: [
      `<< /Length ${font.file.length} /Length1 ${font.file.length} >>\nstream\n`,
      `<< /Type /FontDescriptor /FontName /${name} /Flags 32 /FontBBox [0 -300 2000 1000] /ItalicAngle 0 /Ascent 905 /Descent -211 /CapHeight 700 /StemV 80 /FontFile2 ${fileId} 0 R >>`,
      `<< /Length 131072 >>\nstream\n`,
      `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${name} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptorId} 0 R /DW 600 /W [${widths}] /CIDToGIDMap ${cidMapId} 0 R >>`,
      `<< /Length ${Buffer.byteLength(toUnicodeMap(codePoints), "ascii")} >>\nstream\n${toUnicodeMap(codePoints)}\nendstream`,
      `<< /Type /Font /Subtype /Type0 /BaseFont /${name} /Encoding /Identity-H /DescendantFonts [${cidFontId} 0 R] /ToUnicode ${toUnicodeId} 0 R >>`,
    ].map((object, index) => index === 0 ? Buffer.concat([Buffer.from(object, "ascii"), font.file, Buffer.from("\nendstream", "ascii")]) : index === 2 ? Buffer.concat([Buffer.from(object, "ascii"), cidToGidMap(font, codePoints), Buffer.from("\nendstream", "ascii")]) : object),
  };
}

function renderPage(title: string, lines: PdfLine[]): string {
  const content = ["BT", "/F2 18 Tf", "50 742 Td", `${pdfText(title)} Tj`, "/F1 9 Tf", "0 -28 Td"];
  for (const line of lines) {
    if (line.label) {
      const valueLines = wrapFieldValue(line.value ?? "", Math.max(20, 92 - line.label.length - 2));
      content.push("/F2 9 Tf", `${pdfText(`${line.label}:`)} Tj`, "/F1 9 Tf", `${pdfText(` ${valueLines[0]}`)} Tj`, `0 -${valueLines.length === 1 ? line.gap ?? 16 : 13} Td`);
      for (const valueLine of valueLines.slice(1)) content.push(`${pdfText(valueLine)} Tj`, "0 -13 Td");
    } else {
      for (const text of wrap(line.text ?? "")) content.push(`${pdfText(text)} Tj`, `0 -${line.gap ?? 13} Td`);
    }
  }
  content.push("ET");
  return content.join("\n");
}

function sectionPages(title: string, lines: PdfLine[]): string[] {
  const pages: PdfLine[][] = [];
  let pageLines: PdfLine[] = [];
  let lineCount = 0;
  for (const line of lines) {
    const count = line.label ? wrapFieldValue(line.value ?? "", Math.max(20, 92 - line.label.length - 2)).length : wrap(line.text ?? "").length;
    if (pageLines.length && lineCount + count > 48) { pages.push(pageLines); pageLines = []; lineCount = 0; }
    pageLines.push(line);
    lineCount += count;
  }
  if (pageLines.length) pages.push(pageLines);
  return (pages.length ? pages : [[]]).map((pageLines, index) => renderPage(index ? `${title} (continued)` : title, pageLines));
}

function assemble(streams: string[], codePoints: readonly number[]): Buffer {
  const pageObjectCount = streams.length * 2;
  const regular = fontObjects(regularFont, "LiberationSans", codePoints, 3 + pageObjectCount);
  const bold = fontObjects(boldFont, "LiberationSans-Bold", codePoints, 3 + pageObjectCount + regular.objects.length);
  const objects: PdfObject[] = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Kids [${streams.map((_, index) => `${3 + index * 2} 0 R`).join(" ")}] /Count ${streams.length} >>`];
  streams.forEach((stream, index) => {
    const pageId = 3 + index * 2;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${regular.id} 0 R /F2 ${bold.id} 0 R >> >> /Contents ${pageId + 1} 0 R >>`, `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`);
  });
  objects.push(...regular.objects, ...bold.objects);
  let pdf = Buffer.from("%PDF-1.4\n", "ascii");
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf = Buffer.concat([pdf, Buffer.from(`${index + 1} 0 obj\n`, "ascii"), Buffer.isBuffer(object) ? object : Buffer.from(object, "ascii"), Buffer.from("\nendobj\n", "ascii")]);
  });
  const xref = pdf.length;
  pdf = Buffer.concat([pdf, Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`, "ascii")]);
  return pdf;
}

export function buildMarcondesPreValidationPdf(report: MarcondesPreValidationReadinessReport): Buffer {
  const counts = report.executiveSummary.evidenceStateCounts;
  const presentation = buildMarcondesClientReportPresentation(report);
  const priorityGaps = ["MISSING", "UNCLEAR", "OTHER"].flatMap((state) => report.priorityGaps.filter((gap) => state === "OTHER" ? gap.state !== "MISSING" && gap.state !== "UNCLEAR" : gap.state === state));
  const sections: Array<{ title: string; lines: PdfLine[] }> = [
    { title: report.title, lines: [textLine("Internal Release Candidate"), textLine(`${report.project} | ${report.methodology}`), textLine(report.releaseStatus)] },
    { title: "Executive Summary", lines: [textLine(report.executiveSummary.readinessSummary), field("Rules reviewed", String(report.executiveSummary.rulesReviewed)), textLine(`FOUND: ${counts.FOUND} | UNCLEAR: ${counts.UNCLEAR} | MISSING: ${counts.MISSING} | N/A: ${counts["N/A"]}`), ...report.executiveSummary.keyLimitations.map(textLine)] },
    { title: "Project Overview", lines: [field("Project", report.project), field("Methodology", report.methodology), textLine("Scope: independent pre-validation readiness review based on the finalized Evidence Map report model.")] },
    { title: "Methodology Reconciliation", lines: [field("Page 61 reference", report.methodologyReview.page61Reference), textLine(report.methodologyReview.declarations), field("Classification", report.methodologyReview.classification), textLine(report.methodologyReview.explanation), field("Release blocker", report.methodologyReview.blocker)] },
    { title: "Readiness Summary", lines: [textLine(`Reviewer outcomes: ${Object.entries(report.executiveSummary.reviewerOutcomeCounts).map(([key, value]) => `${key}: ${value}`).join(" | ")}`), textLine(report.executiveSummary.readinessSummary)] },
    { title: "Priority Gaps", lines: priorityGaps.flatMap((gap) => [field("Rule ID", gap.displayRuleId), field("Title", gap.title), field("Evidence status", gap.state), field("Required action", gap.action ?? ""), textLine("")]) },
    ...presentation.rules.map((rule, index) => ({ title: `Rule Appendix ${index + 1} of ${presentation.rules.length}`, lines: clientRuleFields(rule).map(({ label, value }) => field(label, value)) })),
    { title: "Disclaimer", lines: [textLine("This document is an independent pre-validation readiness review and internal release candidate."), textLine("It does not provide a final assurance conclusion or positive release determination."), field("Release state", report.releaseStatus)] },
  ];
  const streams = sections.flatMap((section) => sectionPages(section.title, section.lines));
  const codePoints = [...new Set(streams.flatMap((stream) => [...stream].map((character) => character.codePointAt(0) ?? 0)))];
  return assemble(streams, codePoints);
}
