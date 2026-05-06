import type {
  ExtractedManualFindingDraft,
  ManualFindingClosureStatus,
} from '@/lib/projects/types';

export type ManualFindingExtractionPage = {
  pageNumber: number;
  text: string;
};

export type ManualFindingExtractionResult = {
  drafts: Array<Omit<ExtractedManualFindingDraft, 'id' | 'createdAt' | 'updatedAt' | 'sourceDocumentId'>>;
  message: string;
  extractedText: string;
};

type FindingBoundary = {
  findingId: string;
  findingType?: 'CAR' | 'CL' | 'FAR';
  start: number;
  end: number;
  sourcePageRange?: string;
};

const APPENDIX_SECTION_PATTERN = /(?:^|\n)\s*APPENDIX\s+\d+\s*:/gi;

const FIELD_PATTERNS = [
  { key: 'requirement', label: /(?:^|\n)[^\n]*\brequirement\b\s*[:\-]?\s*/i },
  { key: 'description', label: /(?:^|\n)\s*(?:description(?:\s+of\s+the\s+(?:car|cl|far))?|finding description|nc description)\s*[:\-]?\s*/i },
  { key: 'projectResponse', label: /(?:^|\n)\s*(?:project response|client response|response from (?:the )?(?:project developer|project proponent))(?:\s+date\s*:\s*[^\n]+)?\s*/i },
  { key: 'documentationSubmitted', label: /(?:^|\n)\s*(?:documentation submitted(?: by (?:the )?project developer)?|documents submitted|supporting documents)\s*[:\-]?\s*/i },
  { key: 'auditTeamEvaluation', label: /(?:^|\n)\s*(?:audit team evaluation(?:\s+date\s*:\s*[^\n]+)?|evaluation of the audit team(?:\s+date\s*:\s*[^\n]+)?|validation team assessment|verification team assessment|vvb assessment|team evaluation)\s*[:\-]?\s*/i },
  { key: 'closureStatus', label: /(?:^|\n)\s*(?:closure status|status|car\s+closed|car\s+open|cl\s+closed|cl\s+open|far\s+closed|far\s+open)\s*[:\-]?\s*/i },
] as const;

