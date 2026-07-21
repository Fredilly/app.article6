import type { MarcondesPreValidationReadinessReport } from "./marcondesPreValidationReport";

const esc = (value: string) => value.replace(/[\\()]/g, (c) => `\\${c}`).replace(/[^\x20-\x7e]/g, "");
function clientFacingText(value: string): string {
  return value
    .replace(/Manual review replaced the machine-selected(?: truncated or mislocated)? evidence(?: for [^ ]+)? with PDF-backed evidence\.\s*/gi, "The reviewed evidence was assessed against the methodology requirement. ")
    .replace(/Manual review replaced the machine-selected evidence(?: for [^ ]+)? with PDF-backed evidence\.\s*/gi, "The reviewed evidence was assessed against the methodology requirement. ")
    .replace(/Manual re-adjudication corrected/gi, "The reviewed assessment corrected")
    .replace(/The blind audit confirms/gi, "The reviewed assessment confirms")
    .replace(/machine-selected/gi, "initially selected")
    .replace(/machine proposal/gi, "initial assessment")
    .replace(/truncated or mislocated evidence/gi, "incomplete evidence")
    .replace(/truncated evidence/gi, "incomplete evidence")
    .replace(/mislocated evidence/gi, "evidence that did not establish the requirement")
    .replace(/previous accepted quote/gi, "earlier evidence excerpt")
    .replace(/It was replaced with/gi, "The assessment relies on")
    .replace(/replaced with/gi, "updated to use")
    .replace(/re-adjudication/gi, "assessment review")
    .replace(/blind audit/gi, "reviewed assessment");
}
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
type DrawLine = { text: string; font: "regular" | "bold"; size: number; advance: number };

function textLine(text: string, options: Omit<PdfLine, "text"> = {}): PdfLine {
  return { text, ...options };
}

const field = (label: string, value: string): PdfLine[] => [
  textLine(label, { font: "bold", size: 10, gap: 14 }),
  textLine(value, { size: 10, gap: 16 }),
];

function expandLines(lines: PdfLine[]): DrawLine[] {
  return lines.flatMap((item) => wrap(item.text).map((text) => ({ text, font: item.font ?? "regular", size: item.size ?? 10, advance: item.gap ?? 13 })));
}

function page(reportTitle: string, pageNumber: number, totalPages: number, title: string, lines: DrawLine[], cover = false): string {
  const content = ["BT", "/F2 8 Tf", `1 0 0 1 50 770 Tm`, `(${esc(reportTitle)}) Tj`, "/F1 8 Tf", `1 0 0 1 50 758 Tm`, "(Internal Release Candidate) Tj"];
  if (cover) {
    content.push("/F2 22 Tf", `1 0 0 1 50 650 Tm`, `(${esc("Marcondes REDD+")}) Tj`, "/F2 16 Tf", `1 0 0 1 50 610 Tm`, `(${esc("VM0007 v1.8")}) Tj`, "/F2 19 Tf", `1 0 0 1 50 565 Tm`, `(${esc("Pre-Validation Readiness Review")}) Tj`, "/F1 11 Tf", `1 0 0 1 50 520 Tm`, `(${esc("Prepared from reviewed Evidence Map")}) Tj`, "/F2 11 Tf", `1 0 0 1 50 460 Tm`, `(${esc(lines[0]?.text ?? "")}) Tj`);
  } else {
    content.push("/F2 17 Tf", `1 0 0 1 50 720 Tm`, `(${esc(title)}) Tj`);
    let y = 688;
    for (const item of lines) {
      content.push(item.font === "bold" ? "/F2 10 Tf" : `/F1 ${item.size} Tf`, `1 0 0 1 50 ${y} Tm`, `(${esc(item.text)}) Tj`);
      y -= item.advance;
    }
  }
  content.push("/F1 8 Tf", `1 0 0 1 50 28 Tm`, `(${esc(`${reportTitle} | Page ${pageNumber} of ${totalPages}`)}) Tj`, "ET");
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
    { title: "Priority Gaps", lines: report.priorityGaps.flatMap((gap) => [textLine(gap.displayRuleId, { font: "bold", size: 11, gap: 14 }), textLine(gap.title, { font: "bold", gap: 16 }), ...field("Evidence state", gap.state), ...field("Why it matters", clientFacingText(gap.whyItMatters)), ...field("Required action", clientFacingText(gap.action ?? "Follow-up recorded in the Evidence Map.")), textLine("", { gap: 10 })]) },
  ];
  for (const [index, rule] of report.rules.entries()) {
    const title = clientFacingText(rule.displayTitle);
    const requirement = clientFacingText(rule.displayRequirement);
    const sameRequirement = requirement.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    sections.push({ title: `Rule Appendix ${index + 1} of ${report.rules.length}`, lines: [...field("Rule ID", rule.ruleId), ...field("Rule title", title), ...(sameRequirement ? [] : field("Methodology requirement", requirement)), ...field("Evidence state", rule.evidenceState), ...field("Reviewer outcome", rule.reviewerOutcome), ...field("Rationale", clientFacingText(rule.rationale)), ...field("Recommended action", clientFacingText(rule.recommendedAction ?? "None recorded."))] });
  }
  sections.push({ title: "Disclaimer", lines: [textLine("This document is an independent pre-validation readiness review and internal release candidate."), textLine("It does not provide a final assurance conclusion or positive release determination."), ...field("Release state", report.releaseStatus)] });
  const pages = sections.flatMap((section) => {
    const lines = expandLines(section.lines);
    const chunks: DrawLine[][] = [];
    let chunk: DrawLine[] = [];
    let height = 0;
    for (const line of lines) {
      if (chunk.length > 0 && height + line.advance > 650) {
        chunks.push(chunk);
        chunk = [];
        height = 0;
      }
      chunk.push(line);
      height += line.advance;
    }
    if (chunk.length > 0 || chunks.length === 0) chunks.push(chunk);
    return chunks.map((chunkLines, index) => ({ title: index === 0 ? section.title : `${section.title} (continued)`, lines: chunkLines }));
  });
  const totalPages = pages.length + 1;
  const streams = [page(report.title, 1, totalPages, "", expandLines([textLine(`Release status: ${report.releaseStatus}`)]), true), ...pages.map((section, index) => page(report.title, index + 2, totalPages, section.title, section.lines))];
  return assemble(streams);
}
