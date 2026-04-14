import type { Project, RuleReview, ProjectCoverage } from '@/lib/projects/types';

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

function sym(s: string): string {
  if (s === 'verified') return '\u2713';
  if (s === 'gap') return '\u2717';
  return '\u25CB';
}

export function buildProjectExportPdf(project: Project, coverage: ProjectCoverage): Buffer {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const W = 612, TOP = 760, BOT = 50, L = 56, R = W - 56;
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
  let y = TOP;
  let pg = 0;

  function flush(): void {
    if (ln.length === 0) return;
    const hdr = [
      RC(0, TOP + 8, W, 24, 0.95), LN(TOP + 8),
      ...TXT(L, TOP + 12, 'FB', 9, 'app.article6', '0.4 0.4 0.4 rg'),
      ...TXT(L + 84, TOP + 12, 'F1', 8, project.name, '0.25 0.25 0.25 rg'),
      ...TXT(R - 32, TOP + 12, 'F1', 8, `p.${pg + 1}`, '0.4 0.4 0.4 rg'),
    ];
    streams.push([...hdr, ...ln].join('\n'));
    ln = [];
    y = TOP - 10;
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

  function cols(): void {
    need(20);
    ln.push(
      LN(y + 4),
      ...TXT(L, y, 'FB', 7, 'RULE', '0.55 0.55 0.55 rg'),
      ...TXT(L + 160, y, 'FB', 7, 'TITLE', '0.55 0.55 0.55 rg'),
      ...TXT(L + 340, y, 'FB', 7, 'STATUS', '0.55 0.55 0.55 rg'),
    );
    y -= 18;
  }

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
    ln.push(
      ...TXT(cx, y, 'FB', 18, String(val), `${color} rg`),
      ...TXT(cx, y - 14, 'F1', 7, String(label), '0.45 0.45 0.45 rg'),
    );
    cx += 96;
  }
  y -= 40;
  const fillW = Math.max(4, (R - L) * coverage.percentComplete / 100);
  ln.push(RC(L, y, R - L, 6, 0.93), RC(L, y, fillW, 6, 0.22));
  y -= 20;

  const grouped = project.reviews.reduce((acc, r) => {
    if (!acc[r.sectionId]) acc[r.sectionId] = [];
    acc[r.sectionId].push(r);
    return acc;
  }, {} as Record<string, RuleReview[]>);

  for (const [sid, reviews] of Object.entries(grouped)) {
    sec(sid);
    cols();
    for (const [index, r] of reviews.entries()) {
      need(16);
      const t = r.ruleTitle.length > 48 ? r.ruleTitle.slice(0, 45) + '...' : r.ruleTitle;
      if (index % 2 === 1) ln.push(RC(L, y - 2, R - L, 14, 0.97));
      const statusColor = r.status === 'verified'
        ? '0.2 0.55 0.3 rg'
        : r.status === 'gap'
          ? '0.75 0.2 0.2 rg'
          : '0.45 0.45 0.45 rg';
      ln.push(
        ...TXT(L, y, 'F1', 8, r.ruleId, '0.4 0.4 0.4 rg'),
        ...TXT(L + 110, y, 'F1', 8, t, '0.15 0.15 0.15 rg'),
        ...TXT(L + 340, y, 'F1', 8, sym(r.status), statusColor),
        ...TXT(L + 352, y, 'FB', 7, r.status === 'not-started' ? 'PENDING' : r.status.toUpperCase(), statusColor),
      );
      y -= 16;
    }
    y -= 8;
  }

  const gaps = project.reviews.filter(r => r.status === 'gap' || r.status === 'not-started');
  if (gaps.length > 0) {
    sec(`OPEN GAPS (${gaps.length})`);
    cols();
    for (const r of gaps) {
      need(16);
      const t = r.ruleTitle.length > 48 ? r.ruleTitle.slice(0, 45) + '...' : r.ruleTitle;
      ln.push(
        ...TXT(L, y, 'F1', 8, r.ruleId, '0.4 0.4 0.4 rg'),
        ...TXT(L + 110, y, 'F1', 8, t, '0.15 0.15 0.15 rg'),
        ...TXT(L + 340, y, 'F1', 8, r.status, '0.5 0.5 0.5 rg'),
      );
      y -= 16;
    }
    y -= 8;
  }

  sec('PROVENANCE');
  for (const [k, v] of [
    ['Project ID', project.id],
    ['Method', `${project.methodCode} @ ${project.methodVersion}`],
    ['Created', project.createdAt],
    ['Status', project.status],
    ['Export', now],
    ['Reviewed', `${coverage.verified + coverage.gap} / ${coverage.total}`],
  ]) {
    need(18);
    ln.push(
      ...TXT(L, y, 'FB', 8, String(k), '0.4 0.4 0.4 rg'),
      ...TXT(L + 140, y, 'F1', 8, String(v), '0.15 0.15 0.15 rg'),
    );
    y -= 16;
  }
  need(30);
  ln.push(LN(y), ...TXT(L, y - 12, 'F1', 7, 'Generated by app.article6 -- not a formal certification opinion.', '0.7 0.7 0.7 rg'));
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
