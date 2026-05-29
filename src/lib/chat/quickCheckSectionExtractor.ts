export const SECTION_EXCERPT_MAX_CHARS = 3000;
const SECTION_KEY_NORMALIZE_RE = /[^\d.]/g;

const SECTION_HEADING_RE = /^(?:\s*(?:Section\s+)?(\d+(?:\.\d+)*)\s*[.:]?\s+(.+))\s*$/gm;
const SECTION_HEADING_DOT_RE = /^(?:\s*(?:Section\s+)?(\d+(?:\.\d+)*)\.\s+(.+))\s*$/gm;
const SECTION_HEADING_PAREN_RE = /^(?:\s*(?:Section\s+)?(\d+(?:\.\d+)*)\s+\((.+)\))\s*$/gm;

export function normalizeSectionKey(key: string): string {
  return key.replace(SECTION_KEY_NORMALIZE_RE, "").replace(/\.+$/, "").trim();
}

function stripHeaderFooterNoise(text: string): string {
  const lines = text.split("\n");
  if (lines.length <= 1) return text;
  return lines
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (/^(page\s+\d+\s+of\s+\d+|page\s+\d+|v\d+\.\d+.*|vm0007.*|project\s+description\s+document|\d+\s+of\s+\d+)$/i.test(trimmed)) return false;
      return true;
    })
    .join("\n");
}

function normalizeText(raw: string): string {
  return stripHeaderFooterNoise(raw)
    .replace(/\f/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

type HeadingMatch = {
  num: string;
  title: string;
  start: number;
  end: number;
};

function tryHeadingPatterns(text: string, patterns: RegExp[]): HeadingMatch[] {
  const allCandidates: HeadingMatch[] = [];
  for (const re of patterns) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const num = match[1]!;
      const title = match[2]!.trim();
      if (!title) continue;
      if (/^\d/.test(title)) continue;
      if (/^[a-z]/.test(title)) continue;
      if (title.length > 120) continue;
      allCandidates.push({ num, title, start: match.index, end: match.index + match[0].length });
    }
    re.lastIndex = 0;
  }
  return allCandidates;
}

function isTocTitle(title: string): boolean {
  return /\.{4,}\s*\d+\s*$/.test(title) || /\bpage\s+\d+\s*$/i.test(title);
}

function findTocBlockBounds(text: string): { start: number; end: number } | null {
  const lines = text.split("\n");
  const lineEndPositions: number[] = [];
  let pos = 0;
  for (const line of lines) {
    pos += line.length;
    lineEndPositions.push(pos);
    pos += 1;
  }

  let headerLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.toLowerCase().trim().match(/^(table\s+of\s+contents|contents)$/)) {
      headerLineIdx = i;
      break;
    }
  }
  if (headerLineIdx === -1) return null;

  let tocEndLine = headerLineIdx + 1;
  for (let i = headerLineIdx + 1; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();
    if (!trimmed) {
      if (i === headerLineIdx + 1) continue;
      tocEndLine = i;
      break;
    }
    if (!/^\d+(?:\.\d+)*\s+[A-Z]/.test(trimmed)) {
      tocEndLine = i;
      break;
    }
  }

  const tocStart = headerLineIdx > 0 ? lineEndPositions[headerLineIdx - 1]! + 1 : 0;
  const tocEnd = tocEndLine < lines.length ? lineEndPositions[tocEndLine - 1]! + 1 : text.length;
  return { start: tocStart, end: tocEnd };
}

function isInsideTocBlock(pos: number, tocBlock: { start: number; end: number } | null): boolean {
  if (!tocBlock) return false;
  return pos >= tocBlock.start && pos < tocBlock.end;
}

function hasBodyTextAfter(text: string, startPos: number): boolean {
  const after = text.slice(startPos);
  const re = SECTION_HEADING_RE;
  re.lastIndex = 0;
  const nextMatch = re.exec(after);
  const between = nextMatch ? after.slice(0, nextMatch.index).trim() : after.trim();
  if (between.length < 5) return false;
  if (/[a-z]{4,}/.test(between)) return true;
  if (/[.!?]\s+[A-Z]/.test(between)) return true;
  return false;
}

