import type { Project, ProjectCoverage, RuleReview } from '@/lib/projects/types';
import { composeVerificationReport } from '@/lib/projects/verificationReport';

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

export function getProjectCoverage(reviews: RuleReview[]): ProjectCoverage {
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

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 3) + '...' : s;
}

function safeDate(iso: string | undefined): string {
  if (!iso) return 'n/a';
  const d = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : iso.slice(0, 16);
}

export function buildProjectExportPdf(project: Project, coverage: ProjectCoverage): Buffer {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const report = composeVerificationReport(project, coverage, now);
  const W = 612;
  const PAGE_H = 792;
  const L = 56;
  const R = W - 56;
  const BODY_TOP = 678;
  const BOT = 84;
  const HEADER_Y = PAGE_H - 48;
  const FOOTER_Y = 34;
  const LN = (y: number) => `0.85 G ${L} ${y} m ${R} ${y} l S 0 G`;
  const RC = (x: number, y: number, w: number, h: number, g: number) => `${g} g ${x} ${y} ${w} ${h} re f 0 g`;
  const TXT = (x: number, y: number, font: 'F1' | 'FB', size: number, text: string, color = '0 0 0 rg') => [
    'BT',
    `/${font} ${size} Tf`,
    color,
    `${x} ${y} Td`,
    `(${esc(text)}) Tj`,
    'ET',
  ];

  const streams: string[] = [];
  let ln: string[] = [];
  let y = BODY_TOP;
  let pg = 0;

  function flush(): void {
    if (ln.length === 0) return;
    const pageNumber = `p.${pg + 1}`;
    const hdr = [
      RC(0, HEADER_Y - 6, W, 22, 0.95),
      LN(HEADER_Y - 6),
      ...TXT(L, HEADER_Y, 'FB', 9, 'ARTICLE6', '0.4 0.4 0.4 rg'),
      ...TXT(L + 62, HEADER_Y, 'F1', 8, project.name, '0.25 0.25 0.25 rg'),
      ...TXT(R - 26, HEADER_Y, 'F1', 8, pageNumber, '0.4 0.4 0.4 rg'),
      LN(FOOTER_Y + 10),
      ...TXT(L, FOOTER_Y, 'F1', 7, `Generated ${now}`, '0.6 0.6 0.6 rg'),
      ...TXT(R - 120, FOOTER_Y, 'F1', 7, 'article6.org', '0.6 0.6 0.6 rg'),
    ];
    streams.push([...hdr, ...ln].join('\n'));
    ln = [];
    y = BODY_TOP;
    pg++;
  }

  function need(n: number): void {
    if (y - n < BOT) flush();
  }

  function sec(label: string): void {
    need(40);
    ln.push(RC(L, y - 2, R - L, 18, 0.96), ...TXT(L + 8, y, 'FB', 10, label, '0.25 0.25 0.25 rg'));
    y -= 28;
  }

  function bodyLine(text: string, font: 'F1' | 'FB' = 'F1', size = 8, color = '0.2 0.2 0.2 rg'): void {
    need(14);
    ln.push(...TXT(L, y, font, size, truncate(text, 96), color));
    y -= 12;
  }

  ln.push(
    ...TXT(L, y + 20, 'F1', 8, 'VERIFICATION REPORT', '0.5 0.5 0.5 rg'),
    ...TXT(L, y + 4, 'FB', 18, report.title, '0.1 0.1 0.1 rg'),
    ...TXT(L, y - 14, 'F1', 9, truncate(report.subtitle, 84), '0.35 0.35 0.35 rg'),
  );
  let metaX = L;
  for (const item of report.summaryItems.slice(0, 3)) {
    ln.push(...TXT(metaX, y - 34, 'F1', 8, truncate(item, 26), '0.45 0.45 0.45 rg'));
    metaX += 160;
  }
  y -= 68;

  for (const section of report.sections) {
    sec(section.title);
    for (const line of section.lines) bodyLine(line);
    y -= 4;
  }

  need(30);
  ln.push(
    LN(y),
    ...TXT(L, y - 12, 'F1', 7, truncate(report.limitation, 110), '0.7 0.7 0.7 rg'),
    ...TXT(L, y - 24, 'F1', 7, `Export time ${safeDate(now)}.`, '0.7 0.7 0.7 rg'),
  );
  flush();

  const enc = (s: string) => Buffer.from(s, 'utf-8');
  const parts: Buffer[] = [];
  const offsets: number[] = [0];
  let pos = 0;
  const write = (s: string) => {
    const b = enc(s);
    parts.push(b);
    pos += b.length;
  };

  write('%PDF-1.4\n');

  const allObjs: string[] = [];
  const pageObjNums: number[] = [];
  let totalAfter = 0;
  for (let i = 0; i < streams.length; i++) totalAfter += 4;
  const catNum = totalAfter + 1;
  const pgsNum = totalAfter + 2;

  for (const stream of streams) {
    const fR = allObjs.length + 1;
    const fB = allObjs.length + 2;
    const cs = allObjs.length + 3;
    allObjs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    allObjs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    allObjs.push(`<< /Length ${enc(stream).length} >>\nstream\n${stream}\nendstream`);
    const pn = allObjs.length + 1;
    allObjs.push(`<< /Type /Page /Parent ${pgsNum} 0 R /MediaBox [0 0 ${W} 792] /Resources << /Font << /F1 ${fR} 0 R /FB ${fB} 0 R >> >> /Contents ${cs} 0 R >>`);
    pageObjNums.push(pn);
  }

  allObjs.push(`<< /Type /Catalog /Pages ${pgsNum} 0 R >>`);
  allObjs.push(`<< /Type /Pages /Kids [${pageObjNums.map((num) => `${num} 0 R`).join(' ')}] /Count ${streams.length} >>`);

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
