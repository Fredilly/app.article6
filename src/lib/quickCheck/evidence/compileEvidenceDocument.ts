import { normalizeSectionKey } from "@/lib/chat/quickCheckSectionExtractor";
import type {
  CompileEvidenceDocumentInput,
  EvidenceBlockType,
  EvidenceDocument,
  EvidenceSpan,
} from "@/lib/quickCheck/evidence/evidenceTypes";

type PageSlice = {
  index: number;
  page: number;
  text: string;
  charStart: number;
};

type CandidateBlock = {
  page: number;
  blockType: EvidenceBlockType;
  text: string;
  charStart: number;
  charEnd: number;
  sectionId?: string;
  heading?: string;
  confidence: number;
};

const SECTION_HEADING_RE = /^\s*(?:section\s+)?((?:[A-Z]\.)?\d+(?:\.\d+)*)\s*[.:)]?\s+(.+?)\s*$/i;
const ANNEX_HEADING_RE = /^\s*(annex|appendix)\s+([A-Z0-9]+)\s*[.:)]?\s*(.*)$/i;
const FOOTER_RE =
  /^(?:page\s+\d+(?:\s+of\s+\d+)?|\d+\s+of\s+\d+|v\d+(?:\.\d+)+(?:\s+.*)?|project description document)$/i;
