import type { MarcondesPreValidationReadinessReport } from "./marcondesPreValidationReport";
import { buildMarcondesClientReportPresentation, clientRuleFields } from "./marcondesClientReportPresentation";

function pdfText(value: string): string {
  if ([...value].every((character) => character.charCodeAt(0) >= 0x20 && character.charCodeAt(0) <= 0x7e)) {
    return `(${value.replace(/[\\()]/g, (c) => `\\${c}`)})`;
  }
  const bytes: string[] = ["FE", "FF"];
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    const units = code <= 0xffff ? [code] : [0xd800 + ((code - 0x10000) >> 10), 0xdc00 + ((code - 0x10000) & 0x3ff)];
    for (const unit of units) bytes.push((unit >> 8).toString(16).padStart(2, "0"), (unit & 0xff).toString(16).padStart(2, "0"));
  }
  return `<${bytes.join("").toUpperCase()}>`;
}
const wrap = (value: string, width = 92) => {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line ? line.length + 1 : 0) + word.length > width) { if (line) lines.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
};

function page(title: string, lines: string[]): string {
  const content = ["BT", "/F1 18 Tf", "50 742 Td", `${pdfText(title)} Tj`, "/F1 9 Tf", "0 -28 Td"];
  for (const line of lines.flatMap((item) => wrap(item))) { content.push(`${pdfText(line)} Tj`, "0 -13 Td"); }
  content.push("ET");
  return content.join("\n");
}

function assemble(streams: string[]): Buffer {
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Kids [${streams.map((_, i) => `${3 + i * 2} 0 R`).join(" ")}] /Count ${streams.length} >>`];
  streams.forEach((stream, i) => { const pageId = 3 + i * 2; const streamId = pageId + 1; objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${3 + streams.length * 2} 0 R >> >> /Contents ${streamId} 0 R >>`, `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`); });
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf); pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "ascii");
}

export function buildMarcondesPreValidationPdf(report: MarcondesPreValidationReadinessReport): Buffer {
  const counts = report.executiveSummary.evidenceStateCounts;
  const streams: string[] = [];
  streams.push(page(report.title, ["Internal Release Candidate", `${report.project} | ${report.methodology}`, report.releaseStatus]));
  streams.push(page("Executive Summary", [report.executiveSummary.readinessSummary, `Rules reviewed: ${report.executiveSummary.rulesReviewed}`, `FOUND: ${counts.FOUND} | UNCLEAR: ${counts.UNCLEAR} | MISSING: ${counts.MISSING} | N/A: ${counts["N/A"]}`, ...report.executiveSummary.keyLimitations]));
  streams.push(page("Project Overview", [`Project: ${report.project}`, `Methodology: ${report.methodology}`, "Scope: independent pre-validation readiness review based on the finalized Evidence Map report model."]));
  streams.push(page("Methodology Reconciliation", [`Page 61 reference: ${report.methodologyReview.page61Reference}`, report.methodologyReview.declarations, `Classification: ${report.methodologyReview.classification}`, report.methodologyReview.explanation, `Release blocker: ${report.methodologyReview.blocker}`]));
  streams.push(page("Readiness Summary", [`Reviewer outcomes: ${Object.entries(report.executiveSummary.reviewerOutcomeCounts).map(([k, v]) => `${k}: ${v}`).join(" | ")}`, report.executiveSummary.readinessSummary]));
  streams.push(page("Priority Gaps", report.priorityGaps.map((gap) => `${gap.displayRuleId} — ${gap.title} [${gap.state}]. Required action: ${gap.action ?? "Follow-up recorded in the Evidence Map."}`)));
  const presentation = buildMarcondesClientReportPresentation(report);
  for (const [index, rule] of presentation.rules.entries()) streams.push(page(`Rule Appendix ${index + 1} of ${presentation.rules.length}`, clientRuleFields(rule).map(({ label, value }) => `${label}: ${value}`)));
  streams.push(page("Disclaimer", ["This document is an independent pre-validation readiness review and internal release candidate.", "It does not provide a final assurance conclusion or positive release determination.", `Release state: ${report.releaseStatus}`]));
  return assemble(streams);
}
