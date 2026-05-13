import type { Project, ProjectCoverage, RuleReview } from '@/lib/projects/types';
import { composeVerificationReport, manualRegistryLabel } from '@/lib/projects/verificationReport';
import type { ReportFinding } from '@/lib/projects/reportFindings';

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function asciiSafeText(input: string): string {
  return input
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/\u00B7/g, '-')
    .replace(/\u00B0/g, ' deg')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
}

const H_WIDTH: Record<string, number> = {
  'A': 667, 'B': 667, 'C': 722, 'D': 722, 'E': 667, 'F': 611, 'G': 778, 'H': 722,
  'I': 278, 'J': 500, 'K': 667, 'L': 556, 'M': 833, 'N': 722, 'O': 778, 'P': 667,
  'Q': 778, 'R': 722, 'S': 667, 'T': 611, 'U': 722, 'V': 667, 'W': 944, 'X': 667,
  'Y': 667, 'Z': 611,
  'a': 556, 'b': 556, 'c': 500, 'd': 556, 'e': 556, 'f': 278, 'g': 556, 'h': 556,
  'i': 222, 'j': 222, 'k': 500, 'l': 222, 'm': 833, 'n': 556, 'o': 556, 'p': 556,
  'q': 556, 'r': 333, 's': 500, 't': 278, 'u': 556, 'v': 500, 'w': 722, 'x': 500,
  'y': 500, 'z': 500,
  '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556,
  '8': 556, '9': 556,
  ' ': 278, '.': 278, ',': 278, ':': 278, ';': 278, '!': 278, '?': 556, '/': 278,
  '(': 333, ')': 333, '-': 333, '_': 500, '+': 584, "'": 278, '"': 333, '&': 667,
  '*': 278, '@': 975, '|': 278, '#': 556, '$': 556, '%': 889, '\\': 278,
};

function textWidth(text: string, size: number): number {
  let w = 0;
  for (const ch of text) {
    w += H_WIDTH[ch] !== undefined ? H_WIDTH[ch] : 500;
  }
  return w * size / 1000;
}

