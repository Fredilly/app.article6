import type { DocumentParserAdapterId, ParsedBlock, ParsedDocument, ParsedHeading, ParsedPage, ParserDiagnostics } from "@/lib/documentParsing";

export type Article6SourceRef = {
  source: string;
  parserAdapterId: DocumentParserAdapterId;
  pageNumber?: number;
  blockId?: string;
  headingId?: string;
  sectionId?: string;
  sectionNumber?: string;
};

export type Article6ExtractionWarning = {
  code: string;
  message: string;
  severity: "info" | "warning";
  sourceRefs: Article6SourceRef[];
};

export type Article6DocumentPage = {
  id: string;
  pageNumber: number;
  rawText: string;
  cleanText: string;
  matchingText: string;
  blockIds: string[];
  sourceRefs: Article6SourceRef[];
};

export type Article6DocumentBlock = {
  id: string;
  type: ParsedBlock["type"];
  rawText: string;
  cleanText: string;
  matchingText: string;
  pageNumber?: number;
  sectionId?: string;
  headingLevel?: number;
  sourceRefs: Article6SourceRef[];
  confidence: number;
};

export type Article6DocumentSection = {
  id: string;
  sectionNumber?: string;
  titleRaw: string;
  titleClean: string;
  titleMatchingText: string;
  bodyRaw: string;
  bodyClean: string;
  bodyMatchingText: string;
  displaySnippet: string;
  matchingText: string;
  parentId?: string;
  childIds: string[];
  blockIds: string[];
  sourceRefs: Article6SourceRef[];
  confidence: number;
  extractionWarnings: string[];
};

export type Article6DocumentModel = {
  id: string;
  source: string;
  parserAdapterId: DocumentParserAdapterId;
  rawText: string;
  cleanText: string;
  matchingText: string;
  pages: Article6DocumentPage[];
  blocks: Article6DocumentBlock[];
  sections: Article6DocumentSection[];
  extractionWarnings: Article6ExtractionWarning[];
  parserDiagnostics?: ParserDiagnostics;
  parserOutput: ParsedDocument;
};

export type BuildArticle6DocumentModelInput = {
  parsedDocument: ParsedDocument;
};

export type ParsedArtifacts = {
  pages: ParsedPage[];
  blocks: ParsedBlock[];
  headings: ParsedHeading[];
};
