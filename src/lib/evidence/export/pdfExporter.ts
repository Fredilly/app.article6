import type { PremiumExportInput } from './types';
import type { ExtractedFact } from '@/lib/evidence/extraction/types';

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

const DARK = '0.15 0.15 0.15 rg';
const MED = '0.4 0.4 0.4 rg';
const LIGHT = '0.55 0.55 0.55 rg';
const LIGHTER = '0.65 0.65 0.65 rg';
const CARD_BG = 0.97;
const NOTE_BG = 0.95;

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

function safeDate(iso: string | undefined): string {
  if (!iso) return 'n/a';
  const d = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : iso.slice(0, 16);
}

function exportTimestamp(input: PremiumExportInput): string {
  return input.exportTime ?? input.project.lockedAt ?? input.project.createdAt ?? '1970-01-01T00:00:00.000Z';
}

function centerText(y: number, font: 'F1' | 'FB', size: number, text: string, color?: string): string[] {
  const tw = textWidth(text, size);
  const x = W / 2 - tw / 2;
  return TXT(x, y, font, size, text, color);
}

export type PdfPage = {
  streams: string[];
  ln: string[];
  y: number;
  pg: number;
};

function makePageState(): PdfPage {
  return { streams: [], ln: [], y: BODY_TOP, pg: 0 };
}

function addCoverPage(state: PdfPage, input: PremiumExportInput): void {
  const { project, coverage } = input;
  const now = exportTimestamp(input).replace('T', ' ').slice(0, 16);
  const cx = W / 2;
  const registry = project.registry ?? 'Unknown';
  const lines = state.ln;

  lines.push(...centerText(520, 'FB', 10, 'ARTICLE6', '0.5 0.5 0.5 rg'));
  lines.push(RC(cx - 150, 498, 300, 1, 0.8));
  lines.push(...centerText(470, 'FB', 24, 'PREMIUM EVIDENCE REPORT', '0.2 0.2 0.2 rg'));
  lines.push(...centerText(435, 'F1', 11, 'Review-Grade Evidence Export', '0.45 0.45 0.45 rg'));
  lines.push(RC(cx - 150, 418, 300, 1, 0.8));
  lines.push(...centerText(400, 'F1', 12, truncate(project.name, 70), '0.35 0.35 0.35 rg'));
  lines.push(...TXT(cx - 190, 370, 'F1', 9, `Project ID: ${project.id}`, '0.5 0.5 0.5 rg'));
  const reviewed = coverage.verified + coverage.gap;
  lines.push(...TXT(cx + 10, 370, 'F1', 9, `Coverage: ${reviewed} of ${coverage.total} rules`, '0.5 0.5 0.5 rg'));
  lines.push(...TXT(cx - 190, 352, 'F1', 9, `Registry: ${registry}`, '0.5 0.5 0.5 rg'));
  lines.push(...TXT(cx + 10, 352, 'F1', 9, `Methodology: ${project.methodCode ?? 'n/a'} @ ${project.methodVersion ?? 'n/a'}`, '0.5 0.5 0.5 rg'));
  lines.push(RC(cx - 150, 330, 300, 1, 0.8));
  lines.push(...centerText(290, 'F1', 8, `Generated ${now}`, '0.6 0.6 0.6 rg'));
  lines.push(...centerText(272, 'F1', 8, 'article6.org | Premium Evidence Export', '0.6 0.6 0.6 rg'));

  state.streams.push(lines.join('\n'));
  state.pg = 1;
  state.ln = [];
  state.y = BODY_TOP;
}

function flushPage(state: PdfPage, projectName: string, isManual: boolean, registry: string, now: string, showProjectName: boolean): void {
  if (state.ln.length === 0) return;
  const hdr = [
    RC(0, HEADER_Y - 6, W, 22, 0.96),
    LN(HEADER_Y - 6),
    ...TXT(L, HEADER_Y, 'FB', 9, 'ARTICLE6', '0.4 0.4 0.4 rg'),
  ];
  if (showProjectName) {
    hdr.push(...TXT(L + 62, HEADER_Y, 'F1', 8, projectName, '0.25 0.25 0.25 rg'));
  }
  hdr.push(...TXT(R - 26, HEADER_Y, 'F1', 8, `p.${state.pg}`, '0.4 0.4 0.4 rg'));

  const footerLabel = isManual
    ? 'article6.org | Premium Evidence Export'
    : 'article6.org | Premium Evidence Export';
  state.ln.push(
    LN(FOOTER_Y + 10),
    ...TXT(L, FOOTER_Y, 'F1', 7, `Generated ${now}`, '0.6 0.6 0.6 rg'),
    ...TXT(R - 160, FOOTER_Y, 'F1', 7, footerLabel, '0.6 0.6 0.6 rg'),
  );
  state.streams.push([...hdr, ...state.ln].join('\n'));
  state.ln = [];
  state.y = BODY_TOP;
}

