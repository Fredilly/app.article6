import type { DocumentFamily } from "@/lib/documentParsing";
import type { SectionTopic, TableCellReference } from "@/lib/quickCheck/indexing";
import type { ProjectFactContract } from "@/lib/quickCheck/projectFacts/types";

export type ProjectFactId = keyof Omit<ProjectFactContract, "documentFamily" | "documentType" | "warnings">;

export type QueryIntent =
  | "fact_lookup"
  | "section_topic"
  | "table_lookup"
  | "methodology_lookup"
  | "unsupported_or_out_of_scope"
  | "ambiguous";

export type QueryIntentAnalysis = {
  intent: QueryIntent;
  targetFacts: ProjectFactId[];
  targetSections: string[];
  targetTables: string[];
  targetCells: Array<Pick<TableCellReference, "sourceTableId" | "sourceBlockId" | "rowIndex" | "columnIndex" | "text">>;
  positiveTerms: string[];
  negativeTerms: string[];
  calculationSpecific: boolean;
  unsupportedTopic: boolean;
  confidence: number;
  documentFamily?: DocumentFamily;
};

export type QueryIntentAnalyzerInput = {
  query: string;
  sectionTableIndex: {
    documentFamily?: DocumentFamily;
    sectionTree: {
      nodesById: Record<string, {
        sectionId?: string;
        sectionNumber?: string;
        heading: string;
        headingPath: string[];
      }>;
    };
    tableIndex: {
      tables: Array<{
        evidenceSpanId: string;
        tableId?: string;
        heading?: string;
        sectionId?: string;
        cells: Array<{
          sourceTableId?: string;
          sourceBlockId?: string;
          rowIndex: number;
          columnIndex: number;
          text: string;
          normalizedText: string;
        }>;
      }>;
    };
    sectionTopicMap: Record<SectionTopic, Array<{
      sectionId?: string;
      heading: string;
      confidence: number;
      reasons: string[];
    }>>;
  };
};
