import type { Vm0007FixtureBackedReport, Vm0007FixtureBackedStatus } from "@/lib/preverif/fixtureBackedVm0007Report";

function esc(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function asciiSafeText(input: string): string {
  return input
    .replace(/[\\u2018\\u2019]/g, "'")
    .replace(/[\\u201C\\u201D]/g, '"')
    .replace(/[\\u2013\\u2014]/g, "-")
    .replace(/\\u2022/g, "-")
    .replace(/\\u00B7/g, "-")
    .replace(/[^\\x09\\x0A\\x0D\\x20-\\x7E]/g, "");
}

function wrapText(text: string, max = 96): string[] {
  const words = asciiSafeText(text).split(/\\s+/).filter(Boolean);
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

function statusPriority(status: Vm0007FixtureBackedStatus): number {
  if (status === "MISSING") return 0;
  if (status === "UNCLEAR") return 1;
  if (status === "FOUND") return 2;
  return 3;
}

function buildReportLines(report: Vm0007FixtureBackedReport): string[] {
  const lines: string[] = [];

  // ── Cover / Intro ──
  lines.push("=".repeat(72));
  lines.push("VM0007  Fixture-backed evidence report  Internal");
  lines.push("=".repeat(72));
  lines.push("");
  lines.push(report.reportName);
  lines.push(`Project: ${report.project.name}`);
  lines.push(`Methodology: ${report.methodology.code} ${report.methodology.version} - ${report.methodology.name}`);
  lines.push(`Report ID: ${report.reportId}`);
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push("");
  lines.push(`[!] ${report.limitationBanner}`);
  lines.push("");
  lines.push(report.summary.headline);
  lines.push("");

  // ── Executive Summary ──
  lines.push("-".repeat(72));
  lines.push("Executive Summary");
  lines.push("-".repeat(72));
  lines.push("");
  lines.push(`${report.summary.totalRules} VM0007 rules rendered from reviewed fixture truth.`);
  lines.push("");
  lines.push(`  FOUND:    ${report.summary.counts.FOUND}`);
  lines.push(`  UNCLEAR:  ${report.summary.counts.UNCLEAR}`);
  lines.push(`  MISSING:  ${report.summary.counts.MISSING}`);
  lines.push(`  N/A:      ${report.summary.counts["N/A"]}`);
  lines.push(`  Total:    ${report.summary.totalRules}`);
  lines.push("");

  // ── Priority Client Actions (MISSING + UNCLEAR only) ──
  const priorityActions = [...report.evidenceMapRows]
    .filter((row) => row.status === "MISSING" || row.status === "UNCLEAR")
    .sort((a, b) => statusPriority(a.status) - statusPriority(b.status));

  if (priorityActions.length > 0) {
    lines.push("-".repeat(72));
    lines.push("Priority Client Actions");
    lines.push("Follow-up for MISSING and UNCLEAR evidence.");
    lines.push("-".repeat(72));
    lines.push("");

    for (const row of priorityActions) {
      lines.push(`  [${row.status}] ${row.ruleId} - ${row.ruleName}`);
      if (row.acceptedQuote) {
        lines.push(`    Current PDD evidence: ${row.acceptedQuote}`);
      }
      lines.push(`    Why: ${row.whyEvidenceIsAccepted}`);
      if (row.clientAction) {
        lines.push(`    Action needed: ${row.clientAction}`);
      }
      if (row.sectionHeading || row.page) {
        const parts: string[] = [];
        if (row.sectionHeading) parts.push(`Section: ${row.sectionHeading}`);
        if (row.page) parts.push(`Page ${row.page}`);
        lines.push(`    ${parts.join(" - ")}`);
      }
      lines.push("");
    }
  }

  // ── Evidence Map (grouped: MISSING / UNCLEAR / FOUND / N/A) ──
  const grouped = [...report.evidenceMapRows].sort((a, b) => {
    const r = statusPriority(a.status) - statusPriority(b.status);
    return r !== 0 ? r : a.ruleId.localeCompare(b.ruleId);
  });

  if (grouped.length > 0) {
    lines.push("=".repeat(72));
    lines.push("Evidence Map");
    lines.push("All 58 VM0007 rules grouped by status - MISSING first, then UNCLEAR, FOUND, and N/A.");
    lines.push("=".repeat(72));
    lines.push("");

    let lastStatus: Vm0007FixtureBackedStatus | null = null;
    for (const row of grouped) {
      if (row.status !== lastStatus) {
        lines.push(`--- ${row.status} ---`);
        lastStatus = row.status;
      }
      lines.push(`  ${row.ruleId}  ${row.ruleName}`);
      lines.push(`    Status: ${row.status}`);
      if (row.acceptedQuote) {
        lines.push(`    PDD quote: ${row.acceptedQuote}`);
      } else {
        lines.push(`    PDD quote: No accepted quote encoded in fixture truth.`);
      }
      if (row.page || row.sectionHeading) {
        const parts: string[] = [];
        if (row.sectionHeading) parts.push(row.sectionHeading);
        if (row.page) parts.push(`p.${row.page}`);
        lines.push(`    ${parts.join(" - ")}`);
      }
      if (row.whyEvidenceIsAccepted) {
        lines.push(`    Why: ${row.whyEvidenceIsAccepted}`);
      }
      if (row.rejectedEvidenceExamples.length > 0) {
        for (const rej of row.rejectedEvidenceExamples) {
          lines.push(`    Rejected: ${rej.quote}`);
          lines.push(`      Reason: ${rej.rejectionReason}`);
        }
      }
      if (row.clientAction) {
        lines.push(`    Client action: ${row.clientAction}`);
      }
      if (row.naReason) {
        lines.push(`    N/A reason: ${row.naReason}`);
      }
      lines.push("");
    }
  }

  // ── Disclaimer ──
  lines.push("-".repeat(72));
  lines.push("Internal preview only.");
  lines.push("This report is generated from fixture-backed audit data and is not");
  lines.push("reviewed, certified, or client-ready. All findings are subject to");
  lines.push("manual review.");
  lines.push("-".repeat(72));

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