function need(state: PdfPage): void {
  if (state.y - 16 < BOT) {
    flushPage(state, '', false, '', '', false);
    state.pg += 1;
    state.ln.push(
      RC(0, HEADER_Y - 6, W, 22, 0.96),
      LN(HEADER_Y - 6),
      ...TXT(L, HEADER_Y, 'FB', 9, 'ARTICLE6', '0.4 0.4 0.4 rg'),
      ...TXT(R - 26, HEADER_Y, 'F1', 8, `p.${state.pg}`, '0.4 0.4 0.4 rg'),
    );
  }
}

function sec(state: PdfPage, label: string): void {
  state.y -= 12;
  need(state);
  state.ln.push(LN(state.y));
  state.ln.push(RC(L, state.y - 16, R - L, 20, 0.97));
  state.ln.push(...TXT(L + 10, state.y - 6, 'FB', 10, label, '0.25 0.25 0.25 rg'));
  state.ln.push(LN(state.y - 18));
  state.y -= 34;
}

function bodyLine(state: PdfPage, text: string, font: 'F1' | 'FB' = 'F1', size = 9, color = DARK): void {
  for (const line of wrapText(text)) {
    need(state);
    state.ln.push(...TXT(L, state.y, font, size, line, color));
    state.y -= 14;
  }
}

function bulletLine(state: PdfPage, text: string, font: 'F1' | 'FB' = 'F1', size = 9, color = DARK): void {
  for (const line of wrapText(text, 92)) {
    need(state);
    state.ln.push(...TXT(L + 10, state.y, font, size, `- ${line}`, color));
    state.y -= 14;
  }
}

function addExecutiveSummary(state: PdfPage, input: PremiumExportInput): void {
  const { project, coverage } = input;
  const registry = project.registry ?? 'Unknown';
  const reviewed = coverage.verified + coverage.gap;

  sec(state, 'EXECUTIVE SUMMARY');
  bodyLine(state, `Registry / Standard: ${registry}`);
  bodyLine(state, `Methodology: ${project.methodCode ?? 'n/a'} @ ${project.methodVersion ?? 'n/a'}`);
  if (project.methodCategory) bodyLine(state, `Category: ${project.methodCategory}`);
  bodyLine(state, `Review mode: ${project.reviewMode === 'manual' ? 'Manual review' : 'Methodology-linked'}`);
  bodyLine(state, `Project status: ${project.status === 'locked' ? 'Locked' : 'In Progress'}`);
  bodyLine(state, `Coverage summary: ${reviewed} of ${coverage.total} rules reviewed (${coverage.percentComplete}% complete)`);
  bodyLine(state, `Verified: ${coverage.verified} | Gap: ${coverage.gap} | Not started: ${coverage.notStarted} | In progress: ${coverage.inProgress} | NA: ${coverage.notApplicable}`);
  bodyLine(state, `Evidence inventory items: ${input.inventory.length}`);
  bodyLine(state, `Extracted fragments: ${input.fragments.length}`);
  bodyLine(state, `Extracted facts: ${input.facts.length}`);
  bodyLine(state, `Candidate links: ${input.candidateLinks.length}`);
  if (input.reconciliationRun) {
    bodyLine(state, `Gaps identified: ${input.reconciliationRun.gaps.length}`);
  }
  if (input.decisionRun) {
    bodyLine(state, `Reviewer decisions: ${input.decisionRun.decisions.length}`);
  }
  state.y -= 4;
}

function addProjectInformation(state: PdfPage, input: PremiumExportInput): void {
  const { project } = input;
  sec(state, 'PROJECT INFORMATION');
  bodyLine(state, `Project name: ${project.name}`);
  bodyLine(state, `Project ID: ${project.id}`);
  if (project.aoiLabel) bodyLine(state, `AOI label: ${project.aoiLabel}`);
  if (project.description) bodyLine(state, `Description: ${project.description}`);
  bodyLine(state, `Created: ${safeDate(project.createdAt)}`);
  if (project.lockedAt) bodyLine(state, `Locked: ${safeDate(project.lockedAt)}`);
  bodyLine(state, `Registry: ${project.registry ?? 'Unknown'}`);
  bodyLine(state, `Documents uploaded: ${project.documents.length}`);
  bodyLine(state, `Review mode: ${project.reviewMode}`);
  bodyLine(state, `Review items: ${project.reviews.length}`);
  state.y -= 4;
}

