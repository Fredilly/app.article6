import type { ParsedBoundingBox } from "@/lib/documentParsing";

export const SECTION_TOPICS = [
  "baseline",
  "monitoring",
  "leakage",
  "additionality",
  "methodology",
  "project_location",
  "project_participants",
  "crediting_period",
  "safeguards",
  "sdg",
] as const;

export type SectionTopic = (typeof SECTION_TOPICS)[number];

export type SectionPath = string[];

export type SectionNode = {
  id: string;
  parentId?: string;
  sectionId?: string;
  sectionNumber?: string;
  heading: string;
  headingPath: string[];
  sectionPath: SectionPath;
  evidenceSpanIds: string[];
  sourceBlockIds: string[];
  pageNumbers: number[];
  confidence: number;
  children: SectionNode[];
};

export type SectionTree = {
  roots: SectionNode[];
  orderedNodeIds: string[];
  nodesById: Record<string, SectionNode>;
};

export type TableCellReference = {
  evidenceSpanId: string;
  rowIndex: number;
  columnIndex: number;
  text: string;
  normalizedText: string;
  pageNumber?: number;
  boundingBox?: ParsedBoundingBox;
  sourceTableId?: string;
  sourceBlockId?: string;
  parserSource?: string;
  sectionId?: string;
  sectionPath: SectionPath;
  heading?: string;
  headingPath: string[];
  confidence: number;
  limitedProvenance: boolean;
};

export type IndexedTable = {
  evidenceSpanId: string;
  tableId?: string;
  sourceBlockId?: string;
  parserSource?: string;
  sectionId?: string;
  sectionPath: SectionPath;
  heading?: string;
  headingPath: string[];
  pageNumbers: number[];
  rowCount?: number;
  columnCount?: number;
  headerRowCount?: number;
  confidence: number;
  limitedProvenance: boolean;
  cells: TableCellReference[];
};

export type TableIndex = {
  tables: IndexedTable[];
  cells: TableCellReference[];
  byEvidenceSpanId: Record<string, IndexedTable>;
  byTableId: Record<string, IndexedTable>;
};

export type SectionTopicReference = {
  topic: SectionTopic;
  sectionId?: string;
  heading: string;
  headingPath: string[];
  sectionPath: SectionPath;
  evidenceSpanIds: string[];
  pageNumbers: number[];
  confidence: number;
  reasons: string[];
};

export type SectionTopicMap = Record<SectionTopic, SectionTopicReference[]>;

export type SectionTableIndex = {
  sectionTree: SectionTree;
  tableIndex: TableIndex;
  sectionTopicMap: SectionTopicMap;
};
