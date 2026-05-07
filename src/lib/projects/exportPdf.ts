import type { Project, ProjectCoverage, RuleReview } from '@/lib/projects/types';
import { composeVerificationReport, manualRegistryLabel } from '@/lib/projects/verificationReport';

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function asciiSafeText(input: string): string {
  return input
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/\u00B0/g, ' deg')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
}

function punctuateText(value: string): string {
  return /[.!?]$/.test(value) ? value : `${value}.`;
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

function safeDate(iso: string | undefined): string {
  if (!iso) return 'n/a';
  const d = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : iso.slice(0, 16);
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 3) + '...' : s;
}

function splitLongToken(token: string, max: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < token.length; i += max) chunks.push(token.slice(i, i + max));
  return chunks;
}

function wrapText(text: string, max = 96): string[] {
  const words = text.split(/\s+/).filter(Boolean).flatMap((word) => (
    word.length > max ? splitLongToken(word, max) : [word]
  ));
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= max) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

function estimateWrappedTextHeight(text: string, max = 96, lineHeight = 12): number {
  return wrapText(text, max).length * lineHeight;
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
    `(${esc(asciiSafeText(text))}) Tj`,
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
    for (const line of wrapText(text)) {
      need(14);
      ln.push(...TXT(L, y, font, size, line, color));
      y -= 12;
    }
  }

  function ensureManualProvenanceFits(lines: string[]): void {
    const headingHeight = 28;
    const trailingPadding = 12;
    const totalHeight = headingHeight + trailingPadding + lines.reduce(
      (sum, line) => sum + estimateWrappedTextHeight(line),
      0,
    );

    if (y - totalHeight < BOT) {
      flush();
    }
  }

  function cardLabelValue(label: string, value: string, valueColor = '0.15 0.15 0.15 rg'): void {
    need(18);
    ln.push(...TXT(L + 10, y, 'FB', 7, label, '0.42 0.52 0.60 rg'));
    y -= 10;
    for (const line of wrapText(value, 92)) {
      need(14);
      ln.push(...TXT(L + 10, y, 'F1', 8, line, valueColor));
      y -= 11;
    }
    y -= 3;
  }

  function renderManualReport(): void {
    const manualFindings = project.manualFindings;
    const sourceDocument = project.documents[0];
    const carCount = manualFindings.filter((finding) => finding.findingType === 'CAR').length;
    const clCount = manualFindings.filter((finding) => finding.findingType === 'CL').length;
    const farCount = manualFindings.filter((finding) => finding.findingType === 'FAR').length;
    const closedCount = manualFindings.filter((finding) => finding.closureStatus === 'closed').length;
    const openCount = manualFindings.filter((finding) => finding.closureStatus === 'open').length;
    const inReviewCount = manualFindings.filter((finding) => finding.closureStatus === 'in-review').length;
    const registryLabel = manualRegistryLabel(project);
    const methodologyLabel = project.methodCode && project.methodVersion
      ? `${project.methodCode} @ ${project.methodVersion}`
      : 'Manual review - methodology not wired';
    const projectArea = project.aoiLabel?.trim() || 'Not provided';
    const projectDescription = project.description?.trim() || 'Not provided';
    const sourceDocumentType = sourceDocument?.mimeType === 'application/pdf'
      ? 'Published verification report PDF'
      : sourceDocument
        ? 'Uploaded source document'
        : 'Not provided';

    ln.push(
      RC(0, HEADER_Y - 14, W, 40, 0.98),
      ...TXT(L, y + 30, 'FB', 11, 'ARTICLE6', '0.18 0.23 0.28 rg'),
      ...TXT(L, y + 12, 'FB', 18, 'MANUAL REVIEW REPORT', '0.10 0.12 0.15 rg'),
      ...TXT(L, y - 6, 'FB', 15, report.title, '0.12 0.18 0.23 rg'),
      ...TXT(L, y - 22, 'F1', 8, truncate('Project-level reconstruction of published VVB findings', 80), '0.38 0.44 0.50 rg'),
    );
    y -= 54;

    ln.push(
      RC(L, y - 38, R - L, 34, 0.95),
      ...TXT(L + 10, y - 12, 'F1', 8, truncate(report.limitation, 110), '0.30 0.34 0.38 rg'),
    );
    y -= 54;

    sec('Outcome');
    bodyLine(`${manualFindings.length} VVB finding sections were reconstructed from the uploaded source document set.`, 'FB', 9, '0.12 0.18 0.23 rg');
    bodyLine(`The review identified ${closedCount} closed findings, ${openCount} open findings, and ${inReviewCount} findings still marked in review.`, 'F1', 8, '0.22 0.22 0.22 rg');
    bodyLine('Findings remain reviewer-controlled records and do not represent a new verification opinion.', 'F1', 8, '0.22 0.22 0.22 rg');
    y -= 4;

    need(78);
    const cardY = y;
    const cardW = 152;
    const gap = 14;
    const cardX = [L, L + cardW + gap, L + (cardW + gap) * 2];
    const cards = [
      { title: 'Finding Types', value: `CAR: ${carCount}  CL: ${clCount}  FAR: ${farCount}` },
      { title: 'Closure Status', value: `Closed: ${closedCount}  Open: ${openCount}  In review: ${inReviewCount}` },
      { title: 'Source Set', value: `Documents: ${project.documents.length}  Findings: ${manualFindings.length}` },
    ];
    cards.forEach((card, index) => {
      ln.push(
        RC(cardX[index], cardY - 46, cardW, 40, 0.97),
        ...TXT(cardX[index] + 8, cardY - 14, 'FB', 7, card.title.toUpperCase(), '0.42 0.52 0.60 rg'),
        ...TXT(cardX[index] + 8, cardY - 28, 'F1', 8, truncate(card.value, 28), '0.12 0.15 0.18 rg'),
      );
    });
    y -= 62;

    sec('Project Metadata');
    const metadataPairs = [
      ['Registry / Standard', registryLabel],
      ['Registry project ID', 'Not provided'],
      ['Project name', project.name],
      ['Source document type', sourceDocumentType],
      ['Source document name', sourceDocument?.fileName ?? 'Not provided'],
      ['Methodology / reference', methodologyLabel],
      ['Review mode', 'Manual review'],
      ['Locked status', project.status === 'locked' ? 'Locked' : 'In Progress'],
      ['Export timestamp', now],
      ['Project area', projectArea],
      ['Project description', projectDescription],
    ];
    for (const [label, value] of metadataPairs) {
      bodyLine(`${label}: ${value}.`);
    }
    y -= 4;

    sec('Finding Details');
    if (manualFindings.length === 0) {
      bodyLine('No manual findings have been recorded yet.');
    } else {
      for (const finding of manualFindings) {
        const sourceDocumentLabel = project.documents.find((document) => document.id === finding.sourceDocumentId)?.fileName ?? 'Not provided';
        const fieldLines: Array<[string, string, string?]> = [
          ['Finding ID', finding.findingId],
          ['Type', finding.findingType],
          ['Closure status', finding.closureStatus],
          ['Source document', sourceDocumentLabel],
          ['Source page/range', finding.sourcePageRange?.trim() || 'Not provided'],
          ['Requirement', finding.requirement?.trim() || 'Not provided'],
          ['Description', finding.description?.trim() || 'Not provided'],
          ['Project response', finding.projectResponse?.trim() || 'Not provided'],
          ['Documentation submitted', finding.documentationSubmitted?.trim() || 'Not provided'],
          ['Audit team evaluation', finding.auditTeamEvaluation?.trim() || 'Not provided'],
          ['Reviewer note', finding.reviewerNote?.trim() || 'Needs review'],
          ['Source excerpt', finding.evidenceExcerpt?.trim() || 'Not provided', '0.36 0.38 0.42 rg'],
        ];
        const estimatedHeight = fieldLines.reduce((sum, [, value]) => sum + wrapText(value, 92).length * 11 + 16, 26);
        need(estimatedHeight + 18);
        ln.push(
          RC(L, y - estimatedHeight + 8, R - L, estimatedHeight, 0.985),
          ...TXT(L + 10, y - 8, 'FB', 10, `${finding.findingId}  ${finding.findingType}`, '0.10 0.12 0.15 rg'),
        );
        y -= 24;
        for (const [label, value, color] of fieldLines) {
          cardLabelValue(label, value, color);
        }
        y -= 8;
      }
    }

    const provenanceLines = report.provenance.map(([label, value]) => `${label}: ${punctuateText(value)}`);
    ensureManualProvenanceFits(provenanceLines);
    sec('Provenance And Limitations');
    for (let index = 0; index < report.provenance.length; index += 1) {
      const [label] = report.provenance[index];
      bodyLine(provenanceLines[index], 'F1', 8, label === 'Limitation' ? '0.36 0.38 0.42 rg' : '0.22 0.22 0.22 rg');
    }
  }

  if (project.reviewMode === 'manual') {
    renderManualReport();
    flush();
  } else {

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
  }

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
