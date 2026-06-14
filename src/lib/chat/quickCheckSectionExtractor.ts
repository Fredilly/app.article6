export const SECTION_EXCERPT_MAX_CHARS = 3000;
const SECTION_KEY_NORMALIZE_RE = /[^\d.]/g;

const CDM_KEY_RE = /^([A-Z]\.\d+(?:\.\d+)*)$/;

const SECTION_HEADING_RE = /^(?:[ \t]*(?:Section[ \t]+)?(\d+(?:\.\d+)*)[ \t]*[.:]?[ \t]+(.+))[ \t]*$/gm;
const SECTION_HEADING_DOT_RE = /^(?:[ \t]*(?:Section[ \t]+)?(\d+(?:\.\d+)*)\.[ \t]+(.+))[ \t]*$/gm;
const SECTION_HEADING_PAREN_RE = /^(?:[ \t]*(?:Section[ \t]+)?(\d+(?:\.\d+)*)[ \t]+\((.+)\))[ \t]*$/gm;

const SECTION_HEADING_CDM_RE = /^(?:[ \t]*(?:Section[ \t]+)?([A-Z]\.\d+(?:\.\d+)*)[ \t]*[.:]?[ \t]+(.+))[ \t]*$/gm;
const SECTION_HEADING_CDM_DOT_RE = /^(?:[ \t]*(?:Section[ \t]+)?([A-Z]\.\d+(?:\.\d+)*)\.[ \t]+(.+))[ \t]*$/gm;
const SECTION_HEADING_CDM_PAREN_RE = /^(?:[ \t]*(?:Section[ \t]+)?([A-Z]\.\d+(?:\.\d+)*)[ \t]+\((.+)\))[ \t]*$/gm;

export function normalizeSectionKey(key: string): string {
  const cleaned = key.trim();
  if (CDM_KEY_RE.test(cleaned)) return cleaned;
  return cleaned.replace(SECTION_KEY_NORMALIZE_RE, "").replace(/\.+$/, "").trim();
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

function isConnectorWord(word: string): boolean {
  return /^(?:a|an|and|as|at|by|for|from|in|into|of|on|or|the|to|with|without)$/i.test(word);
}

function isLikelyTopLevelSectionTitle(num: string, title: string): boolean {
  if (num.includes(".")) return true;
  if (/[!?/\\@]/.test(title)) return false;
  if (title.length > 80) return false;

  const words = title.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 8) return false;

  const cleanedWords = words
    .map((word) => word.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9+()-]+$/g, ""))
    .filter(Boolean);

  const headingishWords = words.filter((word) => {
    const cleaned = word.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9+()-]+$/g, "");
    if (!cleaned) return false;
    if (isConnectorWord(cleaned)) return true;
    if (/^[A-Z][a-z][A-Za-z-]*$/.test(cleaned)) return true;
    if (/^[A-Z]{3,}$/.test(cleaned)) return true;
    return false;
  });

  if (headingishWords.length / words.length < 0.6) return false;
  const hasMixedCaseLongWord = cleanedWords.some((word) => /[A-Za-z]{4,}/.test(word) && !/^[A-Z]{2,}$/.test(word));
  const allCapsLongWordCount = cleanedWords.filter((word) => /^[A-Z]{4,}$/.test(word)).length;
  if (!hasMixedCaseLongWord && allCapsLongWordCount < 2) return false;
  return true;
}

function isLikelyHeadingCandidate(num: string, title: string): boolean {
  if (!title) return false;
  if (/^\d/.test(title)) return false;
  if (/^[a-z]/.test(title)) return false;
  if (title.length > 120) return false;
  return isLikelyTopLevelSectionTitle(num, title);
}

function tryHeadingPatterns(text: string, patterns: RegExp[]): HeadingMatch[] {
  const allCandidates: HeadingMatch[] = [];
  for (const re of patterns) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const num = match[1]!;
      const title = match[2]!.trim();
      if (!isLikelyHeadingCandidate(num, title)) continue;
      allCandidates.push({ num, title, start: match.index, end: match.index + match[0].length });
    }
    re.lastIndex = 0;
  }
  return allCandidates;
}

function isTocTitle(title: string): boolean {
  return /\.{4,}\s*\d+\s*$/.test(title) || /\bpage\s+\d+\s*$/i.test(title);
}