function addMethodologySections(state: PdfPage, input: PremiumExportInput): void {
  const project = input.project;
  sec(state, 'METHODOLOGY SOURCE SECTIONS');
  if (project.methodCode && project.methodVersion) {
    bodyLine(state, `Methodology: ${project.methodCode} @ ${project.methodVersion}`);
  } else {
    bodyLine(state, 'No methodology linked to this project.');
    state.y -= 4;
    return;
  }

  const sections = new Map<string, { title: string; count: number }>();
  for (const review of project.reviews) {
    const sectionId = review.sectionId || 'Requirements';
    const existing = sections.get(sectionId);
    if (existing) {
      existing.count++;
    } else {
      sections.set(sectionId, { title: sectionId, count: 1 });
    }
  }

  for (const [sectionId, info] of sections) {
    bulletLine(state, `${sectionId}: ${info.count} rule${info.count === 1 ? '' : 's'}`);
  }

  if (sections.size === 0) {
    bodyLine(state, 'No methodology sections loaded.');
  }
  state.y -= 4;
}

function addEvidenceInventory(state: PdfPage, input: PremiumExportInput): void {
  sec(state, 'EVIDENCE INVENTORY');
  const { inventory, sources, fragments } = input;

  if (inventory.length === 0) {
    bodyLine(state, 'No evidence items in the inventory.');
    state.y -= 4;
    return;
  }

  bodyLine(state, `Total evidence items: ${inventory.length}`, 'F1', 9, MED);
  bodyLine(state, `Source documents: ${sources.length}`, 'F1', 9, MED);
  state.y -= 4;

  for (const item of inventory) {
    need(state);
    const lineHeight = 22 + item.display_name.length > 60 ? 34 : 22;
    state.ln.push(RC(L + 4, state.y - lineHeight + 8, R - L - 8, lineHeight - 4, CARD_BG));
    const kindLabel = item.kind.toUpperCase();
    state.ln.push(RC(L + 10, state.y - 4 - 10, 44, 10, 0.9));
    state.ln.push(...TXT(L + 12, state.y - 4, 'FB', 7, kindLabel, '0.4 0.4 0.4 rg'));
    const name = truncate(item.display_name, 80);
    state.ln.push(...TXT(L + 62, state.y - 2, 'F1', 8, name, DARK));
    state.y -= lineHeight;
    state.ln.push(...TXT(L + 62, state.y, 'F1', 7, `Added: ${safeDate(item.added_at)}`, LIGHT));
    state.ln.push(...TXT(L + 62 + textWidth(`Added: ${safeDate(item.added_at)}`, 7) + 20, state.y, 'F1', 7, `Fragments: ${(item.pdd_fragments ?? []).length}`, LIGHT));
    const rStatus = item.reconciliation_status ? `Status: ${item.reconciliation_status}` : '';
    if (rStatus) {
      const rsX = L + 62 + textWidth(`Added: ${safeDate(item.added_at)}`, 7) + textWidth(`Fragments: ${(item.pdd_fragments ?? []).length}`, 7) + 40;
      state.ln.push(...TXT(rsX, state.y, 'F1', 7, rStatus, LIGHT));
    }
    state.y -= 18;

    const relatedFragments = fragments
      .filter((fragment) => fragment.documentId === item.evidence_id)
      .sort((a, b) => a.fragmentId.localeCompare(b.fragmentId))
      .slice(0, 3);

    if (relatedFragments.length === 0) {
      state.ln.push(...TXT(L + 62, state.y, 'F1', 7, 'No extracted fragments with provenance for this evidence item.', LIGHTER));
      state.y -= 14;
    }

    for (const fragment of relatedFragments) {
      const provenance = [
        fragment.fragmentId,
        fragment.pageStart ? `p.${fragment.pageStart}${fragment.pageEnd && fragment.pageEnd !== fragment.pageStart ? `-${fragment.pageEnd}` : ''}` : null,
        fragment.sheetName ? `sheet ${fragment.sheetName}` : null,
      ].filter(Boolean).join(' · ');
      state.ln.push(...TXT(L + 72, state.y, 'FB', 7, fragment.label, MED));
      state.y -= 11;
      if (provenance) {
        state.ln.push(...TXT(L + 72, state.y, 'F1', 7, provenance, LIGHTER));
        state.y -= 11;
      }
      for (const line of wrapText(truncate(fragment.text.replace(/\s+/g, ' '), 180), 82)) {
        state.ln.push(...TXT(L + 72, state.y, 'F1', 7, line, LIGHT));
        state.y -= 10;
      }
      state.ln.push(...TXT(L + 72, state.y, 'F1', 7, `sha256 ${fragment.contentSha256}`, LIGHTER));
      state.y -= 12;
    }
  }
  state.y -= 4;
}

