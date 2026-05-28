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

function findLiteralOccurrences(text: string, queries: string[]): string[] {
  const results: string[] = [];
  for (const q of queries) {
    let idx = 0;
    const count = results.length;
    while (idx < text.length) {
      const pos = text.toLowerCase().indexOf(q.toLowerCase(), idx);
      if (pos === -1) break;
      const start = Math.max(0, pos - 60);
      const end = Math.min(text.length, pos + q.length + 120);
      let snippet = text.slice(start, end);
      snippet = snippet.replace(/\s+/g, " ").trim();
      if (start > 0) snippet = `...${snippet}`;
      if (end < text.length) snippet = `${snippet}...`;
      results.push(`${q} @${pos}: ${snippet.slice(0, 200)}`);
      idx = pos + 1;
      if (results.length - count >= 5) break;
    }
  }
  return results;
}

function diagnoseTextStructure(rawText: string): Record<string, string> {
  const text = rawText.replace(/\s+/g, " ").trim();
  const newlineCount = (rawText.match(/\n/g) ?? []).length;
  const lines = rawText.split("\n").filter((l) => l.trim());
  const longLineCount = lines.filter((l) => l.length > 200).length;
  const shortLineCount = lines.filter((l) => l.length <= 200).length;

  const sectionNumberMatches = [...text.matchAll(/\b(\d+(?:\.\d+)*)\b/g)]
    .map((m) => m[1]!)
    .filter((n) => /^\d+\.\d+$/.test(n) || /^\d+$/.test(n));

  const topSectionNumbers = Array.from(new Set(sectionNumberMatches))
    .filter((n) => {
      const parts = n.split(".");
      const first = parseInt(parts[0]!, 10);
      return first >= 1 && first <= 10;
    })
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .slice(0, 50);

  const titleCaseHeadingCandidates = [...text.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,5})\b/g)]
    .map((m) => m[1]!)
    .filter((t) => t.length >= 10 && t.length <= 80 && /^(?:Baseline|Additionality|Leakage|Project|Boundary|Monitoring).*/i.test(t));

  const uniqueTitles = Array.from(new Set(titleCaseHeadingCandidates)).slice(0, 20);

  const literalOccurrences = findLiteralOccurrences(text, [
    "2.4", "2.5", "1.10",
    "Baseline Scenario", "Additionality", "Leakage",
    "Project Description",
  ]);

  return {
    newlineCount: String(newlineCount),
    longLinesOver200: String(longLineCount),
    shortLinesUnder200: String(shortLineCount),
    topSectionNumbers: JSON.stringify(topSectionNumbers),
    titleCaseHeadings: JSON.stringify(uniqueTitles),
    literalOccurrences: JSON.stringify(literalOccurrences),
  };
}

export function debugSectionExtraction(rawText: string): Record<string, string> {
  return {
    rawPddTextLength: String(rawText.length),
    rawPddTextPreview: rawText.slice(0, 2000),
    detectedSections: JSON.stringify(Object.keys(extractPddSections(rawText))),
    headingMatches: JSON.stringify(extractHeadings(normalizeText(rawText)).map((h) => h.num)),
    ...diagnoseTextStructure(rawText),
  };
}
