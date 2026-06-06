import { normalizeSectionKey } from "@/lib/chat/quickCheckSectionExtractor";
import type { DocumentStructure } from "@/lib/documentModel";
import type {
  CompileEvidenceDocumentInput,
  EvidenceBlockType,
  EvidenceDocument,
  EvidenceSpan,
  EvidenceSpanReliability,
  EvidenceTableCellMetadata,
  EvidenceTableMetadata,
} from "@/lib/quickCheck/evidence/evidenceTypes";

type PageSlice = {
  index: number;
  page: number;
  text: string;
  charStart: number;
};

type CandidateBlock = {
  page: number | null;
  blockType: EvidenceBlockType;
  text: string;
  charStart: number | null;
  charEnd: number | null;
  sectionId?: string;
  heading?: string;
  headingPath: string[];
  sectionPath: string[];
  sourceBlockId?: string;
  parserSource?: string;
  confidence: number;
  reliability: EvidenceSpanReliability;
  table?: EvidenceTableMetadata;
  layout?: EvidenceSpan["layout"];
};

const SECTION_HEADING_RE = /^\s*(?:section\s+)?((?:[A-Z]\.)?\d+(?:\.\d+)*)\s*[.:)]?\s+(.+?)\s*$/i;
const ANNEX_HEADING_RE = /^\s*(annex|appendix)\s+([A-Z0-9]+)\s*[.:)]?\s*(.*)$/i;
const FOOTER_RE =
  /^(?:page\s+\d+(?:\s+of\s+\d+)?|\d+\s+of\s+\d+|v\d+(?:\.\d+)+(?:\s+.*)?|project description document)$/i;
const FIELD_RE = /^[A-Z][A-Za-z0-9/ (),+-]{1,80}:\s+\S/;
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

function detectBlockType(line: string, isFirstContentLine: boolean): EvidenceBlockType {
  const trimmed = line.trim();
  if (FOOTER_RE.test(trimmed)) return "footer";
  if (isLikelyTocLine(trimmed)) return "toc";
  if (ANNEX_HEADING_RE.test(trimmed)) return "annex";
  if (SECTION_HEADING_RE.test(trimmed)) return "section_heading";
  if (FIELD_RE.test(trimmed)) return "field";
  if (FORMULA_RE.test(trimmed)) return "formula";
  if (/\|/.test(trimmed) || /\S(?:\s{2,}|\t)\S/.test(trimmed)) return "table";
  if (isFirstContentLine && trimmed.length <= 180) return "title";
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
      return 0.78;
    case "formula":
      return 0.78;
    case "header":
    case "footer":
    case "toc":
      return 0.35;
    case "paragraph":
    default:
      return 0.88;
  }
}

function blockReliability(blockType: EvidenceBlockType, options?: { limited?: boolean }): EvidenceSpanReliability {
  if (blockType === "header" || blockType === "footer" || blockType === "toc") {
    return "excluded";
  }
  if (options?.limited || blockType === "table") {
    return "limited";
  }
  return "primary";
}

function sectionIdFromSectionNumber(sectionNumber?: string): string | undefined {
  if (!sectionNumber) return undefined;
  return `section:${normalizeSectionKey(sectionNumber)}`;
}

function sectionPathFromSectionNumber(sectionNumber?: string): string[] {
  if (!sectionNumber) return [];
  const normalized = normalizeSectionKey(sectionNumber);
  if (!normalized.includes(".")) return [sectionIdFromSectionNumber(normalized) ?? normalized];
  const parts = normalized.split(".");
  return parts
    .map((_, index) => sectionIdFromSectionNumber(parts.slice(0, index + 1).join(".")))
    .filter((sectionId): sectionId is string => Boolean(sectionId));
}

function extractSectionContext(text: string): {
  sectionId?: string;
  heading?: string;
  sectionPath: string[];
} {
  const annexMatch = text.match(ANNEX_HEADING_RE);
  if (annexMatch) {
    const annexId = `${annexMatch[1]} ${annexMatch[2]}`.trim();
    const heading = annexMatch[3]?.trim() || annexId;
    return {
      sectionId: annexId.toLowerCase().replace(/\s+/g, "-"),
      heading,
      sectionPath: [annexId.toLowerCase().replace(/\s+/g, "-")],
    };
  }

  const headingMatch = text.match(SECTION_HEADING_RE);
  if (!headingMatch) return { sectionPath: [] };
  const sectionId = sectionIdFromSectionNumber(headingMatch[1]);
  return {
    sectionId,
    heading: headingMatch[2]?.trim() ?? "",
    sectionPath: sectionPathFromSectionNumber(headingMatch[1]),
  };
}

