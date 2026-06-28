import fs from "node:fs";
import path from "node:path";

/**
 * Quick Check v2 — canonical extracted document block.
 *
 * Every block in a canonical extracted document follows this shape.
 * No scoring, no ranking, no answers — just provenanced text.
 */

export type QuickCheckV2Block = {
  /** Stable, deterministic span identifier (hash-based) */
  spanId: string;
  /** Page number (1-indexed, from document markers, not inferred) */
  page: number;
  /** The extracted text content */
  text: string;
  /** Semantic block type */
  blockType:
    | "heading"
    | "body"
    | "table"
    | "footer"
    | "header"
    | "unknown";
  /** The nearest section heading text, or null if none */
  sectionHeading: string | null;
  /** Ordered path of section identifiers (e.g., ["2", "2.4", "2.4.2"]) */
  sectionPath: string[];
  /** Source classification: primary extraction or fallback */
  source: "primary" | "fallback";
};

/**
 * Quick Check v2 — canonical extracted document.
 *
 * This is the deterministic artifact produced by ingestion.
 * All downstream operations (evidence retrieval, answer extraction, status)
 * read from this document. Tests run against this JSON, not against Blob/upload state.
 */
export type QuickCheckV2ExtractedDocument = {
  /** Document identifier (e.g., "proj-desc-1382" for Envira Amazonia) */
  documentId: string;
  /** Parser identifier (e.g., "pyMuPDF-extracted-text") */
  parser: string;
  /** Ordered blocks in document order */
  blocks: QuickCheckV2Block[];
  /** Diagnostics captured during extraction */
  diagnostics: {
    /** Total page count if determinable */
    pageCount?: number;
    /** Non-fatal warnings collected during extraction */
    warnings: string[];
  };
};

// ---------------------------------------------------------------------------
// Stable span ID
// ---------------------------------------------------------------------------

/**
 * FNV-1a hash for stable, deterministic span IDs.
 * Same input always produces same output — no randomness.
 */
