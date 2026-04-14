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

function sym(s: string): string {
  if (s === 'verified') return '\u2713';
  if (s === 'gap') return '\u2717';
  return '\u25CB';
}

function buildPdf(project: Project, coverage: ProjectCoverage): Buffer {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const W = 612, TOP = 760, BOT = 50, L = 56, R = W - 56;
  const LN = (y: number) => `0.85 G ${L} ${y} m ${R} ${y} l S 0 G`;
  const RC = (x: number, y: number, w: number, h: number, g: number) => `${g} g ${x} ${y} ${w} ${h} re f 0 g`;

  // Collect streams per page
  const streams: string[] = [];
  let ln: string[] = [];
  let y = TOP;
  let pg = 0;

  function flush(): void {
    if (ln.length === 0) return;
    const hdr = [
      RC(0, TOP + 8, W, 24, 0.95), LN(TOP + 8),
      '/FB 9 Tf', '0.4 0.4 0.4 rg',
      `${L} ${TOP + 12} Td`, '(app.article6) Tj',
      '/F1 8 Tf', `(${esc(project.name)}) Tj`,
      `/F1 8 Tf`, `(  p.${pg + 2}) Tj`, '0 g',
    ];
    streams.push([...hdr, ...ln].join('\n'));
    ln = [];
    y = TOP - 10;
    pg++;
  }
  function need(n: number): void { if (y - n < BOT) flush(); }

  function sec(label: string): void {
    need(40);
    ln.push(RC(L, y - 2, R - L, 18, 0.96),
      '/FB 10 Tf', '0.25 0.25 0.25 rg',
      `${L + 8} ${y} Td`, `(${esc(label)}) Tj`, '0 g');
    y -= 28;
  }

  function cols(): void {
    need(20);
    ln.push(LN(y + 4),
      '/FB 7 Tf', '0.55 0.55 0.55 rg',
      `${L} ${y} Td`, '(RULE) Tj',
      '160 0 Td', '(TITLE) Tj',
      '340 0 Td', '(STATUS) Tj', '0 g');
    y -= 18;
  }

  // Coverage
  sec('COVERAGE SUMMARY');
  const items = [
    ['Verified', coverage.verified, '0.2 0.55 0.3'],
    ['Gaps', coverage.gap, '0.8 0.2 0.2'],
    ['In Progress', coverage.inProgress, '0.8 0.6 0.1'],
    ['Pending', coverage.notStarted, '0.6 0.6 0.6'],
    ['N/A', coverage.notApplicable, '0.8 0.8 0.8'],
  ];
  let cx = L;
  for (const [label, val, color] of items) {
    ln.push('/FB 18 Tf', `${color} rg`,
      `${cx} ${y} Td`, `(${val}) Tj`, '0 g',
      '/F1 7 Tf', '0 -14 Td', `(${label}) Tj`, '0 14 Td');
    cx += 96;
  }
  y -= 40;
  const fillW = Math.max(4, (R - L) * coverage.percentComplete / 100);
  ln.push(RC(L, y, R - L, 6, 0.93), RC(L, y, fillW, 6, 0.22));
  y -= 20;

  // Rules
  const grouped = project.reviews.reduce((acc, r) => {
    if (!acc[r.sectionId]) acc[r.sectionId] = [];
    acc[r.sectionId].push(r);
    return acc;
  }, {} as Record<string, RuleReview[]>);

  for (const [sid, reviews] of Object.entries(grouped)) {
    sec(sid);
    cols();
    for (const r of reviews) {
      need(16);
      const t = r.ruleTitle.length > 48 ? r.ruleTitle.slice(0, 45) + '...' : r.ruleTitle;
      const alt = reviews.indexOf(r) % 2 === 1;
      if (alt) ln.push(RC(L, y - 2, R - L, 14, 0.97));
      const sg = r.status === 'verified' ? 0.3 : r.status === 'gap' ? 0.5 : 0.7;
      ln.push('/F1 8 Tf', '0.4 0.4 0.4 rg',
        `${L} ${y} Td`, `(${esc(r.ruleId)}) Tj`, '0 g',
        '0.15 0.15 0.15 rg',
        `110 0 Td`, `(${esc(t)}) Tj`, '0 g',
        `${sg} ${sg} ${sg} g`,
        `340 0 Td`, `(${sym(r.status)}) Tj`,
        `8 0 Td`, '/FB 7 Tf',
        `(${esc(r.status === 'not-started' ? 'PENDING' : r.status.toUpperCase())}) Tj`, '0 g');
      y -= 16;
    }
    y -= 8;
  }

  // Gaps
  const gaps = project.reviews.filter(r => r.status === 'gap' || r.status === 'not-started');
  if (gaps.length > 0) {
    sec(`OPEN GAPS (${gaps.length})`);
    cols();
    for (const r of gaps) {
      need(16);
      const t = r.ruleTitle.length > 48 ? r.ruleTitle.slice(0, 45) + '...' : r.ruleTitle;
      ln.push('/F1 8 Tf', '0.4 0.4 0.4 rg',
        `${L} ${y} Td`, `(${esc(r.ruleId)}) Tj`, '0 g',
        '0.15 0.15 0.15 rg',
        `110 0 Td`, `(${esc(t)}) Tj`, '0 g',
        '0.5 0.5 0.5 g',
        `340 0 Td`, `(${esc(r.status)}) Tj`, '0 g');
      y -= 16;
    }
    y -= 8;
  }

  // Provenance
  sec('PROVENANCE');
  for (const [k, v] of [['Project ID', project.id], ['Method', `${project.methodCode} @ ${project.methodVersion}`],
    ['Created', project.createdAt], ['Status', project.status], ['Export', now],
    ['Reviewed', `${coverage.verified + coverage.gap} / ${coverage.total}`]]) {
    need(18);
    ln.push('/FB 8 Tf', '0.4 0.4 0.4 rg',
      `${L} ${y} Td`, `(${esc(k)}) Tj`, '0 g',
      '/F1 8 Tf', '0.15 0.15 0.15 rg',
      `140 0 Td`, `(${esc(String(v))}) Tj`, '0 g');
    y -= 16;
  }
  need(30);
  ln.push(LN(y), '/F1 7 Tf', '0.7 0.7 0.7 rg',
    `${L} ${y - 12} Td`,
    '(Generated by app.article6 -- not a formal certification opinion.) Tj', '0 g');
  flush();

  // --- Assemble PDF ---
  const enc = (s: string) => Buffer.from(s, 'utf-8');
  const parts: Buffer[] = [];
  const offsets: number[] = [0];
  let pos = 0;
  const write = (s: string) => { const b = enc(s); parts.push(b); pos += b.length; };

  write('%PDF-1.4\n');

  // Build objects: per page → fontR, fontB, contentStream, page
  // Then: catalog, pages
  const allObjs: string[] = [];
  const pageObjNums: number[] = [];

  // Catalog and Pages will be objects AFTER all page content
  // First, count total objects to know page parent number
  let totalAfter = 0;
  for (let i = 0; i < streams.length; i++) totalAfter += 4; // fontR, fontB, stream, page
  const catNum = totalAfter + 1;
  const pgsNum = totalAfter + 2;

  for (let i = 0; i < streams.length; i++) {
    const stream = streams[i];
    const fR = allObjs.length + 1;
    const fB = allObjs.length + 2;
    const cs = allObjs.length + 3;
    allObjs.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`);
    allObjs.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`);
    allObjs.push(`<< /Length ${enc(stream).length} >>\nstream\n${stream}\nendstream`);
    const pn = allObjs.length + 1;
    allObjs.push(`<< /Type /Page /Parent ${pgsNum} 0 R /MediaBox [0 0 ${W} 792] /Resources << /Font << /F1 ${fR} 0 R /FB ${fB} 0 R >> >> /Contents ${cs} 0 R >>`);
    pageObjNums.push(pn);
  }

  allObjs.push(`<< /Type /Catalog /Pages ${pgsNum} 0 R >>`);
  allObjs.push(`<< /Type /Pages /Kids [${pageObjNums.join(' ')}] /Count ${streams.length} >>`);

  for (let i = 0; i < allObjs.length; i++) {
    offsets.push(pos);
    write(`${i + 1} 0 obj\n${allObjs[i]}\nendobj\n`);
  }

  const xrefOff = pos;
  write(`xref\n0 ${allObjs.length + 1}\n0000000000 65535 f \n`);
  for (let i = 1; i <= allObjs.length; i++) {
    write(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  write(`trailer\n<< /Size ${allObjs.length + 1} /Root ${catNum} 0 R >>\nstartxref\n${xrefOff}\n%%EOF`);

  return Buffer.concat(parts);
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
