/**
 * Quick Check v2 — Phase 3 evidence retrieval with fixed source priority.
 *
 * Scope note:
 * This module is intentionally self-contained so Phase 3/4 can ship without
 * pulling in wider Quick Check v2 ingestion or section-tree work.
 *
 * Priority:
 * 1. fact contract
 * 2. exact section evidence
 * 3. raw text fallback
 *
 * Hard rules:
 * - No answer extraction
 * - No FOUND / UNCLEAR / MISSING status
 * - No scoring
 * - No candidate ranking
 * - No LLM
 */

export type QuickCheckV2Block = {
  spanId: string;
  page: number;
  text: string;
  blockType:
    | "heading"
    | "body"
    | "table"
    | "footer"
    | "header"
    | "unknown";
  sectionHeading: string | null;
  sectionPath: string[];
  source: "primary" | "fallback";
};

export type QuickCheckV2ExtractedDocument = {
  documentId: string;
  parser: string;
  blocks: QuickCheckV2Block[];
  diagnostics: {
    pageCount?: number;
    warnings: string[];
  };
};

export type EvidenceSpan = {
  quote: string;
  page: number;
  sectionHeading: string | null;
  sectionPath: string[];
  spanId: string;
};

type SectionTreeNode = {
  heading: QuickCheckV2Block;
  directBodyBlocks: QuickCheckV2Block[];
  children: SectionTreeNode[];
};

export const STRUCTURED_CHECK_IDS = [
  "host_country",
  "methodology",
  "baseline_scenario",
  "additionality",
  "leakage",
  "stakeholder_consultation",
] as const;

export type StructuredCheckId = (typeof STRUCTURED_CHECK_IDS)[number];

export type EvidenceSourceType =
  | "fact_contract"
  | "exact_section"
  | "raw_text_fallback";

export type RetrievedEvidence = EvidenceSpan & {
  sourceType: EvidenceSourceType;
};

export type RetrievedCheckEvidence = {
  checkName: StructuredCheckId;
  evidence: RetrievedEvidence | null;
};

type FactContractDefinition = {
  find(blocks: QuickCheckV2Block[]): QuickCheckV2Block | null;
};

type RawFallbackDefinition = {
  match(block: QuickCheckV2Block): boolean;
};

const CHECK_SECTION_MAPPINGS: Record<
  StructuredCheckId,
  {
    searchTexts: string[];
    fallbackSearchTexts?: string[];
    excludeTexts?: string[];
  }
> = {
  host_country: {
    searchTexts: ["Project Location"],
    fallbackSearchTexts: ["PROJECT DETAILS"],
  },
  methodology: {
    searchTexts: ["Title and Reference of Methodology"],
    fallbackSearchTexts: ["APPLICATION OF METHODOLOGY"],
  },
  baseline_scenario: {
    searchTexts: ["Baseline Scenario"],
  },
  additionality: {
    searchTexts: ["Additionality"],
    fallbackSearchTexts: ["demonstration of additionality"],
  },
  leakage: {
    searchTexts: ["Leakage"],
    excludeTexts: ["Baseline, Project and Leakage"],
  },
  stakeholder_consultation: {
    searchTexts: ["STAKEHOLDER COMMENTS", "Stakeholder Comments"],
    fallbackSearchTexts: ["stakeholder"],
  },
};

