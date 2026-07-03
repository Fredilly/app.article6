import {
  getPriorityClientActionRows,
  groupEvidenceMapRowsByStatus,
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
  const priorityRows = getPriorityClientActionRows(report.evidenceMapRows);
  const groupedRows = groupEvidenceMapRowsByStatus(report.evidenceMapRows);
  const lines: string[] = [
    report.reportName,
    `Project: ${report.project.name}`,
    `Methodology: ${report.methodology.code} ${report.methodology.version} - ${report.methodology.name}`,
    `Generated: ${report.generatedAt}`,
    "Internal Envira VM0007 cover and introduction",
    "This internal preview packages reviewed Envira VM0007 fixture truth into a reusable report shape for analysis, QA, and export.",
    report.limitationBanner,
    report.summary.headline,
    "Executive Summary",
    `FOUND: ${report.summary.counts.FOUND}`,
    `UNCLEAR: ${report.summary.counts.UNCLEAR}`,
    `MISSING: ${report.summary.counts.MISSING}`,
    `N/A: ${report.summary.counts["N/A"]}`,
    `Total rules: ${report.summary.totalRules}`,
    `Priority follow-up rows: ${priorityRows.length}`,
    "Priority Client Actions",
    "Only UNCLEAR and MISSING rows appear in this section.",
  ];

  for (const row of priorityRows) {
    lines.push(`Priority action rule: ${row.ruleId}`);
    lines.push(`Priority action rule name: ${row.ruleName}`);
    lines.push(`Priority action status: ${row.status}`);
    lines.push(`Priority action reason: ${row.whyEvidenceIsAccepted}`);
    if (row.clientAction) {
      lines.push(`Priority client action: ${row.clientAction}`);
    }
  }

  lines.push(
    "Evidence Map",
    "All 58 VM0007 rows remain visible below, grouped by reviewed status without changing fixture-backed truth.",
  );

  for (const group of groupedRows) {
    lines.push("");
    lines.push(`Status group: ${group.status}`);
    lines.push(`Status group count: ${group.rows.length}`);
    for (const row of group.rows) {
      lines.push(`Rule ID: ${row.ruleId}`);
      lines.push(`Rule name: ${row.ruleName}`);
      lines.push(`Status: ${row.status}`);
      lines.push(`Accepted quote: ${row.acceptedQuote ?? "No accepted quote encoded in fixture truth."}`);
      if (row.page != null) {
        lines.push(`Page number: ${row.page}`);
      }
      if (row.sectionHeading) {
        lines.push(`Section heading: ${row.sectionHeading}`);
      }
      if (row.spanId) {
        lines.push(`Span ID: ${row.spanId}`);
      }
      lines.push(`Accepted reason: ${row.whyEvidenceIsAccepted}`);
      for (const rejected of row.rejectedEvidenceExamples) {
        lines.push(`Rejected evidence quote: ${rejected.quote}`);
        lines.push(`Rejection reason: ${rejected.rejectionReason}`);
      }
      if (row.rejectedEvidenceExamples.length > 0 && row.whyRejectedEvidenceIsNotEnough) {
        lines.push(`Why rejected evidence is not enough: ${row.whyRejectedEvidenceIsNotEnough}`);
      }
      if (row.clientAction) {
        lines.push(`Client action: ${row.clientAction}`);
      }
      if (row.naReason) {
        lines.push(`N/A reason: ${row.naReason}`);
      }
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