function stripTocSuffix(title: string): string {
  return title.replace(/\s*\.{4,}\s*\d+\s*$/g, "").replace(/\bpage\s+\d+\s*$/gi, "").trim();
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
    if (!/^(?:\d+(?:\.\d+)*|[A-Z]\.\d+)\s+[A-Z]/.test(trimmed)) {
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

function extractHeadingNumberFromLine(line: string): string | null {
  const match = line.match(/^\s*(?:Section\s+)?((?:[A-Z]\.)?\d+(?:\.\d+)*)\s*[.:]?\s+\S/);
  return match?.[1] ?? null;
}

function hasBodyTextAfter(text: string, startPos: number, sectionNum: string): boolean {
  const lines = text.slice(startPos).split("\n");
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const nextHeadingNum = extractHeadingNumberFromLine(trimmed);
    if (nextHeadingNum) {
      if (nextHeadingNum.startsWith(`${sectionNum}.`)) {
        continue;
      }
      return false;
    }

    if (trimmed.length < 5) continue;
    if (/[a-z]{4,}/.test(trimmed)) return true;
    if (/[.!?]\s+[A-Z]/.test(trimmed)) return true;
  }
  return false;
}

const DEFAULT_HEADING_PATTERNS = [
  SECTION_HEADING_RE,
  SECTION_HEADING_DOT_RE,
  SECTION_HEADING_PAREN_RE,
  SECTION_HEADING_CDM_RE,
  SECTION_HEADING_CDM_DOT_RE,
  SECTION_HEADING_CDM_PAREN_RE,
];



function findHeadingsInContinuousText(text: string): HeadingMatch[] {
  const headings: HeadingMatch[] = [];
  const re = /\b((?:[A-Z]\.)?\d+(?:\.\d+)*)\s{1,4}/g;
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
    const inlineRe = /\b((?:[A-Z]\.)?\d+(?:\.\d+)*)\s{2,}([A-Z][A-Za-z\s-]{2,60})(?=\n|$)/g;
    let match: RegExpExecArray | null;
    while ((match = inlineRe.exec(cleaned)) !== null) {
      const num = match[1]!;
      const title = match[2]!.trim();
      if (!isLikelyHeadingCandidate(num, title)) continue;
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
      const numMatch = lines[i]!.match(/^\s*((?:[A-Z]\.)?\d+(?:\.\d+)*)\s*$/);
      if (!numMatch) continue;
      const num = numMatch[1]!;
      const title = lines[i + 1]!.trim();
      if (!isLikelyHeadingCandidate(num, title)) continue;
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
  const validCandidates: HeadingMatch[] = [];

  for (const h of allCandidates) {
    const existing = bestByNum.get(h.num);
    const reason: string | null = (() => {
      if (isTocTitle(h.title)) return "line-level TOC markers";
      if (tocBlock && isInsideTocBlock(h.start, tocBlock)) return "inside TOC block";
      if (!hasBodyTextAfter(cleaned, h.end, h.num)) return "no body text after heading";
      return null;
    })();

    if (reason === null) validCandidates.push(h);

    if (!existing) {
      bestByNum.set(h.num, { heading: h, reason });
      continue;
    }

    if (reason === null && existing.reason !== null) {
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
  selectedHeadings.sort((a, b) => a.start - b.start);
  validCandidates.sort((a, b) => a.start - b.start);

  for (let i = 0; i < selectedHeadings.length; i++) {
    const h = selectedHeadings[i]!;
    const contentStart = h.end;
    let nextStart = cleaned.length;
    for (const candidate of validCandidates) {
      if (candidate.start <= h.start) continue;
      if (candidate.start === h.start && candidate.num === h.num) continue;
      if (candidate.num !== h.num && candidate.num.startsWith(`${h.num}.`)) continue;
      nextStart = candidate.start;
      break;
    }
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
    /\b((?:[A-Z]\.)?\d+(?:\.\d+)*)\s{2,}([A-Z][A-Za-z\s-]{3,60})(?=[\s,.])/g,
    /\b(?:Section\s+)?((?:[A-Z]\.)?\d+(?:\.\d+)*)\s*[.:]\s+([A-Z][A-Za-z\s-]{3,60})/g,
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

  for (const match of normalized.matchAll(/\b((?:[A-Z]\.)?\d+(?:\.\d+)*)\s{0,3}([A-Z][A-Za-z\s-]{2,60})?/g)) {
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
      /^(?:Section\s+)?(?:[A-Z]\.)?\d+(?:\.\d+)*\s*[.:]?\s+\S/,
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
      /^(?:Section\s+)?((?:[A-Z]\.)?\d+(?:\.\d+)*)\s*[.:]?\s+(.+?)(?:\s*\.{4,}\s*\d+\s*)?$/,
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
    if (!hasBodyTextAfter(cleaned, lineEndPos, sectionNum)) {
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
  originalTitle: string;
  normalizedTitle: string;
  bodyPreview: string;
  bodyText: string;
  originalBodyText: string;
  normalizedBodyText: string;
};

export type HeadingQueryMatch = {
  heading: DocumentHeading;
  score: number;
  exactTitleMatch: boolean;
  fullPhraseMatch: boolean;
  exactTokenMatches: string[];
  softTokenMatches: string[];
  fallbackKeywordMatches: string[];
  negativeTermMatches: string[];
  coverage: number;
  strong: boolean;
};

export type RejectedHeadingQueryMatch = {
  sectionNumber: string;
  title: string;
  normalizedTitle: string;
  reasons: string[];
  score: number;
  exactTitleMatch: boolean;
  fullPhraseMatch: boolean;
  fallbackKeywordMatches: string[];
};

const HEADING_PREVIEW_MAX = 220;
const HEADING_BODY_MAX = 4000;

function repairPdfExtractionJoins(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]{2,})([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-zA-Z])([/|])([A-Za-z])/g, "$1 $2 $3");
}

function cleanExtractedDisplayText(text: string): string {
  return repairPdfExtractionJoins(text)
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeadingTitle(title: string): string {
  return cleanExtractedDisplayText(title)
    .toLowerCase()
    .replace(/[^\w\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const HEADING_QUERY_PREFIX_RE = /^(?:(?:does|can|could|should|would|will|is|are)\s+(?:this|the)\s+(?:pdd|document)\s+|(?:what|where|when|why|how)\s+(?:is|are|does)\s+(?:this|the)?\s*(?:pdd|document)?\s*|please\s+)+/i;
const HEADING_QUERY_VERB_RE = /^(?:explain|describe|review|check|evaluate|assess|identify|discuss|justify|mention|outline|summarize|present|provide|include|support|demonstrate|define|show|disclose|contain|address)\s+/i;
const HEADING_QUERY_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "by",
  "does",
  "for",
  "from",
  "how",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "pdd",
  "project",
  "section",
  "that",
  "the",
  "their",
  "this",
  "those",
  "under",
  "what",
  "when",
  "where",
  "which",
  "with",
]);
const HEADING_QUERY_LOW_SIGNAL_TOKENS = new Set([
  "adequate",
  "analysis",
  "assessment",
  "check",
  "compliance",
  "comply",
  "conditions",
  "demonstrated",
  "demonstrate",
  "describe",
  "document",
  "explain",
  "identify",
  "justified",
  "justify",
  "meets",
  "evaluate",
  "evidence",
  "appropriate",
  "present",
  "provide",
  "question",
  "report",
  "requirements",
  "review",
  "risk",
  "show",
  "support",
  "suitable",
]);

function stripHeadingQueryBoilerplate(query: string): string {
  return normalizeHeadingTitle(query)
    .replace(HEADING_QUERY_PREFIX_RE, "")
    .replace(HEADING_QUERY_VERB_RE, "")
    .trim();
}

function tokenizeHeadingMatchText(text: string): string[] {
  return normalizeHeadingTitle(text).split(/\s+/).filter(Boolean);
}

function buildHeadingQueryTokens(query: string): string[] {
  return tokenizeHeadingMatchText(stripHeadingQueryBoilerplate(query))
    .filter((token) => token.length >= 3)
    .filter((token) => !/[a-z]+\d+|\d+[a-z]+/.test(token))
    .filter((token) => !HEADING_QUERY_STOP_WORDS.has(token))
    .filter((token) => !HEADING_QUERY_LOW_SIGNAL_TOKENS.has(token));
}

function scoreBoundaryHeadingSpecificity(query: string, heading: DocumentHeading): number {
  const normalizedQuery = stripHeadingQueryBoilerplate(query);
  if (!normalizedQuery) return 0;

  const asksForDirectBoundaryTerms =
    /\bproject boundary\b|\bboundary\b|\bleakage belt\b|\breference region\b/.test(normalizedQuery);
  if (!asksForDirectBoundaryTerms) return 0;

  const title = heading.normalizedTitle;
  let score = 0;

  if (/\bproject boundary\b|\bboundary\b/.test(title)) score += 55;
  if (/\breference region\b/.test(title)) score += 40;
  if (/\bleakage belt\b/.test(title)) score += 30;
  if (/\blocation\b/.test(title) && !/\bboundary\b/.test(title)) score -= 35;

  return score;
}

function sharedPrefixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let idx = 0;
  while (idx < max && a[idx] === b[idx]) idx += 1;
  return idx;
}

function tokensLooselyMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const shorter = Math.min(a.length, b.length);
  if (shorter < 6) return false;
  const prefix = sharedPrefixLength(a, b);
  return prefix >= 6 && prefix / shorter >= 0.5;
}

function countContiguousQueryBigrams(queryTokens: string[], titleTokens: string[]): number {
  if (queryTokens.length < 2 || titleTokens.length < 2) return 0;
  const titleBigrams = new Set<string>();
  for (let i = 0; i < titleTokens.length - 1; i += 1) {
    titleBigrams.add(`${titleTokens[i]} ${titleTokens[i + 1]}`);
  }
  let count = 0;
  for (let i = 0; i < queryTokens.length - 1; i += 1) {
    if (titleBigrams.has(`${queryTokens[i]} ${queryTokens[i + 1]}`)) count += 1;
  }
  return count;
}

function hasOrderedTokenMatch(queryTokens: string[], titleTokens: string[], allowLoose: boolean): boolean {
  if (queryTokens.length === 0) return false;
  let titleIndex = 0;
  for (const queryToken of queryTokens) {
    let found = false;
    while (titleIndex < titleTokens.length) {
      const titleToken = titleTokens[titleIndex]!;
      const matched = allowLoose ? tokensLooselyMatch(queryToken, titleToken) : queryToken === titleToken;
      titleIndex += 1;
      if (matched) {
        found = true;
        break;
      }
    }
    if (!found) return false;
  }
  return true;
}

export function scoreHeadingAgainstQuery(
  heading: DocumentHeading,
  query: string,
  fallbackKeywords: string[] = [],
  negativeTerms: string[] = [],
): HeadingQueryMatch {
  const strippedQuery = stripHeadingQueryBoilerplate(query);
  const queryTokens = buildHeadingQueryTokens(query);
  const titleTokens = tokenizeHeadingMatchText(heading.normalizedTitle);

  if (!strippedQuery || queryTokens.length === 0) {
    return {
      heading,
      score: 0,
      exactTitleMatch: false,
      fullPhraseMatch: false,
      exactTokenMatches: [],
      softTokenMatches: [],
      fallbackKeywordMatches: [],
      negativeTermMatches: [],
      coverage: 0,
      strong: false,
    };
  }

  const exactTokenMatches: string[] = [];
  const softTokenMatches: string[] = [];

  for (const queryToken of queryTokens) {
    if (titleTokens.includes(queryToken)) {
      exactTokenMatches.push(queryToken);
      continue;
    }
    if (titleTokens.some((titleToken) => tokensLooselyMatch(queryToken, titleToken))) {
      softTokenMatches.push(queryToken);
    }
  }

  const exactTitleMatch = heading.normalizedTitle === strippedQuery;
  const fullPhraseMatch = queryTokens.length >= 2 && heading.normalizedTitle.includes(strippedQuery);
  const exactOrderedMatch = hasOrderedTokenMatch(queryTokens, titleTokens, false);
  const looseOrderedMatch = hasOrderedTokenMatch(queryTokens, titleTokens, true);
  const contiguousBigrams = countContiguousQueryBigrams(queryTokens, titleTokens);
  const fallbackKeywordMatches = fallbackKeywords.filter((keyword) => {
    const normalizedKeyword = normalizeHeadingTitle(keyword);
    return normalizedKeyword.length > 0 && heading.normalizedTitle.includes(normalizedKeyword);
  });
  const negativeTermMatches = negativeTerms.filter((term) => {
    const normalizedTerm = normalizeHeadingTitle(term);
    return normalizedTerm.length > 0 && heading.normalizedTitle.includes(normalizedTerm);
  });
  const weightedMatches = exactTokenMatches.length + softTokenMatches.length * 0.7;
  const coverage = queryTokens.length > 0 ? weightedMatches / queryTokens.length : 0;

  let score = 0;
  if (exactTitleMatch) score += 280;
  if (fullPhraseMatch) score += 220;
  if (exactOrderedMatch && queryTokens.length >= 2) score += 120;
  else if (looseOrderedMatch && queryTokens.length >= 2) score += 90;
  score += exactTokenMatches.length * 40;
  score += softTokenMatches.length * 18;
  score += contiguousBigrams * 35;
  score += Math.round(coverage * 100);
  score += fallbackKeywordMatches.reduce((total, keyword) => total + (keyword.includes(" ") ? 28 : 18), 0);
  score -= negativeTermMatches.reduce((total) => total + 50, 0);
  score += scoreBoundaryHeadingSpecificity(query, heading);
  if (queryTokens.length === 1 && exactTokenMatches.length > 0) score += 120;
  else if (queryTokens.length === 1 && softTokenMatches.length > 0) score += 80;

  const strong =
    exactTitleMatch
    || fullPhraseMatch
    || fallbackKeywordMatches.length > 0
    || (queryTokens.length === 1
      ? exactTokenMatches.length > 0 || softTokenMatches.length > 0
      : coverage >= 0.6 && (
        exactTokenMatches.length >= 2
        || looseOrderedMatch
        || contiguousBigrams > 0
      ));

  return {
    heading,
    score,
    exactTitleMatch,
    fullPhraseMatch,
    exactTokenMatches,
    softTokenMatches,
    fallbackKeywordMatches,
    negativeTermMatches,
    coverage,
    strong,
  };
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
    const originalTitle = lines[0]!.trim();
    const originalBodyText = lines.slice(1).join("\n").trim();
    const title = cleanExtractedDisplayText(originalTitle);
    const body = cleanExtractedDisplayText(originalBodyText);
    const normalizedTitle = normalizeHeadingTitle(title);
    const bodyPreview = makeBodyPreview(body || title);
    const bodyText = (body || title).slice(0, HEADING_BODY_MAX);
    headings.push({
      sectionNumber: num,
      title,
      originalTitle,
      normalizedTitle,
      bodyPreview,
      bodyText,
      originalBodyText,
      normalizedBodyText: normalizeHeadingTitle(bodyText),
    });
  }
  return headings;
}

export function headingMatchesQuery(heading: DocumentHeading, query: string): boolean {
  return scoreHeadingAgainstQuery(heading, query).strong;
}

export function filterPddHeadingsByQuery(
  headings: DocumentHeading[],
  query: string,
  fallbackKeywords: string[] = [],
  negativeTerms: string[] = [],
): DocumentHeading[] {
  const q = query.trim();
  if (!q) return [];
  return headings
    .map((heading) => scoreHeadingAgainstQuery(heading, q, fallbackKeywords, negativeTerms))
    .filter((match) => match.strong)
    .sort((a, b) => b.score - a.score || a.heading.sectionNumber.localeCompare(b.heading.sectionNumber, undefined, { numeric: true }))
    .map((match) => match.heading);
}

export function findRejectedHeadingMatches(
  rawPddText: string,
  query: string,
  fallbackKeywords: string[] = [],
): RejectedHeadingQueryMatch[] {
  if (!rawPddText || !query.trim()) return [];

  const cleaned = normalizeText(rawPddText);
  let allCandidates = findAllRawCandidates(cleaned);
  if (allCandidates.length === 0) {
    allCandidates = findHeadingsInContinuousText(cleaned);
  }
  if (allCandidates.length === 0) return [];

  const tocBlock = findTocBlockBounds(cleaned);
  const matches: RejectedHeadingQueryMatch[] = [];
  const seen = new Set<string>();

  for (const candidate of allCandidates) {
    const reasons: string[] = [];
    if (isTocTitle(candidate.title)) reasons.push("line-level TOC markers");
    if (tocBlock && isInsideTocBlock(candidate.start, tocBlock)) reasons.push("inside TOC block");
    if (!hasBodyTextAfter(cleaned, candidate.end, candidate.num)) reasons.push("no body text after heading");
    if (reasons.length === 0) { continue; }

    const title = stripTocSuffix(candidate.title);
    const normalizedTitle = normalizeHeadingTitle(title);
    const score = scoreHeadingAgainstQuery(
      {
        sectionNumber: candidate.num,
        title,
        originalTitle: title,
        normalizedTitle,
        bodyPreview: "",
        bodyText: "",
        originalBodyText: "",
        normalizedBodyText: "",
      },
      query,
      fallbackKeywords,
    );
    if (!score.strong) continue;

    const key = `${candidate.num}::${normalizedTitle}`;
    if (seen.has(key)) continue;
    seen.add(key);

    matches.push({
      sectionNumber: candidate.num,
      title,
      normalizedTitle,
      reasons,
      score: score.score,
      exactTitleMatch: score.exactTitleMatch,
      fullPhraseMatch: score.fullPhraseMatch,
      fallbackKeywordMatches: score.fallbackKeywordMatches,
    });
  }

  return matches.sort(
    (a, b) => b.score - a.score || a.sectionNumber.localeCompare(b.sectionNumber, undefined, { numeric: true }),
  );
}