const FACT_CONTRACTS: Partial<Record<StructuredCheckId, FactContractDefinition>> = {
  host_country: {
    find(blocks) {
      for (let index = 0; index < blocks.length - 1; index += 1) {
        const current = blocks[index]!;
        const next = blocks[index + 1]!;
        if (
          /\bprovince of\b/i.test(current.text) &&
          current.sectionPath.join(">") === next.sectionPath.join(">") &&
          /\b[A-Z][a-z]+,\s*[A-Z][A-Za-z-]+(?:\s*\(|$)/.test(next.text)
        ) {
          return next;
        }
      }

      return (
        findFirstBlock(
          blocks,
          (block) =>
            /\bhost country\s+[A-Z][A-Za-z]*(?:[ -][A-Z][A-Za-z]*)*\b/.test(block.text) &&
            block.text.length <= 80 &&
            (block.sectionPath.length > 0 || block.sectionHeading !== null),
        ) ??
        findFirstBlock(blocks, (block) =>
          /\b[A-Z][a-z]+,\s*[A-Z][A-Za-z-]+(?:\s*\(|$)/.test(block.text) &&
          /\b(?:province|district|regency|location|located)\b/i.test(block.text) &&
          block.sectionPath.length > 0,
        ) ??
        findFirstBlock(blocks, (block) =>
          /\blocated\b/i.test(block.text) && /\b[A-Z][a-z]+,\s*[A-Z][a-z]+\b/.test(block.text),
        ) ??
        findFirstBlock(blocks, (block) =>
          /\bproject location\b/i.test(block.sectionHeading ?? "") &&
          /\b[A-Z][a-z]+,\s*[A-Z][a-z]+\b/.test(block.text),
        ) ??
        null
      );
    },
  },
  methodology: {
    find(blocks) {
      return (
        findFirstBlock(blocks, (block) =>
          /\btitle and reference of the vcs methodology\b/i.test(block.sectionHeading ?? "") &&
          /\bVM\d{4}\b|\bVMD\d{4}\b/.test(block.text),
        ) ??
        findFirstBlock(blocks, (block) =>
          /\bthe methodology for this project follows\b/i.test(block.text) &&
          /\bVM\d{4}\b|\bVMD\d{4}\b/.test(block.text),
        ) ??
        findFirstBlock(blocks, (block) =>
          /\bVM\d{4}\b|\bVMD\d{4}\b/.test(block.text),
        ) ??
        findFirstBlock(blocks, (block) =>
          /\bmethodology\b/i.test(block.text),
        ) ??
        null
      );
    },
  },
};

const RAW_TEXT_FALLBACKS: Record<StructuredCheckId, RawFallbackDefinition> = {
  host_country: {
    match(block) {
      return (
        /\blocated\b/i.test(block.text) &&
        /\b[A-Z][a-z]+,\s*[A-Z][a-z]+\b/.test(block.text)
      );
    },
  },
  methodology: {
    match(block) {
      return /\bVM\d{4}\b|\bVMD\d{4}\b|\bmethodology\b/i.test(block.text);
    },
  },
  baseline_scenario: {
    match(block) {
      return /\bbaseline scenario\b|\bmost likely baseline\b/i.test(block.text);
    },
  },
  additionality: {
    match(block) {
      return /\badditionality\b/i.test(block.text);
    },
  },
  leakage: {
    match(block) {
      return /\bleakage\b/i.test(block.text);
    },
  },
  stakeholder_consultation: {
    match(block) {
      return /\bstakeholder\b|\bconsultation\b/i.test(block.text);
    },
  },
};

function isEvidenceBlock(block: QuickCheckV2Block): boolean {
  return block.blockType === "body" || block.blockType === "table";
}

function getEvidenceBlocks(document: QuickCheckV2ExtractedDocument): QuickCheckV2Block[] {
  return document.blocks.filter(isEvidenceBlock);
}

function findFirstBlock(
  blocks: QuickCheckV2Block[],
  predicate: (block: QuickCheckV2Block) => boolean,
): QuickCheckV2Block | null {
  for (const block of blocks) {
    if (predicate(block)) {
      return block;
    }
  }
  return null;
}

function toEvidence(
  block: QuickCheckV2Block,
  sourceType: EvidenceSourceType,
  quoteOverride?: string,
): RetrievedEvidence {
  return {
    sourceType,
    quote: quoteOverride ?? block.text,
    page: block.page,
    sectionHeading: block.sectionHeading,
    sectionPath: block.sectionPath,
    spanId: block.spanId,
  };
}

function fnv1a(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
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
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  const hash = fnv1a(`${documentId}:p${page}:b${blockIndex}:${normalized}`);
  return `${documentId}:p${page}:b${blockIndex}:${hash}`;
}

const VCS_PAGE_MARKER_RE = /^v\d+(?:\.\d+)+\s+(\d+)$/;
const PAGE_MARKER_RE = /^(?:page\s+(\d+)(?:\s+of\s+\d+)?|(\d+)\s+of\s+\d+)$/i;
const TOC_LEADER_RE = /\.{3,}\s*\d+\s*$/;

function isPageMarkerLine(
  line: string,
): { isMarker: true; pageNumber: number } | { isMarker: false } {
  const trimmed = line.trim();

  const vcsMatch = trimmed.match(VCS_PAGE_MARKER_RE);
  if (vcsMatch) {
    return { isMarker: true, pageNumber: parseInt(vcsMatch[1]!, 10) };
  }

  const pageMatch = trimmed.match(PAGE_MARKER_RE);
  if (pageMatch) {
    const pageNumber = parseInt(pageMatch[1] ?? pageMatch[2]!, 10);
    if (pageNumber > 0) {
      return { isMarker: true, pageNumber };
    }
  }

  return { isMarker: false };
}

const SECTION_HEADING_RE =
  /^\s*(?:section\s+)?([A-Z]\.\d+(?:\.\d+)*|\d+(?:\.\d+)+)\.?\s+[.:]?\s*(.+?)\s*$/i;
const TOP_LEVEL_HEADING_RE = /^\s*(\d+)\.?\s+([A-Za-z][\w\s/&:,'’()‐-]+)\s*$/;
const ANNEX_HEADING_RE = /^\s*(annex|appendix)\s+([A-Z0-9]+)\s*[.:]?\s*(.*)$/i;

function detectSectionHeading(
  line: string,
): { isHeading: true; sectionNumber: string; title: string } | { isHeading: false } {
  const trimmed = normalizePotentialHeadingText(line);

  const annexMatch = trimmed.match(ANNEX_HEADING_RE);
  if (annexMatch) {
    const sectionNumber =
      `${annexMatch[1]!.toLowerCase()}-${annexMatch[2]!.toLowerCase()}`;
    const title = annexMatch[3]?.trim() || `${annexMatch[1]} ${annexMatch[2]}`;
    return { isHeading: true, sectionNumber, title };
  }

  const headingMatch = trimmed.match(SECTION_HEADING_RE);
  if (headingMatch) {
    const title = headingMatch[2]!.trim();
    if (/^[a-z]/.test(title)) {
      return { isHeading: false };
    }
    return {
      isHeading: true,
      sectionNumber: headingMatch[1]!,
      title,
    };
  }

  const topLevelMatch = trimmed.match(TOP_LEVEL_HEADING_RE);
  if (topLevelMatch) {
    const title = topLevelMatch[2]!.trim();
    const sectionNumber = topLevelMatch[1]!;
    if (/\b\d{4}\b/.test(title)) {
      return { isHeading: false };
    }
    if (title.length > 80) {
      return { isHeading: false };
    }
    if (parseInt(sectionNumber, 10) > 12) {
      return { isHeading: false };
    }
    return {
      isHeading: true,
      sectionNumber,
      title,
    };
  }

  return { isHeading: false };
}

function buildSectionPath(sectionNumber: string): string[] {
  if (sectionNumber.startsWith("annex-") || sectionNumber.startsWith("appendix-")) {
    return [sectionNumber];
  }
  const parts = sectionNumber.split(".");
  return parts.map((_, index) => parts.slice(0, index + 1).join("."));
}

function normalizePotentialHeadingText(line: string): string {
  const trimmed = line.trim().replace(/\s+/g, " ");

  const dottedPrefixMatch = trimmed.match(
    /^((?:section\s+)?(?:[A-Z]\.\d+(?:\.\d+)*|\d+(?:\.\d+)*))\.?\s+(?:\d+\s+){1,4}B\s+(.+)$/i,
  );
  if (dottedPrefixMatch) {
    return `${dottedPrefixMatch[1]!.replace(/\.$/, "")} ${dottedPrefixMatch[2]!.trim()}`;
  }

  const splitSectionMatch = trimmed.match(/^(\d+)\s+(\d+)\s+B\s+(.+)$/);
  if (splitSectionMatch) {
    return `${splitSectionMatch[1]}.${splitSectionMatch[2]} ${splitSectionMatch[3]!.trim()}`;
  }

  return trimmed;
}

function isLikelyTableOfContentsLine(line: string): boolean {
  const normalized = line.trim().replace(/\s+/g, " ");
  return TOC_LEADER_RE.test(normalized);
}

function isLikelyTableOfContentsPage(lines: string[]): boolean {
  let tocLikeCount = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (isLikelyTableOfContentsLine(line)) {
      tocLikeCount += 1;
      continue;
    }

    if (
      /^(?:sub[-‐ ]?step|step)\b/i.test(line) &&
      /(?:\.{3,}\s*|\s)(\d{1,3})\s*$/.test(line)
    ) {
      tocLikeCount += 1;
      continue;
    }

    if (
      /^(?:annex|appendix|\d+(?:\.\d+)*\.?)/i.test(line) &&
      /(?:\.{3,}\s*|\s)(\d{1,3})\s*$/.test(line)
    ) {
      tocLikeCount += 1;
    }
  }

  return tocLikeCount >= 8;
}

function isTableLine(line: string): boolean {
  const trimmed = line.trim();
  return /\|/.test(trimmed) || /\S(?:\s{3,}|\t)\S/.test(trimmed);
}

function detectBlockType(
  line: string,
  isFirstContentLine: boolean,
  isRepeatedHeader: boolean,
  isRepeatedFooter: boolean,
): QuickCheckV2Block["blockType"] {
  const trimmed = line.trim();
  if (!trimmed) return "unknown";
  if (isRepeatedHeader) return "header";
  if (isRepeatedFooter) return "footer";
  if (isLikelyTableOfContentsLine(trimmed)) return "unknown";
  if (detectSectionHeading(trimmed).isHeading) return "heading";
  if (isTableLine(trimmed)) return "table";
  if (isFirstContentLine && trimmed.length <= 180) return "heading";
  return "body";
}

type PageEdgeLines = {
  headers: Set<string>;
  footers: Set<string>;
};

function collectRepeatedPageEdges(pages: Array<{ lines: string[] }>): PageEdgeLines {
  const headerCounts = new Map<string, number>();
  const footerCounts = new Map<string, number>();

  for (const page of pages) {
    const nonEmptyLines = page.lines.map((line) => line.trim()).filter(Boolean);
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

export function parseExtractedText(
  rawText: string,
  documentId: string,
  parser: string,
): QuickCheckV2ExtractedDocument {
  const lines = rawText.split("\n");
  const pageMarkers: Array<{ pageNumber: number; startLine: number; endLine: number }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const marker = isPageMarkerLine(lines[index]!);
    if (marker.isMarker) {
      pageMarkers.push({
        pageNumber: marker.pageNumber,
        startLine: index + 1,
        endLine: lines.length,
      });
    }
  }

  for (let index = 0; index < pageMarkers.length; index += 1) {
    const next = pageMarkers[index + 1];
    pageMarkers[index]!.endLine = next ? next.startLine - 1 : lines.length;
  }

  if (pageMarkers.length === 0) {
    pageMarkers.push({ pageNumber: 1, startLine: 0, endLine: lines.length });
  }

  const pageSlices = pageMarkers.map((marker) => ({
    pageNumber: marker.pageNumber,
    lines: lines.slice(marker.startLine, marker.endLine),
  }));
  const repeatedEdges = collectRepeatedPageEdges(pageSlices);

  const blocks: QuickCheckV2Block[] = [];
  const warnings: string[] = [];
  let globalBlockIndex = 0;
  let currentSectionTitle: string | null = null;
  let currentSectionPath: string[] = [];
  let hasSeenPrimaryContent = false;

  for (const page of pageSlices) {
    const isTableOfContentsPage = isLikelyTableOfContentsPage(page.lines);

    for (const line of page.lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (isPageMarkerLine(trimmed).isMarker) continue;

      const detectedBlockType = detectBlockType(
        trimmed,
        !hasSeenPrimaryContent,
        repeatedEdges.headers.has(trimmed),
        repeatedEdges.footers.has(trimmed),
      );
      const blockType =
        isTableOfContentsPage &&
        detectedBlockType !== "header" &&
        detectedBlockType !== "footer"
          ? "unknown"
          : detectedBlockType;
      const heading = blockType === "heading" ? detectSectionHeading(trimmed) : { isHeading: false as const };
      if (heading.isHeading) {
        currentSectionTitle = heading.title;
        currentSectionPath = buildSectionPath(heading.sectionNumber);
      }

      if (blockType !== "header" && blockType !== "footer") {
        hasSeenPrimaryContent = true;
      }

      blocks.push({
        spanId: buildSpanId(documentId, page.pageNumber, globalBlockIndex, trimmed),
        page: page.pageNumber,
        text: trimmed,
        blockType,
        sectionHeading: currentSectionTitle,
        sectionPath: [...currentSectionPath],
        source: "primary",
      });
      globalBlockIndex += 1;
    }
  }

  const pageCount = new Set(blocks.map((block) => block.page)).size;
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

export function loadAndParseExtractedText(
  filePath: string,
  documentId?: string,
  parser?: string,
): QuickCheckV2ExtractedDocument {
  const fs = process.getBuiltinModule?.("fs") as typeof import("node:fs") | undefined;
  const path = process.getBuiltinModule?.("path") as typeof import("node:path") | undefined;
  if (!fs || !path) {
    throw new Error("loadAndParseExtractedText is only available in Node environments.");
  }
  const resolvedPath = path.resolve(filePath);
  const rawText = fs.readFileSync(resolvedPath, "utf-8");
  return parseExtractedText(
    rawText,
    documentId ?? path.basename(filePath, path.extname(filePath)),
    parser ?? "extracted-text",
  );
}

function buildSectionTree(document: QuickCheckV2ExtractedDocument): SectionTreeNode[] {
  const rootNodes: SectionTreeNode[] = [];
  const stack: SectionTreeNode[] = [];

  for (const block of document.blocks) {
    if (block.blockType === "heading") {
      const node: SectionTreeNode = {
        heading: block,
        directBodyBlocks: [],
        children: [],
      };
      const depth = block.sectionPath.length || 1;
      while (stack.length >= depth) {
        stack.pop();
      }
      if (stack.length > 0) {
        stack[stack.length - 1]!.children.push(node);
      } else {
        rootNodes.push(node);
      }
      stack.push(node);
      continue;
    }

    if ((block.blockType === "body" || block.blockType === "table") && stack.length > 0) {
      stack[stack.length - 1]!.directBodyBlocks.push(block);
    }
  }

  return rootNodes;
}

function findSectionsByHeadingText(
  tree: SectionTreeNode[],
  searchTexts: string[],
  maxResults: number,
  excludeTexts?: string[],
): SectionTreeNode[] {
  const results: SectionTreeNode[] = [];

  function getHeadingSearchPreview(
    node: SectionTreeNode,
    searchTexts: string[],
  ): string {
    const previewParts = [node.heading.text];
    const headingText = node.heading.text.toLowerCase();

    if (searchTexts.some((text) => headingText.includes(text.toLowerCase()))) {
      return headingText;
    }

    if (/[.?!:]$/.test(node.heading.text.trim())) {
      return headingText;
    }

    for (const block of node.directBodyBlocks.slice(0, 2)) {
      const text = block.text.trim();
      if (!text) continue;
      if (text.length > 140) break;
      if (!/^[a-z,(]/.test(text)) break;
      previewParts.push(text);
      if (/[):.]$/.test(text)) break;
    }

    return previewParts.join(" ").toLowerCase();
  }

  function walk(nodes: SectionTreeNode[]): void {
    for (const node of nodes) {
      const headingText = getHeadingSearchPreview(node, searchTexts);
      const matches = searchTexts.some((text) => headingText.includes(text.toLowerCase()));
      const excluded =
        excludeTexts?.some((text) => headingText.includes(text.toLowerCase())) ?? false;

      if (matches && !excluded) {
        results.push(node);
        if (results.length >= maxResults) return;
      }

      if (results.length < maxResults) {
        walk(node.children);
      }
    }
  }

  walk(tree);
  return results;
}

function getHeadingMatchQuality(
  headingText: string,
  searchTexts: string[],
): number {
  const normalizedHeading = headingText.toLowerCase();
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const searchText of searchTexts) {
    const normalizedSearch = searchText.toLowerCase();
    const index = normalizedHeading.indexOf(normalizedSearch);
    if (index === -1) continue;

    const score = 1000 - index - (normalizedHeading.length - normalizedSearch.length);
    if (score > bestScore) {
      bestScore = score;
    }
  }

  return bestScore;
}

function sectionPathStartsWith(pathValue: string[], prefix: string[]): boolean {
  if (prefix.length === 0 || pathValue.length < prefix.length) {
    return false;
  }

  return prefix.every((segment, index) => pathValue[index] === segment);
}

function collectSectionBodyBlocks(
  document: QuickCheckV2ExtractedDocument,
  section: SectionTreeNode,
): QuickCheckV2Block[] {
  const prefix = section.heading.sectionPath;

  return getEvidenceBlocks(document).filter((block) => {
    if (block.page < section.heading.page) {
      return false;
    }

    if (sectionPathStartsWith(block.sectionPath, prefix)) {
      return true;
    }

    return (
      block.sectionHeading === section.heading.sectionHeading &&
      block.page === section.heading.page
    );
  });
}

function isBoilerplateSectionBlock(block: QuickCheckV2Block): boolean {
  return /^PROJECT DESCRIPTION:\s+/i.test(block.text.trim());
}

function endsSentence(text: string): boolean {
  return /[.?!]["')\]]*$/.test(text.trim());
}

function getUsableSectionBlocks(blocks: QuickCheckV2Block[]): QuickCheckV2Block[] {
  return blocks.filter((block) => {
    const text = block.text.trim();
    return (
      text.length > 0 &&
      !isBoilerplateSectionBlock(block) &&
      !isLikelyTableOfContentsLine(text)
    );
  });
}

function normalizeSectionPhrase(value: string): string {
  return value
    .toLowerCase()
    .replace(/^\s*(?:section\s+)?(?:[a-z]?\.\d+(?:\.\d+)*|\d+(?:\.\d+)*)\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isReferenceOnlyBlock(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return (
    /^https?:\/\//.test(normalized) ||
    /\.pdf\b/.test(normalized) ||
    /\blast accessed\b/.test(normalized)
  );
}

function groupBlocksByExactSectionPath(blocks: QuickCheckV2Block[]): QuickCheckV2Block[][] {
  const groups = new Map<string, QuickCheckV2Block[]>();

  for (const block of blocks) {
    const key = block.sectionPath.join(">");
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(block);
  }

  return Array.from(groups.values());
}

function chooseBestSectionGroup(
  baseDepth: number,
  searchTexts: string[],
  blocks: QuickCheckV2Block[],
): QuickCheckV2Block[] {
  const usableBlocks = getUsableSectionBlocks(blocks);
  if (usableBlocks.length === 0) {
    return [];
  }

  const grouped = groupBlocksByExactSectionPath(usableBlocks);
  const descendantGroups = grouped.filter(
    (group) => group[0]!.sectionPath.length > baseDepth,
  );

  if (descendantGroups.length === 0) {
    return usableBlocks;
  }

  const normalizedSearchPhrases = searchTexts
    .map(normalizeSectionPhrase)
    .filter((value) => value.length > 0);

  if (normalizedSearchPhrases.length > 0) {
    const tokenMatchedGroup = descendantGroups.find((group) =>
      group.some((block) => {
        const text = block.text.toLowerCase();
        return normalizedSearchPhrases.some((phrase) => text.includes(phrase));
      }),
    );

    if (tokenMatchedGroup) {
      return tokenMatchedGroup;
    }
  }

  return descendantGroups[0]!;
}

function chooseBestSectionBlock(
  checkName: StructuredCheckId,
  blocks: QuickCheckV2Block[],
): QuickCheckV2Block | null {
  const usableBlocks = getUsableSectionBlocks(blocks);
  if (usableBlocks.length === 0) {
    return null;
  }

  const matchedBlocks = usableBlocks.filter((block) =>
    RAW_TEXT_FALLBACKS[checkName].match(block) && !isReferenceOnlyBlock(block.text),
  );
  if (checkName === "baseline_scenario" || checkName === "additionality") {
    const earliestPage = Math.min(...matchedBlocks.map((block) => block.page));
    const earliestPageMatches = matchedBlocks.filter((block) => block.page === earliestPage);
    return earliestPageMatches[earliestPageMatches.length - 1] ?? usableBlocks[0] ?? null;
  }

  return usableBlocks[0] ?? null;
}

function buildQuoteFromBlock(
  document: QuickCheckV2ExtractedDocument,
  block: QuickCheckV2Block,
): string {
  const startIndex = document.blocks.findIndex((candidate) => candidate.spanId === block.spanId);
  if (startIndex === -1) {
    return block.text;
  }

  const parts = [block.text.trim()];
  let prependIndex = startIndex - 1;

  while (
    prependIndex >= 0 &&
    /^[a-z,(]/.test(parts[0]!) &&
    !/[.?!]/.test(parts[0]!)
  ) {
    const candidate = document.blocks[prependIndex]!;
    if (!isEvidenceBlock(candidate)) break;
    if (candidate.page !== block.page) break;
    if (candidate.sectionHeading !== block.sectionHeading) break;
    if (candidate.sectionPath.join(">") !== block.sectionPath.join(">")) break;
    if (isBoilerplateSectionBlock(candidate)) break;

    parts.unshift(candidate.text.trim());
    prependIndex -= 1;
  }

  for (let index = startIndex + 1; index < document.blocks.length; index += 1) {
    const candidate = document.blocks[index]!;
    if (!isEvidenceBlock(candidate)) break;
    if (candidate.page !== block.page) break;
    if (candidate.sectionHeading !== block.sectionHeading) break;
    if (candidate.sectionPath.join(">") !== block.sectionPath.join(">")) break;
    if (isBoilerplateSectionBlock(candidate)) break;

    if (endsSentence(parts.join(" "))) {
      break;
    }

    parts.push(candidate.text.trim());
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function getBestExactSectionBlock(
  document: QuickCheckV2ExtractedDocument,
  tree: SectionTreeNode[],
  checkName: StructuredCheckId,
): QuickCheckV2Block | null {
  const mapping = CHECK_SECTION_MAPPINGS[checkName];
  if (!mapping) {
    return null;
  }

  let sections = findSectionsByHeadingText(
    tree,
    mapping.searchTexts,
    3,
    mapping.excludeTexts,
  );

  if (sections.length === 0 && mapping.fallbackSearchTexts) {
    sections = findSectionsByHeadingText(
      tree,
      mapping.fallbackSearchTexts,
      3,
      mapping.excludeTexts,
    );
  }

  if (sections.length === 0) {
    return null;
  }

  const dedupedSections = new Map<string, SectionTreeNode>();
  for (const section of sections) {
    dedupedSections.set(section.heading.sectionPath.join(">"), section);
  }
  sections = Array.from(dedupedSections.values()).sort(
    (left, right) =>
      getHeadingMatchQuality(right.heading.text, mapping.searchTexts) -
      getHeadingMatchQuality(left.heading.text, mapping.searchTexts),
  );

  const bestSection =
    sections.find(
      (section) => collectSectionBodyBlocks(document, section).length > 0 && section.heading.page > 2,
    ) ??
    sections.find((section) => collectSectionBodyBlocks(document, section).length > 0) ??
    null;

  if (!bestSection) {
    return null;
  }

  const candidateBlocks = collectSectionBodyBlocks(document, bestSection);
  const selectedGroup = chooseBestSectionGroup(
    bestSection.heading.sectionPath.length,
    mapping.searchTexts,
    candidateBlocks,
  );
  return chooseBestSectionBlock(checkName, selectedGroup);
}

function getFactContractEvidence(
  document: QuickCheckV2ExtractedDocument,
  checkName: StructuredCheckId,
): RetrievedEvidence | null {
  const definition = FACT_CONTRACTS[checkName];
  if (!definition) {
    return null;
  }

  const block = definition.find(getEvidenceBlocks(document));
  return block ? toEvidence(block, "fact_contract") : null;
}

function getExactSectionEvidence(
  document: QuickCheckV2ExtractedDocument,
  checkName: StructuredCheckId,
): RetrievedEvidence | null {
  const block = getBestExactSectionBlock(document, buildSectionTree(document), checkName);
  return block ? toEvidence(block, "exact_section", buildQuoteFromBlock(document, block)) : null;
}

function getRawTextFallbackEvidence(
  document: QuickCheckV2ExtractedDocument,
  checkName: StructuredCheckId,
): RetrievedEvidence | null {
  const definition = RAW_TEXT_FALLBACKS[checkName];
  const block = findFirstBlock(
    getEvidenceBlocks(document),
    (candidate) =>
      !isLikelyTableOfContentsLine(candidate.text) && definition.match(candidate),
  );
  return block ? toEvidence(block, "raw_text_fallback") : null;
}

export function retrieveEvidenceForCheck(
  document: QuickCheckV2ExtractedDocument,
  checkName: StructuredCheckId,
): RetrievedCheckEvidence {
  const evidence =
    getFactContractEvidence(document, checkName) ??
    getExactSectionEvidence(document, checkName) ??
    getRawTextFallbackEvidence(document, checkName);

  return {
    checkName,
    evidence,
  };
}

export function retrieveEvidenceForAllChecks(
  document: QuickCheckV2ExtractedDocument,
): RetrievedCheckEvidence[] {
  return STRUCTURED_CHECK_IDS.map((checkName) =>
    retrieveEvidenceForCheck(document, checkName),
  );
}