const DEFAULT_HEADING_PATTERNS = [
  SECTION_HEADING_RE,
  SECTION_HEADING_DOT_RE,
  SECTION_HEADING_PAREN_RE,
];



function findHeadingsInContinuousText(text: string): HeadingMatch[] {
  const headings: HeadingMatch[] = [];
  const re = /\b(\d+(?:\.\d+)*)\s{1,4}/g;
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const num = match[1]!;
    if (seen.has(num)) continue;
    seen.add(num);

    const beforeCtx = text.slice(Math.max(0, match.index - 30), match.index).toLowerCase();
    if (/\b(?:page|version)\s*$/.test(beforeCtx)) continue;

    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 60);
    const titleMatch = after.match(/^([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})/);
    if (!titleMatch) continue;
    let title = titleMatch[1]!.trim();
    if (title.length < 3 || title.length > 120) continue;
    if (/^\d/.test(title)) continue;
    if (headings.some((h) => h.num === num)) continue;

    const articleRe = /\b(?:The|A|An|This|That|These|Those|For|With|From)\b/i;
    const words = title.split(/\s+/);
    const filteredWords = words.filter((w) => !articleRe.test(w));
    title = filteredWords.length > 0 ? filteredWords.join(" ") : words[0]!;

    if (title.length < 2) continue;

    const end = match.index + match[0].length + titleMatch[0].length;
    headings.push({ num, title, start: match.index, end });
  }

  return headings;
}

function findAllRawCandidates(cleaned: string): HeadingMatch[] {
  const all: HeadingMatch[] = [];
  const raw = tryHeadingPatterns(cleaned, DEFAULT_HEADING_PATTERNS);
  all.push(...raw);
  if (all.length === 0) {
    const inlineRe = /\b(\d+(?:\.\d+)*)\s{2,}([A-Z][A-Za-z\s-]{2,60})(?=\n|$)/g;
    let match: RegExpExecArray | null;
    while ((match = inlineRe.exec(cleaned)) !== null) {
      const num = match[1]!;
      const title = match[2]!.trim();
      if (!title) continue;
      if (/^\d/.test(title)) continue;
      all.push({ num, title, start: match.index, end: match.index + match[0].length });
    }
  }
  if (all.length === 0) {
    const lines = cleaned.split("\n");
    const linePos = (idx: number) => {
      let pos = 0;
      for (let j = 0; j < idx; j++) pos += lines[j]!.length + 1;
      return pos;
    };
    for (let i = 0; i < lines.length - 1; i++) {
      const numMatch = lines[i]!.match(/^\s*(\d+(?:\.\d+)*)\s*$/);
      if (!numMatch) continue;
      const num = numMatch[1]!;
      const title = lines[i + 1]!.trim();
      if (!title) continue;
      if (/^\d/.test(title)) continue;
      if (title.length > 120) continue;
      all.push({ num, title, start: linePos(i), end: linePos(i + 2) });
    }
  }
  return all;
}

export function extractPddSections(rawText: string): Record<string, string> {
  const cleaned = normalizeText(rawText);
  const sections: Record<string, string> = {};

  let allCandidates = findAllRawCandidates(cleaned);

  if (allCandidates.length === 0) {
    const continuousHeadings = findHeadingsInContinuousText(cleaned);
    allCandidates = continuousHeadings;
  }

  if (allCandidates.length === 0) return sections;

  const tocBlock = findTocBlockBounds(cleaned);
  // TOC block detected: only candidates outside it survive the proximity check
  const bestByNum = new Map<string, { heading: HeadingMatch; reason: string | null }>();

  for (const h of allCandidates) {
    const existing = bestByNum.get(h.num);
    const reason: string | null = (() => {
      if (isTocTitle(h.title)) return "line-level TOC markers";
      if (tocBlock && isInsideTocBlock(h.start, tocBlock)) return "inside TOC block";
      if (!hasBodyTextAfter(cleaned, h.end)) return "no body text after heading";
      return null;
    })();

    if (!existing) {
      bestByNum.set(h.num, { heading: h, reason });
      continue;
    }

    if (reason === null && existing.reason !== null) {
      bestByNum.set(h.num, { heading: h, reason: null });
    } else if (reason === null && existing.reason === null && h.start > existing.heading.start) {
      bestByNum.set(h.num, { heading: h, reason: null });
    }
  }

  const selectedHeadings: HeadingMatch[] = [];
  for (const [, entry] of bestByNum) {
    if (entry.reason === null) {
      selectedHeadings.push(entry.heading);
    }
  }

  if (selectedHeadings.length === 0) return sections;

  for (let i = 0; i < selectedHeadings.length; i++) {
    const h = selectedHeadings[i]!;
    const contentStart = h.end;
    const nextStart = i + 1 < selectedHeadings.length ? selectedHeadings[i + 1]!.start : cleaned.length;
    let content = cleaned.slice(contentStart, nextStart).trim();
    if (content) {
      content = `${h.title}\n${content}`;
    } else {
      content = h.title;
    }
    if (content.length > SECTION_EXCERPT_MAX_CHARS) {
      content = content.slice(0, SECTION_EXCERPT_MAX_CHARS).replace(/\s+\S*$/, "") + " […]";
    }
    sections[normalizeSectionKey(h.num)] = content;
  }

  return sections;
}

