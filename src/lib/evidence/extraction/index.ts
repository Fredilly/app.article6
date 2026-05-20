export { runExtraction } from './pipeline';
export { extractPdfFragments } from './pdfExtractor';
export { extractWorkbookFragments } from './workbookExtractor';
export { extractFacts } from './factExtractor';
export { generateCandidateLinks } from './candidateLinker';
export {
  computeInputFingerprint,
  computeFragmentSetFingerprint,
  computeFactSetFingerprint,
  computeLinkSetFingerprint,
} from './provenance';
export type {
  SourceDocument,
  DocumentFragment,
  ExtractedFact,
  CandidateLink,
  ExtractionRun,
  ExtractionInputFingerprint,
  FactType,
  MatchType,
  DocumentKind,
  ExtractionConfig,
} from './types';