function addExtractedFacts(state: PdfPage, input: PremiumExportInput): void {
  sec(state, 'EXTRACTED FACTS');
  const { facts } = input;

  if (facts.length === 0) {
    bodyLine(state, 'No extracted facts available.');
    state.y -= 4;
    return;
  }

  const grouped = new Map<string, ExtractedFact[]>();
  for (const fact of facts) {
    const type = fact.factType;
    const existing = grouped.get(type) ?? [];
    existing.push(fact);
    grouped.set(type, existing);
  }

  bodyLine(state, `Total extracted facts: ${facts.length} across ${grouped.size} types`, 'F1', 9, MED);

  for (const [factType, typeFacts] of grouped) {
    state.y -= 8;
    need(state);
    const typeLabel = factType.replace(/-/g, ' ');
    state.ln.push(...TXT(L + 8, state.y, 'FB', 9, typeLabel.toUpperCase(), DARK));
    state.y -= 16;
    state.ln.push(...TXT(L + 8, state.y, 'F1', 8, `${typeFacts.length} fact${typeFacts.length === 1 ? '' : 's'}`, LIGHT));
    state.y -= 16;

    const display = typeFacts.slice(0, 8);
    for (const fact of display) {
      need(state);
      state.ln.push(...TXT(L + 16, state.y, 'F1', 8, `- ${truncate(fact.value, 80)}`, MED));
      state.y -= 13;
      state.ln.push(...TXT(L + 26, state.y, 'F1', 7, `[${fact.fragmentId}]`, LIGHTER));
      state.y -= 13;
    }
    if (typeFacts.length > 8) {
      state.ln.push(...TXT(L + 16, state.y, 'F1', 8, `... and ${typeFacts.length - 8} more`, LIGHT));
      state.y -= 14;
    }
  }
  state.y -= 4;
}

function addCoverageMatrix(state: PdfPage, input: PremiumExportInput): void {
  sec(state, 'COVERAGE MATRIX');
  const { project, reconciliationRun } = input;

  if (project.reviews.length === 0) {
    bodyLine(state, 'No reviews recorded for this project.');
    state.y -= 4;
    return;
  }

  bodyLine(state, `Total rules: ${project.reviews.length}`, 'F1', 9, MED);
  if (reconciliationRun) {
    bodyLine(state, `Reconciliation status: ${reconciliationRun.status}`, 'F1', 9, MED);
    bodyLine(state, `Coverage gaps: ${reconciliationRun.gaps.length}`, 'F1', 9, MED);
    bodyLine(state, `Reconciliation fingerprints: ${reconciliationRun.reconciliationFingerprint}`, 'F1', 7, LIGHT);
  }
  state.y -= 4;

  for (const review of project.reviews) {
    need(state);
    const statusLabel = review.status.toUpperCase();
    const statusColorMap: Record<string, string> = {
      'VERIFIED': '0.3 0.75 0.3 rg',
      'GAP': '0.7 0.3 0.3 rg',
      'NOT-STARTED': '0.7 0.7 0.7 rg',
      'IN-PROGRESS': '0.75 0.65 0.3 rg',
      'NOT-APPLICABLE': '0.6 0.6 0.6 rg',
    };
    const chipColor = statusColorMap[statusLabel] || '0.5 0.5 0.5 rg';

    const lineCount = Math.max(2, Math.ceil((review.ruleTitle.length + review.ruleId.length) / 96) + 1);
    const cardH = 18 + lineCount * 14;

    state.ln.push(RC(L + 4, state.y - cardH + 8, R - L - 8, cardH - 4, CARD_BG));
    state.ln.push(RC(L + 10, state.y - 4 - 10, 32, 10, 0.9));
    state.ln.push(...TXT(L + 13, state.y - 4, 'FB', 6, `[${statusLabel}]`, chipColor));
    state.ln.push(...TXT(L + 50, state.y - 2, 'FB', 8, review.ruleId, DARK));
    state.y -= 16;

    for (const line of wrapText(review.ruleTitle, 88)) {
      state.ln.push(...TXT(L + 50, state.y, 'F1', 8, line, MED));
      state.y -= 13;
    }
    state.y -= 4;

    if (review.evidenceIds.length > 0) {
      state.ln.push(...TXT(L + 60, state.y, 'F1', 7, `Evidence: ${review.evidenceIds.length} reference(s)`, LIGHT));
      state.y -= 12;
    } else {
      state.ln.push(...TXT(L + 60, state.y, 'F1', 7, 'No evidence linked', LIGHTER));
      state.y -= 12;
    }

    state.y -= 8;
  }
  state.y -= 4;

  if (reconciliationRun && reconciliationRun.gaps.length > 0) {
    sec(state, 'COVERAGE GAPS');
    for (const gap of reconciliationRun.gaps) {
      need(state);
      state.ln.push(RC(L + 8, state.y - 22, R - L - 16, 18, NOTE_BG));
      state.ln.push(...TXT(L + 16, state.y - 5, 'FB', 8, gap.ruleId, DARK));
      state.y -= 18;
      state.ln.push(...TXT(L + 24, state.y, 'F1', 7, gap.ruleTitle, MED));
      state.y -= 16;
    }
  }
}

