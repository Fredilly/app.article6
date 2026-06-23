import type { DocumentStructure } from "@/lib/documentModel";
import type { EvidenceDocument, EvidenceSpan } from "@/lib/quickCheck/evidence/evidenceTypes";
import type {
  IndexedTable,
  SectionNode,
  SectionTableIndex,
  SectionTopic,
  SectionTopicMap,
  SectionTopicReference,
  SectionTree,
  TableCellReference,
  TableIndex,
} from "@/lib/quickCheck/indexing/types";

const TOPIC_PATTERNS: Record<SectionTopic, RegExp[]> = {
  baseline: [/\bbaseline scenario\b/i, /\bbaseline\b/i, /\bwithout the project\b/i],
  monitoring: [/\bmonitoring\b/i, /\bmonitoring plan\b/i],
  leakage: [/\bleakage\b/i],
  additionality: [/\badditionality\b/i, /\badditional\b/i],
  methodology: [/\bmethodology\b/i, /\bapplied methodology\b/i, /\bmethodological\b/i],
  project_location: [/\bproject location\b/i, /\blocation\b/i, /\bhost country\b/i, /\bproject area\b/i],
  project_participants: [/\bproject participants?\b/i, /\bproject proponent\b/i, /\bparticipants?\b/i, /\bdeveloper\b/i],
  crediting_period: [/\bcrediting period\b/i, /\bcrediting\b/i],
  safeguards: [/\bsafeguards?\b/i, /\bstakeholders?\b/i, /\bgrievance\b/i, /\bfpic\b/i],
  sdg: [/\bsdgs?\b/i, /\bsustainable development\b/i, /\bco-benefits?\b/i],
};

