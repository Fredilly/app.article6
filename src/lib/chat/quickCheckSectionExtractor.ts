export const SECTION_EXCERPT_MAX_CHARS = 3000;
const SECTION_KEY_NORMALIZE_RE = /[^\d.]/g;

const SECTION_HEADING_RE = /^(?:\s*(?:Section\s+)?(\d+(?:\.\d+)*)\s*[.:]?\s+(.+))\s*$/gm;
const SECTION_HEADING_DOT_RE = /^(?:\s*(?:Section\s+)?(\d+(?:\.\d+)*)\.\s+(.+))\s*$/gm;
const SECTION_HEADING_PAREN_RE = /^(?:\s*(?:Section\s+)?(\d+(?:\.\d+)*)\s+\((.+)\))\s*$/gm;

export function normalizeSectionKey(key: string): string {
  return key.replace(SECTION_KEY_NORMALIZE_RE, "").replace(/\.+$/, "").trim();
}

function stripHeaderFooterNoise(text: string): string {
  return text
    .split("\n")
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
  const headings: HeadingMatch[] = [];
  for (const re of patterns) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const num = match[1]!;
      const title = match[2]!.trim();
      if (!title) continue;
      if (/^\d/.test(title)) continue;
      if (title.length > 120) continue;
      if (headings.some((h) => h.num === num)) continue;
      headings.push({ num, title, start: match.index, end: match.index + match[0].length });
    }
    re.lastIndex = 0;
  }
  return headings;
}

const DEFAULT_HEADING_PATTERNS = [
  SECTION_HEADING_RE,
  SECTION_HEADING_DOT_RE,
  SECTION_HEADING_PAREN_RE,
];

function extractHeadings(text: string): HeadingMatch[] {
  return tryHeadingPatterns(text, DEFAULT_HEADING_PATTERNS);
}

export function extractPddSections(rawText: string): Record<string, string> {
  const cleaned = normalizeText(rawText);
  const sections: Record<string, string> = {};
  const headings = extractHeadings(cleaned);

  if (headings.length === 0) {
    const inlineRe = /\b(\d+(?:\.\d+)*)\s{2,}([A-Z][A-Za-z\s-]{2,60})(?=\n|$)/g;
    let match: RegExpExecArray | null;
    while ((match = inlineRe.exec(cleaned)) !== null) {
      const num = match[1]!;
      const title = match[2]!.trim();
      if (!title) continue;
      if (/^\d/.test(title)) continue;
      headings.push({ num, title, start: match.index, end: match.index + match[0].length });
    }
  }

  if (headings.length === 0) {
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
      headings.push({ num, title, start: linePos(i), end: linePos(i + 2) });
    }
  }

  if (headings.length === 0) return sections;

  for (let i = 0; i < headings.length; i++) {
    const h = headings[i]!;
    const contentStart = h.end;
    const nextStart = i + 1 < headings.length ? headings[i + 1]!.start : cleaned.length;
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

export function debugSectionExtraction(rawText: string): Record<string, string> {
  return diagnoseTextStructure(rawText);
}
