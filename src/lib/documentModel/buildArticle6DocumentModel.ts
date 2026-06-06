import { buildDocumentQualityReport, classifyDocumentFamily } from "@/lib/documentClassification";
import type {
  Article6DocumentBlock,
  Article6DocumentModel,
  Article6DocumentPage,
  Article6DocumentSection,
  Article6ExtractionWarning,
  Article6SourceRef,
  BuildArticle6DocumentModelInput,
} from "@/lib/documentModel/types";

const DISPLAY_SNIPPET_MAX = 280;

function cleanText(rawText: string): string {
  return rawText
    .replace(/\f/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function matchingText(rawText: string): string {
  return cleanText(rawText).toLowerCase().replace(/\s+/g, " ").trim();
}

function coerceMatchingText(parserText: string | undefined, fallbackText: string): string {
  const candidate = parserText && parserText.trim().length > 0 ? parserText : fallbackText;
  return matchingText(candidate);
}

function makeSnippet(text: string): string {
  const clean = cleanText(text);
  if (clean.length <= DISPLAY_SNIPPET_MAX) return clean;
  return `${clean.slice(0, DISPLAY_SNIPPET_MAX).replace(/\s+\S*$/, "")} […]`;
}

function sectionIdFromNumber(sectionNumber?: string): string | undefined {
  return sectionNumber ? `section:${sectionNumber}` : undefined;
}

function sectionIdPathFromNumbers(sectionPath?: string[]): string[] | undefined {
  if (!sectionPath?.length) return undefined;
  return sectionPath
    .map((sectionNumber) => sectionIdFromNumber(sectionNumber))
    .filter((sectionId): sectionId is string => Boolean(sectionId));
}

function parentSectionNumber(sectionNumber?: string): string | undefined {
  if (!sectionNumber || !sectionNumber.includes(".")) return undefined;
  return sectionNumber.split(".").slice(0, -1).join(".");
}

function pageSourceRef(input: {
  source: string;
  parserAdapterId: Article6DocumentModel["parserAdapterId"];
  pageNumber: number;
}): Article6SourceRef {
  return {
    source: input.source,
    parserAdapterId: input.parserAdapterId,
    quality: "synthetic",
    pageNumber: input.pageNumber,
  };
}

export function buildArticle6DocumentModel(
  input: BuildArticle6DocumentModelInput,
): Article6DocumentModel {
  const { parsedDocument, includeDebugPayload = false } = input;
  const parserAdapterId = parsedDocument.adapterId;
  const source = parsedDocument.source;
  const parsedElements = parsedDocument.elements ?? [];
  const qualityReport = buildDocumentQualityReport(parsedDocument);
  const documentFamily = classifyDocumentFamily({
    ...parsedDocument,
    qualityReport,
  });

  const blockSource: Array<{
    id: string;
    type: Article6DocumentBlock["type"];
    text: string;
    normalizedText: string;
    parserElementId?: string;
    parserSource?: string;
    pageNumber?: number;
    charStart?: number;
    charEnd?: number;
    headingLevel?: number;
    sectionNumber?: string;
    sectionPath?: string[];
    boundingBox?: Article6DocumentBlock["boundingBox"];
    table?: Article6DocumentBlock["table"];
    confidence?: number;
  }> = parsedElements.length > 0
    ? parsedElements.map((element) => ({
        id: element.id,
        type: element.elementType,
        text: element.text,
        normalizedText: element.normalizedText,
        parserElementId: element.id,
        parserSource: element.sourceParser,
        pageNumber: element.pageNumber,
        charStart: element.charStart,
        charEnd: element.charEnd,
        headingLevel: element.headingLevel,
        sectionNumber: element.sectionNumber,
        sectionPath: element.sectionPath,
        boundingBox: element.boundingBox,
        table: element.table,
        confidence: element.confidence,
      }))
    : parsedDocument.blocks;

  const blocks: Article6DocumentBlock[] = blockSource.map((block) => {
    const sectionId = sectionIdFromNumber(block.sectionNumber);
    const sectionPath = sectionIdPathFromNumbers(block.sectionPath);
    return {
      id: block.id,
      type: block.type,
      rawText: block.text,
      cleanText: cleanText(block.text),
      matchingText: coerceMatchingText(block.normalizedText, block.text),
      parserElementId: block.parserElementId,
      parserSource: block.parserSource ?? parsedDocument.parserName,
      pageNumber: block.pageNumber,
      charStart: block.charStart,
      charEnd: block.charEnd,
      sectionId,
      sectionPath,
      headingLevel: block.headingLevel,
      boundingBox: block.boundingBox,
      table: block.table,
      sourceRefs: [{
        source,
        parserAdapterId,
        quality: block.parserElementId ? "exact" : "synthetic",
        pageNumber: block.pageNumber,
        blockId: block.id,
        sectionId,
        sectionNumber: block.sectionNumber,
      }],
      confidence: block.confidence ?? (block.type === "heading" ? 0.95 : 0.8),
    };
  });

  const pageIdsByNumber = new Map<number, string>();
  const pages: Article6DocumentPage[] = parsedDocument.pages.map((page) => {
    const pageId = `page:${page.pageNumber}`;
    pageIdsByNumber.set(page.pageNumber, pageId);
    const blockIds = blocks
      .filter((block) => block.pageNumber === page.pageNumber)
      .map((block) => block.id);
    return {
      id: pageId,
      pageNumber: page.pageNumber,
      rawText: page.rawText,
      cleanText: cleanText(page.rawText),
      matchingText: coerceMatchingText(page.normalizedText, page.rawText),
      blockIds,
      sourceRefs: [pageSourceRef({ source, parserAdapterId, pageNumber: page.pageNumber })],
    };
  });
  void pageIdsByNumber;

  const warnings: Article6ExtractionWarning[] = [];
  for (const warningText of parsedDocument.diagnostics?.warnings ?? []) {
    warnings.push({
      code: "parser_warning",
      message: warningText,
      severity: "warning",
      sourceRefs: [],
    });
  }

  const sections: Article6DocumentSection[] = [];
  const headingIndex = parsedDocument.headingIndex ?? [];
  if (headingIndex.length > 0) {
    for (const heading of headingIndex) {
      const sectionNumber = heading.sectionNumber;
      const sectionId = sectionIdFromNumber(sectionNumber) ?? `section:bridge:${heading.title}`;
      const sectionRaw = parsedDocument.sectionsByNumber?.[sectionNumber] ?? heading.title;
      const bodyRaw = sectionRaw.split("\n").slice(1).join("\n").trim() || heading.bodyText || "";
      const parentNumber = parentSectionNumber(sectionNumber);
      const blockIds = blocks
        .filter((block) => block.sectionId === sectionId)
        .map((block) => block.id);
      const sourceRefs: Article6SourceRef[] = [{
        source,
        parserAdapterId,
        quality: "synthetic",
        pageNumber: 1,
        headingId: `heading:${sectionNumber}`,
        sectionId,
        sectionNumber,
      }];
      sections.push({
        id: sectionId,
        sectionNumber,
        titleRaw: heading.title,
        titleClean: cleanText(heading.title),
        titleMatchingText: coerceMatchingText(heading.normalizedTitle, heading.title),
        bodyRaw,
        bodyClean: cleanText(bodyRaw),
        bodyMatchingText: coerceMatchingText(undefined, bodyRaw),
        displaySnippet: makeSnippet(bodyRaw || heading.title),
        matchingText: coerceMatchingText(undefined, `${heading.title}\n${bodyRaw}`),
        parentId: parentNumber ? sectionIdFromNumber(parentNumber) : undefined,
        childIds: [],
        blockIds,
        sourceRefs,
        confidence: 0.95,
        extractionWarnings: [],
      });
    }
  } else {
    for (const heading of parsedDocument.headings) {
      const sectionNumber = heading.sectionNumber;
      const sectionId = sectionIdFromNumber(sectionNumber) ?? `section:${heading.id}`;
      const relatedBlocks = parsedDocument.blocks.filter((block) => block.sectionNumber === sectionNumber);
      const bodyRaw = relatedBlocks
        .filter((block) => block.type !== "heading")
        .map((block) => block.text)
        .join("\n")
        .trim();
      const parentNumber = parentSectionNumber(sectionNumber);
      sections.push({
        id: sectionId,
        sectionNumber,
        titleRaw: heading.text,
        titleClean: cleanText(heading.text),
        titleMatchingText: coerceMatchingText(heading.normalizedText, heading.text),
        bodyRaw,
        bodyClean: cleanText(bodyRaw),
        bodyMatchingText: coerceMatchingText(undefined, bodyRaw),
        displaySnippet: makeSnippet(bodyRaw || heading.text),
        matchingText: coerceMatchingText(undefined, `${heading.text}\n${bodyRaw}`),
        parentId: parentNumber ? sectionIdFromNumber(parentNumber) : undefined,
        childIds: [],
        blockIds: blocks
          .filter((block) => block.sectionId === sectionId)
          .map((block) => block.id),
        sourceRefs: [{
          source,
          parserAdapterId,
          quality: "synthetic",
          pageNumber: heading.pageNumber,
          headingId: heading.id,
          sectionId,
          sectionNumber,
        }],
        confidence: 0.65,
        extractionWarnings: [],
      });
    }
  }

  const sectionIds = new Set(sections.map((section) => section.id));
  for (const section of sections) {
    if (section.parentId && sectionIds.has(section.parentId)) {
      const parent = sections.find((candidate) => candidate.id === section.parentId);
      if (parent && !parent.childIds.includes(section.id)) {
        parent.childIds.push(section.id);
      }
    }
  }

  if (parsedDocument.rawText.trim() && sections.length === 0) {
    warnings.push({
      code: "no_sections_detected",
      message: "Parser output did not produce any canonical sections.",
      severity: "warning",
      sourceRefs: [],
    });
  }

  if (parsedDocument.headings.length === 0 && parsedDocument.rawText.trim()) {
    warnings.push({
      code: "no_headings_detected",
      message: "Parser output did not produce any headings.",
      severity: "warning",
      sourceRefs: [],
    });
  }

  return {
    id: `article6-document:${parserAdapterId}`,
    source,
    parserAdapterId,
    rawText: parsedDocument.rawText,
    cleanText: cleanText(parsedDocument.rawText),
    matchingText: coerceMatchingText(parsedDocument.normalizedText, parsedDocument.rawText),
    documentFamily,
    qualityReport,
    pages,
    blocks,
    sections,
    extractionWarnings: warnings,
    parserDiagnostics: parsedDocument.diagnostics,
    debug: includeDebugPayload ? { parserOutput: parsedDocument } : undefined,
  };
}

export function buildDocumentStructure(
  input: BuildArticle6DocumentModelInput,
): Article6DocumentModel {
  return buildArticle6DocumentModel(input);
}
