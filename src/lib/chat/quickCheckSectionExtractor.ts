export const SECTION_EXCERPT_MAX_CHARS = 3000;

const SECTION_HEADING_RE = /^(?:\s*(?:Section\s+)?(\d+(?:\.\d+)*)\s*[.:]?\s+(.+))\s*$/gm;

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

function extractHeadings(text: string): HeadingMatch[] {
  const headings: HeadingMatch[] = [];
  SECTION_HEADING_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SECTION_HEADING_RE.exec(text)) !== null) {
    const num = match[1]!;
    const title = match[2]!.trim();
    if (!title) continue;
    if (/^\d/.test(title)) continue;
    if (title.length > 120) continue;
    headings.push({ num, title, start: match.index, end: match.index + match[0].length });
  }
  SECTION_HEADING_RE.lastIndex = 0;
  return headings;
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
    sections[h.num] = content;
  }

  return sections;
}

export function extractSectionContent(
  rawText: string,
  sectionNumber: string,
): string | null {
  const sections = extractPddSections(rawText);
  return sections[sectionNumber] ?? null;
}

export function extractRoutedSections(
  rawText: string,
  relevantSections: string[],
): Record<string, string> {
  const allSections = extractPddSections(rawText);
  const result: Record<string, string> = {};
  for (const section of relevantSections) {
    const content = allSections[section];
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

  return {
    rawPddTextLength: String(rawText.length),
    includes_2_4: String(has2_4),
    includes_2_5: String(has2_5),
    includes_1_10: String(has1_10),
    includes_baseline: String(hasBaseline),
    includes_additionality: String(hasAdditionality),
    includes_leakage: String(hasLeakage),
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