function uniqueNumbers(values: Array<number | null | undefined>): number[] {
  return Array.from(new Set(values.filter((value): value is number => typeof value === "number"))).sort((a, b) => a - b);
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function normalizeForSearch(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function inferNodeId(span: EvidenceSpan): string {
  if (span.sectionId) return span.sectionId;
  return `section:span:${span.spanId}`;
}

function buildSectionNumberLookup(documentStructure: DocumentStructure): Map<string, string | undefined> {
  return new Map(documentStructure.sections.map((section) => [section.id, section.sectionNumber]));
}

function buildSectionBodyLookup(documentStructure: DocumentStructure): Map<string, string> {
  return new Map(documentStructure.sections.map((section) => [section.id, section.matchingText]));
}

function sortNodes(a: SectionNode, b: SectionNode): number {
  const aPage = a.pageNumbers[0] ?? Number.MAX_SAFE_INTEGER;
  const bPage = b.pageNumbers[0] ?? Number.MAX_SAFE_INTEGER;
  if (aPage !== bPage) return aPage - bPage;
  return a.heading.localeCompare(b.heading);
}

export function buildSectionTree(input: {
  documentStructure: DocumentStructure;
  evidenceDocument: EvidenceDocument;
}): SectionTree {
  const nodes = new Map<string, SectionNode>();
  const sectionNumberById = buildSectionNumberLookup(input.documentStructure);

  const ensureNode = (seed: Omit<SectionNode, "children">): SectionNode => {
    const existing = nodes.get(seed.id);
    if (existing) {
      existing.parentId = existing.parentId ?? seed.parentId;
      existing.sectionId = existing.sectionId ?? seed.sectionId;
      existing.sectionNumber = existing.sectionNumber ?? seed.sectionNumber;
      existing.heading = existing.heading || seed.heading;
      existing.headingPath = existing.headingPath.length > 0 ? existing.headingPath : seed.headingPath;
      existing.sectionPath = existing.sectionPath.length > 0 ? existing.sectionPath : seed.sectionPath;
      existing.evidenceSpanIds = uniqueStrings([...existing.evidenceSpanIds, ...seed.evidenceSpanIds]);
      existing.sourceBlockIds = uniqueStrings([...existing.sourceBlockIds, ...seed.sourceBlockIds]);
      existing.pageNumbers = uniqueNumbers([...existing.pageNumbers, ...seed.pageNumbers]);
      existing.confidence = Math.max(existing.confidence, seed.confidence);
      return existing;
    }

    const created: SectionNode = {
      ...seed,
      children: [],
    };
    nodes.set(seed.id, created);
    return created;
  };

  for (const section of input.documentStructure.sections) {
    const spans = input.evidenceDocument.spans.filter((span) => span.sectionId === section.id);
    const headingSpan = spans.find((span) => span.blockType === "section_heading" || span.blockType === "annex");
    ensureNode({
      id: section.id,
      parentId: section.parentId,
      sectionId: section.id,
      sectionNumber: section.sectionNumber,
      heading: headingSpan?.heading ?? section.titleRaw,
      headingPath: headingSpan?.headingPath ?? [section.titleRaw],
      sectionPath: headingSpan?.sectionPath ?? [section.id],
      evidenceSpanIds: spans.map((span) => span.spanId),
      sourceBlockIds: spans.map((span) => span.sourceBlockId).filter((value): value is string => Boolean(value)),
      pageNumbers: uniqueNumbers(spans.map((span) => span.page)),
      confidence: Math.max(section.confidence, ...spans.map((span) => span.confidence), 0.5),
    });
  }

  for (const span of input.evidenceDocument.spans) {
    if (span.blockType !== "section_heading" && span.blockType !== "annex") continue;
    const id = inferNodeId(span);
    const parentId = span.sectionPath.length > 1 ? span.sectionPath[span.sectionPath.length - 2] : undefined;
    ensureNode({
      id,
      parentId,
      sectionId: span.sectionId,
      sectionNumber: span.sectionId ? sectionNumberById.get(span.sectionId) : undefined,
      heading: span.heading ?? span.text,
      headingPath: span.headingPath,
      sectionPath: span.sectionPath.length > 0 ? span.sectionPath : [id],
      evidenceSpanIds: [span.spanId],
      sourceBlockIds: span.sourceBlockId ? [span.sourceBlockId] : [],
      pageNumbers: uniqueNumbers([span.page]),
      confidence: span.confidence,
    });
  }

  for (const node of nodes.values()) {
    node.children = [];
  }
  for (const node of nodes.values()) {
    if (!node.parentId) continue;
    const parent = nodes.get(node.parentId);
    if (!parent) continue;
    parent.children.push(node);
  }
  for (const node of nodes.values()) {
    node.children.sort(sortNodes);
  }

  const orderedNodeIds = [
    ...input.documentStructure.sections
      .map((section) => section.id)
      .filter((sectionId) => nodes.has(sectionId)),
    ...Array.from(nodes.keys()).filter((sectionId) => (
      !input.documentStructure.sections.some((section) => section.id === sectionId)
    )),
  ];
  const orderedNodes = orderedNodeIds
    .map((nodeId) => nodes.get(nodeId))
    .filter((node): node is SectionNode => Boolean(node));
  const roots = orderedNodes.filter((node) => !node.parentId || !nodes.has(node.parentId));

  return {
    roots,
    orderedNodeIds: orderedNodes.map((node) => node.id),
    nodesById: Object.fromEntries(orderedNodes.map((node) => [node.id, node])),
  };
}

export function buildTableIndex(input: {
  evidenceDocument: EvidenceDocument;
}): TableIndex {
  const tables: IndexedTable[] = input.evidenceDocument.spans
    .filter((span) => span.blockType === "table")
    .map((span) => {
      const cells: TableCellReference[] = (span.table?.cells ?? []).map((cell) => ({
        evidenceSpanId: span.spanId,
        rowIndex: cell.rowIndex,
        columnIndex: cell.columnIndex,
        text: cell.text,
        normalizedText: cell.normalizedText,
        pageNumber: cell.pageNumber ?? span.page ?? undefined,
        boundingBox: cell.boundingBox,
        sourceTableId: cell.sourceTableId ?? span.table?.tableId,
        sourceBlockId: cell.sourceBlockId ?? span.sourceBlockId,
        parserSource: cell.parserSource ?? span.parserSource,
        sectionId: span.sectionId,
        sectionPath: span.sectionPath,
        heading: span.heading,
        headingPath: span.headingPath,
        confidence: span.confidence,
        limitedProvenance: span.table?.limitedProvenance ?? span.reliability !== "primary",
      }));

      return {
        evidenceSpanId: span.spanId,
        tableId: span.table?.tableId,
        sourceBlockId: span.sourceBlockId,
        parserSource: span.parserSource,
        sectionId: span.sectionId,
        sectionPath: span.sectionPath,
        heading: span.heading,
        headingPath: span.headingPath,
        pageNumbers: uniqueNumbers([span.page, ...cells.map((cell) => cell.pageNumber)]),
        rowCount: span.table?.rowCount,
        columnCount: span.table?.columnCount,
        headerRowCount: span.table?.headerRowCount,
        confidence: span.confidence,
        limitedProvenance: span.table?.limitedProvenance ?? span.reliability !== "primary",
        cells,
      };
    });

  return {
    tables,
    cells: tables.flatMap((table) => table.cells),
    byEvidenceSpanId: Object.fromEntries(tables.map((table) => [table.evidenceSpanId, table])),
    byTableId: Object.fromEntries(
      tables
        .filter((table) => Boolean(table.tableId))
        .map((table) => [table.tableId as string, table]),
    ),
  };
}

function collectTopicReference(input: {
  node: SectionNode;
  searchableText: string;
  topic: SectionTopic;
}): SectionTopicReference | null {
  const patterns = TOPIC_PATTERNS[input.topic];
  const matchedPatterns = patterns.filter((pattern) => pattern.test(input.searchableText));
  if (matchedPatterns.length === 0) return null;

  const headingText = normalizeForSearch(input.node.heading);
  const headingPathText = normalizeForSearch(input.node.headingPath.join(" "));

  let confidence: number;
  if (matchedPatterns.some((pattern) => pattern.test(headingText))) {
    confidence = 0.95;
  } else if (matchedPatterns.some((pattern) => pattern.test(headingPathText))) {
    confidence = 0.88;
  } else {
    confidence = 0.78;
  }

  // Boost headings that match a canonical / highly-specific pattern
  // so they rank above partial matches in the same topic.
  // E.g. "Additionality" beats "Additional Information", and
  // "Baseline Scenario" beats "Baseline Emissions".
  if (confidence >= 0.95) {
    if (
      (input.topic === "additionality" && /\badditionality\b/i.test(headingText))
      || (input.topic === "baseline" && /\bbaseline scenario\b/i.test(headingText))
    ) {
      confidence = 0.97;
    }
  }

  return {
    topic: input.topic,
    sectionId: input.node.sectionId,
    heading: input.node.heading,
    headingPath: input.node.headingPath,
    sectionPath: input.node.sectionPath,
    evidenceSpanIds: input.node.evidenceSpanIds,
    pageNumbers: input.node.pageNumbers,
    confidence,
    reasons: matchedPatterns.map((pattern) => pattern.source),
  };
}

export function buildSectionTopicMap(input: {
  documentStructure: DocumentStructure;
  sectionTree: SectionTree;
}): SectionTopicMap {
  const bodyBySectionId = buildSectionBodyLookup(input.documentStructure);
  const topicMap: SectionTopicMap = {
    baseline: [],
    monitoring: [],
    leakage: [],
    additionality: [],
    methodology: [],
    project_location: [],
    project_participants: [],
    crediting_period: [],
    safeguards: [],
    sdg: [],
  };

  for (const nodeId of input.sectionTree.orderedNodeIds) {
    const node = input.sectionTree.nodesById[nodeId];
    const searchableText = normalizeForSearch([
      node.heading,
      node.headingPath.join(" "),
      node.sectionId ? bodyBySectionId.get(node.sectionId) ?? "" : "",
    ].join(" "));

    for (const topic of Object.keys(TOPIC_PATTERNS) as SectionTopic[]) {
      const match = collectTopicReference({ node, searchableText, topic });
      if (match) topicMap[topic].push(match);
    }
  }

  for (const topic of Object.keys(topicMap) as SectionTopic[]) {
    topicMap[topic].sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      const aPage = a.pageNumbers[0] ?? Number.MAX_SAFE_INTEGER;
      const bPage = b.pageNumbers[0] ?? Number.MAX_SAFE_INTEGER;
      if (aPage !== bPage) return aPage - bPage;
      return a.heading.localeCompare(b.heading);
    });
  }

  return topicMap;
}

export function buildSectionTableIndex(input: {
  documentStructure: DocumentStructure;
  evidenceDocument: EvidenceDocument;
}): SectionTableIndex {
  const sectionTree = buildSectionTree(input);
  return {
    documentFamily: input.documentStructure.documentFamily.family,
    sectionTree,
    tableIndex: buildTableIndex({ evidenceDocument: input.evidenceDocument }),
    sectionTopicMap: buildSectionTopicMap({
      documentStructure: input.documentStructure,
      sectionTree,
    }),
  };
}