const FIELD_RE = /^[A-Z][A-Za-z0-9/ (),-]{1,80}:\s+\S/;
const FORMULA_RE = /(?:^|[\s(])(?:[A-Za-z][A-Za-z0-9_]*\s*=\s*.+|\d+(?:\.\d+)?\s*[+\-/*]\s*\d+)/;

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function normalizeUnicode(value: string): string {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2012\u2013\u2014\u2212]/g, "-");
}

export function normalizeEvidenceText(value: string): string {
  return normalizeUnicode(value)
    .replace(/\f/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function splitPages(rawText: string): PageSlice[] {
  const normalized = normalizeNewlines(rawText);
  const parts = normalized.split("\f");
  const pages: PageSlice[] = [];
  let cursor = 0;
  for (let index = 0; index < parts.length; index += 1) {
    const text = parts[index] ?? "";
    pages.push({
      index,
      page: parts.length > 1 ? index + 1 : 1,
      text,
      charStart: cursor,
    });
    cursor += text.length;
    if (index < parts.length - 1) cursor += 1;
  }
  return pages;
}

function isLikelyTocLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^(table of contents|contents)$/i.test(trimmed)) return true;
  if (/\.{3,}\s*\d+\s*$/.test(trimmed)) return true;
  return /^(?:section\s+)?(?:[A-Z]\.)?\d+(?:\.\d+)*\s+.+\s+\d+\s*$/.test(trimmed);
}

function detectBlockType(line: string, page: number, isFirstContentLine: boolean): EvidenceBlockType {
  const trimmed = line.trim();
  if (FOOTER_RE.test(trimmed)) return "footer";
  if (isLikelyTocLine(trimmed)) return "toc";
  if (ANNEX_HEADING_RE.test(trimmed)) return "annex";
  if (SECTION_HEADING_RE.test(trimmed)) return isFirstContentLine ? "title" : "section_heading";
  if (isFirstContentLine && trimmed.length <= 180) return "title";
  if (FIELD_RE.test(trimmed)) return "field";
  if (FORMULA_RE.test(trimmed)) return "formula";
  if (/\|/.test(trimmed) || /\S(?:\s{2,}|\t)\S/.test(trimmed)) return "table";
  return "paragraph";
}

function blockConfidence(blockType: EvidenceBlockType, text: string): number {
  if (!text.trim()) return 0.2;
  switch (blockType) {
    case "title":
    case "section_heading":
    case "annex":
      return 0.95;
    case "field":
      return 0.92;
    case "table":
      return 0.82;
    case "formula":
      return 0.78;
    case "toc":
    case "footer":
      return 0.72;
    case "paragraph":
    default:
      return 0.88;
  }
}

function flushParagraphBuffer(
  blocks: CandidateBlock[],
  buffer: { lines: string[]; start: number; end: number; page: number; sectionId?: string; heading?: string } | null,
): null {
  if (!buffer || buffer.lines.length === 0) return null;
  const text = buffer.lines.join(" ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  blocks.push({
    page: buffer.page,
    blockType: "paragraph",
    text,
    charStart: buffer.start,
    charEnd: buffer.end,
    sectionId: buffer.sectionId,
    heading: buffer.heading,
    confidence: blockConfidence("paragraph", text),
  });
  return null;
}

function extractSectionContext(text: string): { sectionId?: string; heading?: string } {
  const annexMatch = text.match(ANNEX_HEADING_RE);
  if (annexMatch) {
    const annexId = `${annexMatch[1]} ${annexMatch[2]}`.trim();
    const heading = annexMatch[3]?.trim() || annexId;
    return {
      sectionId: annexId.toLowerCase().replace(/\s+/g, "-"),
      heading,
    };
  }

  const headingMatch = text.match(SECTION_HEADING_RE);
  if (!headingMatch) return {};
  return {
    sectionId: normalizeSectionKey(headingMatch[1] ?? ""),
    heading: headingMatch[2]?.trim() ?? "",
  };
}

function buildCandidateBlocks(input: CompileEvidenceDocumentInput): CandidateBlock[] {
  const pages = splitPages(input.rawText);
  const blocks: CandidateBlock[] = [];
  let currentSectionId: string | undefined;
  let currentHeading: string | undefined;
  let hasSeenPrimaryContent = false;

  for (const page of pages) {
    const lines = page.text.split("\n");
    let pageOffset = page.charStart;
    let paragraphBuffer: {
      lines: string[];
      start: number;
      end: number;
      page: number;
      sectionId?: string;
      heading?: string;
    } | null = null;

    for (const line of lines) {
      const lineStart = pageOffset;
      const lineEnd = lineStart + line.length;
      pageOffset = lineEnd + 1;

      const trimmed = line.trim();
      if (!trimmed) {
        paragraphBuffer = flushParagraphBuffer(blocks, paragraphBuffer);
        continue;
      }

      const blockType = detectBlockType(trimmed, page.page, !hasSeenPrimaryContent);
      const isStandalone = blockType !== "paragraph";

      if (isStandalone) {
        paragraphBuffer = flushParagraphBuffer(blocks, paragraphBuffer);
      }

      if (blockType === "paragraph") {
        if (
          !paragraphBuffer ||
          paragraphBuffer.page !== page.page ||
          paragraphBuffer.sectionId !== currentSectionId ||
          paragraphBuffer.heading !== currentHeading
        ) {
          paragraphBuffer = {
            lines: [trimmed],
            start: lineStart,
            end: lineEnd,
            page: page.page,
            sectionId: currentSectionId,
            heading: currentHeading,
          };
        } else {
          paragraphBuffer.lines.push(trimmed);
          paragraphBuffer.end = lineEnd;
        }
        hasSeenPrimaryContent = true;
        continue;
      }

      const sectionContext = extractSectionContext(trimmed);
      if (sectionContext.sectionId) currentSectionId = sectionContext.sectionId;
      if (sectionContext.heading) currentHeading = sectionContext.heading;

      blocks.push({
        page: page.page,
        blockType,
        text: trimmed,
        charStart: lineStart,
        charEnd: lineEnd,
        sectionId: sectionContext.sectionId ?? currentSectionId,
        heading: sectionContext.heading ?? currentHeading,
        confidence: blockConfidence(blockType, trimmed),
      });

      if (blockType !== "footer" && blockType !== "toc") {
        hasSeenPrimaryContent = true;
      }
    }

    flushParagraphBuffer(blocks, paragraphBuffer);
  }

  return blocks;
}

function buildSpanId(docId: string, page: number | null, charStart: number, blockType: EvidenceBlockType): string {
  const safeDocId = docId.replace(/[^a-zA-Z0-9_-]+/g, "-");
  return [safeDocId, `p${page ?? 0}`, blockType, `${charStart}`].join(":");
}

export function compileEvidenceDocument(input: CompileEvidenceDocumentInput): EvidenceDocument {
  const rawText = normalizeNewlines(input.rawText ?? "");
  const spans: EvidenceSpan[] = buildCandidateBlocks({ ...input, rawText }).map((block) => ({
    spanId: buildSpanId(input.docId, block.page, block.charStart, block.blockType),
    docId: input.docId,
    page: block.page,
    sectionId: block.sectionId,
    heading: block.heading,
    blockType: block.blockType,
    text: block.text,
    normalizedText: normalizeEvidenceText(block.text),
    charStart: block.charStart,
    charEnd: block.charEnd,
    confidence: block.confidence,
  }));

  return {
    docId: input.docId,
    rawText,
    spans,
  };
}