function addReviewerDecisions(state: PdfPage, input: PremiumExportInput): void {
  sec(state, 'REVIEWER DECISIONS');
  const { decisionRun } = input;

  const decisions = decisionRun?.decisions ?? [];
  if (decisions.length === 0) {
    bodyLine(state, 'No reviewer decisions recorded for this project.');
    state.y -= 4;
    return;
  }

  bodyLine(state, `Total decisions: ${decisions.length}`, 'F1', 9, MED);
  if (decisionRun) {
    bodyLine(state, `Decision set fingerprint: ${decisionRun.decisionSetFingerprint}`, 'F1', 7, LIGHT);
  }
  state.y -= 4;

  for (const decision of decisions) {
    need(state);
    const statusColorMap: Record<string, string> = {
      'approved': '0.3 0.75 0.3 rg',
      'rejected': '0.7 0.3 0.3 rg',
      'needs-review': '0.75 0.65 0.3 rg',
    };
    const chipColor = statusColorMap[decision.status] || '0.5 0.5 0.5 rg';
    const statusLabel = decision.status.toUpperCase();

    const rationaleLines = wrapText(decision.rationale, 90).length;
    const cardH = 40 + rationaleLines * 12 + (decision.evidenceInventoryIds.length > 0 ? 12 : 0);

    state.ln.push(RC(L + 4, state.y - cardH + 8, R - L - 8, cardH - 4, CARD_BG));
    state.ln.push(RC(L + 10, state.y - 4 - 10, 50, 10, 0.9));
    state.ln.push(...TXT(L + 13, state.y - 4, 'FB', 6, `[${statusLabel}]`, chipColor));
    state.ln.push(...TXT(L + 68, state.y - 2, 'FB', 8, decision.ruleId, DARK));
    state.y -= 16;

    state.ln.push(...TXT(L + 68, state.y, 'F1', 8, truncate(decision.ruleTitle, 70), MED));
    state.y -= 14;

    state.ln.push(...TXT(L + CARD_INDENT, state.y, 'F1', 8, 'Rationale:', LIGHT));
    state.y -= 13;
    for (const line of wrapText(decision.rationale, 90)) {
      state.ln.push(...TXT(L + CARD_INDENT + 6, state.y, 'F1', 9, line, DARK));
      state.y -= 12;
    }

    if (decision.evidenceInventoryIds.length > 0) {
      state.ln.push(...TXT(L + CARD_INDENT, state.y, 'F1', 7, `Evidence refs: ${decision.evidenceInventoryIds.join(', ')}`, LIGHT));
      state.y -= 12;
    }

    state.y -= 6;
    state.ln.push(...TXT(L + CARD_INDENT, state.y, 'F1', 7, `Reviewer: ${decision.reviewerId} | ${safeDate(decision.reviewedAt)}`, LIGHTER));
    state.y -= 12;

    state.ln.push(...TXT(L + CARD_INDENT, state.y, 'F1', 7, `Provenance: ${decision.provenanceHash}`, LIGHTER));
    state.y -= 14;
  }
  state.y -= 4;
}