function fnv1a(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function buildSpanId(
  documentId: string,
  page: number,
  blockIndex: number,
  text: string,
): string {
  const normalized = text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const hash = fnv1a(`${documentId}:p${page}:b${blockIndex}:${normalized}`);
  return `${documentId}:p${page}:b${blockIndex}:${hash}`;
}

// ---------------------------------------------------------------------------
// Page marker detection — handles VCS v3.2 "v3.2 N" format specifically
// ---------------------------------------------------------------------------

/**
 * Regex that matches VCS v3.2 page markers like "v3.2 1", "v3.2 142".
 *
 * These appear as standalone lines in VCS PDDs. The v1 code treated them as
 * footer noise (FOOTER_RE matches /v\d+(\.\d+)+/) and discarded them,
 * which caused all blocks to default to page 1.
 *
 * v2 recognises them as page separators and uses them to assign real
 * page numbers.
 */
const VCS_PAGE_MARKER_RE = /^v\d+(?:\.\d+)+\s+(\d+)$/;

/**
 * Regex that matches common page marker formats with strong prefix context:
 *   "Page 1", "Page 1 of 142", "1 of 142"
 *
 * These must NOT match bare standalone numbers like "0", "1", "25" which
 * commonly appear in table cells. The regex requires "Page" prefix or "of N" suffix.
 */
const PAGE_MARKER_RE = /^(?:page\s+(\d+)(?:\s+of\s+\d+)?|(\d+)\s+of\s+\d+)$/i;

/**
 * Check if a line is a standalone page marker (not body text).
 *
 * Only accepts page markers that have strong contextual prefixes:
 * - VCS format:  v3.2 N
 * - Standard:    Page N, Page N of M
 * - CDM format:  N of M
 *
 * Bare numeric lines like "0", "1", "25" are NOT page markers.
 */
function isPageMarkerLine(
  line: string,
): { isMarker: true; pageNumber: number } | { isMarker: false } {
  const trimmed = line.trim();

  // VCS v3.2 format: "v3.2 1", "v3.2 142" — very specific prefix, low false-positive risk
  const vcsMatch = trimmed.match(VCS_PAGE_MARKER_RE);
  if (vcsMatch) {
    return { isMarker: true, pageNumber: parseInt(vcsMatch[1]!, 10) };
  }

  // Standard page markers with strong prefix context
  // Only accept if the line looks like a page marker, not a table cell
  const pageMatch = trimmed.match(PAGE_MARKER_RE);
  if (pageMatch) {
    const pageNum = parseInt(pageMatch[1] ?? pageMatch[2]!, 10);
    if (pageNum > 0) {
      return { isMarker: true, pageNumber: pageNum };
    }
  }

  return { isMarker: false };
}

// ---------------------------------------------------------------------------
// Section heading detection
// ---------------------------------------------------------------------------

/**
 * Matches section headings like:
 *   "1.0", "1.", "2.4.2", "A.1", "Section 3.3"
 *
 * Does not match lines that are exclusively digits or page numbers.
 */
const SECTION_HEADING_RE =
  /^\s*(?:section\s+)?([A-Z]\.\d+(?:\.\d+)*|\d+(?:\.\d+)+)\s+[.:]?\s*(.+?)\s*$/i;

/**
 * Matches top-level integer-only section headings like:
 *   "1 PROJECT DETAILS"
 *   "5 ENVIRONMENTAL IMPACT"
 *   "6 STAKEHOLDER COMMENTS"
 *
 * These are single-digit or multi-digit numbers followed by an ALL-CAPS title.
 * Must be at the start of a line and must have a non-numeric title after the number
 * (to distinguish from page numbers and table cells).
 */
const TOP_LEVEL_HEADING_RE =
  /^\s*(\d+)\s+([A-Z][A-Z\s\/&-]+)\s*$/;

/**
 * Matches annex/appendix headings like:
 *   "Annex 1", "Appendix A", "Annex II"
 */
const ANNEX_HEADING_RE =
  /^\s*(annex|appendix)\s+([A-Z0-9]+)\s*[.:]?\s*(.*)$/i;

/**
 * Check if a line is a section heading and extract its section number + title.
 */
function detectSectionHeading(
  line: string,
): { isHeading: true; sectionNumber: string; title: string } | { isHeading: false } {
  const trimmed = line.trim();

  const annexMatch = trimmed.match(ANNEX_HEADING_RE);
  if (annexMatch) {
    const sectionNumber = `${annexMatch[1]!.toLowerCase()}-${annexMatch[2]!.toLowerCase()}`;
    const title = annexMatch[3]?.trim() || `${annexMatch[1]} ${annexMatch[2]}`;
    return { isHeading: true, sectionNumber, title };
  }

  const headingMatch = trimmed.match(SECTION_HEADING_RE);
  if (headingMatch) {
    return {
      isHeading: true,
      sectionNumber: headingMatch[1]!,
      title: headingMatch[2]!.trim(),
    };
  }

  // Top-level integer headings: "5 ENVIRONMENTAL IMPACT"
  const topLevelMatch = trimmed.match(TOP_LEVEL_HEADING_RE);
  if (topLevelMatch) {
    return {
      isHeading: true,
      sectionNumber: topLevelMatch[1]!,
      title: topLevelMatch[2]!.trim(),
    };
  }

  return { isHeading: false };
}

/**
 * Build a section path array from a dotted section number.
 * E.g., "2.4.2" → ["2", "2.4", "2.4.2"]
 */
function buildSectionPath(sectionNumber: string): string[] {
  const parts = sectionNumber.split(".");
  return parts.map((_, index) => parts.slice(0, index + 1).join("."));
}

// ---------------------------------------------------------------------------
// Table detection
// ---------------------------------------------------------------------------

/**
 * Heuristic: a line is likely a table row if it contains pipe characters
 * or multiple consecutive spaces/tabs separating columns.
 */
function isTableLine(line: string): boolean {
  const trimmed = line.trim();
  if (/\|/.test(trimmed)) return true;
  // Multiple spaces or tabs suggest tabular data
  if (/\S(?:\s{3,}|\t)\S/.test(trimmed)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Block type detection
// ---------------------------------------------------------------------------

function detectBlockType(
  line: string,
  isFirstContentLine: boolean,
  isRepeatedHeader: boolean,
  isRepeatedFooter: boolean,
): QuickCheckV2Block["blockType"] {
  const trimmed = line.trim();
  if (!trimmed) return "unknown";

  // Check for repeated headers/footers first (from page-edge detection)
  if (isRepeatedHeader) return "header";
  if (isRepeatedFooter) return "footer";

  // Table detection (must precede heading detection)
  if (isTableLine(trimmed)) return "table";

  // Section headings
  const headingCheck = detectSectionHeading(trimmed);
  if (headingCheck.isHeading) return "heading";

  // First non-empty content line with short text → likely a title
  if (isFirstContentLine && trimmed.length <= 180) return "heading";

  return "body";
}

// ---------------------------------------------------------------------------
// Repeated header/footer detection across pages
// ---------------------------------------------------------------------------

type PageEdgeLines = {
  headers: Set<string>;
  footers: Set<string>;
};

function collectRepeatedPageEdges(pages: { lines: string[] }[]): PageEdgeLines {
  const headerCounts = new Map<string, number>();
  const footerCounts = new Map<string, number>();

  for (const page of pages) {
    const nonEmptyLines = page.lines
      .map((l) => l.trim())
      .filter(Boolean);
    const first = nonEmptyLines[0];
    const last = nonEmptyLines[nonEmptyLines.length - 1];

    if (first && !isPageMarkerLine(first).isMarker) {
      headerCounts.set(first, (headerCounts.get(first) ?? 0) + 1);
    }
    if (last && !isPageMarkerLine(last).isMarker) {
      footerCounts.set(last, (footerCounts.get(last) ?? 0) + 1);
    }
  }

  return {
    headers: new Set(
      Array.from(headerCounts.entries())
        .filter(([, count]) => count >= 2)
        .map(([text]) => text),
    ),
    footers: new Set(
      Array.from(footerCounts.entries())
        .filter(([, count]) => count >= 2)
        .map(([text]) => text),
    ),
  };
}

// ---------------------------------------------------------------------------
// Core ingestion function
// ---------------------------------------------------------------------------

export type ParseOptions = {
  /**
   * When true, lines that match VCS page markers ("v3.2 1", etc.) are
   * NOT included as blocks in the output. They are consumed to determine
   * page boundaries but do not appear as text blocks.
   *
   * Default: true
   */
  excludePageMarkers?: boolean;

  /**
   * When true, repeated header/footer lines (appearing on 2+ pages) are
   * marked as blockType "header" / "footer" rather than "body".
   *
   * Default: true
   */
  detectRepeatedHeaders?: boolean;
};

/**
 * Parse raw extracted text into a canonical QuickCheckV2ExtractedDocument.
 *
 * This is the primary ingestion entry point. It handles:
 * - VCS v3.2 page markers ("v3.2 N") for page number assignment
 * - Section heading detection
 * - Block type classification
 * - Repeated header/footer filtering
 * - Stable span ID generation
 *
 * @param rawText - The raw extracted text from a PDF parser (e.g., PyMuPDF)
 * @param documentId - A stable document identifier (e.g., "proj-desc-1382")
 * @param parser - The parser that produced the raw text
 * @param options - Parsing options
 */
export function parseExtractedText(
  rawText: string,
  documentId: string,
  parser: string,
  options?: ParseOptions,
): QuickCheckV2ExtractedDocument {
  const {
    excludePageMarkers = true,
    detectRepeatedHeaders = true,
  } = options ?? {};

  // -----------------------------------------------------------------------
  // Step 1: Split raw text into pages using marker lines
  // -----------------------------------------------------------------------

  const lines = rawText.split("\n");

  // Find all page marker positions
  interface PageSlice {
    pageNumber: number;
    startLine: number; // inclusive
    endLine: number; // exclusive
  }

  const pageMarkers: PageSlice[] = [];

  for (let i = 0; i < lines.length; i++) {
    const markerCheck = isPageMarkerLine(lines[i]!);
    if (markerCheck.isMarker) {
      pageMarkers.push({
        pageNumber: markerCheck.pageNumber,
        startLine: i + 1, // content starts after the marker
        endLine: lines.length, // default: until end
      });
    }
  }

  // Set endLine for each marker
  for (let i = 0; i < pageMarkers.length; i++) {
    const curr = pageMarkers[i]!;
    const next = pageMarkers[i + 1];
    curr.endLine = next ? next.startLine - 1 : lines.length;
  }

  // If no markers found, treat entire text as single page
  if (pageMarkers.length === 0) {
    pageMarkers.push({
      pageNumber: 1,
      startLine: 0,
      endLine: lines.length,
    });
  }

  // Build page slices
  const pageSlices = pageMarkers.map((marker) => ({
    pageNumber: marker.pageNumber,
    lines: lines.slice(marker.startLine, marker.endLine),
  }));

  // -----------------------------------------------------------------------
  // Step 2: Detect repeated headers/footers across pages
  // -----------------------------------------------------------------------

  let headerFooterEdges: PageEdgeLines = { headers: new Set(), footers: new Set() };

  if (detectRepeatedHeaders) {
    headerFooterEdges = collectRepeatedPageEdges(pageSlices);
  }

  // -----------------------------------------------------------------------
  // Step 3: Build blocks page by page
  // -----------------------------------------------------------------------

  const warnings: string[] = [];
  const blocks: QuickCheckV2Block[] = [];
  let globalBlockIndex = 0;

  // Track current section heading context (persists across pages)
  let currentSectionTitle: string | null = null;
  let currentSectionPath: string[] = [];
  let hasSeenPrimaryContent = false;

  for (const page of pageSlices) {
    const { pageNumber } = page;

    for (let lineIndex = 0; lineIndex < page.lines.length; lineIndex++) {
      const line = page.lines[lineIndex]!;
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Skip page marker lines if configured
      if (excludePageMarkers) {
        const markerCheck = isPageMarkerLine(trimmed);
        if (markerCheck.isMarker) continue;
      }

      // Detect if this is a repeated header or footer
      const isRepeatedHeader = headerFooterEdges.headers.has(trimmed);
      const isRepeatedFooter = headerFooterEdges.footers.has(trimmed);

      // Detect block type
      const blockType = detectBlockType(
        trimmed,
        !hasSeenPrimaryContent,
        isRepeatedHeader,
        isRepeatedFooter,
      );

      // Update section heading context
      const headingResult = detectSectionHeading(trimmed);
      if (headingResult.isHeading) {
        currentSectionTitle = headingResult.title;
        currentSectionPath = buildSectionPath(headingResult.sectionNumber);

        // For annex headings, build a section-path-friendly form
        if (
          headingResult.sectionNumber.startsWith("annex-") ||
          headingResult.sectionNumber.startsWith("appendix-")
        ) {
          currentSectionPath = [headingResult.sectionNumber];
        }
      }

      // Track primary content
      if (blockType !== "header" && blockType !== "footer") {
        hasSeenPrimaryContent = true;
      }

      // Build the block
      const blockIndex = globalBlockIndex++;
      const block: QuickCheckV2Block = {
        spanId: buildSpanId(documentId, pageNumber, blockIndex, trimmed),
        page: pageNumber,
        text: trimmed,
        blockType,
        sectionHeading: currentSectionTitle,
        sectionPath: [...currentSectionPath],
        source: "primary",
      };

      blocks.push(block);
    }
  }

  // Determine page count
  const uniquePages = new Set(blocks.map((b) => b.page));
  const pageCount = uniquePages.size;

  // Check for page 1 defaulting issue
  if (pageCount <= 1 && pageMarkers.length > 1) {
    warnings.push(
      `Only ${pageCount} unique page(s) detected from ${pageMarkers.length} markers. Page provenance may be incomplete.`,
    );
  }

  return {
    documentId,
    parser,
    blocks,
    diagnostics: {
      pageCount,
      warnings,
    },
  };
}

// ---------------------------------------------------------------------------
// Ingestion from file
// ---------------------------------------------------------------------------

/**
 * Load a previously extracted text file and parse it into a canonical document.
 *
 * This is the main entry point for tests. The fixture path should point to a
 * `.txt` file containing the raw extracted text from a PDF parser.
 */
export function loadAndParseExtractedText(
  filePath: string,
  documentId?: string,
  parser?: string,
): QuickCheckV2ExtractedDocument {
  const resolvedPath = path.resolve(filePath);
  const rawText = fs.readFileSync(resolvedPath, "utf-8");

  const resolvedDocId =
    documentId ?? path.basename(filePath, path.extname(filePath));
  const resolvedParser = parser ?? "extracted-text";

  return parseExtractedText(rawText, resolvedDocId, resolvedParser);
}
