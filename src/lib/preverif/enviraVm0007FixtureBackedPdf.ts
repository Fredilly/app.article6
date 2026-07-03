import type { Vm0007FixtureBackedReport } from "@/lib/preverif/fixtureBackedVm0007Report";

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
  const lines: string[] = [
    report.reportName,
    `Project: ${report.project.name}`,
    `Methodology: ${report.methodology.code} ${report.methodology.version} - ${report.methodology.name}`,
    `Generated: ${report.generatedAt}`,
    report.limitationBanner,
    report.summary.headline,
    "Summary counts",
    `FOUND: ${report.summary.counts.FOUND}`,
    `UNCLEAR: ${report.summary.counts.UNCLEAR}`,
    `MISSING: ${report.summary.counts.MISSING}`,
    `N/A: ${report.summary.counts["N/A"]}`,
    `Total rules: ${report.summary.totalRules}`,
    "Evidence Map",
    "Each row reflects reviewed fixture truth for a single VM0007 rule. UNCLEAR and MISSING rows remain visible for internal follow-up.",
  ];

  for (const row of report.evidenceMapRows) {
    lines.push("");
    lines.push(`Rule ID: ${row.ruleId}`);
    lines.push(`Rule name: ${row.ruleName}`);
    lines.push(`Status: ${row.status}`);
    lines.push(`Accepted quote: ${row.acceptedQuote ?? "No accepted quote encoded in fixture truth."}`);
    lines.push(`Page number: ${row.page ?? "Not available"}`);
    lines.push(`Section heading: ${row.sectionHeading ?? "Not available"}`);
    lines.push(`Span ID: ${row.spanId ?? "Not available"}`);
    lines.push(`Accepted reason: ${row.whyEvidenceIsAccepted}`);
    if (row.rejectedEvidenceExamples.length === 0) {
      lines.push("Rejected evidence examples: No rejected evidence examples encoded for this row.");
    } else {
      lines.push("Rejected evidence examples:");
      for (const rejected of row.rejectedEvidenceExamples) {
        lines.push(`Rejected evidence quote: ${rejected.quote}`);
        lines.push(`Rejection reason: ${rejected.rejectionReason}`);
      }
    }
    lines.push(`Why rejected evidence is not enough: ${row.whyRejectedEvidenceIsNotEnough ?? "No rejected evidence explanation encoded for this row."}`);
    lines.push(`Client action: ${row.clientAction ?? "No client action required for this row."}`);
    lines.push(`N/A reason: ${row.naReason ?? "This row is not marked N/A."}`);
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
