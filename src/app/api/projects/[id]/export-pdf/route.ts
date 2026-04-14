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

function statusSym(s: string): string {
  if (s === 'verified') return '\u2713';   // ✓
  if (s === 'gap') return '\u2717';        // ✗
  if (s === 'in-progress') return '\u25CB'; // ○
  if (s === 'not-applicable') return '\u2014'; // —
  return '\u25CB'; // pending
}

function buildPdf(project: Project, coverage: ProjectCoverage): Uint8Array {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const W = 612;
  const TOP = 760;
  const BOT = 50;
  const L = 56; // left margin
  const R = W - 56; // right margin

  const objs: string[] = [];
  const pages: number[] = [];



  function textStream(lines: string[]): string {
    return ['BT', ...lines, 'ET'].join('\n');
  }

  function addStream(stream: string): number {
    const idx = objs.length;
    objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    return idx + 1; // 1-based
  }

  function addPage(contentRef: number): number {
    const fontR = objs.length + 1;
    objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const fontB = objs.length + 1;
    objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    const idx = objs.length;
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} 792] /Resources << /Font << /F1 ${fontR} 0 R /FB ${fontB} 0 R >> >> /Contents ${contentRef} 0 R >>`);
    pages.push(idx);
    return idx + 1;
  }

  // Helper: draw a horizontal line
  function hLine(y: number): string {
    return `0.85 G ${L} ${y} m ${R} ${y} l S 0 G`;
  }

  // Helper: draw a filled rectangle
  function rect(x: number, y: number, w: number, h: number, g: number): string {
    return `${g} g ${x} ${y} ${w} ${h} re f 0 g`;
  }

  // --- Cover page ---
  const coverLines = [
    // Top bar
    rect(0, 700, W, 92, 0.14),
    // Title on bar
    '/FB 28 Tf', `0.95 0.95 0.95 rg`,
    `${L} 740 Td`, `(${esc(project.name)}) Tj`,
    '/FB 11 Tf',
    '0 -24 Td', `(Verification Pack) Tj`,
    '0 g',
    // Method
    '/F1 13 Tf', `${L} 650 Td`,
    `(${esc(project.methodCode)} @ ${esc(project.methodVersion)}) Tj`,
  ];

  if (project.aoiLabel) {
    coverLines.push('0 -22 Td', `(${esc(project.aoiLabel)}) Tj`);
  }

  coverLines.push(
    '0 -22 Td', `(${esc(project.status.toUpperCase())}) Tj`,
    '0 -22 Td', `(Generated: ${now}) Tj`,
    // Divider
    hLine(580),
    // Stats
    '/FB 10 Tf', `${L} 555 Td`, '(REVIEW COVERAGE) Tj',
    '/F1 26 Tf',
    `0.15 0.65 0.3 rg`,
    '0 -36 Td', `(${coverage.percentComplete}%) Tj`,
    '0 g',
    '/F1 10 Tf',
    '0 -16 Td',
    `(${coverage.verified} verified   ${coverage.gap} gaps   ${coverage.inProgress} in progress   ${coverage.notStarted} pending) Tj`,
    hLine(480),
    '/F1 8 Tf', `${L} 455 Td`, `(${coverage.total} rules across ${Object.keys(project.reviews.reduce((a, r) => ({ ...a, [r.sectionId]: 1 }), {} as Record<string, number>)).length} sections) Tj`,
    // Footer
    '/F1 7 Tf', `${L} 60 Td`, '(app.article6) Tj',
  );

  const coverRef = addStream(textStream(coverLines));
  addPage(coverRef);

  // --- Content pages ---
  const grouped = project.reviews.reduce((acc, r) => {
    if (!acc[r.sectionId]) acc[r.sectionId] = [];
    acc[r.sectionId].push(r);
    return acc;
  }, {} as Record<string, RuleReview[]>);

  const allReviews = Object.entries(grouped);
  let pageLines: string[] = [];
  let y = TOP;
  let pageNum = 1;

  function flushPage(): void {
    if (pageLines.length === 0) return;
    // Add header bar and page number to content pages
    const header = [
      rect(0, TOP + 8, W, 24, 0.95),
      hLine(TOP + 8, 0.88),
      '/FB 9 Tf',
      `0.4 0.4 0.4 rg`,
      `${L} ${TOP + 12} Td`,
      `(app.article6) Tj`,
      `/F1 8 Tf`,
      `(${esc(project.name)}) Tj`,
      `/F1 8 Tf`,
      `(  Page ${pageNum + 1}) Tj`,
      '0 g',
    ];
    const stream = textStream([...header, ...pageLines]);
    const contentRef = addStream(stream);
    addPage(contentRef);
    pageLines = [];
    y = TOP - 10;
    pageNum++;
  }

  function needSpace(needed: number): void {
    if (y - needed < BOT) {
      flushPage();
    }
  }

  // Section header
  function sectionHeader(label: string): void {
    needSpace(40);
    pageLines.push(
      rect(L, y - 2, R - L, 18, 0.96),
      `/FB 10 Tf`,
      `0.25 0.25 0.25 rg`,
      `${L + 8} ${y} Td`,
      `(${esc(label)}) Tj`,
      '0 g',
    );
    y -= 28;
  }

  // Column headers
  function columnHeaders(): void {
    needSpace(20);
    pageLines.push(
      hLine(y + 4, 0.82),
      '/FB 7 Tf',
      `0.55 0.55 0.55 rg`,
      `${L} ${y} Td`,
      '(RULE) Tj',
      `160 0 Td`,
      '(TITLE) Tj',
      `340 0 Td`,
      '(STATUS) Tj',
      '0 g',
    );
    y -= 18;
  }

  // Coverage page
  sectionHeader('COVERAGE SUMMARY');
  const covItems = [
    ['Verified', String(coverage.verified), '0.2 0.55 0.3'],
    ['Gaps', String(coverage.gap), '0.8 0.2 0.2'],
    ['In Progress', String(coverage.inProgress), '0.8 0.6 0.1'],
    ['Pending', String(coverage.notStarted), '0.6 0.6 0.6'],
    ['N/A', String(coverage.notApplicable), '0.8 0.8 0.8'],
  ];
  let cx = L;
  for (const [label, val, color] of covItems) {
    const [r, g, b] = color.split(' ').map(Number);
    pageLines.push(
      `/FB 18 Tf`,
      `${r} ${g} ${b} rg`,
      `${cx} ${y} Td`,
      `(${val}) Tj`,
      '0 g',
      '/F1 7 Tf',
      '0 -14 Td',
      `(${label}) Tj`,
      '0 14 Td',
    );
    cx += 96;
  }
  y -= 40;

  // Progress bar
  const barW = R - L;
  const fillW = Math.max(4, barW * coverage.percentComplete / 100);
  pageLines.push(
    rect(L, y, barW, 6, 0.93),
    rect(L, y, fillW, 6, 0.22),
  );
  y -= 20;

  // Rules by section
  for (const [sectionId, reviews] of allReviews) {
    sectionHeader(sectionId);
    columnHeaders();

    for (const r of reviews) {
      needSpace(16);
      const title = r.ruleTitle.length > 48 ? r.ruleTitle.slice(0, 45) + '...' : r.ruleTitle;
      const sym = statusSym(r.status);

      // Alternating row background
      const isAlt = reviews.indexOf(r) % 2 === 1;
      if (isAlt) {
        pageLines.push(rect(L, y - 2, R - L, 14, 0.97));
      }

      const statusGray = r.status === 'verified' ? 0.3 : r.status === 'gap' ? 0.5 : 0.7;

      pageLines.push(
        '/F1 8 Tf',
        `0.4 0.4 0.4 rg`,
        `${L} ${y} Td`,
        `(${esc(r.ruleId)}) Tj`,
        `0 g`,
        `0.15 0.15 0.15 rg`,
        `110 0 Td`,
        `(${esc(title)}) Tj`,
        '0 g',
        `${statusGray} ${statusGray} ${statusGray} g`,
        `340 0 Td`,
        `(${sym}) Tj`,
        `8 0 Td`,
        `/FB 7 Tf`,
        `(${esc(r.status === 'not-started' ? 'PENDING' : r.status.toUpperCase())}) Tj`,
        '0 g',
      );
      y -= 16;
    }
    y -= 8;
  }

  // Gap summary
  const gaps = project.reviews.filter(r => r.status === 'gap' || r.status === 'not-started');
  if (gaps.length > 0) {
    sectionHeader(`OPEN GAPS (${gaps.length})`);
    columnHeaders();

    for (const r of gaps) {
      needSpace(16);
      const title = r.ruleTitle.length > 48 ? r.ruleTitle.slice(0, 45) + '...' : r.ruleTitle;
      pageLines.push(
        '/F1 8 Tf',
        `0.4 0.4 0.4 rg`,
        `${L} ${y} Td`,
        `(${esc(r.ruleId)}) Tj`,
        `0 g`,
        `0.15 0.15 0.15 rg`,
        `110 0 Td`,
        `(${esc(title)}) Tj`,
        '0 g',
        `0.5 0.5 0.5 g`,
        `340 0 Td`,
        `(${esc(r.status)}) Tj`,
        '0 g',
      );
      y -= 16;
    }
    y -= 8;
  }

  // Provenance
  sectionHeader('PROVENANCE');
  const provItems = [
    ['Project ID', project.id],
    ['Methodology', `${project.methodCode} @ ${project.methodVersion}`],
    ['Created', project.createdAt],
    ['Status', project.status],
    ['Export', now],
    ['Rules Reviewed', `${coverage.verified + coverage.gap} / ${coverage.total}`],
  ];

  for (const [label, value] of provItems) {
    needSpace(18);
    pageLines.push(
      '/FB 8 Tf',
      `0.4 0.4 0.4 rg`,
      `${L} ${y} Td`,
      `(${esc(label)}) Tj`,
      '0 g',
      '/F1 8 Tf',
      `0.15 0.15 0.15 rg`,
      `140 0 Td`,
      `(${esc(String(value))}) Tj`,
      '0 g',
    );
    y -= 16;
  }

  // Disclaimer
  needSpace(30);
  pageLines.push(
    hLine(y, 0.9),
    '/F1 7 Tf',
    `0.7 0.7 0.7 rg`,
    `${L} ${y - 12} Td`,
    '(This verification pack is generated by app.article6 and does not constitute a formal certification opinion.) Tj',
    '0 g',
  );

  // Flush last page
  flushPage();

  // --- Assemble PDF ---
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];

  for (let i = 0; i < objs.length; i++) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objs[i]}\nendobj\n`;
  }

  const catalogNum = objs.length + 1;
  offsets.push(pdf.length);
  pdf += `${catalogNum} 0 obj\n<< /Type /Catalog /Pages ${catalogNum + 1} 0 R >>\nendobj\n`;

  const pagesNum = catalogNum + 1;
  offsets.push(pdf.length);
  pdf += `${pagesNum} 0 obj\n<< /Type /Pages /Kids [${pages.map(p => `${p + 1} 0 R`).join(' ')}] /Count ${pages.length} >>\nendobj\n`;

  const xrefOffset = pdf.length;
  const totalObjs = pagesNum;
  pdf += `xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`;
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
