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

function statusLabel(s: string): string {
  if (s === 'verified') return 'VERIFIED';
  if (s === 'gap') return 'GAP';
  if (s === 'not-applicable') return 'N/A';
  if (s === 'in-progress') return 'IN PROGRESS';
  return 'PENDING';
}

function buildPdf(project: Project, coverage: ProjectCoverage): Uint8Array {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const PAGE_W = 612;
  const MARGIN_TOP = 756;
  const PAGE_BREAK = 60;

  const objects: string[] = [];
  const pageObjects: number[] = [];

  function makePage(lines: string[]): void {
    const stream = ['BT', ...lines, 'ET'].join('\n');
    const contentIdx = objects.length;
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const fontIdx = objects.length;
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const fontBoldIdx = objects.length;
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    const pageIdx = objects.length;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} 792] /Resources << /Font << /F1 ${fontIdx + 1} 0 R /FB ${fontBoldIdx + 1} 0 R >> >> /Contents ${contentIdx + 1} 0 R >>`
    );
    pageObjects.push(pageIdx);
  }

  // --- Cover page ---
  makePage([
    '/FB 24 Tf', '56 580 Td', `(${esc(project.name)}) Tj`,
    '/F1 12 Tf', '0 -36 Td', `(${esc(project.methodCode)} @ ${esc(project.methodVersion)}) Tj`,
    '0 -20 Td', `(Status: ${esc(project.status.toUpperCase())}) Tj`,
    '0 -16 Td', `(Generated: ${now}) Tj`,
    ...(project.aoiLabel ? ['0 -16 Td', `(AOI: ${esc(project.aoiLabel)}) Tj`] : []),
    '/FB 10 Tf', '0 -48 Td', '(VERIFICATION PACK) Tj',
  ]);

  // --- Content pages ---
  const grouped = project.reviews.reduce((acc, r) => {
    if (!acc[r.sectionId]) acc[r.sectionId] = [];
    acc[r.sectionId].push(r);
    return acc;
  }, {} as Record<string, RuleReview[]>);

  // Coverage section header
  let pageLines: string[] = [];
  let y = MARGIN_TOP;

  function startNewPage(): void {
    if (pageLines.length > 0) {
      makePage(pageLines);
    }
    pageLines = [];
    y = MARGIN_TOP;
  }

  // Coverage header
  pageLines.push(
    '/FB 14 Tf', `${56} ${y} Td`, '(COVERAGE SUMMARY) Tj',
    '/F1 10 Tf',
    '0 -28 Td', `(Verified: ${coverage.verified}    Gaps: ${coverage.gap}    In Progress: ${coverage.inProgress}) Tj`,
    '0 -16 Td', `(Pending: ${coverage.notStarted}    N/A: ${coverage.notApplicable}) Tj`,
    '0 -16 Td', `(${coverage.percentComplete}% of actionable rules reviewed) Tj`,
  );
  y -= 60;

  // Requirement matrix by section
  for (const [sectionId, reviews] of Object.entries(grouped)) {
    if (y < PAGE_BREAK) startNewPage();
    pageLines.push('/FB 11 Tf', '0 -24 Td', `(${esc(sectionId)}) Tj`);
    y -= 24;
    pageLines.push('/F1 8 Tf');
    for (const r of reviews) {
      if (y < PAGE_BREAK) {
        startNewPage();
        pageLines.push('/FB 11 Tf', '0 -24 Td', `(${esc(sectionId)} continued) Tj`);
        y -= 24;
        pageLines.push('/F1 8 Tf');
      }
      const title = r.ruleTitle.length > 55 ? r.ruleTitle.slice(0, 52) + '...' : r.ruleTitle;
      pageLines.push('0 -14 Td', `(${esc(r.ruleId)}  ${statusLabel(r.status)}  ${esc(title)}) Tj`);
      y -= 14;
    }
  }

  // Gap summary
  const gaps = project.reviews.filter(r => r.status === 'gap' || r.status === 'not-started');
  if (gaps.length > 0) {
    if (y < PAGE_BREAK * 2) startNewPage();
    pageLines.push('/FB 14 Tf', '0 -28 Td', '(OPEN GAPS) Tj', '/F1 8 Tf');
    y -= 40;
    for (const r of gaps) {
      if (y < PAGE_BREAK) startNewPage();
      const title = r.ruleTitle.length > 60 ? r.ruleTitle.slice(0, 57) + '...' : r.ruleTitle;
      pageLines.push('0 -14 Td', `(${esc(r.ruleId)}  ${esc(r.status)}  ${esc(title)}) Tj`);
      y -= 14;
    }
  }

  // Provenance
  if (y < PAGE_BREAK) startNewPage();
  pageLines.push(
    '/FB 14 Tf', '0 -28 Td', '(PROVENANCE) Tj',
    '/F1 9 Tf',
    '0 -20 Td', `(Project: ${esc(project.id)}) Tj`,
    '0 -14 Td', `(Method: ${esc(project.methodCode)} @ ${esc(project.methodVersion)}) Tj`,
    '0 -14 Td', `(Created: ${project.createdAt}) Tj`,
    '0 -14 Td', `(Export: ${now}) Tj`,
    '0 -14 Td', `(Rules Reviewed: ${coverage.verified + coverage.gap} / ${coverage.total}) Tj`,
    '/F1 7 Tf',
    '0 -36 Td',
    '(Verification pack generated by app.article6 -- not a formal certification opinion) Tj',
  );

  // Flush last page
  if (pageObjects.length === 0 || pageLines.length > 2) {
    makePage(pageLines);
  }

  // --- Assemble PDF ---
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];

  // Write content/font/page objects (1-indexed, skipping 0)
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  // Catalog
  const catalogNum = objects.length + 1;
  offsets.push(pdf.length);
  pdf += `${catalogNum} 0 obj\n<< /Type /Catalog /Pages ${catalogNum + 1} 0 R >>\nendobj\n`;

  // Pages
  const pagesNum = catalogNum + 1;
  offsets.push(pdf.length);
  pdf += `${pagesNum} 0 obj\n<< /Type /Pages /Kids [${pageObjects.map(p => `${p + 1} 0 R`).join(' ')}] /Count ${pageObjects.length} >>\nendobj\n`;

  const xrefOffset = pdf.length;
  const totalObjs = pagesNum;
  pdf += `xref\n0 ${totalObjs + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= totalObjs; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${totalObjs + 1} /Root ${catalogNum} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

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

    const ab = new ArrayBuffer(pdf.byteLength);
    new Uint8Array(ab).set(pdf);
    const blob = new Blob([ab], { type: 'application/pdf' });

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