export function extractSectionContent(
  rawText: string,
  sectionNumber: string,
): string | null {
  const sections = extractPddSections(rawText);
  const key = normalizeSectionKey(sectionNumber);
  return sections[key] ?? Object.entries(sections).find(([k]) => normalizeSectionKey(k) === key)?.[1] ?? null;
}

export function extractRoutedSections(
  rawText: string,
  relevantSections: string[],
): Record<string, string> {
  const allSections = extractPddSections(rawText);
  const result: Record<string, string> = {};
  for (const section of relevantSections) {
    const key = normalizeSectionKey(section);
    let content = allSections[key] ?? allSections[section];
    if (!content) {
      const entry = Object.entries(allSections).find(([k]) => normalizeSectionKey(k) === key);
      if (entry) content = entry[1];
    }
    if (content) {
      result[section] = content;
    }
  }
  return result;
}

function findSnippets(text: string, query: string, maxResults = 5): string[] {
  const results: string[] = [];
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let idx = 0;
  while (idx < text.length) {
    const pos = lower.indexOf(q, idx);
    if (pos === -1) break;
    const start = Math.max(0, pos - 80);
    const end = Math.min(text.length, pos + q.length + 120);
    let snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
    if (start > 0) snippet = `…${snippet}`;
    if (end < text.length) snippet = `${snippet}…`;
    results.push(snippet);
    idx = pos + 1;
    if (results.length >= maxResults) break;
  }
  return results;
}

function findHeadingLikeFragments(text: string, maxResults = 50): string[] {
  const results: string[] = [];
  const seen = new Set<string>();

  const patterns: RegExp[] = [
    /\b(\d+(?:\.\d+)*)\s{2,}([A-Z][A-Za-z\s-]{3,60})(?=[\s,.])/g,
    /\b(?:Section\s+)?(\d+(?:\.\d+)*)\s*[.:]\s+([A-Z][A-Za-z\s-]{3,60})/g,
    /\b([A-Z][A-Z\s-]{5,60})\b/g,
  ];

  for (const p of patterns) {
    for (const match of text.replace(/\s+/g, "  ").matchAll(p)) {
      const fragment = match[0]!.trim();
      if (!fragment || seen.has(fragment)) continue;
      if (fragment.length > 120) continue;
      seen.add(fragment);
      results.push(fragment);
      if (results.length >= maxResults) break;
    }
    if (results.length >= maxResults) break;
  }
  return results.slice(0, maxResults);
}

function findNumericFragments(text: string, maxResults = 50): string[] {
  const results: string[] = [];
  const seen = new Set<string>();
  const normalized = text.replace(/\s+/g, " ");

  for (const match of normalized.matchAll(/\b(\d+(?:\.\d+)*)\s{0,3}([A-Z][A-Za-z\s-]{2,60})?/g)) {
    const num = match[1]!;
    const title = match[2]?.trim() ?? "";
    const fragment = title ? `${num} ${title.slice(0, 60)}` : num;
    if (seen.has(num)) continue;
    seen.add(num);
    results.push(fragment.slice(0, 100));
    if (results.length >= maxResults) break;
  }
  return results;
}