function collectRepeatedPageEdgeLines(pages: PageSlice[]): { headers: Set<string>; footers: Set<string> } {
  const headerCounts = new Map<string, number>();
  const footerCounts = new Map<string, number>();

  for (const page of pages) {
    const lines = page.text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const first = lines[0];
    const last = lines[lines.length - 1];
    if (first) headerCounts.set(first, (headerCounts.get(first) ?? 0) + 1);
    if (last) footerCounts.set(last, (footerCounts.get(last) ?? 0) + 1);
  }

  return {
    headers: new Set(Array.from(headerCounts.entries()).filter(([, count]) => count >= 2).map(([text]) => text)),
    footers: new Set(Array.from(footerCounts.entries()).filter(([, count]) => count >= 2).map(([text]) => text)),
  };
}

function flushParagraphBuffer(
  blocks: CandidateBlock[],
  buffer: {
    lines: string[];
    start: number;
    end: number;
    page: number;
    sectionId?: string;
    heading?: string;
    headingPath: string[];
    sectionPath: string[];
  } | null,
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
    headingPath: buffer.headingPath,
    sectionPath: buffer.sectionPath,
    confidence: blockConfidence("paragraph", text),
    reliability: "primary",
  });
  return null;
}

function buildCandidateBlocks(input: CompileEvidenceDocumentInput): CandidateBlock[] {
  const pages = splitPages(input.rawText);
  const pageEdgeLines = collectRepeatedPageEdgeLines(pages);
  const blocks: CandidateBlock[] = [];
  let currentSectionId: string | undefined;
  let currentHeading: string | undefined;
  let currentSectionPath: string[] = [];
  let currentHeadingPath: string[] = [];
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
      headingPath: string[];
      sectionPath: string[];
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

      let blockType = detectBlockType(trimmed, !hasSeenPrimaryContent);
      if (pageEdgeLines.headers.has(trimmed) && blockType !== "title") {
        blockType = "header";
      }
      if (pageEdgeLines.footers.has(trimmed) || FOOTER_RE.test(trimmed)) {
        blockType = "footer";
      }

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
            headingPath: [...currentHeadingPath],
            sectionPath: [...currentSectionPath],
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
      if (sectionContext.sectionPath.length > 0) currentSectionPath = sectionContext.sectionPath;
      if (sectionContext.heading) {
        currentHeadingPath = blockType === "section_heading" || blockType === "annex"
          ? [...currentHeadingPath.slice(0, Math.max(currentSectionPath.length - 1, 0)), sectionContext.heading]
          : currentHeadingPath;
      }

      const reliability = blockReliability(blockType, { limited: blockType === "table" });
      blocks.push({
        page: page.page,
        blockType,
        text: trimmed,
        charStart: lineStart,
        charEnd: lineEnd,
        sectionId: sectionContext.sectionId ?? currentSectionId,
        heading: sectionContext.heading ?? currentHeading,
        sectionPath: sectionContext.sectionPath.length > 0 ? sectionContext.sectionPath : [...currentSectionPath],
        headingPath: sectionContext.heading
          ? [...currentHeadingPath]
          : [...currentHeadingPath],
        confidence: blockConfidence(blockType, trimmed),
        reliability,
        table: blockType === "table" ? { limitedProvenance: true } : undefined,
        layout: reliability === "excluded"
          ? { repeatedHeaderFooter: blockType === "header" || blockType === "footer", limitedProvenance: true }
          : undefined,
      });

      if (blockType !== "footer" && blockType !== "toc" && blockType !== "header") {
        hasSeenPrimaryContent = true;
      }
    }

    flushParagraphBuffer(blocks, paragraphBuffer);
  }

  return blocks;
}

