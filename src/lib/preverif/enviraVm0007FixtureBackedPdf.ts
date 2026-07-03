import {
  getPriorityClientActionRows,
  groupEvidenceMapRowsByStatus,
  type Vm0007EvidenceMapRow,
  type Vm0007FixtureBackedReport,
} from "@/lib/preverif/fixtureBackedVm0007Report";

function esc(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function asciiSafeText(input: string): string {
  return input
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2022/g, "-")
    .replace(/\u00B7/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function maybeLine(label: string, value: string | number | null | undefined): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return `${label}: ${text}`;
}

function buildEvidenceRowLines(row: Vm0007EvidenceMapRow): string[] {
  const lines: string[] = [`Rule ID: ${row.ruleId}`, `Rule name: ${row.ruleName}`, `Status: ${row.status}`];

  if (row.status === "FOUND") {
    if (row.acceptedQuote) lines.push(`Accepted quote: ${row.acceptedQuote}`);
    const pageLine = maybeLine("Page", row.page);
    const sectionLine = maybeLine("Section", row.sectionHeading);
    if (pageLine) lines.push(pageLine);
    if (sectionLine) lines.push(sectionLine);
    lines.push(`Accepted reason: ${row.whyEvidenceIsAccepted}`);
    return lines;
  }

  if (row.status === "UNCLEAR") {
    if (row.acceptedQuote) lines.push(`Weak quote: ${row.acceptedQuote}`);
    lines.push(`Why this is insufficient: ${row.whyEvidenceIsAccepted}`);
    if (row.rejectedEvidenceExamples.length > 0) {
      lines.push("Rejected evidence:");
      for (const rejected of row.rejectedEvidenceExamples) {
        lines.push(`- ${rejected.quote}`);
        lines.push(`Rejection reason: ${rejected.rejectionReason}`);
      }
      if (row.whyRejectedEvidenceIsNotEnough) {
        lines.push(`Why the rejected evidence is not enough: ${row.whyRejectedEvidenceIsNotEnough}`);
      }
    }
    if (row.clientAction) lines.push(`Client action: ${row.clientAction}`);
    return lines;
  }

  if (row.status === "MISSING") {
    lines.push(`Missing reason: ${row.whyEvidenceIsAccepted}`);
    if (row.clientAction) lines.push(`Client action: ${row.clientAction}`);
    return lines;
  }

  if (row.naReason) lines.push(`N/A reason: ${row.naReason}`);
  return lines;
}

function buildPriorityActionLines(report: Vm0007FixtureBackedReport): string[] {
  const lines: string[] = ["Priority Client Actions"];
  for (const row of getPriorityClientActionRows(report.evidenceMapRows)) {
    lines.push(`Rule ID: ${row.ruleId}`);
    lines.push(`Rule name: ${row.ruleName}`);
    lines.push(`Status: ${row.status}`);
    lines.push(row.status === "MISSING" ? `Missing reason: ${row.whyEvidenceIsAccepted}` : `Weak evidence reason: ${row.whyEvidenceIsAccepted}`);
    if (row.clientAction) lines.push(`Client action: ${row.clientAction}`);
    if (row.status === "UNCLEAR" && row.rejectedEvidenceExamples.length > 0) {
      for (const rejected of row.rejectedEvidenceExamples) {
        lines.push(`Rejected evidence: ${rejected.quote}`);
        lines.push(`Rejection reason: ${rejected.rejectionReason}`);
      }
    }
  }
  return lines;
}

function wrapText(text: string, max = 96): string[] {
  const words = asciiSafeText(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= max) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}

function buildReportLines(report: Vm0007FixtureBackedReport): string[] {
  const groupedRows = groupEvidenceMapRowsByStatus(report.evidenceMapRows);
  const lines: string[] = [
    report.reportName,
    "Envira VM0007 Evidence Map",
    "Internal fixture-backed preview",
    "Not client-ready",
    "Based on PDF-backed fixture truth",
    "Purpose: show supported, weak, missing, and non-applicable methodology evidence",
    `Project name: ${report.project.name}`,
    report.project.description,
    `Methodology: ${report.methodology.code} ${report.methodology.version} - ${report.methodology.name}`,
    `Generated: ${report.generatedAt}`,
    report.limitationBanner,
    `FOUND: ${report.summary.counts.FOUND}`,
    `UNCLEAR: ${report.summary.counts.UNCLEAR}`,
    `MISSING: ${report.summary.counts.MISSING}`,
    `N/A: ${report.summary.counts["N/A"]}`,
    `Total rules: ${report.summary.totalRules}`,
    report.summary.headline,
  ];

  lines.push("");
  lines.push(...buildPriorityActionLines(report));
  lines.push("");
  lines.push("Evidence Map");
  lines.push("Rows are grouped by reviewed status and preserve the reviewed fixture truth.");

  for (const group of groupedRows) {
    lines.push("");
    lines.push(`${group.status} - ${group.rows.length}`);
    for (const row of group.rows) {
      lines.push("");
      lines.push(...buildEvidenceRowLines(row));
    }
  }

  return lines.flatMap((line) => wrapText(line));
}

function buildPages(lines: string[], linesPerPage = 56): string[][] {
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage));
  }
  return pages;
}

function buildContentStream(lines: string[]): string {
  const commands = ["BT", "/F1 9 Tf", "50 770 Td"];
  lines.forEach((line, index) => {
    if (index > 0) commands.push("0 -12 Td");
    commands.push(`(${esc(line)}) Tj`);
  });
  commands.push("ET");
  return commands.join("\n");
}

export function buildEnviraVm0007FixtureBackedPdf(report: Vm0007FixtureBackedReport): Buffer {
  const pageLines = buildPages(buildReportLines(report));
  const objects: string[] = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  const pageObjectNumbers = pageLines.map((_, index) => 4 + index * 2);
  objects.push(`<< /Type /Pages /Kids [${pageObjectNumbers.map((num) => `${num} 0 R`).join(" ")}] /Count ${pageLines.length} >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  pageLines.forEach((lines, index) => {
    const pageObjectNumber = 4 + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    const stream = buildContentStream(lines);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
    );
    objects.push(`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`);
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}
