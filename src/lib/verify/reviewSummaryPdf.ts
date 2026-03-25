import { reviewSummaryRows, type ReviewSummary } from "@/lib/verify/buildReviewSummary";

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function buildReviewSummaryPdf(summary: ReviewSummary): Uint8Array {
  const rows = reviewSummaryRows(summary);
  const lines = ["Review Summary", "", ...rows.map((row) => `${row.label}: ${row.value}`)];

  const content: string[] = ["BT", "/F1 18 Tf", "72 760 Td", `(${escapePdfText(lines[0] ?? "Review Summary")}) Tj`, "/F1 10 Tf"];
  let firstBodyLine = true;
  for (const line of lines.slice(1)) {
    content.push(firstBodyLine ? "0 -24 Td" : "0 -14 Td");
    firstBodyLine = false;
    content.push(`(${escapePdfText(line)}) Tj`);
  }
  content.push("ET");
  const stream = content.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}