function normalizeInline(value: string): string {
  return value.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function normalizePageText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripReportBoilerplate(value: string): string {
  return value
    .replace(/(?:^|\n)CCB & VCS VERIFICATION REPORT:[^\n]*(?:\n[^\n]*){0,2}/gi, '\n')
    .replace(/(?:^|\n)[A-Za-z][A-Za-z0-9_ .()/-]{1,60}\s+Date\s*:\s*[^\n]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildCombinedText(pages: ManualFindingExtractionPage[]): {
  combined: string;
  pageMarkers: Array<{ index: number; pageNumber: number }>;
} {
  const pageMarkers: Array<{ index: number; pageNumber: number }> = [];
  let combined = '';

  for (const page of pages) {
    const normalizedPage = normalizePageText(page.text);
    if (!normalizedPage) continue;
    pageMarkers.push({ index: combined.length, pageNumber: page.pageNumber });
    combined += `\n[[PAGE:${page.pageNumber}]]\n${normalizedPage}\n`;
  }

  return { combined, pageMarkers };
}

function inferPageRange(markers: Array<{ index: number; pageNumber: number }>, start: number, end: number): string | undefined {
  const matchedPages = markers
    .filter((marker, index) => {
      const nextIndex = markers[index + 1]?.index ?? Number.POSITIVE_INFINITY;
      return marker.index <= end && nextIndex > start;
    })
    .map((marker) => marker.pageNumber);

  if (matchedPages.length === 0) return undefined;
  const first = matchedPages[0];
  const last = matchedPages[matchedPages.length - 1];
  return first === last ? String(first) : `${first}-${last}`;
}

function normalizeFindingId(value: string): string {
  const normalized = value
    .replace(/\bFinding\s+/i, 'F-')
    .replace(/\bNO\.?\s*/gi, '')
    .replace(/\s+/g, '')
    .toUpperCase();

  if (/^(CAR|CL|FAR)\d/.test(normalized)) return normalized;
  if (/^F\d/.test(normalized)) return normalized.replace(/^F/, 'F-');
  return normalized;
}

function inferFindingType(input: { rawId: string; surroundingText: string }): FindingBoundary['findingType'] {
  const rawId = input.rawId.trim().toUpperCase();
  if (rawId.startsWith('CAR')) return 'CAR';
  if (rawId.startsWith('CL')) return 'CL';
  if (rawId.startsWith('FAR')) return 'FAR';

  const near = input.surroundingText.slice(0, 420);
  if (/\bcorrective action request\b|\btype\s*[:\-]?\s*car\b/i.test(near)) return 'CAR';
  if (/\bclarification request\b|\btype\s*[:\-]?\s*cl\b/i.test(near)) return 'CL';
  if (/\bforward action request\b|\btype\s*[:\-]?\s*far\b/i.test(near)) return 'FAR';

  return undefined;
}

function detectFindingBoundaries(combined: string, markers: Array<{ index: number; pageNumber: number }>): FindingBoundary[] {
  const pattern = /(?:^|\n)\s*((?:(CAR|CL|FAR)(?:\s*NO\.?)?[- ]?\d{1,3}(?:\.\d+)?)|(?:F[- ]?\d{3,})|(?:F\d{3,})|(?:Finding\s+\d{1,3})|(?:NCR[- ]?\d{1,3})|(?:NC[- ]?\d{1,3}))\b/gi;
  const matches = Array.from(combined.matchAll(pattern)).filter((match, index, allMatches) => {
    if (index === 0) return true;

    const rawId = (match[1] ?? '').trim();
    const previousRawId = (allMatches[index - 1]?.[1] ?? '').trim();
    const currentStart = match.index ?? 0;
    const previousStart = allMatches[index - 1]?.index ?? 0;
    const between = combined.slice(previousStart, currentStart);

    const currentIsCompactLabel = /^(CAR|CL|FAR)\d{1,3}$/i.test(rawId);
    const previousIsExplicitNoLabel = /^(CAR|CL|FAR)\s*NO\.?\s*\d{1,3}$/i.test(previousRawId);
    const lacksBodyMarkers = !/(?:description of the|response from the project developer|documentation submitted by the project developer)/i.test(between);

    if (currentIsCompactLabel && previousIsExplicitNoLabel && currentStart - previousStart < 260 && lacksBodyMarkers) {
      return false;
    }

    return true;
  });

  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const nextFindingStart = index < matches.length - 1 ? (matches[index + 1].index ?? combined.length) : combined.length;
    const appendixBoundary = (() => {
      APPENDIX_SECTION_PATTERN.lastIndex = start;
      const appendixMatch = APPENDIX_SECTION_PATTERN.exec(combined);
      return appendixMatch?.index;
    })();
    const end = appendixBoundary != null ? Math.min(nextFindingStart, appendixBoundary) : nextFindingStart;
    const rawId = (match[1] ?? '').trim();
    const surroundingText = combined.slice(Math.max(0, start - 160), Math.min(end, start + 500));
    return {
      findingId: normalizeFindingId(rawId),
      findingType: inferFindingType({ rawId, surroundingText }),
      start,
      end,
      sourcePageRange: inferPageRange(markers, start, end),
    };
  });
}

function extractFieldValue(block: string, key: typeof FIELD_PATTERNS[number]['key']): string | undefined {
  const fieldIndex = FIELD_PATTERNS.findIndex((field) => field.key === key);
  if (fieldIndex === -1) return undefined;

  const startMatch = FIELD_PATTERNS[fieldIndex].label.exec(block);
  if (!startMatch || typeof startMatch.index !== 'number') return undefined;
  const start = startMatch.index + startMatch[0].length;

  let end = block.length;
  for (let index = 0; index < FIELD_PATTERNS.length; index += 1) {
    if (index === fieldIndex) continue;
    const candidate = FIELD_PATTERNS[index].label.exec(block.slice(start));
    if (candidate && typeof candidate.index === 'number') {
      end = Math.min(end, start + candidate.index);
    }
  }

  const value = normalizeInline(block.slice(start, end).replace(/\[\[PAGE:\d+\]\]/g, ''));
  const cleaned = stripReportBoilerplate(value);
  return cleaned || undefined;
}

function detectClosureStatus(block: string): ManualFindingClosureStatus | undefined {
  const explicitStatusLine = block.match(/(?:^|\n)\s*(?:CAR|CL|FAR)\s+(Closed|Open)\b/i)?.[1];
  if (explicitStatusLine) return explicitStatusLine.toLowerCase() === 'closed' ? 'closed' : 'open';

  const explicit = extractFieldValue(block, 'closureStatus') ?? '';
  const haystack = explicit || block;
  if (/\bclosed?\b/i.test(haystack)) return 'closed';
  if (/\bopen\b/i.test(haystack)) return 'open';
  if (/\bin review\b|\bpending\b|\bongoing\b/i.test(haystack)) return 'in-review';
  return undefined;
}

function buildExtractionMessage(boundary: FindingBoundary, block: string): string {
  if (!boundary.findingType) return 'needs review';
  const hasDescription = Boolean(extractFieldValue(block, 'description'));
  const hasResponse = Boolean(extractFieldValue(block, 'projectResponse'));
  if (!hasDescription || !hasResponse) return 'needs review';
  return 'draft';
}

export function extractManualFindingDraftsFromPages(input: {
  pages: ManualFindingExtractionPage[];
  sourceDocumentName: string;
}): ManualFindingExtractionResult {
  const normalizedPages = input.pages
    .map((page) => ({ pageNumber: page.pageNumber, text: normalizePageText(page.text) }))
    .filter((page) => page.text);
  const extractedText = normalizedPages.map((page) => page.text).join('\n\n').trim();

  if (normalizedPages.length === 0) {
    return {
      drafts: [],
      message: 'No structured CAR/CL/FAR findings detected. You can still add findings manually.',
      extractedText: '',
    };
  }

  const { combined, pageMarkers } = buildCombinedText(normalizedPages);
  const boundaries = detectFindingBoundaries(combined, pageMarkers);

  const drafts = boundaries.map((boundary) => {
    const block = combined.slice(boundary.start, boundary.end).replace(/\n?\[\[PAGE:\d+\]\]\n?/g, '\n').trim();
    const extractionMessage = buildExtractionMessage(boundary, block);
    return {
      findingId: boundary.findingId,
      findingType: boundary.findingType,
      requirement: extractFieldValue(block, 'requirement'),
      description: extractFieldValue(block, 'description'),
      sourcePageRange: boundary.sourcePageRange,
      evidenceExcerpt: normalizeInline(block),
      projectResponse: extractFieldValue(block, 'projectResponse'),
      documentationSubmitted: extractFieldValue(block, 'documentationSubmitted'),
      auditTeamEvaluation: extractFieldValue(block, 'auditTeamEvaluation'),
      closureStatus: detectClosureStatus(block),
      reviewerNote: undefined,
      extractionStatus: extractionMessage === 'draft' ? 'draft' : 'needs-review',
      extractionMessage,
    } satisfies Omit<ExtractedManualFindingDraft, 'id' | 'createdAt' | 'updatedAt' | 'sourceDocumentId'>;
  }).filter((draft) => draft.findingType || draft.findingId || draft.evidenceExcerpt);

  if (drafts.length === 0) {
    return {
      drafts: [],
      message: 'No structured CAR/CL/FAR findings detected. You can still add findings manually.',
      extractedText,
    };
  }

  const confidentCount = drafts.filter((draft) => draft.findingType).length;
  return {
    drafts,
    message: confidentCount > 0
      ? `${drafts.length} draft finding sections detected. Review before accepting.`
      : `${drafts.length} finding-like sections detected. Review before accepting.`,
    extractedText,
  };
}