function addLimitations(state: PdfPage): void {
  sec(state, 'LIMITATIONS AND DISCLAIMERS');
  bodyLine(state, 'This export is a readiness-review artifact. It is not:');
  bulletLine(state, 'An official verification opinion, validation statement, or certification decision.');
  bulletLine(state, 'A registry-approved compliance determination or issuance approval.');
  bulletLine(state, 'A legal opinion or binding assessment of carbon credit eligibility.');
  state.y -= 4;
  bodyLine(state, 'Evidence sufficiency is a reviewer determination. Metrics and candidate links are advisory.');
  bodyLine(state, 'All pipeline artifacts are deterministic: same inputs produce identical outputs.');
  state.y -= 4;
  bodyLine(state, 'Canonical deterministic artifacts are produced by the app pipeline. Advisory candidate intelligence does not establish final evidence sufficiency.');
  state.y -= 4;
}

function addProvenance(state: PdfPage, input: PremiumExportInput): void {
  sec(state, 'PROVENANCE CHAIN');
  const now = input.exportTime ?? new Date().toISOString();
  const { project, inventory, fragments, facts, candidateLinks, reconciliationRun, decisionRun } = input;

  const provenanceItems: Array<[string, string]> = [
    ['Export time', now],
    ['Project', `${project.name} (${project.id})`],
    ['Registry', project.registry ?? 'Unknown'],
    ['Methodology', project.methodCode && project.methodVersion ? `${project.methodCode} @ ${project.methodVersion}` : 'n/a'],
    ['Review mode', project.reviewMode],
    ['Coverage', `${coverageSummary(input)}`],
    ['Evidence inventory', `${inventory.length} items`],
    ['Extracted fragments', `${fragments.length}`],
    ['Extracted facts', `${facts.length}`],
    ['Candidate links', `${candidateLinks.length}`],
  ];

  if (reconciliationRun) {
    provenanceItems.push(['Reconciliation status', reconciliationRun.status]);
    provenanceItems.push(['Reconciliation fingerprint', reconciliationRun.reconciliationFingerprint]);
    provenanceItems.push(['Coverage gaps', `${reconciliationRun.gaps.length}`]);
  }

  if (decisionRun) {
    provenanceItems.push(['Decision set fingerprint', decisionRun.decisionSetFingerprint]);
    provenanceItems.push(['Reviewer decisions', `${decisionRun.decisions.length}`]);
  }

  for (const [label, value] of provenanceItems) {
    const line = `${label}: ${value}`;
    bodyLine(state, line, 'F1', 8, LIGHT);
  }
  state.y -= 4;
}

function coverageSummary(input: PremiumExportInput): string {
  const { coverage } = input;
  return `${coverage.verified + coverage.gap} of ${coverage.total} rules (${coverage.percentComplete}%)`;
}

function buildPdfStream(state: PdfPage, input: PremiumExportInput): string[] {
  const now = exportTimestamp(input).replace('T', ' ').slice(0, 16);
  const isManual = input.project.reviewMode === 'manual';

  addCoverPage(state, input);

  state.y = BODY_TOP;
  addExecutiveSummary(state, input);
  addProjectInformation(state, input);
  addMethodologySections(state, input);
  addEvidenceInventory(state, input);
  addExtractedFacts(state, input);
  addCoverageMatrix(state, input);
  addReviewerDecisions(state, input);
  addLimitations(state);
  addProvenance(state, input);

  need(state);
  state.ln.push(
    LN(state.y),
    ...TXT(L, state.y - 12, 'F1', 7, 'This export was generated deterministically from project evidence pipeline data.', '0.65 0.65 0.65 rg'),
    ...TXT(L, state.y - 24, 'F1', 7, `Export time ${safeDate(now)}. article6.org | Premium Evidence Export`, '0.65 0.65 0.65 rg'),
  );

  flushPage(state, input.project.name, isManual, input.project.registry ?? 'Unknown', now, false);
  return state.streams;
}

function assemblePdf(streams: string[]): Buffer {
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

export function buildPremiumPdf(input: PremiumExportInput): Buffer {
  const state = makePageState();
  const streams = buildPdfStream(state, input);
  return assemblePdf(streams);
}
