import { NextResponse } from 'next/server';
import type { Project, RuleReview, ProjectCoverage } from '@/lib/projects/types';

export const runtime = 'nodejs';

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function getCoverage(reviews: RuleReview[]): ProjectCoverage {
  const total = reviews.length;
  const verified = reviews.filter(r => r.status === 'verified').length;
  const gap = reviews.filter(r => r.status === 'gap').length;
  const notStarted = reviews.filter(r => r.status === 'not-started').length;
  const notApplicable = reviews.filter(r => r.status === 'not-applicable').length;
  const inProgress = reviews.filter(r => r.status === 'in-progress').length;
  const actionable = total - notApplicable;
  const percentComplete = actionable > 0 ? Math.round(((verified + gap) / actionable) * 100) : 0;
  return { total, verified, gap, notStarted, notApplicable, inProgress, percentComplete };
}

function buildPdf(project: Project, coverage: ProjectCoverage): Uint8Array {
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const lines: string[] = [];

  // Cover page
  lines.push('/F1 24 Tf', '72 700 Td', `(${esc(project.name)}) Tj`);
  lines.push('/F1 12 Tf', '0 -30 Td', `(${esc(project.methodCode)} @ ${esc(project.methodVersion)}) Tj`);
  lines.push('0 -18 Td', `(Status: ${esc(project.status.toUpperCase())}) Tj`);
  lines.push('0 -18 Td', `(Generated: ${now}) Tj`);
  if (project.aoiLabel) {
    lines.push('0 -18 Td', `(AOI: ${esc(project.aoiLabel)}) Tj`);
  }

  // Coverage
  lines.push('0 -40 Td', '/F1 16 Tf', '(Coverage Summary) Tj', '/F1 10 Tf');
  lines.push('0 -20 Td', `(Verified: ${coverage.verified}    Gaps: ${coverage.gap}    In Progress: ${coverage.inProgress}) Tj`);
  lines.push('0 -14 Td', `(Pending: ${coverage.notStarted}    N/A: ${coverage.notApplicable}) Tj`);
  lines.push('0 -14 Td', `(${coverage.percentComplete}% of actionable rules reviewed) Tj`);

  // Matrix header
  lines.push('0 -30 Td', '/F1 14 Tf', '(Requirement Coverage Matrix) Tj', '/F1 8 Tf');

  // Matrix rows
  let y = 680;
  for (const r of project.reviews) {
    if (y < 60) break; // safety
    const status = r.status === 'verified' ? 'V' : r.status === 'gap' ? 'G' : r.status === 'not-applicable' ? 'N/A' : r.status === 'in-progress' ? 'IP' : '-';
    const title = r.ruleTitle.length > 50 ? r.ruleTitle.slice(0, 47) + '...' : r.ruleTitle;
    lines.push(`0 -11 Td`, `(${esc(r.ruleId)}  ${status}  ${esc(title)}) Tj`);
    y -= 11;
  }

  // Gap summary
  const gaps = project.reviews.filter(r => r.status === 'gap' || r.status === 'not-started');
  if (gaps.length > 0) {
    lines.push('/F1 14 Tf', '0 -24 Td', '(Gap Summary) Tj', '/F1 8 Tf');
    for (const r of gaps) {
      lines.push('0 -11 Td', `(${esc(r.ruleId)}  ${esc(r.status)}  ${esc(r.ruleTitle)}) Tj`);
    }
  }

  // Provenance
  lines.push('/F1 14 Tf', '0 -24 Td', '(Provenance) Tj', '/F1 9 Tf');
  lines.push('0 -16 Td', `(Project: ${esc(project.id)}) Tj`);
  lines.push('0 -12 Td', `(Method: ${esc(project.methodCode)} @ ${esc(project.methodVersion)}) Tj`);
  lines.push('0 -12 Td', `(Created: ${project.createdAt}) Tj`);
  lines.push('0 -12 Td', `(Export: ${now}) Tj`);

  const stream = ['BT', ...lines, 'ET'].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += `${offsets.length} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const project = body.project as Project | undefined;

    if (!project || !project.reviews?.length) {
      return NextResponse.json({ error: 'Invalid project data' }, { status: 400 });
    }

    const coverage = getCoverage(project.reviews);
    const pdf = buildPdf(project, coverage);
    const filename = `verification-pack-${project.methodCode}-${project.id.slice(0, 8)}.pdf`;

    const buffer = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength);
    const blob = new Blob([buffer], { type: 'application/pdf' });
    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'PDF generation failed', detail: String(err) }, { status: 500 });
  }
}
