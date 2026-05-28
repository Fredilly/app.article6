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

function diagnoseHeadingCandidates(rawText: string): string[] {
  const lines = normalizeText(rawText).split("\n");
  const candidates: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line || line.length < 2 || line.length > 200) continue;

    const patterns: RegExp[] = [
      /^\d+(?:\.\d+)*\s+[A-Z]/,
      /^\d+(?:\.\d+)*\s*[.:]\s*[A-Z]/,
      /^Section\s+\d+(?:\.\d+)*/i,
      /^\d+(?:\.\d+)*\s*$/,
      /^[A-Z][A-Z\s-]{3,60}$/,
      /\bSECTION\s+\d/i,
      /\bTABLE\s+OF\s+CONTENTS/i,
      /^\d+(?:\.\d+)*\s{2,}[A-Z]/,
    ];

    const nextLine = i + 1 < lines.length ? lines[i + 1]!.trim() : "";

    for (const pattern of patterns) {
      if (pattern.test(line)) {
        const nextContext = nextLine && !/^\d/.test(nextLine) ? ` → ${nextLine.slice(0, 60)}` : "";
        const key = `${line.slice(0, 80)}${nextContext}`;
        if (!seen.has(key)) {
          seen.add(key);
          candidates.push(`${line.slice(0, 80)}${nextContext}`);
        }
        break;
      }
    }

    if (candidates.length >= 50) break;
  }

  return candidates;
}

export function debugSectionExtraction(rawText: string): Record<string, string> {
  return {
    rawPddTextLength: String(rawText.length),
    rawPddTextPreview: rawText.slice(0, 2000),
    detectedSections: JSON.stringify(Object.keys(extractPddSections(rawText))),
    headingMatches: JSON.stringify(extractHeadings(normalizeText(rawText)).map((h) => h.num)),
    headingCandidates: JSON.stringify(diagnoseHeadingCandidates(rawText)),
  };
}