function rawLinesAround(rawText: string, sectionNum: string, windowSize = 3): string[] {
  const lines = rawText.split("\n");
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();
    const headingMatch = trimmed.match(
      /^(?:Section\s+)?\d+(?:\.\d+)*\s*[.:]?\s+\S/,
    );
    if (!headingMatch && !trimmed.startsWith(sectionNum)) continue;
    const numOnLine = trimmed.match(/\b\d+(?:\.\d+)*\b/)?.[0];
    if (numOnLine !== sectionNum) continue;
    const start = Math.max(0, i - windowSize);
    const end = Math.min(lines.length, i + windowSize + 1);
    for (let j = start; j < end; j++) {
      result.push(`L${j + 1}: ${lines[j]}`);
    }
    break;
  }
  return result;
}

function diagnoseTextStructure(rawText: string): Record<string, string> {
  const text = rawText.replace(/\s+/g, " ").trim();

  const has2_4 = /\b2\.4\b/.test(text);
  const has2_5 = /\b2\.5\b/.test(text);
  const has1_10 = /\b1\.10\b/.test(text);
  const hasBaseline = /\bbaseline\b/i.test(text);
  const hasAdditionality = /\badditionality\b/i.test(text);
  const hasLeakage = /\bleakage\b/i.test(text);

  const baselineSnippets = findSnippets(text, "baseline", 5);
  const additionalitySnippets = findSnippets(text, "additionality", 5);
  const leakageSnippets = findSnippets(text, "leakage", 5);

  const headingLike = findHeadingLikeFragments(text, 50);
  const numericLike = findNumericFragments(text, 50);

  const rawLines_2_4 = rawLinesAround(rawText, "2.4", 3);
  const rawLines_2_5 = rawLinesAround(rawText, "2.5", 3);
  const rawLines_1_10 = rawLinesAround(rawText, "1.10", 3);

  const sections = extractPddSections(rawText);
  const parsed_2_4 = sections[normalizeSectionKey("2.4")] ? "found" : "missing";
  const parsed_2_5 = sections[normalizeSectionKey("2.5")] ? "found" : "missing";
  const parsed_1_10 = sections[normalizeSectionKey("1.10")] ? "found" : "missing";

  return {
    rawPddTextLength: String(rawText.length),
    includes_2_4: String(has2_4),
    includes_2_5: String(has2_5),
    includes_1_10: String(has1_10),
    includes_baseline: String(hasBaseline),
    includes_additionality: String(hasAdditionality),
    includes_leakage: String(hasLeakage),
    parsed_2_4,
    parsed_2_5,
    parsed_1_10,
    raw_lines_2_4: JSON.stringify(rawLines_2_4),
    raw_lines_2_5: JSON.stringify(rawLines_2_5),
    raw_lines_1_10: JSON.stringify(rawLines_1_10),
    snippets_baseline: JSON.stringify(baselineSnippets),
    snippets_additionality: JSON.stringify(additionalitySnippets),
    snippets_leakage: JSON.stringify(leakageSnippets),
    heading_like_fragments: JSON.stringify(headingLike),
    numeric_fragments: JSON.stringify(numericLike),
  };
}

export type SectionCandidateDebug = {
  allCandidateLines: string[];
  rejectedCandidates: string[];
  selectedCandidate: string;
  selectedReason: string;
  sectionBodyPreview: string;
};

