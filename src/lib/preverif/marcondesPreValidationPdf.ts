import type { MarcondesPreValidationReadinessReport } from "./marcondesPreValidationReport";

const esc = (value: string) => value.replace(/[\\()]/g, (c) => `\\${c}`).replace(/[^\x20-\x7e]/g, "");
const wrap = (value: string, width = 92) => {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line ? line.length + 1 : 0) + word.length > width) {
      if (line) lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
};

type PdfLine = { text: string; font?: "regular" | "bold"; size?: number; gap?: number };

function textLine(text: string, options: Omit<PdfLine, "text"> = {}): PdfLine {
  return { text, ...options };
}

const field = (label: string, value: string): PdfLine[] => [
  textLine(label, { font: "bold", size: 10, gap: 2 }),
  textLine(value, { size: 10, gap: 12 }),
];

function page(reportTitle: string, pageNumber: number, totalPages: number, title: string, lines: PdfLine[], cover = false): string {
  const content = ["BT", "/F2 8 Tf", "50 770 Td", `(${esc(reportTitle)}) Tj`, "/F1 8 Tf", "0 -12 Td", "(Internal Release Candidate) Tj"];
  if (cover) {
    content.push("/F2 22 Tf", "0 -50 Td", `(${esc("Marcondes REDD+")}) Tj`, "/F2 16 Tf", "0 -28 Td", `(${esc("VM0007 v1.8")}) Tj`, "/F2 19 Tf", "0 -34 Td", `(${esc("Pre-Validation Readiness Review")}) Tj`, "/F1 11 Tf", "0 -34 Td", `(${esc("Prepared from reviewed Evidence Map")}) Tj`, "/F2 11 Tf", "0 -42 Td", `(${esc(lines[0]?.text ?? "")}) Tj`);
  } else {
    content.push("/F2 17 Tf", "0 -38 Td", `(${esc(title)}) Tj`, "/F1 10 Tf", "0 -25 Td");
    for (const item of lines) {
      for (const wrapped of wrap(item.text)) {
        content.push(item.font === "bold" ? "/F2 10 Tf" : `/F1 ${item.size ?? 10} Tf`, `(${esc(wrapped)}) Tj`, `0 -${item.gap ?? 13} Td`);
      }
    }
  }
  content.push("/F1 8 Tf", "50 -730 Td", `(${esc(`${reportTitle} | Page ${pageNumber} of ${totalPages}`)}) Tj`, "ET");
  return content.join("\n");
}

function assemble(streams: string[]): Buffer {
  const fontRegular = 3 + streams.length * 2;
  const fontBold = fontRegular + 1;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Kids [${streams.map((_, i) => `${3 + i * 2} 0 R`).join(" ")}] /Count ${streams.length} >>`];
  streams.forEach((stream, i) => {
    const pageId = 3 + i * 2;
    const streamId = pageId + 1;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${streamId} 0 R >>`, `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  });
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "ascii");
}

export function buildMarcondesPreValidationPdf(report: MarcondesPreValidationReadinessReport): Buffer {
  const counts = report.executiveSummary.evidenceStateCounts;
  const sections: Array<{ title: string; lines: PdfLine[] }> = [
    { title: "Executive Summary", lines: [textLine(report.executiveSummary.readinessSummary), ...field("Rules reviewed", String(report.executiveSummary.rulesReviewed)), textLine(`FOUND: ${counts.FOUND} | UNCLEAR: ${counts.UNCLEAR} | MISSING: ${counts.MISSING} | N/A: ${counts["N/A"]}`), ...report.executiveSummary.keyLimitations.map((line) => textLine(line))] },
    { title: "Project Overview", lines: [...field("Project", report.project), ...field("Methodology", report.methodology), textLine("Scope: independent pre-validation readiness review based on the finalized Evidence Map report model.")] },
    { title: "Methodology Reconciliation", lines: [...field("Page 61 reference", report.methodologyReview.page61Reference), ...field("Declarations", report.methodologyReview.declarations), ...field("Classification", report.methodologyReview.classification), ...field("Explanation", report.methodologyReview.explanation), ...field("Release blocker", report.methodologyReview.blocker)] },
    { title: "Readiness Summary", lines: [textLine(`Reviewer outcomes: ${Object.entries(report.executiveSummary.reviewerOutcomeCounts).map(([k, v]) => `${k}: ${v}`).join(" | ")}`), textLine(report.executiveSummary.readinessSummary)] },
    { title: "Priority Gaps", lines: report.priorityGaps.flatMap((gap) => [textLine(gap.displayRuleId, { font: "bold", size: 11, gap: 3 }), textLine(gap.title, { font: "bold", gap: 3 }), ...field("Evidence state", gap.state), ...field("Why it matters", gap.whyItMatters), ...field("Required action", gap.action ?? "Follow-up recorded in the Evidence Map."), textLine("", { gap: 8 })]) },
  ];
  for (const [index, rule] of report.rules.entries()) sections.push({ title: `Rule Appendix ${index + 1} of ${report.rules.length}`, lines: [...field("Rule ID", rule.ruleId), ...field("Rule title", rule.displayTitle), ...field("Requirement", rule.displayRequirement), ...field("Evidence state", rule.evidenceState), ...field("Reviewer outcome", rule.reviewerOutcome), ...field("Rationale", rule.rationale), ...field("Recommended action", rule.recommendedAction ?? "None recorded.")] });
  sections.push({ title: "Disclaimer", lines: [textLine("This document is an independent pre-validation readiness review and internal release candidate."), textLine("It does not provide a final assurance conclusion or positive release determination."), ...field("Release state", report.releaseStatus)] });
  const totalPages = sections.length + 1;
  const streams = [page(report.title, 1, totalPages, "", [textLine(`Release status: ${report.releaseStatus}`)], true), ...sections.map((section, index) => page(report.title, index + 2, totalPages, section.title, section.lines))];
  return assemble(streams);
}