function sanitizeDocId(docId: string): string {
  return docId.replace(/[^a-zA-Z0-9_-]+/g, "-");
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function buildSpanId(input: {
  docId: string;
  sourceBlockId?: string;
  page: number | null;
  blockType: EvidenceBlockType;
  charStart: number | null;
  text: string;
}): string {
  const safeDocId = sanitizeDocId(input.docId);
  if (input.sourceBlockId) return `${safeDocId}:${input.sourceBlockId}`;
  return [
    safeDocId,
    `p${input.page ?? 0}`,
    input.blockType,
    `${input.charStart ?? -1}`,
    stableHash(normalizeEvidenceText(input.text)),
  ].join(":");
}

function buildEvidenceSpan(input: {
  docId: string;
  parserSource?: string;
  parserAdapterId?: EvidenceDocument["parserAdapterId"];
  documentFamily?: EvidenceDocument["documentFamily"];
  block: CandidateBlock;
}): EvidenceSpan {
  return {
    spanId: buildSpanId({
      docId: input.docId,
      sourceBlockId: input.block.sourceBlockId,
      page: input.block.page,
      blockType: input.block.blockType,
      charStart: input.block.charStart,
      text: input.block.text,
    }),
    docId: input.docId,
    page: input.block.page,
    sectionId: input.block.sectionId,
    heading: input.block.heading,
    headingPath: input.block.headingPath,
    sectionPath: input.block.sectionPath,
    blockType: input.block.blockType,
    text: input.block.text,
    normalizedText: normalizeEvidenceText(input.block.text),
    charStart: input.block.charStart,
    charEnd: input.block.charEnd,
    sourceBlockId: input.block.sourceBlockId,
    parserSource: input.block.parserSource ?? input.parserSource,
    parserAdapterId: input.parserAdapterId,
    documentFamily: input.documentFamily,
    layout: input.block.layout,
    table: input.block.table,
    reliability: input.block.reliability,
    confidence: input.block.confidence,
  };
}

function buildEvidenceTableCells(input: {
  table: NonNullable<DocumentStructure["blocks"][number]["table"]>;
  blockId: string;
  parserSource?: string;
}): EvidenceTableCellMetadata[] {
  return input.table.cells.map((cell) => ({
    rowIndex: cell.rowIndex,
    columnIndex: cell.columnIndex,
    text: cell.text,
    normalizedText: normalizeEvidenceText(cell.text),
    pageNumber: input.table.pageNumber,
    boundingBox: cell.boundingBox,
    sourceTableId: input.table.id,
    sourceBlockId: input.blockId,
    parserSource: input.parserSource,
  }));
}

function inferStructureBlockType(
  block: DocumentStructure["blocks"][number],
  index: number,
): EvidenceBlockType | null {
  if (!block.rawText.trim()) return null;

  switch (block.type) {
    case "heading":
      return index === 0 && !block.sectionId ? "title" : "section_heading";
    case "paragraph":
      if (FIELD_RE.test(block.rawText.trim())) return "field";
      if (FORMULA_RE.test(block.rawText.trim())) return "formula";
      if (/\|/.test(block.rawText) || /\S(?:\s{2,}|\t)\S/.test(block.rawText)) return "table";
      return "paragraph";
    case "table":
      return "table";
    case "list_item":
      return "paragraph";
    case "header":
      return "header";
    case "footer":
      return "footer";
    case "unknown":
    default:
      return null;
  }
}

function findCharStart(rawText: string, blockText: string, fallbackCursor: number): number | null {
  const trimmed = blockText.trim();
  if (!trimmed) return null;
  const exactIndex = rawText.indexOf(blockText, fallbackCursor);
  if (exactIndex >= 0) return exactIndex;
  const trimmedIndex = rawText.indexOf(trimmed, fallbackCursor);
  if (trimmedIndex >= 0) return trimmedIndex;
  return null;
}

function buildSectionHeadingLookup(documentStructure: DocumentStructure): Map<string, string[]> {
  const sectionsById = new Map(documentStructure.sections.map((section) => [section.id, section]));
  const headingPathBySectionId = new Map<string, string[]>();

  const buildPath = (sectionId?: string): string[] => {
    if (!sectionId) return [];
    const existing = headingPathBySectionId.get(sectionId);
    if (existing) return existing;
    const section = sectionsById.get(sectionId);
    if (!section) return [];
    const parentPath = buildPath(section.parentId);
    const path = [...parentPath, section.titleRaw].filter(Boolean);
    headingPathBySectionId.set(sectionId, path);
    return path;
  };

  for (const section of documentStructure.sections) {
    buildPath(section.id);
  }

  return headingPathBySectionId;
}

function buildStructureSectionPath(
  block: DocumentStructure["blocks"][number],
  documentStructure: DocumentStructure,
): string[] {
  if (block.sectionPath?.length) return block.sectionPath;
  if (!block.sectionId) return [];
  const sectionsById = new Map(documentStructure.sections.map((section) => [section.id, section]));
  const path: string[] = [];
  let currentId: string | undefined = block.sectionId;
  while (currentId) {
    path.unshift(currentId);
    currentId = sectionsById.get(currentId)?.parentId;
  }
  return path;
}

export function compileEvidenceDocument(input: CompileEvidenceDocumentInput): EvidenceDocument {
  const rawText = normalizeNewlines(input.rawText ?? "");
  const spans = buildCandidateBlocks({ ...input, rawText }).map((block) => buildEvidenceSpan({
    docId: input.docId,
    parserSource: "raw-text",
    block,
  }));

  return {
    docId: input.docId,
    rawText,
    parserSource: "raw-text",
    spans,
  };
}

export function compileEvidenceDocumentFromStructure(input: {
  docId: string;
  documentStructure: DocumentStructure;
}): EvidenceDocument {
  const rawText = normalizeNewlines(input.documentStructure.rawText ?? "");
  const headingPathBySectionId = buildSectionHeadingLookup(input.documentStructure);
  let cursor = 0;

  const spans: EvidenceSpan[] = input.documentStructure.blocks.flatMap((block, index) => {
    const blockType = inferStructureBlockType(block, index);
    if (!blockType) return [];

    const charStart = block.charStart ?? findCharStart(rawText, block.rawText, cursor);
    const charEnd = block.charEnd ?? (charStart == null ? null : charStart + block.rawText.length);
    if (charEnd != null) cursor = charEnd;

    const sectionPath = buildStructureSectionPath(block, input.documentStructure);
    const headingPath = block.sectionId
      ? (headingPathBySectionId.get(block.sectionId) ?? [])
      : blockType === "title" || blockType === "section_heading" || blockType === "annex"
        ? [block.cleanText]
        : [];
    const heading = headingPath[headingPath.length - 1] ?? (blockType === "section_heading" ? block.cleanText : undefined);
    const hasNativeTableMetadata = Boolean(block.table);
    const table = blockType === "table"
      ? {
          tableId: block.table?.id,
          caption: block.table?.caption,
          rowCount: block.table?.rowCount,
          columnCount: block.table?.columnCount,
          headerRowCount: block.table?.headerRowCount,
          cells: block.table ? buildEvidenceTableCells({
            table: block.table,
            blockId: block.id,
            parserSource: block.parserSource ?? input.documentStructure.source,
          }) : undefined,
          limitedProvenance: !hasNativeTableMetadata,
        }
      : undefined;
    const reliability = blockReliability(blockType, {
      limited:
        blockType === "table"
        || block.type === "list_item",
    });

    return [buildEvidenceSpan({
      docId: input.docId,
      parserSource: input.documentStructure.source,
      parserAdapterId: input.documentStructure.parserAdapterId,
      documentFamily: input.documentStructure.documentFamily.family,
      block: {
        page: block.pageNumber ?? null,
        blockType,
        text: block.rawText,
        charStart,
        charEnd,
        sectionId: block.sectionId,
        heading,
        headingPath,
        sectionPath,
        sourceBlockId: block.id,
        parserSource: block.parserSource,
        confidence: block.confidence,
        reliability,
        table,
        layout: {
          boundingBox: block.boundingBox,
          repeatedHeaderFooter: block.type === "header" || block.type === "footer",
          limitedProvenance: block.type === "list_item" || blockType === "table" || !block.boundingBox,
        },
      },
    })];
  });

  return {
    docId: input.docId,
    rawText,
    parserSource: input.documentStructure.source,
    parserAdapterId: input.documentStructure.parserAdapterId,
    documentFamily: input.documentStructure.documentFamily.family,
    spans,
  };
}