export function analyzeSectionCandidates(rawText: string, sectionNum: string): SectionCandidateDebug {
  const cleaned = normalizeText(rawText);
  const tocBlock = findTocBlockBounds(cleaned);
  const sections = extractPddSections(rawText);
  const key = normalizeSectionKey(sectionNum);
  const bodyContent = sections[key] ?? null;
  const lines = rawText.split("\n");

  const allCandidateLines: string[] = [];
  const rejectedCandidates: string[] = [];
  let selectedCandidate = "none";
  let selectedReason = "section not found in extracted output";

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();
    const headingMatch = trimmed.match(
      /^(?:Section\s+)?(\d+(?:\.\d+)*)\s*[.:]?\s+(.+?)(?:\s*\.{4,}\s*\d+\s*)?$/,
    );
    if (!headingMatch) continue;
    if (headingMatch[1] !== sectionNum) continue;
    const title = headingMatch[2]!.trim();
    const lineText = `L${i + 1}: ${trimmed.slice(0, 120)}`;
    allCandidateLines.push(lineText);

    const rejectReasons: string[] = [];
    if (isTocTitle(title)) {
      rejectReasons.push("line-level TOC markers");
    }
    if (tocBlock) {
      const linePos = lines.slice(0, i).reduce((sum, l) => sum + l.length + 1, 0);
      if (isInsideTocBlock(linePos, tocBlock)) {
        rejectReasons.push("inside TOC block");
      }
    }
    const lineEndPos = lines.slice(0, i + 1).reduce((sum, l) => sum + l.length + 1, 0);
    if (!hasBodyTextAfter(cleaned, lineEndPos)) {
      rejectReasons.push("no body text after heading");
    }
    if (rejectReasons.length > 0) {
      rejectedCandidates.push(`L${i + 1}: ${trimmed.slice(0, 80)} — rejected: ${rejectReasons.join(", ")}`);
    } else {
      selectedCandidate = `L${i + 1}: ${trimmed.slice(0, 120)}`;
      selectedReason = "passes all checks";
    }
  }

  const allRejected = rejectedCandidates.length;
  const allFound = allCandidateLines.length;
  if (allFound === 0) {
    selectedReason = "no heading candidates found for this section number";
  } else if (selectedCandidate === "none" && allRejected > 0) {
    selectedCandidate = `all ${allFound} candidate(s) rejected`;
    selectedReason = "all candidates matched one or more rejection criteria";
  } else if (selectedCandidate === "none") {
    selectedReason = "unknown — heading found but not selected";
  }

  return {
    allCandidateLines,
    rejectedCandidates,
    selectedCandidate,
    selectedReason,
    sectionBodyPreview: (bodyContent ?? "missing").slice(0, 200),
  };
}

export function debugSectionExtraction(rawText: string): Record<string, string> {
  return diagnoseTextStructure(rawText);
}

export type DocumentHeading = {
  sectionNumber: string;
  title: string;
  normalizedTitle: string;
  bodyPreview: string;
  bodyText: string;
};

const HEADING_PREVIEW_MAX = 220;
const HEADING_BODY_MAX = 4000;

function normalizeHeadingTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeBodyPreview(body: string): string {
  const t = body.trim();
  if (!t) return "";
  if (t.length <= HEADING_PREVIEW_MAX) return t;
  return t.slice(0, HEADING_PREVIEW_MAX).replace(/\s+\S*$/, "") + " […]";
}

export function buildPddHeadingIndex(rawPddText: string): DocumentHeading[] {
  if (!rawPddText || rawPddText.trim().length < 10) return [];
  const sections = extractPddSections(rawPddText);
  const headings: DocumentHeading[] = [];
  for (const [num, content] of Object.entries(sections)) {
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length === 0) continue;
    const title = lines[0]!.trim();
    const body = lines.slice(1).join("\n").trim();
    const normalizedTitle = normalizeHeadingTitle(title);
    const bodyPreview = makeBodyPreview(body || title);
    const bodyText = (body || title).slice(0, HEADING_BODY_MAX);
    headings.push({
      sectionNumber: num,
      title,
      normalizedTitle,
      bodyPreview,
      bodyText,
    });
  }
  return headings;
}

export function headingMatchesQuery(heading: DocumentHeading, query: string): boolean {
  const q = normalizeHeadingTitle(query);
  if (!q || q.length < 2) return false;
  if (heading.normalizedTitle.includes(q)) return true;
  const STOP = new Set(["project", "pdd", "this", "that", "what", "does", "the", "and", "for", "with", "from"]);
  const words = q.split(/\s+/).filter((w) => w.length >= 4 && !STOP.has(w));
  if (words.length === 0) return false;
  return words.some((w) => heading.normalizedTitle.includes(w));
}

export function filterPddHeadingsByQuery(headings: DocumentHeading[], query: string): DocumentHeading[] {
  const q = query.trim();
  if (!q) return [];
  return headings.filter((h) => headingMatchesQuery(h, q));
}