function centerText(y: number, font: 'F1' | 'FB', size: number, text: string, color?: string): string[] {
  const tw = textWidth(text, size);
  const x = W / 2 - tw / 2;
  return TXT(x, y, font, size, text, color);
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

const DARK     = '0.15 0.15 0.15 rg';
const MED      = '0.4 0.4 0.4 rg';
const LIGHT    = '0.55 0.55 0.55 rg';
const LIGHTER  = '0.65 0.65 0.65 rg';
const CARD_BG  = 0.97;
const NOTE_BG  = 0.95;

const W = 612;
const PAGE_H = 792;
const M = 56;
const L = M;
const R = W - M;
const BODY_TOP = 678;
const BOT = 84;
const HEADER_Y = PAGE_H - 48;
const FOOTER_Y = 34;
const CARD_INDENT = 12;

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

function buildCoverPage(project: Project, coverage: ProjectCoverage, now: string): string[] {
  const lines: string[] = [];
  const reviewed = coverage.verified + coverage.gap;
  const cx = W / 2;

  lines.push(...centerText(520, 'FB', 10, 'ARTICLE6', '0.5 0.5 0.5 rg'));
  lines.push(RC(cx - 150, 498, 300, 1, 0.8));
  lines.push(...centerText(470, 'FB', 24, 'VERIFICATION REPORT', '0.2 0.2 0.2 rg'));
  lines.push(...centerText(430, 'F1', 12, truncate(project.name, 70), '0.35 0.35 0.35 rg'));
  lines.push(...TXT(cx - 190, 390, 'F1', 9, `Project ID: ${project.id}`, '0.5 0.5 0.5 rg'));
  lines.push(...TXT(cx + 10, 390, 'F1', 9, `Findings: ${reviewed} of ${coverage.total} rules reviewed`, '0.5 0.5 0.5 rg'));
  lines.push(...TXT(cx - 190, 372, 'F1', 9, `Methodology: ${project.methodCode} @ ${project.methodVersion}`, '0.5 0.5 0.5 rg'));
  lines.push(...TXT(cx + 10, 372, 'F1', 9, `Evidence references: ${project.reviews.reduce((s,r)=>s+r.evidenceIds.length,0)}`, '0.5 0.5 0.5 rg'));
  lines.push(RC(cx - 150, 350, 300, 1, 0.8));
  lines.push(...centerText(310, 'F1', 8, `Generated ${now}`, '0.6 0.6 0.6 rg'));
  lines.push(...centerText(292, 'F1', 8, 'article6.org', '0.6 0.6 0.6 rg'));
  return lines;
}

function buildManualCoverPage(project: Project, coverage: ProjectCoverage, now: string, report: { title: string }): string[] {
  const lines: string[] = [];
  const cx = W / 2;
  const carCount = project.manualFindings.filter((f) => f.findingType === 'CAR').length;
  const clCount = project.manualFindings.filter((f) => f.findingType === 'CL').length;
  const farCount = project.manualFindings.filter((f) => f.findingType === 'FAR').length;
  const regLabel = manualRegistryLabel(project);
  const metaL = L + 80;
  const metaR = cx + 40;

  lines.push(...centerText(520, 'FB', 10, 'ARTICLE6', '0.5 0.5 0.5 rg'));
  lines.push(RC(cx - 150, 498, 300, 1, 0.8));
  lines.push(...centerText(470, 'FB', 24, 'MANUAL REVIEW REPORT', '0.2 0.2 0.2 rg'));
  lines.push(...centerText(440, 'FB', 14, report.title, '0.35 0.35 0.35 rg'));
  lines.push(...centerText(400, 'F1', 12, truncate(project.name, 70), '0.35 0.35 0.35 rg'));
  lines.push(RC(cx - 150, 378, 300, 1, 0.8));

  const metaY = 352;
  lines.push(...TXT(metaL, metaY, 'F1', 7, 'REGISTRY / STANDARD', '0.6 0.6 0.6 rg'));
  lines.push(...TXT(metaL, metaY - 14, 'F1', 8, truncate(regLabel, 26), '0.25 0.25 0.25 rg'));
  lines.push(...TXT(metaR, metaY, 'F1', 7, 'SOURCE DOCUMENTS', '0.6 0.6 0.6 rg'));
  lines.push(...TXT(metaR, metaY - 14, 'F1', 8, String(project.documents.length), '0.25 0.25 0.25 rg'));

  const metaY2 = metaY - 40;
  lines.push(...TXT(metaL, metaY2, 'F1', 7, 'MANUAL FINDINGS', '0.6 0.6 0.6 rg'));
  lines.push(...TXT(metaL, metaY2 - 14, 'F1', 8, String(project.manualFindings.length), '0.25 0.25 0.25 rg'));
  lines.push(...TXT(metaR, metaY2, 'F1', 7, 'FINDING TYPES', '0.6 0.6 0.6 rg'));
  lines.push(...TXT(metaR, metaY2 - 14, 'F1', 8, `CAR: ${carCount}  CL: ${clCount}  FAR: ${farCount}`, '0.25 0.25 0.25 rg'));

  lines.push(RC(cx - 150, 248, 300, 1, 0.8));
  lines.push(...centerText(228, 'F1', 7, `Generated ${now}`, '0.6 0.6 0.6 rg'));
  lines.push(...centerText(210, 'F1', 7, 'article6.org | Manual Review Export', '0.6 0.6 0.6 rg'));
  return lines;
}

function estimateFindingHeight(finding: ReportFinding): number {
  const base = 90;
  const rationaleLines = wrapText(finding.rationale, 88).length;
  const limitationLines = finding.limitation ? wrapText(finding.limitation, 92).length : 0;
  const evidenceLines = Math.min(
    finding.evidenceIds.reduce((s, id) => s + wrapText(id, 90).length, 0),
    6
  );
  return base + rationaleLines * 12 + limitationLines * 12 + evidenceLines * 12 + 24;
}

export function buildProjectExportPdf(project: Project, coverage: ProjectCoverage): Buffer {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const report = composeVerificationReport(project, coverage, now);
  const isManual = project.reviewMode === 'manual';

  const streams: string[] = [];
  let ln: string[] = [];
  let y = BODY_TOP;
  let pg = 0;

  {
    const coverLines = isManual
      ? buildManualCoverPage(project, coverage, now, report)
      : buildCoverPage(project, coverage, now);
    streams.push(coverLines.join('\n'));
    pg = 1;
  }

  function flushPage(pageNum: number, showProjectName: boolean): void {
    if (ln.length === 0) return;
    const hdr = [
      RC(0, HEADER_Y - 6, W, 22, 0.96),
      LN(HEADER_Y - 6),
      ...TXT(L, HEADER_Y, 'FB', 9, 'ARTICLE6', '0.4 0.4 0.4 rg'),
    ];
    if (showProjectName) {
      hdr.push(...TXT(L + 62, HEADER_Y, 'F1', 8, project.name, '0.25 0.25 0.25 rg'));
    }
    hdr.push(...TXT(R - 26, HEADER_Y, 'F1', 8, `p.${pageNum}`, '0.4 0.4 0.4 rg'));

    ln.push(
      LN(FOOTER_Y + 10),
      ...TXT(L, FOOTER_Y, 'F1', 7, `Generated ${now}`, '0.6 0.6 0.6 rg'),
      ...TXT(R - 120, FOOTER_Y, 'F1', 7, 'article6.org | Manual Review Export', '0.6 0.6 0.6 rg'),
    );
    streams.push([...hdr, ...ln].join('\n'));
    ln = [];
    y = BODY_TOP;
  }

  function need(n: number): void {
    if (y - n < BOT) {
      flushPage(pg, false);
      pg += 1;
      ln.push(
        RC(0, HEADER_Y - 6, W, 22, 0.96),
        LN(HEADER_Y - 6),
        ...TXT(L, HEADER_Y, 'FB', 9, 'ARTICLE6', '0.4 0.4 0.4 rg'),
        ...TXT(R - 26, HEADER_Y, 'F1', 8, `p.${pg}`, '0.4 0.4 0.4 rg'),
      );
    }
  }

  function sec(label: string): void {
    need(40);
    ln.push(LN(y));
    ln.push(RC(L, y - 16, R - L, 20, 0.97));
    ln.push(...TXT(L + 10, y - 6, 'FB', 10, label, '0.25 0.25 0.25 rg'));
    ln.push(LN(y - 18));
    y -= 34;
  }

  function bodyLine(text: string, font: 'F1' | 'FB' = 'F1', size = 9, color = DARK): void {
    for (const line of wrapText(text)) {
      need(16);
      ln.push(...TXT(L, y, font, size, line, color));
      y -= 14;
    }
  }

  if (!isManual) {
    ln.push(
      ...TXT(L, y + 20, 'F1', 8, 'VERIFICATION REPORT', LIGHTER),
      ...TXT(L, y + 4,  'FB', 18, report.title, DARK),
      ...TXT(L, y - 14, 'F1', 9, truncate(report.subtitle, 84), '0.4 0.4 0.4 rg'),
    );

    let metaX = L;
    for (const item of report.summaryItems.slice(0, 3)) {
      ln.push(...TXT(metaX, y - 36, 'F1', 8, truncate(item, 32), LIGHT));
      metaX += 190;
    }
    y -= 70;
  }

  let renderedEvidenceAppendix = false;
  let renderedLimitations = false;
  let renderedProvenance = false;

  for (const section of report.sections) {
    sec(section.title);
    for (const line of section.lines) bodyLine(line);
    y -= 4;
    if (section.title === 'EVIDENCE APPENDIX') renderedEvidenceAppendix = true;
    if (section.title === 'LIMITATIONS') renderedLimitations = true;
    if (section.title === 'PROVENANCE') renderedProvenance = true;
  }

  if (!isManual && report.findings.length > 0) {
    y -= 12;
    sec('REQUIREMENT FINDINGS');

    for (let i = 0; i < report.findings.length; i++) {
      const finding = report.findings[i];
      const height = estimateFindingHeight(finding);

      if (y - height < BOT) {
        flushPage(pg, false);
        pg += 1;
        ln.push(
          RC(0, HEADER_Y - 6, W, 22, 0.96),
          LN(HEADER_Y - 6),
          ...TXT(L, HEADER_Y, 'FB', 9, 'ARTICLE6', '0.4 0.4 0.4 rg'),
          ...TXT(R - 26, HEADER_Y, 'F1', 8, `p.${pg}`, '0.4 0.4 0.4 rg'),
        );
      }

      ln.push(RC(L + 4, y - height + 8, R - L - 8, height - 4, CARD_BG));

      let cy = y;
      const fid = `F-${String(i + 1).padStart(3, '0')}`;
      ln.push(...TXT(L + 10, cy, 'FB', 9, fid, DARK));

      const chipColorMap: Record<string, string> = {
        OK:      '0.3 0.75 0.3 rg',
        CL:      '0.75 0.65 0.3 rg',
        NC:      '0.7 0.3 0.3 rg',
        FAR:     '0.4 0.45 0.7 rg',
        PENDING: '0.7 0.7 0.7 rg',
        NA:      '0.6 0.6 0.6 rg',
      };
      const chipColor = chipColorMap[finding.code] || '0.5 0.5 0.5 rg';
      const chipX = L + 50;
      const chipY = cy - 4;
      ln.push(RC(chipX, chipY - 12, 38, 12, 0.9));
      ln.push(`0.85 G ${chipX} ${chipY - 12} 38 12 re S 0 g`);
      ln.push(...TXT(chipX + 4, chipY, 'FB', 7, `[${finding.code}]`, chipColor));

      let ruleY = cy - 4;
      const ruleText = `${finding.ruleId}: ${finding.ruleTitle}`;
      for (const line of wrapText(ruleText, 88)) {
        ln.push(...TXT(L + 96, ruleY, 'F1', 8, line, MED));
        ruleY -= 14;
      }
      cy = ruleY - 8;

      ln.push(...TXT(L + CARD_INDENT, cy, 'F1', 8, 'Issue excerpt:', LIGHT));
      cy -= 14;
      for (const line of wrapText(finding.rationale, 92)) {
        ln.push(...TXT(L + CARD_INDENT + 6, cy, 'F1', 9, line, DARK));
        cy -= 12;
      }

      cy -= 6;
      ln.push(...TXT(L + CARD_INDENT, cy, 'F1', 8, 'Project response / evidence:', LIGHT));
      cy -= 14;
      if (finding.evidenceIds.length === 0) {
        ln.push(...TXT(L + CARD_INDENT + 6, cy, 'F1', 9, 'No evidence references linked.', LIGHTER));
        cy -= 12;
      } else {
        for (const evid of finding.evidenceIds) {
          for (const line of wrapText(evid, 90)) {
            ln.push(...TXT(L + CARD_INDENT + 6, cy, 'F1', 9, line, MED));
            cy -= 12;
          }
        }
      }

      if (finding.limitation) {
        cy -= 6;
        ln.push(...TXT(L + CARD_INDENT, cy, 'F1', 8, 'Article6 note:', LIGHT));
        cy -= 14;
        for (const line of wrapText(finding.limitation, 90)) {
          ln.push(RC(L + CARD_INDENT + 3, cy - 10, 552, 12, NOTE_BG));
          ln.push(...TXT(L + CARD_INDENT + 6, cy, 'F1', 9, line, DARK));
          cy -= 12;
        }
      }

      cy -= 6;
      ln.push(...TXT(L + CARD_INDENT, cy, 'F1', 8, 'Auditor notes:', LIGHT));
      cy -= 14;
      ln.push(...TXT(L + CARD_INDENT + 6, cy, 'F1', 9, '- concluded as recorded -', LIGHTER));
      cy -= 12;

      y = cy - 16;
    }
  }

  if (!isManual) {
    if (!renderedEvidenceAppendix) {
      y -= 20;
      sec('EVIDENCE APPENDIX');
      if (report.findings.length === 0) {
        bodyLine('No requirement findings are available from current project review data.', 'F1', 8, LIGHT);
      } else {
        for (const finding of report.findings) {
          if (finding.evidenceIds.length === 0) {
            bodyLine(`${finding.findingId}: No evidence references linked.`, 'F1', 8, LIGHT);
          } else {
            for (const ev of finding.evidenceIds) {
              bodyLine(`${finding.findingId}: ${ev}`, 'F1', 8, LIGHT);
            }
          }
        }
      }
    }

    if (!renderedLimitations) {
      y -= 20;
      sec('LIMITATIONS');
      bodyLine(report.limitation, 'F1', 8, LIGHT);
    }

    if (!renderedProvenance) {
      y -= 20;
      sec('PROVENANCE');
      for (const [label, value] of report.provenance) {
        const line = `${label}: ${value || 'n/a'}.`;
        bodyLine(line, 'F1', 8, LIGHT);
      }
    }
  }

  need(30);
  ln.push(
    LN(y),
    ...TXT(L, y - 12, 'F1', 7, truncate(report.limitation, 112), '0.65 0.65 0.65 rg'),
    ...TXT(L, y - 24, 'F1', 7, `Export time ${safeDate(now)}.`, '0.65 0.65 0.65 rg'),
  );
  flushPage(pg, false);

  const enc = (s: string) => Buffer.from(s, 'utf-8');
  const parts: Buffer[] = [];
  const offsets: number[] = [0];
  let pos = 0;
  const write = (s: string) => {
    parts.push(enc(s));
    pos += s.length;
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
